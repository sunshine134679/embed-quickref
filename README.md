# EmbedQuickRef · 嵌入式速查

一个悬浮在桌面上的嵌入式开发速查工具：内置 897 条精选词条（命令、协议、语法、工具链、设备树、芯片外设、AI 开发等），输入即查；查不到的按 `Tab` 让 AI 解释并自动沉淀为个人词库。另含英语翻译分区（243 词学习词典 + AI 句子翻译）与 hover 快捷查找窗。

基于 **Tauri 2 + Vue 3 + Vite**，纯前端无 TypeScript，透明毛玻璃悬浮窗，支持悬浮圆点 / 弹窗 / 固定三种模式。

## ✨ 功能特性

补充能力：

- 多模型故障转移：API 设置支持无限数量的备用模型，主模型请求失败时按顺序自动切换；备用项可自行添加。
- 本机英语发音：直接调用 Windows 本机语音，不请求在线词典音频；支持美式 / 英式口音和已安装的英语语音。
- 分类设置与快捷键：API、快捷键、界面行为、发音分区管理；快捷键可直接按键录入并自动保存。
- **897 条内置词条，19 个板块**：Linux 命令、U-Boot 命令、Windows 命令、内核与系统、文件后缀、硬件与存储、网络协议、Shell 脚本、总线协议、构建与工具链、汇编指令、Git 操作、Make 语法、CMake 语法、VSCode 配置、文件系统、AI 开发、设备树、芯片外设
- **智能搜索**：
  - 缩写精确 / 前缀 / 包含、全称与中文匹配（输入 `TCP`、`传输控制` 都能命中）
  - 带点号输入：`main.c` → `.c`、`.h` → 头文件、`a.b.py` → `.py`
  - 完整命令输入：`ls -l`、`tar czf`、`git commit -m` 直接命中对应命令
  - 特殊语法关键字：`$?`、`$()`、`%.o: %.c`、`[[ ]]` 等直接可搜
- **结构化词条卡片**：命令格式（usage）+ 选项逐项详解（options）+ 要点列表，如 `ls` 展示全部 10 个选项各自含义
- **AI 解释**：词库未命中时按 `Enter`/`Tab` 直接问 AI（DeepSeek OpenAI 兼容接口，SSE 流式）；多轮追问、历史会话保存、回答自动解析为词条缓存到个人词库（可一键更新）
- **英语翻译分区**：英文单词优先命中本地学习词典（音标/词形/双语例句），未命中走 AI 词典式解释；句子翻译流式上屏；查到的词可一键并入个人词库
- **快捷查找窗**：鼠标悬停圆点弹出 440×240 小窗，术语/翻译即输即查，收起后短暂冷却期不抢焦点，焦点"借用-归还"不打断当前应用
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
| `Alt+Shift+D`（默认） | 快捷窗口中查看详情 |
| `Alt+Shift+S`（默认） | 打开设置 |

## 🛠 开发

快捷键可以在“设置 → 快捷键”中直接按下目标组合键修改，修改后自动保存并立即生效。

```bash
npm install          # 安装依赖
npm test             # 运行测试（node --test，覆盖搜索索引/翻译性能/语音/焦点工具）
npm run dev          # 前端开发（Vite）
npm run tauri dev    # Tauri 开发模式
npm run tauri build  # 打包（产物在 src-tauri/target/release/）
```

> 图标重新生成：`npm run tauri icon app-icon.png`（自动产出全套尺寸）；若 exe 图标未更新，需 touch `src-tauri/build.rs` 强制 tauri-build 重嵌资源。

## 📁 目录结构

Windows 本机发音使用系统已安装的英语语音。若列表中没有合适的声音，请先在 Windows 的“语音”设置中安装对应的英语语音包。

```
├── src/                      # 前端（Vue 3）
│   ├── App.vue               # 主界面：窗口形态/位置/视图导航/快捷键
│   ├── components/           # 搜索框/结果列表/词条卡片/AI 回答/历史/设置/圆点
│   │                         #   + QuickPanel（快捷窗）/ TranslatePanel（翻译分区）
│   ├── composables/          # useSearch（搜索与词库）/ useTranslate（翻译与发音）/ useAi / useSettings / useFavorites
│   ├── utils/                # 搜索索引/语音/服务商端点/URL 校验等（含 4 个测试文件）
│   └── data/                 # terms.json 内置词库（897 条）+ learning-dictionary / development-dictionary / providers
├── src-tauri/                # Tauri 2（Rust）
│   ├── src/lib.rs            # 快捷窗定位与焦点借用 / 原生语音 / API Key DPAPI 加密 / 单实例
│   └── tauri.conf.json       # 窗口/打包配置（透明 + acrylic 效果）
└── app-icon.png              # 应用图标源图
```

## 🧠 词库结构

词条字段：`abbr` 缩写 / `full` 英文全称 / `zh` 中文名 / `category` 分类 / `definition` 定义 / `points` 要点 / `usage` 命令格式 / `example` 实际示例 / `options` 选项详解（`{o, d}`）。

个人词库（AI 缓存）存储在 `%APPDATA%\com.mr.embed-quickref\user-terms.json`，与内置词库合并搜索；同缩写同分类时内置词条优先。
