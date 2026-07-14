mod adb_track;
mod tooling;

use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const APP_UPDATE_DOWNLOAD_PROGRESS_EVENT: &str = "app-update://download-progress";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppUpdateResponse {
    status: AppUpdateStatus,
    version: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppUpdateDownloadProgress {
    downloaded: u64,
    total: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
enum AppUpdateStatus {
    Available,
    Prepared,
    UpToDate,
    Restarting,
}

#[derive(Default)]
struct PreparedAppUpdateState {
    update: Mutex<Option<PreparedAppUpdate>>,
}

struct PreparedAppUpdate {
    version: String,
    update: Update,
    bytes: Vec<u8>,
}

#[tauri::command]
fn path_is_directory(path: String) -> Result<bool, String> {
    std::fs::metadata(&path)
        .map(|meta| meta.is_dir())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_app_update(app: AppHandle) -> Result<AppUpdateResponse, String> {
    let update = app
        .updater()
        .map_err(|error| format!("Failed to initialize updater: {error}"))?
        .check()
        .await
        .map_err(|error| format!("Failed to check for updates: {error}"))?;

    match update {
        Some(update) => Ok(AppUpdateResponse {
            status: AppUpdateStatus::Available,
            version: Some(update.version),
        }),
        None => Ok(AppUpdateResponse {
            status: AppUpdateStatus::UpToDate,
            version: None,
        }),
    }
}

#[tauri::command]
async fn prepare_app_update(
    app: AppHandle,
    prepared_update: State<'_, PreparedAppUpdateState>,
) -> Result<AppUpdateResponse, String> {
    let update = app
        .updater()
        .map_err(|error| format!("Failed to initialize updater: {error}"))?
        .check()
        .await
        .map_err(|error| format!("Failed to check for updates: {error}"))?;

    let Some(update) = update else {
        return Ok(AppUpdateResponse {
            status: AppUpdateStatus::UpToDate,
            version: None,
        });
    };

    let version = update.version.clone();
    let mut downloaded: u64 = 0;
    let bytes = update
        .download(
            |chunk_length, content_length| {
                downloaded = downloaded.saturating_add(chunk_length as u64);
                let _ = app.emit(
                    APP_UPDATE_DOWNLOAD_PROGRESS_EVENT,
                    AppUpdateDownloadProgress {
                        downloaded,
                        total: content_length,
                    },
                );
            },
            || {},
        )
        .await
        .map_err(|error| format!("Failed to download update: {error}"))?;

    let mut prepared = prepared_update
        .update
        .lock()
        .map_err(|_| "Failed to lock prepared update state".to_string())?;
    *prepared = Some(PreparedAppUpdate {
        version: version.clone(),
        update,
        bytes,
    });

    Ok(AppUpdateResponse {
        status: AppUpdateStatus::Prepared,
        version: Some(version),
    })
}

#[tauri::command]
async fn install_prepared_app_update(
    app: AppHandle,
    prepared_update: State<'_, PreparedAppUpdateState>,
) -> Result<AppUpdateResponse, String> {
    let prepared = prepared_update
        .update
        .lock()
        .map_err(|_| "Failed to lock prepared update state".to_string())?
        .take()
        .ok_or_else(|| "No prepared update found. Check for updates again.".to_string())?;

    let version = prepared.version;
    let quarantine_target = app_quarantine_target()?;
    prepared
        .update
        .install(prepared.bytes)
        .map_err(|error| format!("Failed to install update: {error}"))?;

    // The new bundle is already on disk at this point. The steps below only
    // harden unsigned/ad-hoc builds against Gatekeeper, so a failure here must
    // not abort before the restart and strand the user in a half-updated state.
    // Report problems via logs and continue to the restart regardless.
    if let Err(error) = clear_installed_app_quarantine(quarantine_target.as_deref()) {
        log::warn!("Failed to clear quarantine on updated app: {error}");
    }
    if let Err(error) = repair_installed_app_signature_if_needed(quarantine_target.as_deref()) {
        log::warn!("Failed to repair signature on updated app: {error}");
    }
    app.request_restart();

    Ok(AppUpdateResponse {
        status: AppUpdateStatus::Restarting,
        version: Some(version),
    })
}

#[cfg(target_os = "macos")]
fn app_quarantine_target() -> Result<Option<PathBuf>, String> {
    current_app_bundle_path().map(Some)
}

#[cfg(not(target_os = "macos"))]
fn app_quarantine_target() -> Result<Option<PathBuf>, String> {
    Ok(None)
}

#[cfg(target_os = "macos")]
fn clear_installed_app_quarantine(app_bundle: Option<&Path>) -> Result<(), String> {
    let app_bundle = app_bundle.ok_or_else(|| "Missing app bundle path".to_string())?;
    let output = std::process::Command::new("/usr/bin/xattr")
        .args(["-cr"])
        .arg(app_bundle)
        .output()
        .map_err(|error| format!("Failed to run xattr: {error}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!(
            "Failed to clear quarantine on `{}`: {}",
            app_bundle.display(),
            if stderr.is_empty() {
                "xattr exited without an error message".to_string()
            } else {
                stderr
            }
        ))
    }
}

#[cfg(not(target_os = "macos"))]
fn clear_installed_app_quarantine(_app_bundle: Option<&Path>) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn repair_installed_app_signature_if_needed(app_bundle: Option<&Path>) -> Result<(), String> {
    let app_bundle = app_bundle.ok_or_else(|| "Missing app bundle path".to_string())?;
    if verify_app_signature(app_bundle) {
        return Ok(());
    }

    // Sign nested code (frameworks, plug-ins, helper/sidecar binaries) before
    // the outer bundle, so the enclosing signature covers valid inner ones.
    let contents_dir = app_bundle.join("Contents");
    for nested_dir in ["Frameworks", "PlugIns", "MacOS"] {
        let dir = contents_dir.join(nested_dir);
        if !dir.exists() {
            continue;
        }
        let entries = fs::read_dir(&dir)
            .map_err(|error| format!("Failed to read `{}`: {error}", dir.display()))?;
        for entry in entries {
            let path = entry.map_err(|error| error.to_string())?.path();
            let metadata = fs::symlink_metadata(&path)
                .map_err(|error| format!("Failed to stat `{}`: {error}", path.display()))?;
            if metadata.file_type().is_symlink() {
                continue;
            }
            ad_hoc_codesign(&path)?;
        }
    }

    ad_hoc_codesign(app_bundle)?;

    if verify_app_signature(app_bundle) {
        Ok(())
    } else {
        Err(format!(
            "Installed app signature still failed verification after ad-hoc signing `{}`",
            app_bundle.display()
        ))
    }
}

#[cfg(not(target_os = "macos"))]
fn repair_installed_app_signature_if_needed(_app_bundle: Option<&Path>) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn verify_app_signature(app_bundle: &Path) -> bool {
    std::process::Command::new("/usr/bin/codesign")
        .args(["--verify", "--deep", "--strict"])
        .arg(app_bundle)
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn ad_hoc_codesign(path: &Path) -> Result<(), String> {
    let output = std::process::Command::new("/usr/bin/codesign")
        .args(["--force", "--sign", "-", "--timestamp=none"])
        .arg(path)
        .output()
        .map_err(|error| format!("Failed to run codesign: {error}"))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!(
            "Failed to ad-hoc sign `{}`: {}",
            path.display(),
            if stderr.is_empty() {
                "codesign exited without an error message".to_string()
            } else {
                stderr
            }
        ))
    }
}

#[cfg(target_os = "macos")]
fn current_app_bundle_path() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    let macos_dir = exe
        .parent()
        .ok_or_else(|| format!("Could not find parent directory for `{}`", exe.display()))?;
    let contents_dir = macos_dir
        .parent()
        .ok_or_else(|| format!("Could not find Contents directory for `{}`", exe.display()))?;
    let app_bundle = contents_dir
        .parent()
        .ok_or_else(|| format!("Could not find app bundle for `{}`", exe.display()))?;

    Ok(app_bundle.to_path_buf())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PreparedAppUpdateState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            path_is_directory,
            check_app_update,
            prepare_app_update,
            install_prepared_app_update,
            tooling::resolve_cli_tools,
            tooling::install_cli_tool
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            adb_track::spawn_tracker(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                adb_track::kill_tracker(app);
            }
        });
}
