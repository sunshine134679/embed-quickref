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
        .invoke_handler(tauri::generate_handler![show_quick, hide_quick, secret_protect, secret_reveal, exit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 退出整个应用，而不是只销毁当前窗口；托盘图标和 quick 窗口也必须随应用一并结束。
#[tauri::command]
fn exit_app(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
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
    let monitor = main
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("no monitor")?;
    // 使用目标显示器的缩放比例。主窗口刚跨屏移动时，main.scale_factor() 可能仍是旧屏幕比例，
    // 会导致快捷窗的物理尺寸和定位偏移，表现为与圆点重叠或部分出屏。
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let area_x = area.position.x as f64;
    let area_y = area.position.y as f64;
    let area_w = area.size.width as f64;
    let area_h = area.size.height as f64;

    let dot = DOT_W * scale;
    let gap = GAP * scale;
    let qw = QUICK_W * scale;
    let qh = QUICK_H * scale;
    let right_x = x + dot + gap;
    let left_x = x - qw - gap;
    let max_x = (area_x + area_w - qw).max(area_x);
    let qx = if right_x + qw <= area_x + area_w {
        right_x
    } else if left_x >= area_x {
        left_x
    } else {
        // 两侧都放不下时居中，保证快捷窗完整可见，不覆盖圆点作为唯一 fallback。
        (area_x + (area_w - qw) / 2.0).clamp(area_x, max_x)
    };
    // 垂直方向以圆点中心对齐，再按工作区钳制；比顶边对齐更不容易遮住原应用关键区域。
    let max_y = (area_y + area_h - qh).max(area_y);
    let qy = (y + (dot - qh) / 2.0).clamp(area_y, max_y);
    quick
        .set_position(PhysicalPosition::new(qx.max(area_x), qy.max(area_y)))
        .map_err(|e| e.to_string())?;
    // 记录显示前可见性与焦点：focus=false（隐藏冷却期内重新弹出）不抢焦点；
    // 否则仅"从隐藏到显示"或"已可见但未聚焦"时抢 OS 键盘焦点（hover 即输）
    let was_visible = quick.is_visible().map_err(|e| e.to_string())?;
    let was_focused = quick.is_focused().map_err(|e| e.to_string())?;
    let steal_focus = focus && (!was_visible || !was_focused);
    // 借用记录必须在 show() 之前：tao 对普通窗口用 SW_SHOW 显示（本身会激活窗口，
    // 见 tao window_state.rs），show 之后再取前台句柄可能拿到快捷窗自己，
    // 归还时 prev == fg 恒不成立、焦点归还静默失效
    if steal_focus {
        #[cfg(windows)]
        {
            let prev = unsafe { GetForegroundWindow() };
            if prev != 0 {
                *app.state::<QuickFocusState>().0.lock().unwrap() = prev;
            }
        }
    }
    quick.show().map_err(|e| e.to_string())?;
    if steal_focus {
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

// ---------- 秘密字段本地加密（Windows DPAPI，当前用户作用域） ----------
// API Key 等经此加密后落盘为 "dpapi:<base64>"，非 Windows 平台直通（本项目仅 Windows）。
// JS 侧负责前缀判定与迁移，这里只做纯编解码。无新依赖：crypt32/kernel32 为系统库。

fn b64_encode(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        out.push(T[(b[0] >> 2) as usize] as char);
        out.push(T[(((b[0] & 0x03) << 4) | (b[1] >> 4)) as usize] as char);
        out.push(if chunk.len() > 1 {
            T[(((b[1] & 0x0F) << 2) | (b[2] >> 6)) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 { T[(b[2] & 0x3F) as usize] as char } else { '=' });
    }
    out
}

fn b64_val(c: u8) -> Option<u8> {
    match c {
        b'A'..=b'Z' => Some(c - b'A'),
        b'a'..=b'z' => Some(c - b'a' + 26),
        b'0'..=b'9' => Some(c - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

fn b64_decode(s: &str) -> Option<Vec<u8>> {
    let mut acc: u32 = 0;
    let mut bits: u32 = 0;
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    for &c in s.as_bytes() {
        if c == b'=' {
            break;
        }
        let v = b64_val(c)?;
        acc = (acc << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    Some(out)
}

#[cfg(windows)]
mod dpapi {
    use std::ffi::c_void;
    use std::ptr;

    #[repr(C)]
    struct Blob {
        cb: u32,
        data: *mut u8,
    }

    const UI_FORBIDDEN: u32 = 0x1;
    // 应用专属熵：同用户下只有本应用知道，其他程序即使拿到 blob 也解不开
    const ENTROPY: &[u8] = b"com.mr.embed-quickref secret v1";

    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(
            data_in: *const Blob,
            descr: *const u16,
            entropy: *const Blob,
            reserved: *const c_void,
            prompt: *const c_void,
            flags: u32,
            data_out: *mut Blob,
        ) -> i32;
        fn CryptUnprotectData(
            data_in: *const Blob,
            descr_out: *mut *mut u16,
            entropy: *const Blob,
            reserved: *const c_void,
            prompt: *const c_void,
            flags: u32,
            data_out: *mut Blob,
        ) -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn LocalFree(mem: *mut c_void) -> *mut c_void;
    }

    fn blob_from_bytes(bytes: &[u8]) -> Blob {
        Blob {
            cb: bytes.len() as u32,
            data: bytes.as_ptr() as *mut u8,
        }
    }
    fn entropy_blob() -> Blob {
        blob_from_bytes(ENTROPY)
    }
    fn take_bytes(b: &mut Blob) -> Vec<u8> {
        if b.data.is_null() || b.cb == 0 {
            return Vec::new();
        }
        let v = unsafe { std::slice::from_raw_parts(b.data, b.cb as usize) }.to_vec();
        unsafe { LocalFree(b.data as *mut c_void) };
        b.data = ptr::null_mut();
        v
    }

    pub fn protect(plain: &str) -> Option<String> {
        let mut out = Blob { cb: 0, data: ptr::null_mut() };
        let ent = entropy_blob();
        let ok = unsafe {
            CryptProtectData(
                &blob_from_bytes(plain.as_bytes()),
                ptr::null(),
                &ent,
                ptr::null(),
                ptr::null(),
                UI_FORBIDDEN,
                &mut out,
            )
        };
        if ok == 0 {
            return None;
        }
        Some(super::b64_encode(&take_bytes(&mut out)))
    }

    pub fn reveal(encoded: &str) -> Option<String> {
        let bytes = super::b64_decode(encoded)?;
        let mut out = Blob { cb: 0, data: ptr::null_mut() };
        let ent = entropy_blob();
        let ok = unsafe {
            CryptUnprotectData(
                &blob_from_bytes(&bytes),
                ptr::null_mut(),
                &ent,
                ptr::null(),
                ptr::null(),
                UI_FORBIDDEN,
                &mut out,
            )
        };
        if ok == 0 {
            return None;
        }
        String::from_utf8(take_bytes(&mut out)).ok()
    }
}

// API Key 等秘密字段加密/解密命令（Windows DPAPI 当前用户作用域；非 Windows 直通）
#[tauri::command]
fn secret_protect(plain: String) -> Result<String, String> {
    #[cfg(windows)]
    {
        dpapi::protect(&plain).ok_or_else(|| "DPAPI 加密失败".to_string())
    }
    #[cfg(not(windows))]
    {
        Ok(plain)
    }
}

#[tauri::command]
fn secret_reveal(blob: String) -> Result<String, String> {
    #[cfg(windows)]
    {
        dpapi::reveal(&blob).ok_or_else(|| "DPAPI 解密失败".to_string())
    }
    #[cfg(not(windows))]
    {
        Ok(blob)
    }
}
