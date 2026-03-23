mod adb_track;

#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let current = app.package_info().version.to_string();

    let client = reqwest::Client::builder()
        .user_agent("photo-bridge-update-check")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get("https://github.com/nikitadrokin/Photo-Bridge/releases/latest")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let latest = resp
        .url()
        .path_segments()
        .and_then(|s| s.last())
        .unwrap_or("")
        .trim_start_matches('v')
        .to_string();

    if latest.is_empty() || latest == current {
        Ok(None)
    } else {
        Ok(Some(latest))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![check_for_update])
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
