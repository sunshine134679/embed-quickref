use tauri::{AppHandle, Manager, PhysicalPosition};

#[cfg(target_os = "windows")]
fn strip_caption_hwnd(hwnd: *mut std::ffi::c_void) {
  #[link(name = "user32")]
  extern "system" {
    fn GetWindowLongW(hwnd: *mut std::ffi::c_void, nindex: i32) -> i32;
    fn SetWindowLongW(hwnd: *mut std::ffi::c_void, nindex: i32, dwnewlong: i32) -> i32;
  }
  const GWL_STYLE: i32 = -16;
  // 原生标题栏样式位（WS_CAPTION = WS_BORDER | WS_DLGFRAME，全清后标题栏不再绘制）
  const WS_BORDER: i32 = 0x0080_0000;
  const WS_DLGFRAME: i32 = 0x0040_0000;
  const WS_SYSMENU: i32 = 0x0008_0000;
  const WS_MINIMIZEBOX: i32 = 0x0002_0000;
  const WS_MAXIMIZEBOX: i32 = 0x0001_0000;
  const STRIP: i32 = WS_BORDER | WS_DLGFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX;
  let style = unsafe { GetWindowLongW(hwnd, GWL_STYLE) };
  if style & STRIP != 0 {
    unsafe {
      SetWindowLongW(hwnd, GWL_STYLE, style & !STRIP);
    }
  }
}

/// 移除无边框窗口的原生标题栏样式位。
/// 无边框窗口为保留系统缩放保留了 WS_THICKFRAME，但 tao 创建窗口时还保留了
/// WS_BORDER/WS_DLGFRAME/WS_SYSMENU/WS_MINIMIZEBOX/WS_MAXIMIZEBOX：
/// - WS_BORDER + WS_THICKFRAME 会在窗口边缘画一圈 1px 边框线（透明窗口上呈"方框"）；
/// - WS_SYSMENU + WS_MINIMIZEBOX + WS_MAXIMIZEBOX + WS_CAPTION 会让 DWM 在窗口
///   获得焦点时绘制原生标题栏（白色条 + 最小化/最大化/关闭三按钮）。
/// 展开态这些元素被卡片背景盖住不可见，圆点态/收起动画中窗口透明时全部露出。
/// 保留 WS_THICKFRAME 维持系统缩放边框。
#[cfg(target_os = "windows")]
fn strip_caption_styles(window: &tauri::Window) {
  if let Ok(hwnd) = window.hwnd() {
    strip_caption_hwnd(hwnd.0 as *mut std::ffi::c_void);
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
        .on_window_event(|window, event| {
            // 事件触发时窗口必然已创建：移除原生标题栏样式位（幂等）
            #[cfg(target_os = "windows")]
            strip_caption_styles(window);
            // 收起/展开动画会 setSize/setPosition，DWM 随后异步重绘 frame 时可能恢复
            // 样式位——延迟再 strip 一次兜底（动画 220ms，120ms 足够覆盖 DWM 重绘）
            #[cfg(target_os = "windows")]
            if matches!(event, tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_)) {
                let hwnd = window.hwnd().ok().map(|h| h.0 as isize);
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(120));
                    if let Some(hwnd) = hwnd {
                        strip_caption_hwnd(hwnd as *mut std::ffi::c_void);
                    }
                });
            }
        })
        .invoke_handler(tauri::generate_handler![show_quick, hide_quick, strip_window_styles])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 快捷查找窗口：显示在悬浮圆点旁（默认右侧，越界翻到左侧/上移），物理像素定位
const QUICK_W: f64 = 440.0;
const QUICK_H: f64 = 300.0;
const DOT_W: f64 = 64.0;
const GAP: f64 = 10.0;

#[tauri::command]
fn show_quick(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    let quick = app.get_webview_window("quick").ok_or("no quick window")?;
    let main = app.get_webview_window("main").ok_or("no main window")?;
    // 主窗口可能仍处于展开态（hover 触发时圆点刚挂载），以传入的圆点位置为准
    let scale = main.scale_factor().map_err(|e| e.to_string())?;
    let monitor = main
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("no monitor")?;
    let area = monitor.work_area();
    let area_x = area.position.x as f64;
    let area_y = area.position.y as f64;
    let area_w = area.size.width as f64;
    let area_h = area.size.height as f64;

    let qw = QUICK_W * scale;
    let qh = QUICK_H * scale;
    let mut qx = x + (DOT_W + GAP) * scale;
    if qx + qw > area_x + area_w {
        qx = x - (QUICK_W + GAP) * scale; // 右侧放不下，翻到左侧
    }
    let mut qy = y;
    if qy + qh > area_y + area_h {
        qy = area_y + area_h - qh;
    }
    quick
        .set_position(PhysicalPosition::new(qx.max(area_x), qy.max(area_y)))
        .map_err(|e| e.to_string())?;
    quick.show().map_err(|e| e.to_string())?;
    quick.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
fn hide_quick(app: AppHandle) -> Result<(), String> {
    let quick = app.get_webview_window("quick").ok_or("no quick window")?;
    quick.hide().map_err(|e| e.to_string())
}

// 前端在收起/展开动画的关键时机主动清除标题栏样式位：
// clearEffects/setEffects 可能恢复样式且不触发 Resized/Moved 事件，延迟 strip 无法覆盖
#[tauri::command]
fn strip_window_styles(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(win) = app.get_webview_window("main") {
            if let Ok(hwnd) = win.hwnd() {
                strip_caption_hwnd(hwnd.0 as *mut std::ffi::c_void);
            }
        }
    }
    Ok(())
}
