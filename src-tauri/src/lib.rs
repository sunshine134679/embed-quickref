use tauri::{AppHandle, Manager, PhysicalPosition};
use std::process::Command;
use std::sync::Mutex;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// Windows 前台窗口 FFI：快捷窗弹出时"借用"焦点（记录原前台窗口），收起时归还，
// 避免快捷窗反复抢走用户正在使用的应用（如编辑器/播放器）的键盘焦点
#[cfg(windows)]
unsafe extern "system" {
    fn GetForegroundWindow() -> isize;
    fn SetForegroundWindow(hwnd: isize) -> i32;
}

// 焦点借用记录：弹出抢焦点前的 OS 前台窗口句柄
#[derive(Default)]
struct QuickFocusState(Mutex<isize>);

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
        .manage(NativeSpeechState::default())
        .invoke_handler(tauri::generate_handler![show_quick, hide_quick, secret_protect, secret_reveal, speak_native, exit_app])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn powershell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

// 发音命令：wry 的 IPC 在 WebView 主线程内联执行同步命令，kill/wait + spawn powershell
// 会阻塞 UI（点击发音瞬间冻结窗口动画/事件处理），因此移入阻塞线程池执行
#[tauri::command]
async fn speak_native(app: AppHandle, text: String, accent: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || speak_native_blocking(app, text, accent))
        .await
        .map_err(|e| format!("语音任务执行失败: {e}"))?
}

fn speak_native_blocking(app: AppHandle, text: String, accent: String) -> Result<(), String> {
    let text = text.trim();
    if text.is_empty() {
        return Ok(());
    }
    #[cfg(windows)]
    {
        // -EncodedCommand 走 CreateProcess 命令行（上限 32767 字符）：脚本经 UTF-16LE+base64
        // 放大约 2.7 倍、单引号转义最坏再翻倍，超长正文会直接 spawn 失败；截断到安全长度
        let text: String = text.chars().take(6000).collect();
        let locale = if accent == "en" { "en-GB" } else { "en-US" };
        let mut script = String::from(
            "Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; ",
        );
        script.push_str("$culture = New-Object System.Globalization.CultureInfo(");
        script.push_str(&powershell_single_quote(locale));
        script.push_str("); try { $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSet, [System.Speech.Synthesis.VoiceAge]::NotSet, 0, $culture) } catch {}; $synth.Speak(");
        script.push_str(&powershell_single_quote(&text));
        script.push_str("); $synth.Dispose();");

        let mut utf16le = Vec::with_capacity(script.len() * 2);
        for unit in script.encode_utf16() {
            utf16le.extend_from_slice(&unit.to_le_bytes());
        }
        let encoded = b64_encode(&utf16le);
        let state = app.state::<NativeSpeechState>();
        let mut active = state.0.lock().map_err(|_| "语音状态锁定失败".to_string())?;
        if let Some(mut child) = active.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        let child = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", &encoded])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| format!("启动 Windows 语音失败: {e}"))?;
        *active = Some(child);
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (app, accent);
        Err("当前平台不支持 Windows 原生语音".to_string())
    }
}

#[derive(Default)]
struct NativeSpeechState(Mutex<Option<std::process::Child>>);

// 退出整个应用，而不是只销毁当前窗口；托盘图标和 quick 窗口也必须随应用一并结束。
#[tauri::command]
fn exit_app(app: AppHandle) -> Result<(), String> {
    // 退出前终止正在播放的原生语音子进程：Windows 父进程退出不会级联杀子进程，
    // 否则 powershell.exe 会把剩余文本读完
    #[cfg(windows)]
    if let Some(mut child) = app.state::<NativeSpeechState>().0.lock().unwrap().take() {
        let _ = child.kill();
        let _ = child.wait();
    }
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
    // 非法坐标防御：Inf 会命中"放左侧"分支把窗口送到工作区外（NaN 会被 clamp/max 吸收，无需特判）
    if !x.is_finite() || !y.is_finite() {
        return Err("非法的快捷窗坐标".to_string());
    }
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
    // qx 与 qy 对称做上界钳制：异常大的 x（跨屏/过期坐标）不会再把快捷窗放到工作区外不可见
    quick
        .set_position(PhysicalPosition::new(
            qx.max(area_x).clamp(area_x, max_x),
            qy.max(area_y),
        ))
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
    // 不抢焦点路径（focus=false 冷却期重弹，或已可见未聚焦）同样要防激活：
    // tao 对普通窗口一律 SW_SHOW 显示（本身会激活窗口），Windows 上临时禁用可聚焦
    // （WS_EX_NOACTIVATE，不影响已持有的焦点）再恢复，否则冷却期重弹仍会抢走前台，
    // 且该路径无借用记录、hide_quick 的焦点归还会静默失效
    #[cfg(windows)]
    {
        if !steal_focus {
            quick.set_focusable(false).map_err(|e| e.to_string())?;
        }
    }
    quick.show().map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        if !steal_focus {
            quick.set_focusable(true).map_err(|e| e.to_string())?;
        }
    }
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
                    // state 先绑定：State 是临时借用包装，跨语句持有 MutexGuard 必须先留住它（E0716）
                    let state = app.state::<QuickFocusState>();
                    let mut prev_guard = state.0.lock().unwrap();
                    let prev = *prev_guard;
                    if prev != 0 && prev != fg {
                        unsafe { SetForegroundWindow(prev) };
                    }
                    // 归还后清零：陈旧句柄可能在下次 hide 时把焦点还给早已销毁/无关的窗口
                    *prev_guard = 0;
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
