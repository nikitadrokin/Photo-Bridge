//! Spawns `adb track-devices` for live USB/ADB device list updates.
//! The ADB client sends a 4-byte ASCII hex length followed by a UTF-8 payload (same text as `adb devices`).

use std::io::Read;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;

const EVENT: &str = "adb-device-state";
const MAX_PAYLOAD_LEN: usize = 256 * 1024;

/// Payload emitted to the webview when the set of attached ADB devices changes.
#[derive(Clone, Serialize)]
pub struct AdbDeviceState {
    /// True when at least one non-header line appears in the device list (matches `check-adb` semantics).
    pub connected: bool,
}

/// Holds the `adb track-devices` child so it can be killed on app shutdown (`SIGINT`/`SIGTERM` paths).
/// **SIGKILL** cannot be handled: the OS terminates the process with no cleanup hook.
pub struct AdbTrackChild(pub Arc<Mutex<Option<Child>>>);

fn prepare_adb_command() -> Command {
    let mut cmd = Command::new("adb");
    if cfg!(target_os = "macos") {
        let path = std::env::var("PATH").unwrap_or_default();
        let augmented = format!("/opt/homebrew/bin:/usr/local/bin:{path}");
        cmd.env("PATH", augmented);
    }
    cmd
}

fn list_has_device_line(payload: &str) -> bool {
    payload.lines().any(|line| {
        let line = line.trim();
        !line.is_empty() && !line.starts_with("List of devices attached")
    })
}

fn read_next_track_message<R: Read>(reader: &mut R) -> std::io::Result<Option<String>> {
    let mut len_buf = [0u8; 4];
    match reader.read_exact(&mut len_buf) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let len_str = std::str::from_utf8(&len_buf).map_err(|e| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string())
    })?;
    let len = usize::from_str_radix(len_str, 16).map_err(|e| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string())
    })?;
    if len > MAX_PAYLOAD_LEN {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "adb track-devices payload too large",
        ));
    }
    if len == 0 {
        return Ok(Some(String::new()));
    }
    let mut body = vec![0u8; len];
    reader.read_exact(&mut body)?;
    Ok(Some(String::from_utf8_lossy(&body).into_owned()))
}

/// Starts `adb track-devices` in a background thread and emits [`EVENT`] on each update.
pub fn spawn_tracker(app: AppHandle) {
    let child_slot: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let slot_for_thread = Arc::clone(&child_slot);
    let app_for_thread = app.clone();

    std::thread::spawn(move || {
        let mut cmd = prepare_adb_command();
        cmd.arg("track-devices")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                log::warn!("adb track-devices: failed to spawn: {e}");
                let _ = app_for_thread.emit(
                    EVENT,
                    AdbDeviceState { connected: false },
                );
                return;
            }
        };

        let stdout = match child.stdout.take() {
            Some(s) => s,
            None => {
                log::warn!("adb track-devices: no stdout");
                let _ = child.kill();
                let _ = child.wait();
                let _ = app_for_thread.emit(
                    EVENT,
                    AdbDeviceState { connected: false },
                );
                return;
            }
        };

        {
            let mut guard = slot_for_thread.lock().expect("adb child mutex poisoned");
            *guard = Some(child);
        }

        let mut reader = stdout;
        loop {
            let msg = match read_next_track_message(&mut reader) {
                Ok(Some(s)) => s,
                Ok(None) => break,
                Err(e) => {
                    log::debug!("adb track-devices read ended: {e}");
                    break;
                }
            };
            let connected = list_has_device_line(&msg);
            if app_for_thread
                .emit(EVENT, AdbDeviceState { connected })
                .is_err()
            {
                break;
            }
        }

        let mut guard = slot_for_thread.lock().expect("adb child mutex poisoned");
        if let Some(mut c) = guard.take() {
            let _ = c.kill();
            let _ = c.wait();
        }
    });

    app.manage(AdbTrackChild(child_slot));
}

/// Terminates the tracker subprocess (normal exit, SIGINT, SIGTERM).
pub fn kill_tracker(app: &AppHandle) {
    let Some(wrapped) = app.try_state::<AdbTrackChild>() else {
        return;
    };
    let mut guard = wrapped.0.lock().expect("adb child mutex poisoned");
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}
