// Shared entry point for desktop (main.rs) and Android/iOS (mobile_entry_point).
// The whole app is the web UI in ../src; Rust only hosts it and provides the file dialog
// and file system plugins used by Open, Save and Export DXF, and Bluetooth for the laser measure.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_blec::init())
        .run(tauri::generate_context!())
        .expect("error while running Benchmark Planner");
}
