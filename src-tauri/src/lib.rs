use tauri::{AppHandle, Manager, PhysicalPosition};
use std::sync::Mutex;

// Windows 前台窗口 FFI：快捷窗弹出时"借用"焦点（记录原前台窗口），收起时归还，
// 避免快捷窗反复抢走用户正在使用的应用（如编辑器/播放器）的键盘焦点
#[cfg(windows)]
unsafe extern "system" {
    fn GetForegroundWindow() -> isize;
    fn SetForegroundWindow(hwnd: isize) -> i32;
}

// 焦点借用记录：弹出抢焦点前的 OS 前台窗口句柄
struct QuickFocusState(Mutex<isize>);
impl Default for QuickFocusState {
    fn default() -> Self {
        Self(Mutex::new(0))
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
        .manage(QuickFocusState::default())
        .invoke_handler(tauri::generate_handler![show_quick, hide_quick])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 快捷查找窗口：显示在悬浮圆点旁（默认右侧，越界翻到左侧/上移），物理像素定位
const QUICK_W: f64 = 440.0;
const QUICK_H: f64 = 240.0; // 与 tauri.conf.json quick 窗口尺寸保持一致
const DOT_W: f64 = 64.0;
const GAP: f64 = 10.0;

#[tauri::command]
fn show_quick(app: AppHandle, x: f64, y: f64, focus: bool) -> Result<(), String> {
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
    // 记录显示前可见性与焦点：focus=false（隐藏冷却期内重新弹出）不抢焦点；
    // 否则仅"从隐藏到显示"或"已可见但未聚焦"时抢 OS 键盘焦点（hover 即输）
    let was_visible = quick.is_visible().map_err(|e| e.to_string())?;
    let was_focused = quick.is_focused().map_err(|e| e.to_string())?;
    quick.show().map_err(|e| e.to_string())?;
    if focus && (!was_visible || !was_focused) {
        // 记录焦点"借用"前的 OS 前台窗口（hide_quick 时归还），
        // 防止快捷窗反复抢走用户正在使用的应用的键盘焦点
        #[cfg(windows)]
        {
            let prev = unsafe { GetForegroundWindow() };
            if prev != 0 {
                *app.state::<QuickFocusState>().0.lock().unwrap() = prev;
            }
        }
        quick.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn hide_quick(app: AppHandle) -> Result<(), String> {
    let quick = app.get_webview_window("quick").ok_or("no quick window")?;
    quick.hide().map_err(|e| e.to_string())?;
    // 归还焦点：仅当 OS 前台仍是快捷窗时，把键盘焦点还给弹出前借用的窗口
    // （用户已点击其他窗口则不打扰）
    #[cfg(windows)]
    {
        let fg = unsafe { GetForegroundWindow() };
        if fg != 0 {
            if let Ok(hwnd) = quick.hwnd() {
                if fg == hwnd.0 as isize {
                    let prev = *app.state::<QuickFocusState>().0.lock().unwrap();
                    if prev != 0 && prev != fg {
                        unsafe { SetForegroundWindow(prev) };
                    }
                }
            }
        }
    }
    Ok(())
}
