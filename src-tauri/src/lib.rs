// Shared entry point for desktop (main.rs) and Android/iOS (mobile_entry_point).
// The whole app is the web UI in ../src; Rust only hosts it and provides the file dialog
// and file system plugins used by Open, Save and Export DXF, Bluetooth for the laser measure,
// and (on computers) remembering where the window was.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_blec::init());

    // Computers: the window comes back with the size and position it had when the app was last closed
    // (saved on exit), and is always kept inside the screen's work area, so the bottom of the app is
    // never hidden behind the Windows taskbar.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            use tauri::Manager;
            if let Some(w) = app.get_webview_window("main") {
                keep_inside_work_area(&w);
            }
            Ok(())
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running Benchmark Planner");
}

/// Shrinks and moves the window, if needed, so it fits in the visible part of its screen
/// (the screen minus the taskbar / dock). A maximized or full-screen window is left alone.
#[cfg(desktop)]
fn keep_inside_work_area(w: &tauri::WebviewWindow) {
    use tauri::{PhysicalPosition, PhysicalSize};
    if w.is_maximized().unwrap_or(false) || w.is_fullscreen().unwrap_or(false) {
        return;
    }
    let monitor = match w.current_monitor() {
        Ok(Some(m)) => m,
        _ => match w.primary_monitor() {
            Ok(Some(m)) => m,
            _ => return,
        },
    };
    let area = *monitor.work_area();
    let (pos, outer, inner) = match (w.outer_position(), w.outer_size(), w.inner_size()) {
        (Ok(p), Ok(o), Ok(i)) => (p, o, i),
        _ => return,
    };
    let (aw, ah) = (area.size.width, area.size.height);
    let ow = outer.width.min(aw);
    let oh = outer.height.min(ah);
    if ow != outer.width || oh != outer.height {
        // set_size takes the inner size; keep the frame (title bar, borders) out of the sum
        let fw = outer.width.saturating_sub(inner.width);
        let fh = outer.height.saturating_sub(inner.height);
        let _ = w.set_size(PhysicalSize::new(ow.saturating_sub(fw), oh.saturating_sub(fh)));
    }
    let max_x = area.position.x + (aw - ow) as i32;
    let max_y = area.position.y + (ah - oh) as i32;
    let x = pos.x.clamp(area.position.x, max_x.max(area.position.x));
    let y = pos.y.clamp(area.position.y, max_y.max(area.position.y));
    if x != pos.x || y != pos.y {
        let _ = w.set_position(PhysicalPosition::new(x, y));
    }
}
