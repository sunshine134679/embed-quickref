# iOS 悬浮圆点模式实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 EmbedQuickRef（Tauri 2 + Vue 3，源码 `d:\embed-quickref`）实现 iOS 辅助触控风格的悬浮圆点模式：桌面常驻 64×64 半透明光晕圆点，点击就地展开 680×500 主界面，失焦自动缩回；悬浮为默认模式，弹窗/固定保留为设置选项。

**Architecture:** 单窗口 `main` 形态切换（compact 64×64 ↔ expanded 680×500）：切换 = `setMinSize` + `setSize` + 前端 `form` 状态控制模板渲染层。模式 `mode`（floating/popup/pinned）与圆点位置 `dotPosition` 持久化于 `state.json`。失焦策略按 mode 分支：floating 展开态→缩回圆点；popup→隐藏；pinned→不隐藏。

**Tech Stack:** Tauri 2（`@tauri-apps/api/window`、`@tauri-apps/api/dpi`、`@tauri-apps/api/menu`）、Vue 3 `<script setup>`、Vite。无自动化测试框架，验证用 CDP（端口 9333）脚本实测。

**约束:** 编辑工具不能写工作区外文件 → 所有文件改动先写 `d:\Project_OldObjectsExchange\AgentA3_new\.staging-embedquickref\` 再复制回 `d:\embed-quickref`，用完彻底删除暂存目录。编译后部署到 `D:\EmbedQuickRef\EmbedQuickRef.exe`。每任务 git commit，结束 push origin/main（`$env:no_proxy="*"`）。

---

### Task 1: 新建 FloatingDot.vue 圆点组件

**Files:**
- Create: `d:\embed-quickref\src\components\FloatingDot.vue`

- [ ] **Step 1: 在暂存目录创建组件**（写入 `.staging-embedquickref\FloatingDot.vue`，内容如下，然后复制到 `d:\embed-quickref\src\components\`）

```vue
<script setup>
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Menu } from "@tauri-apps/api/menu";

const emit = defineEmits(["expand", "settings", "quit"]);

// 按住拖动（移动超阈值才交给系统拖动），单击展开
let downPos = null;
let dragging = false;

function onDotDown(e) {
  if (e.button !== 0) return;
  downPos = { x: e.clientX, y: e.clientY };
  dragging = false;
}

function onDotMove(e) {
  if (!downPos || dragging) return;
  const dx = e.clientX - downPos.x;
  const dy = e.clientY - downPos.y;
  if (Math.hypot(dx, dy) > 6) {
    dragging = true;
    getCurrentWindow().startDragging();
  }
}

function onDotUp() {
  if (!dragging && downPos) emit("expand");
  downPos = null;
  dragging = false;
}

async function onContextMenu(e) {
  e.preventDefault();
  const menu = await Menu.new({
    items: [
      { id: "expand", text: "展开", action: () => emit("expand") },
      { id: "settings", text: "设置", action: () => emit("settings") },
      { id: "quit", text: "退出", action: () => emit("quit") },
    ],
  });
  await menu.popup();
}
</script>

<template>
  <div
    class="floating-dot"
    title="EmbedQuickRef · 点击展开"
    @mousedown="onDotDown"
    @mousemove="onDotMove"
    @mouseup="onDotUp"
    @contextmenu.prevent="onContextMenu"
  >
    <div class="dot-core"></div>
  </div>
</template>

<style scoped>
.floating-dot {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  -webkit-app-region: no-drag;
}

.floating-dot:active {
  cursor: grabbing;
}

