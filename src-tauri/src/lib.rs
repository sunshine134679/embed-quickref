use tauri::Manager;

/// 移除无边框窗口的 1px 边框线与原生标题栏样式位。
/// 无边框窗口为保留系统缩放保留了 WS_THICKFRAME，但 tao 创建窗口时还保留了
/// WS_BORDER/WS_DLGFRAME/WS_SYSMENU/WS_MINIMIZEBOX/WS_MAXIMIZEBOX：
/// - WS_BORDER + WS_THICKFRAME 会在窗口边缘画一圈 1px 边框线（圆点态透明时呈"方框"）；
/// - WS_SYSMENU + WS_MINIMIZEBOX + WS_MAXIMIZEBOX + WS_CAPTION 会让 DWM 在窗口
///   获得焦点时绘制原生标题栏（白色条 + 最小化/最大化/关闭三按钮）——圆点态聚焦时
///   窗口顶部出现"白色背景 + 收起/展开/关闭图标"的假象。
/// 展开态这些元素被卡片背景盖住不可见，圆点态窗口透明时全部露出。保留
/// WS_THICKFRAME 维持系统缩放边框（1px 边框线为已知可接受项）。
#[cfg(target_os = "windows")]
fn strip_caption_styles(window: &tauri::Window) {
  #[link(name = "user32")]
  extern "system" {
    fn GetWindowLongW(hwnd: *mut std::ffi::c_void, nindex: i32) -> i32;
    fn SetWindowLongW(hwnd: *mut std::ffi::c_void, nindex: i32, dwnewlong: i32) -> i32;
  }
  const GWL_STYLE: i32 = -16;
  // 1px 边框线
  const WS_BORDER: i32 = 0x0080_0000;
  // 原生标题栏样式位（WS_CAPTION = WS_BORDER | WS_DLGFRAME，全清后标题栏不再绘制）
  const WS_DLGFRAME: i32 = 0x0040_0000;
  const WS_SYSMENU: i32 = 0x0008_0000;
  const WS_MINIMIZEBOX: i32 = 0x0002_0000;
  const WS_MAXIMIZEBOX: i32 = 0x0001_0000;
  const STRIP: i32 = WS_BORDER | WS_DLGFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX;
  if let Ok(hwnd) = window.hwnd() {
    let hwnd = hwnd.0 as *mut std::ffi::c_void;
    let style = unsafe { GetWindowLongW(hwnd, GWL_STYLE) };
    if style & STRIP != 0 {
      unsafe {
        SetWindowLongW(hwnd, GWL_STYLE, style & !STRIP);
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
            // 事件触发时窗口必然已创建：移除 1px 边框线与标题栏样式位（幂等，仅首帧生效）
            #[cfg(target_os = "windows")]
            strip_caption_styles(window);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
