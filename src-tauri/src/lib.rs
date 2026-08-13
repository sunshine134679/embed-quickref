use tauri::Manager;

/// 移除无边框窗口的 1px 边框线。
/// 无边框窗口为保留系统缩放保留了 WS_THICKFRAME，但 WS_BORDER 会在窗口边缘画一圈
/// 1px 边框线——展开态被卡片背景盖住不可见，圆点态窗口透明时该线条呈"方框内部透明"。
#[cfg(target_os = "windows")]
fn remove_border_line(window: &tauri::Window) {
  #[link(name = "user32")]
  extern "system" {
    fn GetWindowLongW(hwnd: *mut std::ffi::c_void, nindex: i32) -> i32;
    fn SetWindowLongW(hwnd: *mut std::ffi::c_void, nindex: i32, dwnewlong: i32) -> i32;
  }
  const GWL_STYLE: i32 = -16;
  const WS_BORDER: i32 = 0x0080_0000;
  if let Ok(hwnd) = window.hwnd() {
    let hwnd = hwnd.0 as *mut std::ffi::c_void;
    let style = unsafe { GetWindowLongW(hwnd, GWL_STYLE) };
    if style & WS_BORDER != 0 {
      unsafe {
        SetWindowLongW(hwnd, GWL_STYLE, style & !WS_BORDER);
      }
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 单实例：重复启动时唤醒已有窗口，而不是创建新进程
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .on_window_event(|window, _event| {
            // 事件触发时窗口必然已创建：移除 1px 边框线（幂等，仅首帧生效）
            #[cfg(target_os = "windows")]
            remove_border_line(window);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
