//! Detection and one-click installation of the CLI tools Photo Bridge shells
//! out to (ffmpeg, ffprobe, exiftool, adb).
//!
//! Resolution order for each tool:
//!   1. App-managed copy under `<app_data_dir>/bin/<id>/…` (what we installed).
//!   2. A copy already on the user's PATH (Homebrew, manual install, …).
//!   3. Otherwise: missing → offer a 1-click install.
//!
//! Installation downloads a prebuilt archive, verifies its SHA-256 (when a hash
//! is pinned), extracts it into app-managed storage, strips the macOS quarantine
//! flag, ad-hoc re-signs binaries that need it, and marks them executable.

use std::path::{Path, PathBuf};
use std::process::Command as StdCommand;

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};

/// Host CPU architecture, used to pick the right artifact.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Arch {
    Arm64,
    X86_64,
}

fn host_arch() -> Arch {
    if cfg!(target_arch = "aarch64") {
        Arch::Arm64
    } else {
        Arch::X86_64
    }
}

/// How a downloaded archive is packed.
#[derive(Clone, Copy)]
enum ArchiveKind {
    Zip,
    TarGz,
}

/// One downloadable artifact for a specific architecture.
struct Artifact {
    url: &'static str,
    /// Pinned SHA-256 (lowercase hex). `None` for rolling-latest sources
    /// (e.g. Google's platform-tools) where no stable hash is published.
    sha256: Option<&'static str>,
    /// When true, fetch a `<final-url>.sha256` sidecar (after redirects) and
    /// verify against it. Lets a rolling-latest source stay checksummed without
    /// a pin that goes stale on every upstream rebuild.
    sha256_sidecar: bool,
    kind: ArchiveKind,
    /// Path of the executable inside the extracted archive, relative to the
    /// tool's install dir. For single-binary zips this is just the binary name.
    bin_rel_path: &'static str,
}

/// Static definition of a tool plus its per-arch artifacts.
struct ToolManifest {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    /// Bare binary name to look for on PATH (e.g. `ffmpeg`).
    bin_name: &'static str,
    /// Argument that makes the tool print its version (parsed loosely).
    version_arg: &'static str,
    /// Whether extracted binaries need an ad-hoc codesign on Apple Silicon.
    needs_codesign: bool,
    arm64: Artifact,
    x86_64: Artifact,
}

impl ToolManifest {
    fn artifact(&self) -> &Artifact {
        match host_arch() {
            Arch::Arm64 => &self.arm64,
            Arch::X86_64 => &self.x86_64,
        }
    }
}

/// The four tools Photo Bridge depends on.
///
/// Sources: ffmpeg/ffprobe from ffmpeg.martin-riedl.de — per-arch static
/// builds behind a stable `latest/release` redirect, each with a `.sha256`
/// sidecar we verify dynamically (so upstream rebuilds never break the pin).
/// exiftool from the official versioned tarball (runs in place via system
/// Perl), adb from Google's canonical latest platform-tools.
const MANIFESTS: &[ToolManifest] = &[
    ToolManifest {
        id: "ffmpeg",
        name: "FFmpeg",
        description: "Convert and transcode video files.",
        bin_name: "ffmpeg",
        version_arg: "-version",
        needs_codesign: true,
        arm64: Artifact {
            url: "https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip",
            sha256: None,
            sha256_sidecar: true,
            kind: ArchiveKind::Zip,
            bin_rel_path: "ffmpeg",
        },
        x86_64: Artifact {
            url: "https://ffmpeg.martin-riedl.de/redirect/latest/macos/amd64/release/ffmpeg.zip",
            sha256: None,
            sha256_sidecar: true,
            kind: ArchiveKind::Zip,
            bin_rel_path: "ffmpeg",
        },
    },
    ToolManifest {
        id: "ffprobe",
        name: "FFprobe",
        description: "Read video metadata during conversion.",
        bin_name: "ffprobe",
        version_arg: "-version",
        needs_codesign: true,
        arm64: Artifact {
            url: "https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffprobe.zip",
            sha256: None,
            sha256_sidecar: true,
            kind: ArchiveKind::Zip,
            bin_rel_path: "ffprobe",
        },
        x86_64: Artifact {
            url: "https://ffmpeg.martin-riedl.de/redirect/latest/macos/amd64/release/ffprobe.zip",
            sha256: None,
            sha256_sidecar: true,
            kind: ArchiveKind::Zip,
            bin_rel_path: "ffprobe",
        },
    },
    ToolManifest {
        id: "exiftool",
        name: "ExifTool",
        description: "Read and write photo and video metadata.",
        bin_name: "exiftool",
        version_arg: "-ver",
        needs_codesign: false,
        // Architecture-independent: a Perl script + lib/, run via system Perl.
        arm64: Artifact {
            url: "https://sourceforge.net/projects/exiftool/files/Image-ExifTool-13.59.tar.gz/download",
            sha256: Some("668ea3acececb7235fbd0f4900e72d5f12c9b07e5c778fd36cb1e9b5828fd65a"),
            sha256_sidecar: false,
            kind: ArchiveKind::TarGz,
            bin_rel_path: "Image-ExifTool-13.59/exiftool",
        },
        x86_64: Artifact {
            url: "https://sourceforge.net/projects/exiftool/files/Image-ExifTool-13.59.tar.gz/download",
            sha256: Some("668ea3acececb7235fbd0f4900e72d5f12c9b07e5c778fd36cb1e9b5828fd65a"),
            sha256_sidecar: false,
            kind: ArchiveKind::TarGz,
            bin_rel_path: "Image-ExifTool-13.59/exiftool",
        },
    },
    ToolManifest {
        id: "adb",
        name: "ADB",
        description: "Transfer files to and from a connected Pixel.",
        bin_name: "adb",
        version_arg: "version",
        needs_codesign: false,
        // Google publishes only a rolling "latest" URL with no stable hash;
        // the universal binary covers both architectures.
        arm64: Artifact {
            url: "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip",
            sha256: None,
            sha256_sidecar: false,
            kind: ArchiveKind::Zip,
            bin_rel_path: "platform-tools/adb",
        },
        x86_64: Artifact {
            url: "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip",
            sha256: None,
            sha256_sidecar: false,
            kind: ArchiveKind::Zip,
            bin_rel_path: "platform-tools/adb",
        },
    },
];

