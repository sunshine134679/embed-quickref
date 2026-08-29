fn main() {
    // .cargo/config.toml 把 link.exe 的 TMP/TEMP 指到 target/linktmp（受限令牌写不了系统临时目录）；
    // cargo clean 会连该目录一起删掉导致链接期报错，构建脚本阶段先行补建
    if let Ok(tmp) = std::env::var("TEMP") {
        let _ = std::fs::create_dir_all(tmp);
    }
    tauri_build::build()
}
