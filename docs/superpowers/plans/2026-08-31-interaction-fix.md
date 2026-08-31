# EmbedQuickRef 交互审查修复实施方案

> **日期**：2026-08-31 ｜ **基线**：200aabd（工作树干净，已推送 origin/main）
> **范围**：审查报告全部 47 项（P1×12、P2×22、P3×13）

## 已确认决策

1. 修复范围：全部 47 项
2. 置顶基线：统一为置顶（修 onModeChange floating 路径，与冷启动一致）
3. 执行方式：主代理直接逐项执行
4. **每完成一个功能 = 1 次 git commit**（中文提交信息；只 commit 不 push；git add 只加涉及文件，提交前检查 git diff）

## 全局约束

- 构建：前端 `npm run build`；单测 `npm test`；Rust 改动 `cargo check/build --features custom-protocol`；验证管道显式检查退出码
- 不动已接受的基线行为：圆点 1px 边框线、收起动画基线、词库内容 terms.json、AI 提示词、providers 列表
- 部署 exe 复制到 D:\EmbedQuickRef 需应用未在运行

## Commit 清单（34 个）

### 阶段 A：请求生命周期与 AI（8）
- A1 AI 请求可中止 + 离开视图即取消（useAi.js + apiCandidates.js + App.vue）：askAi/askAiOnce 支持外部 signal；withApiFallback 遇外部取消不再尝试备用；App 持 aiAbortCtrl + watch(view) 离开即 seq++/abort/status 复位（同时解决"离开视图仍自动入库落盘"）
- A2 AI 中段失败保留已输出 + 重试按钮（App.vue + AiAnswer.vue）：catch 有 partial 不 splice；error 态显示重试
- A3 AI 流式渲染节流 + 仅底部自动滚动 + fallback 光标（AiAnswer.vue）：60ms 合并提交；滚动仅当在底部；非结构化首答挂 caret
- A4 AI 代码块渲染 + 复制（AiAnswer.vue）：``` 围栏 → pre+code + 复制（复用 TermCard 交互）
- A5 AI 历史收敛（App.vue + HistoryPanel.vue）：消息 slice(-40)；同 norm(query) 复用会话；更新 unshift 置顶；AI tab 清空按钮
- A6 AI 首答解析器统一（AiAnswer.vue 复用 useAi.parseAnswer）
- A7 无 Key 就地引导 + 词库加载失败区分（App.vue + QuickPanel.vue）：runAi 不再静默跳设置；termsError 空态提示+重试
- A8 详情页 AI 解释可见按钮（App.vue）

### 阶段 B：翻译（9）
- B1 无 Key 不拦本地词典（useTranslate.js + QuickPanel.vue）：hasApiCandidate 移到本地命中之后
- B2 翻译缓存指纹化（useTranslate.js）：key 加 baseUrl+model 指纹
- B3 流式中途改输入作废（App.vue）：loading 中用户输入 translateSeq++
- B4 键盘触发去重 + 请求真实中止（App.vue + useTranslate.js + QuickPanel.vue）：keydown loading 守卫；runTranslate 持 AbortController；askOnce/askStream 支持 signal；QuickPanel Enter searching 守卫
- B5 错误/建议/loading 层重排（TranslatePanel.vue）：error 提前；loading 独立指示；旧卡片降透明度
- B6 翻译结果来源标识（TranslatePanel.vue）：本地词典/AI 生成 badge
- B7 个人词库并入翻译词典（useSearch.js + useTranslate.js）：lookupWord 合并 userTerms，写入后重建索引
- B8 翻译历史大小写去重（useTranslate.js）
- B9 联想防抖 150ms + 超长文本拦截 + 发音失败反馈（TranslatePanel.vue + App.vue + useTranslate.js）

### 阶段 C：快捷查找窗（6）
- C1 键盘 ↑↓/Enter/Tab 语义（QuickPanel.vue）
- C2 误触优化：quick-show 带 focus 标志，冷却期不聚焦；600ms 无输入未入窗提前收（App.vue + QuickPanel.vue）
- C3 busy 单一公式 + pickTerm 宽限 + composing 复位（QuickPanel.vue）
- C4 quick-hidden 事件同步 + 隐藏即清结果（lib.rs + App.vue + QuickPanel.vue）
- C5 退场动画统一 + 列表不截断 + 滚动位置恢复（App.vue + QuickPanel.vue）
- C6 圆点定位修正（lib.rs + App.vue）：44px 视觉基准间隙；垂直翻转防覆盖；多屏 monitorForPoint 传参

### 阶段 D：设置与后端（7）
- D1 设置保存闭环（SettingsPage.vue + App.vue）：卸装 flush；成败真实反馈
- D2 置顶基线统一为置顶（App.vue）
- D3 死代码清理（删除 SettingsPanel.vue；移除 @save/onSaveSettings）
- D4 测试连接按钮（SettingsPage.vue）
- D5 DPAPI 降级提示 + apiKey blur 落盘（useSettings.js + SettingsPage.vue）
- D6 界面模式并入 settings.json + state.json 一次性迁移（useSettings.js + App.vue）
- D7 命令失败可见化 + pronunciationSource 清理（App.vue + useSettings.js）

### 阶段 E：主窗杂项与收尾（4）
- E1 ResultList hover 复位 + TermCard 复制 focus-visible + 文本链接化（ResultList.vue + TermCard.vue）
- E2 托盘退出确认 + 状态栏 Ctrl+H 文案 + 历史视图恢复（App.vue）
- E3 端点主机白名单 assertEndpointMatches + v-html 核实（safeUrl.js + useAi.js + useTranslate.js）
- E4 全量验证：npm test / npm run build / cargo build --release --features custom-protocol / CDP 冒烟 / exe 大小校验 / 部署 D:\EmbedQuickRef

## 验收约定

- 每个 commit 前后跑对应验证命令并检查退出码
- 实现中发现与计划不符时，先记录证据再调整，不硬套
- 全部完成后汇总：commit 列表 + 验证点 + 部署状态