fn manifest(id: &str) -> Option<&'static ToolManifest> {
    MANIFESTS.iter().find(|m| m.id == id)
}

/// Extracted archive contents for a tool: `<app_data_dir>/tools/<id>`.
fn tool_dir(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    Ok(base.join("tools").join(id))
}

/// Stable, version-independent entrypoint for a tool:
/// `<app_data_dir>/bin/<id>`. This is a symlink to the real executable inside
/// `tool_dir`, kept at a predictable path so the `pb` CLI can resolve
/// app-managed tools without knowing each archive's internal layout.
fn bin_link(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data dir: {e}"))?;
    Ok(base.join("bin").join(id))
}

/// Full path to the app-managed executable, if it exists on disk. Follows the
/// `bin/<id>` symlink; `is_file` returns true only when its target resolves.
fn app_managed_bin(app: &AppHandle, m: &ToolManifest) -> Option<PathBuf> {
    let path = bin_link(app, m.id).ok()?;
    path.is_file().then_some(path)
}

/// Search PATH (augmented with common macOS locations that GUI apps don't
/// inherit) for the tool's binary.
fn path_bin(m: &ToolManifest) -> Option<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Ok(path) = std::env::var("PATH") {
        dirs.extend(std::env::split_paths(&path));
    }
    // GUI apps launched from Finder get a minimal PATH without Homebrew.
    for extra in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"] {
        let p = PathBuf::from(extra);
        if !dirs.contains(&p) {
            dirs.push(p);
        }
    }
    dirs.into_iter()
        .map(|d| d.join(m.bin_name))
        .find(|p| p.is_file())
}

/// Run `<bin> <version_arg>` and return the first non-empty line, trimmed.
fn detect_version(bin: &Path, m: &ToolManifest) -> Option<String> {
    let out = StdCommand::new(bin).arg(m.version_arg).output().ok()?;
    let text = if out.stdout.is_empty() {
        String::from_utf8_lossy(&out.stderr)
    } else {
        String::from_utf8_lossy(&out.stdout)
    };
    let first = text.lines().find(|l| !l.trim().is_empty())?.trim();
    // ffmpeg prints "ffmpeg version 8.1 …"; keep it readable but short.
    Some(
        first
            .strip_prefix(&format!("{} version ", m.bin_name))
            .unwrap_or(first)
            .split_whitespace()
            .next()
            .unwrap_or(first)
            .to_string(),
    )
}

/// Resolved status for one tool, serialized to the settings UI.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliToolStatus {
    id: String,
    name: String,
    description: String,
    /// `"system"`, `"app"`, or `"missing"`.
    source: String,
    resolved_path: Option<String>,
    version: Option<String>,
    /// True when we can install this tool (always true today).
    installable: bool,
}