.dot-core {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(35, 48, 66, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow:
    inset 0 1px 3px rgba(255, 255, 255, 0.25),
    inset 0 -2px 6px rgba(0, 0, 0, 0.28),
    0 0 12px rgba(82, 112, 143, 0.4),
    0 0 24px rgba(82, 112, 143, 0.3),
    0 0 48px rgba(82, 112, 143, 0.15);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.floating-dot:hover .dot-core {
  transform: scale(1.06);
  box-shadow:
    inset 0 1px 3px rgba(255, 255, 255, 0.25),
    inset 0 -2px 6px rgba(0, 0, 0, 0.28),
    0 0 14px rgba(82, 112, 143, 0.5),
    0 0 28px rgba(82, 112, 143, 0.38),
    0 0 56px rgba(82, 112, 143, 0.2);
}

.floating-dot:active .dot-core {
  transform: scale(0.94);
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git -C d:\embed-quickref add src/components/FloatingDot.vue
git -C d:\embed-quickref commit -m "feat: 悬浮圆点组件 FloatingDot.vue（光晕外观+点击展开+拖动+右键菜单）"
```

---

### Task 2: App.vue 形态状态机与模式逻辑

**Files:**
- Modify: `d:\embed-quickref\src\App.vue`

分 6 个 SearchReplace 修改（在暂存副本上做，全部完成后一次复制回）。

- [ ] **Step 1: import 与状态声明**

在暂存副本中替换：

```js
import { getCurrentWindow } from "@tauri-apps/api/window";
```
为：
```js
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
```

替换：
```js
import AiHistory from "./components/AiHistory.vue";
```
为：
```js
import AiHistory from "./components/AiHistory.vue";
import FloatingDot from "./components/FloatingDot.vue";
```

替换：
```js
const searchBox = ref(null);
```
为：
```js
const searchBox = ref(null);
// 悬浮圆点模式：compact(圆点) | expanded(主界面)
const form = ref("expanded");
// 界面模式：floating(悬浮圆点，默认) | popup(弹窗) | pinned(固定)
const mode = ref("floating");
const dotPosition = ref(null);
const DOT_SIZE = 64;
const EXPAND_W = 680;
const EXPAND_H = 500;
```

- [ ] **Step 2: persistState / restoreState 扩展**

替换现有 `persistState`（增加 mode、dotPosition）：

```js
async function persistState() {
  if (!stateStore) return;
  try {
    await stateStore.set("tabs", tabs.value);
    await stateStore.set("pinned", pinned.value);
    await stateStore.set("mode", mode.value);
    await stateStore.set("dotPosition", dotPosition.value);
    await stateStore.save();
  } catch (e) {
    console.error("状态保存失败", e);
  }
}
```

替换现有 `restoreState`（增加 mode、dotPosition 恢复）：

```js
async function restoreState() {
  stateStore = await load("state.json", { autoSave: false });
  const savedTabs = await stateStore.get("tabs");
  if (Array.isArray(savedTabs) && savedTabs.length) tabs.value = savedTabs;
  if ((await stateStore.get("pinned")) === true) {
    pinned.value = true;
    await applyPinned();
  }
  const savedMode = await stateStore.get("mode");
  if (["floating", "popup", "pinned"].includes(savedMode)) mode.value = savedMode;
  const savedPos = await stateStore.get("dotPosition");
  if (savedPos && typeof savedPos.x === "number" && typeof savedPos.y === "number") {
    dotPosition.value = { x: savedPos.x, y: savedPos.y };
  }
}
```

- [ ] **Step 3: 形态切换与位置管理函数**

在 `applyPinned` 函数前插入：

```js
// ---------- 悬浮圆点模式：形态切换与位置管理 ----------

// 缩回圆点态：64×64 小窗
async function enterCompact() {
  try {
    await win.setMinSize(DOT_SIZE, DOT_SIZE);
    await win.setSize(new LogicalSize(DOT_SIZE, DOT_SIZE));
  } catch (e) {
    console.error("缩回圆点失败", e);
  }
  form.value = "compact";
}

// 展开主界面：680×500，就地展开并纠正到可见区
async function enterExpanded(initialView = "search") {
  try {
    await win.setMinSize(520, 300);
    await win.setSize(new LogicalSize(EXPAND_W, EXPAND_H));
    await clampToVisible();
  } catch (e) {
    console.error("展开失败", e);
  }
  form.value = "expanded";
  view.value = initialView;
  if (initialView === "search") focusInput();
}

// 窗口位置纠正到当前显示器可见范围（保守 clamp，物理像素）
async function clampToVisible() {
  try {
    const mon = await win.currentMonitor();
    if (!mon) return;
    const p = await win.outerPosition();
    const maxX = Math.max(0, mon.size.width - 320);
    const maxY = Math.max(0, mon.size.height - 320);
    const x = Math.min(Math.max(p.x, 0), maxX);
    const y = Math.min(Math.max(p.y, 0), maxY);
    if (x !== p.x || y !== p.y) {
      await win.setPosition(new PhysicalPosition(x, y));
    }
  } catch (e) {
    console.error("位置纠正失败", e);
  }
}

// 应用记忆的圆点位置
async function applyDotPosition(p) {
  try {
    await win.setPosition(new PhysicalPosition(Math.max(0, p.x), Math.max(0, p.y)));
  } catch (e) {
    console.error("恢复圆点位置失败", e);
  }
}

// 圆点点击展开（FloatingDot 事件）
async function onDotExpand() {
  await win.show();
  await enterExpanded();
  await win.setFocus();
}

// 圆点右键 → 设置：展开并打开设置面板
async function onDotSettings() {
  await win.show();
  await enterExpanded("settings");
  await win.setFocus();
}
```

- [ ] **Step 4: 失焦策略 / 热键 / Esc 联动**

替换现有 `onFocusChanged` 注册块（onMounted 内）：

```js
  await win.onFocusChanged(({ payload: focused }) => {
    if (focused) {
      clearTimeout(hideTimer);
      return;
    }
    if (mode.value === "floating") {
      // 圆点态常驻；仅展开态失焦后缩回圆点
      if (form.value !== "expanded") return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(async () => {
        if (form.value !== "expanded" || pointerInside) return;
        if (await win.isFocused()) return;
        await enterCompact();
      }, 200);
      return;
    }
    if (pinned.value) return;
    // 点击边框缩放/拖动会先触发一次失焦：延迟确认，指针仍在窗口内则不隐藏
    clearTimeout(hideTimer);
    hideTimer = setTimeout(async () => {
      if (pinned.value || pointerInside) return;
      if (await win.isFocused()) return;
      win.hide();
    }, 200);
  });
```

替换现有 `toggleWindow` 函数：

```js
async function toggleWindow() {
  if (mode.value === "floating") {
    // 悬浮模式：热键在 展开 <-> 圆点 间切换
    if (form.value === "expanded") {
      await enterCompact();
    } else {
      await win.show();
      await enterExpanded();
      await win.setFocus();
    }
    return;
  }
  if (pinned.value) {
    // 固定模式：热键在 最小化 <-> 还原聚焦 间切换
    if (await win.isMinimized()) {
      await win.unminimize();
      await win.setFocus();
      focusInput();
    } else if (await win.isFocused()) {
      await win.minimize();
    } else {
      await win.setFocus();
      focusInput();
    }
  } else if (await win.isVisible()) {
    await win.hide();
  } else {
    await win.center();
    await showAndFocus();
  }
}
```

替换现有 `goBack` 函数：

```js
function goBack() {
  if (view.value === "search") {
    if (query.value) query.value = "";
    else if (mode.value === "floating" && form.value === "expanded") enterCompact();
    else dismissWindow();
  } else {
    view.value = "search";
    focusInput();
  }
}
```

- [ ] **Step 5: 窗口移动监听（位置保存 + 水平边缘吸附）**

在 `onMounted` 中、`win.onFocusChanged` 注册之后插入：

```js
  // 悬浮模式：窗口移动后防抖保存位置 + 水平边缘吸附（80px 内贴边）
  let moveTimer = null;
  await win.onMoved(async ({ payload: pos }) => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(async () => {
      dotPosition.value = { x: pos.x, y: pos.y };
      if (stateStore) {
        await stateStore.set("dotPosition", dotPosition.value);
        await stateStore.save();
      }
      if (mode.value !== "floating" || form.value !== "compact") return;
      try {
        const mon = await win.currentMonitor();
        if (!mon) return;
        const scale = mon.scaleFactor || 1;
        const dotPx = Math.round(DOT_SIZE * scale);
        let nx = pos.x;
        if (pos.x < 80 * scale) nx = 0;
        else if (mon.size.width - pos.x - dotPx < 80 * scale) nx = mon.size.width - dotPx;
        if (nx !== pos.x) await win.setPosition(new PhysicalPosition(nx, pos.y));
      } catch (e) {
        console.error("吸附失败", e);
      }
    }, 400);
  });
```

- [ ] **Step 6: 启动初始化 + 模板 + CSS**

替换 `onMounted` 开头（在 `initSettings` 之前插入悬浮模式初始化）：

```js
onMounted(async () => {
  await initSettings();
  await initUserTerms();
  try {
    await restoreState();
  } catch (e) {
    console.error("状态恢复失败", e);
  }
  // 悬浮模式：启动即为圆点态并恢复位置
  if (mode.value === "floating") {
    await enterCompact();
    if (dotPosition.value) await applyDotPosition(dotPosition.value);
  }
```

模板：替换

```html
<template>
  <div class="shell">
    <header class="topbar">
```
为：
```html
<template>
  <div class="shell" :class="{ compact: form === 'compact' }">
    <FloatingDot
      v-if="form === 'compact'"
      @expand="onDotExpand"
      @settings="onDotSettings"
      @quit="closeApp"
    />
    <template v-else>
      <header class="topbar">
```

并替换模板末尾：

```html
    <footer class="statusbar" title="按住拖动窗口" @mousedown.self="startDrag">
      <span><kbd>↑↓</kbd> 选择</span>
      <span><kbd>Enter</kbd> 打开标签</span>
      <span><kbd>Tab</kbd> 问 AI</span>
      <span><kbd>Ctrl+H</kbd> AI 历史</span>
      <span><kbd>Esc</kbd> 返回 / 收起</span>
    </footer>
  </div>
</template>
```
为：
```html
      <footer class="statusbar" title="按住拖动窗口" @mousedown.self="startDrag">
        <span><kbd>↑↓</kbd> 选择</span>
        <span><kbd>Enter</kbd> 打开标签</span>
        <span><kbd>Tab</kbd> 问 AI</span>
        <span><kbd>Ctrl+H</kbd> AI 历史</span>
        <span><kbd>Esc</kbd> 返回 / 收起</span>
      </footer>
    </template>
  </div>
</template>
```

CSS：在 `.shell` 规则后追加：

```css
.shell.compact {
  background: transparent;
  border: none;
  overflow: visible;
}
```

- [ ] **Step 7: 复制回源码并提交**

```bash
Copy-Item "d:\Project_OldObjectsExchange\AgentA3_new\.staging-embedquickref\App.vue" d:\embed-quickref\src\App.vue -Force
git -C d:\embed-quickref add src/App.vue
git -C d:\embed-quickref commit -m "feat: 悬浮圆点模式核心（形态状态机/失焦策略/位置持久化/边缘吸附）"
```

---

### Task 3: SettingsPanel.vue 界面模式选择

**Files:**
- Modify: `d:\embed-quickref\src\components\SettingsPanel.vue`

- [ ] **Step 1: 先读现有文件**（`Read` 全文，2348 字节），在合适位置加 props/emit 与模式选择 UI

新增 props 与 emit（script setup 中）：

```js
const props = defineProps({
  settings: { type: Object, required: true },
  mode: { type: String, default: "floating" },
});
const emit = defineEmits(["save", "cancel", "update:mode"]);

const MODES = [
  { value: "floating", label: "悬浮圆点", desc: "桌面小圆点，点击展开，失焦自动缩回" },
  { value: "popup", label: "弹窗", desc: "热键唤起，失焦自动隐藏" },
  { value: "pinned", label: "固定", desc: "置顶最前 + 任务栏图标" },
];
```

模板中（在设置分组之间或末尾）插入：

```html
<div class="field">
  <label>界面模式</label>
  <div class="mode-options">
    <button
      v-for="m in MODES"
      :key="m.value"
      class="mode-opt"
      :class="{ active: mode === m.value }"
      @click="emit('update:mode', m.value)"
    >
      <span class="mode-name">{{ m.label }}</span>
      <span class="mode-desc">{{ m.desc }}</span>
    </button>
  </div>
</div>
```

配套 scoped 样式（追加）：

```css
.mode-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.mode-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid rgba(219, 226, 234, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.5);
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.mode-opt.active {
  background: rgba(82, 112, 143, 0.1);
  border-color: rgba(143, 168, 196, 0.8);
  color: #52708f;
}

.mode-name {
  flex: none;
  font-weight: 600;
  min-width: 56px;
}

.mode-desc {
  color: #94a3b8;
  font-size: 12px;
}
```

注意：若现有文件已有 `defineProps`/`defineEmits` 定义，合并而非重复声明。

- [ ] **Step 2: App.vue 接线**

在 `onSaveSettings` 函数前插入模式变更处理：

```js
async function onModeChange(m) {
  if (mode.value === m) return;
  mode.value = m;
  persistState();
  if (m === "floating") {
    await enterCompact();
  } else if (form.value === "compact") {
    await enterExpanded();
    await win.setFocus();
  }
}
```

模板中 SettingsPanel 调用处（现有）：

```html
      <SettingsPanel
        v-else-if="view === 'settings'"
        :settings="settings"
        @save="onSaveSettings"
        @cancel="view = 'search'; focusInput()"
      />
```
改为：
```html
      <SettingsPanel
        v-else-if="view === 'settings'"
        :settings="settings"
        :mode="mode"
        @save="onSaveSettings"
        @cancel="view = 'search'; focusInput()"
        @update:mode="onModeChange"
      />
```

- [ ] **Step 3: 复制回源码并提交**

```bash
Copy-Item "d:\Project_OldObjectsExchange\AgentA3_new\.staging-embedquickref\SettingsPanel.vue" d:\embed-quickref\src\components\SettingsPanel.vue -Force
git -C d:\embed-quickref add src/components/SettingsPanel.vue src/App.vue
git -C d:\embed-quickref commit -m "feat: 设置面板新增界面模式三选一（悬浮/弹窗/固定）"
```

---

### Task 4: 编译与部署

**Files:** 无源码改动

- [ ] **Step 1: 编译**

```bash
$env:PATH="$env:USERPROFILE\.cargo\bin;$env:PATH"; $env:no_proxy="*"; $env:NO_PROXY="*"; Set-Location d:\embed-quickref; npm run tauri build -- --no-bundle
```
Expected: `Built application at: D:\embed-quickref\src-tauri\target\release\embed-quickref.exe`（若 JS 编译报错，检查模板缩进/括号）

- [ ] **Step 2: 停进程、部署、启动（带 CDP 9333）**

```bash
Get-Process | Where-Object { $_.Path -like '*EmbedQuickRef*' } | Stop-Process -Force -ErrorAction SilentlyContinue
Copy-Item d:\embed-quickref\src-tauri\target\release\embed-quickref.exe D:\EmbedQuickRef\EmbedQuickRef.exe -Force
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9333"
Start-Process D:\EmbedQuickRef\EmbedQuickRef.exe
```

- [ ] **Step 3: 提交推送**

```bash
git -C d:\embed-quickref push origin main
```

---

### Task 5: CDP 全链路验证

**Files:** 临时脚本 `d:\embed-quickref\verify-floating.mjs`（Node ≥22 内置 WebSocket，跑完删除）

- [ ] **Step 1: 验证圆点态与展开**

脚本核心断言（连 9333 后依次 evaluate + sleep）：

1. 启动 6s 后：`document.querySelector('.floating-dot')` 存在（圆点态）
2. 窗口尺寸（`GetWindowRect` 或 CDP `window.outerWidth/outerHeight`）：`outerWidth === 64 && outerHeight === 64`
3. 点击展开：`document.querySelector('.floating-dot')?.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}))` 不触发（需 mousedown+mouseup 模拟）；直接调用 `document.querySelector('.floating-dot')` 的点击路径不可靠 → 用 `evaluate` 触发 `mousedown`/`mouseup`（downPos 需在页面内设置：先 mousedown 再 mouseup）
4. 展开后：`outerWidth === 680 && outerHeight === 500`；`document.querySelector('.search-input, input')` 存在且 `document.activeElement` 是它；`.floating-dot` 不存在
5. 失焦缩回：CDP `Page.bringToFront` 后 `Runtime.evaluate` 到另一个 target？无第二个 target → 用 `window.blur()`？WebView 失焦模拟：直接调 `document.dispatchEvent` 不行（onFocusChanged 是原生事件）。改用 PowerShell `SetForegroundWindow(0)`/激活其他窗口（如终端）触发失焦，再查 `outerWidth === 64`
6. 位置记忆：`state.json` 中 `dotPosition` 存在（拖动难模拟，改为直接检查 stateStore 写入路径——通过 `evaluate` 读取 `state.json` 文件内容？文件在磁盘，Node 直接读 `C:\Users\MR\AppData\Roaming\com.mr.embed-quickref\state.json` 验证）

- [ ] **Step 2: 执行验证并修复**

```bash
Set-Location d:\embed-quickref; node verify-floating.mjs
```
若有断言失败：按输出定位（多半是交互模拟或尺寸逻辑），修 App.vue → 重新编译部署 → 重测。修复后删除脚本。

- [ ] **Step 3: 回归验证**

1. 设置面板切换模式（CDP 点击 mode-opt）→ popup 模式重启后热键/失焦行为 = 隐藏（现有逻辑）；pinned 模式 = 任务栏显示
2. 圆点右键菜单：CDP `contextmenu` 事件 → 菜单弹出（原生菜单 CDP 看不到，验证 `@contextmenu.prevent` 不报错即可）
3. 搜索/AI/历史功能回归：搜索 i2c → 详情 → 标签页 → AI 历史入口均正常

- [ ] **Step 4: 提交修复（如有）并推送**

```bash
git -C d:\embed-quickref add -A
git -C d:\embed-quickref commit -m "fix: 悬浮圆点模式验证修复"
git -C d:\embed-quickref push origin main
```

---

### Task 6: 收尾

- [ ] **Step 1: 清理**

删除 `d:\embed-quickref\verify-floating.mjs`（如有）、`.staging-embedquickref` 目录（Test-Path 确认 False）
重启应用（不带 CDP 参数），确认正常运行

- [ ] **Step 2: 最终提交推送 + 记忆**

```bash
git -C d:\embed-quickref status --short  # 应为空
git -C d:\embed-quickref push origin main
```
更新记忆：悬浮圆点模式（默认模式/圆点外观/失焦缩回/位置持久化）
