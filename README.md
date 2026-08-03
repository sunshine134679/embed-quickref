# EmbedQuickRef · 嵌入式速查

一个悬浮在桌面上的嵌入式开发速查工具：内置 570+ 条精选词条（协议、命令、语法、工具链、VSCode 配置等），输入即查；查不到的按 `Tab` 让 AI 解释并自动沉淀为个人词库。

基于 **Tauri 2 + Vue 3 + Vite**，纯前端无 TypeScript，透明毛玻璃悬浮窗，支持悬浮圆点 / 弹窗 / 固定三种模式。

## ✨ 功能特性

- **570+ 内置词条，14 个板块**：Linux 命令、内核与系统、文件后缀、硬件与存储、网络协议、Shell 脚本、总线协议、构建与工具链、汇编指令、Git 操作、Make 语法、CMake 语法、VSCode 配置、文件系统
- **智能搜索**：
  - 缩写精确 / 前缀 / 包含、全称与中文匹配（输入 `TCP`、`传输控制` 都能命中）
  - 带点号输入：`main.c` → `.c`、`.h` → 头文件、`a.b.py` → `.py`
  - 完整命令输入：`ls -l`、`tar czf`、`git commit -m` 直接命中对应命令
  - 特殊语法关键字：`$?`、`$()`、`%.o: %.c`、`[[ ]]` 等直接可搜
- **结构化词条卡片**：命令格式（usage）+ 选项逐项详解（options）+ 要点列表，如 `ls` 展示全部 10 个选项各自含义
- **AI 解释**：词库未命中时按 `Enter`/`Tab` 直接问 AI（DeepSeek OpenAI 兼容接口，SSE 流式）；多轮追问、历史会话保存、回答自动解析为词条缓存到个人词库（可一键更新）
- **悬浮圆点交互**：展开 ⇄ 圆点一键切换，CSS 飞行动画（GPU 60fps 平滑缩放平移），位置记忆与屏幕边缘吸附
- **标签页**：打开过的词条固定为标签（最新在左），`Ctrl+W` 关闭、`Ctrl+Tab` 循环、随会话持久化
- **任务栏快捷收起**：点收起键最小化到任务栏，点击图标秒回

## 🎯 安装与使用

部署产物：`EmbedQuickRef.exe`（Windows x64，无边框透明窗口）。支持三种模式（设置中切换）：

| 模式 | 行为 |
|---|---|
| 悬浮圆点（默认） | 常驻桌面的圆点，点击展开 680×500 速查窗口，失焦自动缩回 |
| 弹窗 | 全局热键（默认 `Alt+Q`）唤出/隐藏 |
| 固定 | 固定置顶 + 任务栏图标，不随失焦隐藏 |

### 常用快捷键

| 按键 | 功能 |
|---|---|
| `↑` / `↓` | 结果列表选择 |
| `Enter` | 打开选中词条（空结果时问 AI） |
| `Tab` | 词条详情页问 AI / 空结果直接问 AI |
| `Esc` | 逐级返回（AI 页 → 详情 → 搜索 → 收起） |
| `Ctrl+H` | AI 解释历史 |
| `Ctrl+W` | 关闭当前标签 |
| `Ctrl+Tab` | 循环切换标签 |
| `Alt+Q`（默认） | 全局热键：展开/收起或显示/隐藏 |

## 🛠 开发

```bash
npm install          # 安装依赖
npm run dev          # 前端开发（Vite）
npm run tauri dev    # Tauri 开发模式
npm run tauri build  # 打包（产物在 src-tauri/target/release/）
```

> 图标重新生成：`npm run tauri icon app-icon.png`（自动产出全套尺寸）；若 exe 图标未更新，需 touch `src-tauri/build.rs` 强制 tauri-build 重嵌资源。

## 📁 目录结构

```
├── src/                      # 前端（Vue 3）
│   ├── App.vue               # 主界面：窗口形态/位置/视图导航/快捷键
│   ├── components/           # 搜索框/结果列表/词条卡片/AI 回答/历史/设置/圆点
│   ├── composables/          # useSearch（搜索与词库）/ useAi（AI 会话）/ useSettings
│   └── data/terms.json       # 内置词库（570+ 条）
├── src-tauri/                # Tauri 2（Rust）
│   ├── src/lib.rs            # 单实例/插件注册
│   └── tauri.conf.json       # 窗口/打包配置（透明 + acrylic 效果）
└── app-icon.png              # 应用图标源图（1024×1024）
```

## 🧠 词库结构

词条字段：`abbr` 缩写 / `full` 英文全称 / `zh` 中文名 / `category` 分类 / `definition` 定义 / `points` 要点 / `usage` 命令格式 / `options` 选项详解（`{o, d}`）。

个人词库（AI 缓存）存储在 `%APPDATA%\com.mr.embed-quickref\user-terms.json`，与内置词库合并搜索、按缩写去重。