/// Detect every tool and report where each resolves from.
#[tauri::command]
pub fn resolve_cli_tools(app: AppHandle) -> Vec<CliToolStatus> {
    MANIFESTS
        .iter()
        .map(|m| {
            let (source, path) = if let Some(p) = app_managed_bin(&app, m) {
                ("app", Some(p))
            } else if let Some(p) = path_bin(m) {
                ("system", Some(p))
            } else {
                ("missing", None)
            };

            let version = path.as_deref().and_then(|p| detect_version(p, m));

            CliToolStatus {
                id: m.id.to_string(),
                name: m.name.to_string(),
                description: m.description.to_string(),
                source: source.to_string(),
                resolved_path: path.map(|p| p.to_string_lossy().into_owned()),
                version,
                installable: true,
            }
        })
        .collect()
}

/// Progress update streamed to the UI during an install.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallProgress {
    id: String,
    /// `"downloading" | "verifying" | "extracting" | "finalizing" | "done"`.
    phase: String,
    message: String,
}

fn emit_progress(app: &AppHandle, id: &str, phase: &str, message: &str) {
    let _ = app.emit(
        "cli-tool-install-progress",
        InstallProgress {
            id: id.to_string(),
            phase: phase.to_string(),
            message: message.to_string(),
        },
    );
}

/// Fetch the `<url>.sha256` sidecar and return the expected lowercase-hex
/// digest. The file is the usual `shasum` format: `<hex>  <filename>`.
async fn fetch_sidecar_sha256(
    client: &reqwest::Client,
    url: &reqwest::Url,
) -> Result<String, String> {
    let sidecar = format!("{url}.sha256");
    let text = client
        .get(&sidecar)
        .send()
        .await
        .map_err(|e| format!("fetch checksum: {e}"))?
        .error_for_status()
        .map_err(|e| format!("fetch checksum: {e}"))?
        .text()
        .await
        .map_err(|e| format!("read checksum: {e}"))?;
    text.split_whitespace()
        .next()
        .map(str::to_string)
        .ok_or_else(|| "empty checksum sidecar".to_string())
}

fn verify_sha256(bytes: &[u8], expected: &str) -> Result<(), String> {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let actual = hex_lower(&hasher.finalize());
    if actual.eq_ignore_ascii_case(expected) {
        Ok(())
    } else {
        Err(format!(
            "checksum mismatch: expected {expected}, got {actual}"
        ))
    }
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

fn extract_zip(bytes: &[u8], dest: &Path) -> Result<(), String> {
    let reader = std::io::Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("open zip: {e}"))?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("zip entry: {e}"))?;
        let Some(rel) = file.enclosed_name() else {
            continue; // skip unsafe paths (zip-slip guard)
        };
        let out = dest.join(rel);
        if file.is_dir() {
            std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut writer = std::fs::File::create(&out).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut writer).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        if let Some(mode) = file.unix_mode() {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&out, std::fs::Permissions::from_mode(mode))
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn extract_tar_gz(bytes: &[u8], dest: &Path) -> Result<(), String> {
    let decoder = flate2::read::GzDecoder::new(std::io::Cursor::new(bytes));
    let mut archive = tar::Archive::new(decoder);
    archive.set_preserve_permissions(true);
    archive
        .unpack(dest)
        .map_err(|e| format!("unpack tar.gz: {e}"))
}

#[cfg(unix)]
fn make_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = std::fs::metadata(path).map_err(|e| e.to_string())?.permissions();
    perms.set_mode(perms.mode() | 0o755);
    std::fs::set_permissions(path, perms).map_err(|e| e.to_string())
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

/// Strip the macOS quarantine attribute so Gatekeeper won't block execution of
/// a freshly downloaded binary. Best-effort: ignored on non-macOS.
fn strip_quarantine(dir: &Path) {
    let _ = StdCommand::new("xattr")
        .args(["-dr", "com.apple.quarantine"])
        .arg(dir)
        .output();
}

/// Ad-hoc codesign a binary (`codesign -s -`). Required for the static
/// ffmpeg/ffprobe builds on Apple Silicon. Best-effort.
fn ad_hoc_codesign(bin: &Path) -> Result<(), String> {
    let out = StdCommand::new("codesign")
        .args(["--force", "--sign", "-"])
        .arg(bin)
        .output()
        .map_err(|e| format!("codesign: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!(
            "codesign failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ))
    }
}

/// Download, verify, extract, and finalize one tool into app-managed storage.
/// Returns the resolved binary path on success.
#[tauri::command]
pub async fn install_cli_tool(app: AppHandle, id: String) -> Result<String, String> {
    let m = manifest(&id).ok_or_else(|| format!("unknown tool: {id}"))?;
    let artifact = m.artifact();
    let dir = tool_dir(&app, &id)?;

    // Download.
    emit_progress(&app, &id, "downloading", &format!("Downloading {}…", m.name));
    let client = reqwest::Client::builder()
        .user_agent("photo-bridge-tool-installer")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(artifact.url)
        .send()
        .await
        .map_err(|e| format!("download failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("download failed: {e}"))?;
    // Capture the post-redirect URL so we can find the matching `.sha256` sidecar.
    let final_url = resp.url().clone();
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("read body: {e}"))?
        .to_vec();

    // Verify: prefer a pinned hash; otherwise fetch the `.sha256` sidecar that
    // sits next to the (redirect-resolved) artifact and verify against it.
    if let Some(expected) = artifact.sha256 {
        emit_progress(&app, &id, "verifying", "Verifying checksum…");
        verify_sha256(&bytes, expected)?;
    } else if artifact.sha256_sidecar {
        emit_progress(&app, &id, "verifying", "Verifying checksum…");
        let expected = fetch_sidecar_sha256(&client, &final_url).await?;
        verify_sha256(&bytes, &expected)?;
    }

    // Stage the install in a sibling temp dir, then atomically swap it in only
    // once everything succeeds. This way a failure never wipes a previously
    // working app-managed copy, and leaves no half-written dir behind.
    let staging = dir.with_extension("installing");
    let outcome = stage_install(&app, &id, m, artifact, &bytes, &staging, &dir);
    if outcome.is_err() {
        // Roll back whatever the failed attempt wrote.
        let _ = std::fs::remove_dir_all(&staging);
    }
    outcome
}

/// Download-independent half of an install: unpack `bytes` into `staging`,
/// finalize the binary, swap `staging` into place at `dir`, and publish the
/// `bin/<id>` symlink. Any `Err` here leaves the live `dir` untouched and is
/// cleaned up by the caller.
fn stage_install(
    app: &AppHandle,
    id: &str,
    m: &ToolManifest,
    artifact: &Artifact,
    bytes: &[u8],
    staging: &Path,
    dir: &Path,
) -> Result<String, String> {
    // Extract into a clean staging directory.
    emit_progress(app, id, "extracting", "Extracting…");
    if staging.exists() {
        std::fs::remove_dir_all(staging).map_err(|e| format!("clear staging dir: {e}"))?;
    }
    std::fs::create_dir_all(staging).map_err(|e| format!("create staging dir: {e}"))?;
    match artifact.kind {
        ArchiveKind::Zip => extract_zip(bytes, staging)?,
        ArchiveKind::TarGz => extract_tar_gz(bytes, staging)?,
    }

    // Finalize: de-quarantine, mark executable, ad-hoc sign if needed.
    emit_progress(app, id, "finalizing", "Finalizing…");
    let staged_bin = staging.join(artifact.bin_rel_path);
    if !staged_bin.is_file() {
        return Err(format!(
            "expected binary not found after extract: {}",
            staged_bin.display()
        ));
    }
    strip_quarantine(staging);
    make_executable(&staged_bin)?;
    if m.needs_codesign && host_arch() == Arch::Arm64 {
        ad_hoc_codesign(&staged_bin)?;
    }

    // Swap staging into place: only now do we touch the live install dir.
    if dir.exists() {
        std::fs::remove_dir_all(dir).map_err(|e| format!("clear install dir: {e}"))?;
    }
    if let Some(parent) = dir.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create tools dir: {e}"))?;
    }
    std::fs::rename(staging, dir).map_err(|e| format!("activate install: {e}"))?;

    // Publish a stable `bin/<id>` symlink the CLI can resolve.
    let bin = dir.join(artifact.bin_rel_path);
    let link = bin_link(app, id)?;
    if let Some(parent) = link.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("create bin dir: {e}"))?;
    }
    // Replace any stale link/file from a previous install.
    let _ = std::fs::remove_file(&link);
    #[cfg(unix)]
    std::os::unix::fs::symlink(&bin, &link).map_err(|e| format!("link binary: {e}"))?;
    #[cfg(not(unix))]
    std::fs::copy(&bin, &link).map(|_| ()).map_err(|e| format!("link binary: {e}"))?;

    emit_progress(app, id, "done", &format!("{} ready", m.name));
    Ok(link.to_string_lossy().into_owned())
}
