<script setup>
import { ref, watch, onMounted, nextTick } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu } from "@tauri-apps/api/menu";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import SearchBox from "./components/SearchBox.vue";
import ResultList from "./components/ResultList.vue";
import TermCard from "./components/TermCard.vue";
import AiAnswer from "./components/AiAnswer.vue";
import AiHistory from "./components/AiHistory.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import { initSettings, useSettings } from "./composables/useSettings";
import { initUserTerms, search, addUserTerm } from "./composables/useSearch";
import { askAi, parseAnswer, createSession, restoreSession } from "./composables/useAi";
import { load } from "@tauri-apps/plugin-store";

const win = getCurrentWindow();
const { settings, saveSettings } = useSettings();

const view = ref("search"); // search | detail | ai | history | settings
const query = ref("");
const results = ref([]);
const selectedIndex = ref(0);
const currentTerm = ref(null);
const aiQuery = ref("");
const aiMessages = ref([]); // 含 system 的完整多轮会话
const aiStatus = ref("idle"); // idle | loading | streaming | done | error
const aiError = ref("");
const aiSaved = ref(false);
const aiSessions = ref([]); // AI 解释历史，新的在前
let aiSessionId = null;
let aiStore = null;
const searchBox = ref(null);

// 固定模式：不随失焦隐藏，显示任务栏图标，可从任务栏切回
const pinned = ref(false);
// 指针是否在窗口内：点击边框缩放/拖动会瞬时失焦，此时不能隐藏窗口
let pointerInside = false;
let hideTimer = null;
// 标签页：打开过的词条固定为标签，直到手动关闭；随 pinned 一起持久化，重启不丢
const tabs = ref([]);
const activeTab = ref(null);
let stateStore = null;

async function persistState() {
  if (!stateStore) return;
  try {
    await stateStore.set("tabs", tabs.value);
    await stateStore.set("pinned", pinned.value);
    await stateStore.save();
  } catch (e) {
    console.error("状态保存失败", e);
  }
}

async function restoreState() {
  stateStore = await load("state.json", { autoSave: false });
  const savedTabs = await stateStore.get("tabs");
  if (Array.isArray(savedTabs) && savedTabs.length) tabs.value = savedTabs;
  if ((await stateStore.get("pinned")) === true) {
    pinned.value = true;
    await applyPinned();
  }
}

watch(query, (q) => {
  results.value = search(q);
  selectedIndex.value = 0;
  if (view.value !== "search") view.value = "search";
});

async function applyPinned() {
  // 固定 = 置顶最前 + 显示任务栏图标 + 不随失焦隐藏
  await win.setAlwaysOnTop(true);
  await win.setSkipTaskbar(!pinned.value);
}

async function togglePin() {
  pinned.value = !pinned.value;
  try {
    await applyPinned();
  } catch (e) {
    console.error("切换固定模式失败", e);
  }
  persistState();
}

function openTab(term) {
  if (!tabs.value.some((t) => t.abbr === term.abbr)) {
    tabs.value.push(term);
    persistState();
  }
  activeTab.value = term.abbr;
  currentTerm.value = term;
  view.value = "detail";
}

function selectTab(abbr) {
  const t = tabs.value.find((x) => x.abbr === abbr);
  if (!t) return;
  activeTab.value = abbr;
  currentTerm.value = t;
  view.value = "detail";
}

function closeTab(abbr) {
  const i = tabs.value.findIndex((t) => t.abbr === abbr);
  if (i === -1) return;
  tabs.value.splice(i, 1);
  persistState();
  if (activeTab.value === abbr) {
    if (tabs.value.length) {
      selectTab(tabs.value[Math.min(i, tabs.value.length - 1)].abbr);
    } else {
      activeTab.value = null;
      view.value = "search";
      focusInput();
    }
  }
}

function cycleTab(step) {
  if (!tabs.value.length) return;
  const i = tabs.value.findIndex((t) => t.abbr === activeTab.value);
  const next = (i + step + tabs.value.length) % tabs.value.length;
  selectTab(tabs.value[next].abbr);
}

// ---------- AI 解释：多轮会话 + 历史持久化 ----------

async function initAiHistory() {
  aiStore = await load("ai-history.json", { autoSave: false });
  const saved = await aiStore.get("sessions");
  if (Array.isArray(saved)) aiSessions.value = saved;
}

// 每轮回答完成后把当前会话写入历史（同一会话覆盖更新），最多保留 50 条
async function saveAiSession() {
  if (!aiStore || !aiSessionId) return;
  const messages = aiMessages.value
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  if (!messages.some((m) => m.role === "assistant")) return;
  const record = { id: aiSessionId, query: aiQuery.value, time: Date.now(), messages };
  const i = aiSessions.value.findIndex((s) => s.id === aiSessionId);
  if (i === -1) aiSessions.value.unshift(record);
  else aiSessions.value[i] = record;
  if (aiSessions.value.length > 50) aiSessions.value = aiSessions.value.slice(0, 50);
  try {
    await aiStore.set("sessions", aiSessions.value);
    await aiStore.save();
  } catch (e) {
    console.error("AI 历史保存失败", e);
  }
}

// 发起请求并流式写入会话末尾的 assistant 消息
async function streamAi(isFirstAnswer) {
  aiStatus.value = "loading";
  aiError.value = "";
  const payload = aiMessages.value.map((m) => ({ role: m.role, content: m.content }));
  aiMessages.value.push({ role: "assistant", content: "" });
  const idx = aiMessages.value.length - 1;
  try {
    const answer = await askAi(payload, settings.value, (t) => {
      aiMessages.value[idx].content = t;
      aiStatus.value = "streaming";
    });
    aiMessages.value[idx].content = answer;
    aiStatus.value = "done";
    if (isFirstAnswer) {
      const parsed = parseAnswer(answer);
      if (parsed) {
        aiSaved.value = await addUserTerm(parsed);
        // AI 结果静默加入标签页，方便回看
        if (!tabs.value.some((t) => t.abbr === parsed.abbr)) {
          tabs.value.push(parsed);
          persistState();
        }
      }
    }
    await saveAiSession();
  } catch (e) {
    aiMessages.value.splice(idx, 1); // 失败的空占位不留在会话里
    aiStatus.value = "error";
    aiError.value = String(e.message || e);
  }
}

async function runAi(q) {
  const text = q.trim();
  if (!text) return;
  if (!settings.value.apiKey) {
    view.value = "settings";
    return;
  }
  aiQuery.value = text;
  aiSaved.value = false;
  aiSessionId = Date.now();
  aiMessages.value = createSession(text);
  view.value = "ai";
  await streamAi(true);
}

async function runFollowUp(q) {
  const text = q.trim();
  if (!text || aiStatus.value === "loading" || aiStatus.value === "streaming") return;
  aiMessages.value.push({ role: "user", content: text });
  await streamAi(false);
}

// 从历史打开会话：还原上下文，可继续追问
function openAiSession(s) {
  aiSessionId = s.id;
  aiQuery.value = s.query;
  aiMessages.value = restoreSession(s.messages.map((m) => ({ ...m })));
  aiStatus.value = "done";
  aiError.value = "";
  aiSaved.value = false;
  view.value = "ai";
}

async function removeAiSession(id) {
  aiSessions.value = aiSessions.value.filter((s) => s.id !== id);
  try {
    await aiStore.set("sessions", aiSessions.value);
    await aiStore.save();
  } catch (e) {
    console.error("AI 历史保存失败", e);
  }
}

function toggleHistory() {
  if (view.value === "history") {
    view.value = "search";
    focusInput();
  } else {
    view.value = "history";
  }
}

async function dismissWindow() {
  // 固定模式最小化（保留任务栏图标），弹窗模式直接隐藏
  if (pinned.value) await win.minimize();
  else await win.hide();
}

// 关闭按钮：同普通窗口的 ×，直接退出程序
function closeApp() {
  win.destroy();
}

// 拖动手柄 / 空白栏按下即拖动窗口
function startDrag(e) {
  if (e.buttons === 1) win.startDragging();
}

function goBack() {
  if (view.value === "search") {
    if (query.value) query.value = "";
    else dismissWindow();
  } else {
    view.value = "search";
    focusInput();
  }
}

function onKeydown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    goBack();
    return;
  }
  if (e.ctrlKey && (e.key === "h" || e.key === "H")) {
    e.preventDefault();
    toggleHistory();
    return;
  }
  if (e.ctrlKey && (e.key === "w" || e.key === "W")) {
    e.preventDefault();
    if (activeTab.value) closeTab(activeTab.value);
    return;
  }
  if (e.ctrlKey && e.key === "Tab") {
    e.preventDefault();
    cycleTab(e.shiftKey ? -1 : 1);
    return;
  }
  if (view.value === "detail") {
    if (e.key === "Tab") {
      e.preventDefault();
      const t = currentTerm.value;
      runAi(`详细讲讲 ${t.abbr}${t.full ? `（${t.full}）` : ""}`);
    }
    return;
  }
  if (view.value !== "search") return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (results.value.length)
      selectedIndex.value = (selectedIndex.value + 1) % results.value.length;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (results.value.length)
      selectedIndex.value =
        (selectedIndex.value - 1 + results.value.length) % results.value.length;
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (results.value.length) openTab(results.value[selectedIndex.value]);
    else if (query.value.trim()) runAi(query.value);
  } else if (e.key === "Tab") {
    e.preventDefault();
    if (query.value.trim()) runAi(query.value);
  }
}

async function focusInput() {
  await nextTick();
  searchBox.value?.focus();
}

async function showAndFocus() {
  await win.show();
  await win.setFocus();
  focusInput();
}

async function toggleWindow() {
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

async function applyShortcut(shortcut) {
  await unregisterAll();
  await register(shortcut, (event) => {
    if (event.state === "Pressed") toggleWindow();
  });
}

async function onSaveSettings(next) {
  const prev = settings.value.shortcut;
  await saveSettings(next);
  if (next.shortcut !== prev) {
    try {
      await applyShortcut(next.shortcut);
    } catch (e) {
      console.error("热键注册失败", e);
    }
  }
  view.value = "search";
  focusInput();
}

async function setupTray() {
  // HMR / 刷新时避免重复创建托盘图标
  const existing = await TrayIcon.getById("main-tray").catch(() => null);
  if (existing) return;
  const menu = await Menu.new({
    items: [
      { id: "toggle", text: "显示 / 隐藏", action: () => toggleWindow() },
      {
        id: "settings",
        text: "设置",
        action: async () => {
          view.value = "settings";
          await win.show();
          await win.setFocus();
        },
      },
      { id: "quit", text: "退出", action: () => win.destroy() },
    ],
  });
  await TrayIcon.new({
    id: "main-tray",
    icon: await defaultWindowIcon(),
    menu,
    tooltip: "EmbedQuickRef · 嵌入式速查",
    showMenuOnLeftClick: true,
  });
}

onMounted(async () => {
  await initSettings();
  await initUserTerms();
  try {
    await restoreState();
  } catch (e) {
    console.error("状态恢复失败", e);
  }
  try {
    await initAiHistory();
  } catch (e) {
    console.error("AI 历史加载失败", e);
  }
  try {
    await applyShortcut(settings.value.shortcut);
  } catch (e) {
    console.error("热键注册失败", e);
  }
  try {
    await setupTray();
  } catch (e) {
    console.error("托盘创建失败", e);
  }
  await win.onFocusChanged(({ payload: focused }) => {
    if (focused) {
      clearTimeout(hideTimer);
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
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("mouseenter", () => (pointerInside = true));
  document.addEventListener("mouseleave", () => (pointerInside = false));
  // mousemove 兜底：避免错过 mouseenter 导致状态不准
  document.addEventListener("mousemove", () => (pointerInside = true));
  focusInput();
});
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="grip" title="按住拖动窗口" @mousedown.prevent="startDrag">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
          <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
          <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
        </svg>
      </div>
      <SearchBox ref="searchBox" v-model="query" />
      <button
        class="icon-btn"
        :class="{ active: pinned }"
        :title="pinned ? '取消固定（恢复弹窗模式）' : '固定置顶（始终最前 + 任务栏图标）'"
        @click="togglePin"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M12 17v5" />
          <path
            d="M9 3h6l-.6 6.2a4 4 0 0 0 1.7 3.7l1.4 1a.8.8 0 0 1-.5 1.4H7a.8.8 0 0 1-.5-1.4l1.4-1a4 4 0 0 0 1.7-3.7z"
          />
        </svg>
      </button>
      <button
        class="icon-btn"
        :class="{ active: view === 'history' }"
        title="AI 解释历史 (Ctrl+H)"
        @click="toggleHistory"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
          <path d="M3.5 3.5V9H9" />
          <path d="M12 8v4.2l3 1.8" />
        </svg>
      </button>
      <button
        class="icon-btn"
        title="设置"
        @click="view = view === 'settings' ? 'search' : 'settings'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.09a1.6 1.6 0 0 0-1-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.09a1.6 1.6 0 0 0 1.47-1 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32h.09a1.6 1.6 0 0 0 1-1.47V3a2 2 0 1 1 4 0v.09a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77v.09a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.47 1z"
          />
        </svg>
      </button>
      <span class="topbar-sep"></span>
      <button
        class="icon-btn"
        :title="pinned ? '最小化到任务栏' : '收起窗口（热键或托盘可唤回）'"
        @click="dismissWindow"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M5 12h14" />
        </svg>
      </button>
      <button class="icon-btn close-btn" title="关闭" @click="closeApp">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </header>
    <nav v-if="tabs.length" class="tabbar">
      <button
        v-for="t in tabs"
        :key="t.abbr"
        class="tab"
        :class="{ active: view === 'detail' && activeTab === t.abbr }"
        @click="selectTab(t.abbr)"
        @mousedown.middle.prevent="closeTab(t.abbr)"
      >
        <span class="tab-label">{{ t.abbr }}</span>
        <span class="tab-close" title="关闭" @click.stop="closeTab(t.abbr)">×</span>
      </button>
    </nav>
    <main class="content">
      <template v-if="view === 'search'">
        <ResultList
          v-if="results.length"
          :results="results"
          :selected-index="selectedIndex"
          @hover="selectedIndex = $event"
          @open="openTab"
        />
        <div v-else-if="query.trim()" class="empty">
          本地词库未命中，按 <kbd>Enter</kbd> 或 <kbd>Tab</kbd> 问 AI
        </div>
        <div v-else class="empty muted">输入缩写或关键词，如 I2C、MQTT、DTS</div>
      </template>
      <TermCard v-else-if="view === 'detail'" :term="currentTerm" />
      <AiAnswer
        v-else-if="view === 'ai'"
        :query="aiQuery"
        :messages="aiMessages"
        :status="aiStatus"
        :error="aiError"
        :saved="aiSaved"
        @follow-up="runFollowUp"
      />
      <AiHistory
        v-else-if="view === 'history'"
        :sessions="aiSessions"
        @open="openAiSession"
        @remove="removeAiSession"
      />
      <SettingsPanel
        v-else-if="view === 'settings'"
        :settings="settings"
        @save="onSaveSettings"
        @cancel="view = 'search'; focusInput()"
      />
    </main>
    <footer class="statusbar" title="按住拖动窗口" @mousedown.self="startDrag">
      <span><kbd>↑↓</kbd> 选择</span>
      <span><kbd>Enter</kbd> 打开标签</span>
      <span><kbd>Tab</kbd> 问 AI</span>
      <span><kbd>Ctrl+H</kbd> AI 历史</span>
      <span><kbd>Esc</kbd> 返回 / 收起</span>
    </footer>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  background: transparent;
}

body {
  font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 14px;
  color: #1f2937;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  cursor: default;
  overflow: hidden;
}

/* 玻璃外壳：Acrylic 负责底层磨砂，这里叠一层浅色半透明表面 */
.shell {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: rgba(250, 251, 253, 0.66);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.42);
  border-bottom: 1px solid rgba(226, 232, 240, 0.55);
}

.grip {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 34px;
  border-radius: 6px;
  color: #c2ccd8;
  cursor: grab;
}

.grip:hover {
  background: rgba(241, 245, 249, 0.85);
  color: #94a3b8;
}

.grip:active {
  cursor: grabbing;
}

.grip svg {
  width: 14px;
  height: 14px;
}

.icon-btn {
  flex: none;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.icon-btn:hover {
  background: rgba(241, 245, 249, 0.85);
  color: #475569;
}

.icon-btn.active {
  background: rgba(82, 112, 143, 0.14);
  color: #52708f;
}

/* 收起/关闭与功能按钮之间的分隔线 */
.topbar-sep {
  flex: none;
  width: 1px;
  height: 18px;
  margin: 0 2px;
  background: rgba(219, 226, 234, 0.9);
}

.close-btn:hover {
  background: rgba(224, 82, 82, 0.12);
  color: #c05252;
}

.icon-btn svg {
  width: 18px;
  height: 18px;
}

.tabbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabbar::-webkit-scrollbar {
  display: none;
}

.tab {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 6px 0 12px;
  border: 1px solid rgba(219, 226, 234, 0.7);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.5);
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.8);
}

.tab.active {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(143, 168, 196, 0.8);
  color: #334155;
  font-weight: 600;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  color: #a3aebc;
  font-size: 13px;
  line-height: 1;
}

.tab-close:hover {
  background: rgba(226, 232, 240, 0.9);
  color: #475569;
}

.content {
  flex: 1;
  overflow-y: auto;
  background: transparent;
}

.content::-webkit-scrollbar {
  width: 6px;
}

.content::-webkit-scrollbar-thumb {
  background: rgba(215, 221, 228, 0.9);
  border-radius: 3px;
}

.empty {
  padding: 48px 20px;
  text-align: center;
  color: #64748b;
}

.empty.muted {
  color: #a3aebc;
}

.statusbar {
  display: flex;
  gap: 14px;
  padding: 8px 16px;
  border-top: 1px solid rgba(238, 242, 246, 0.7);
  background: rgba(255, 255, 255, 0.42);
  color: #94a3b8;
  font-size: 12px;
}

kbd {
  display: inline-block;
  padding: 1px 5px;
  border: 1px solid rgba(219, 226, 234, 0.9);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: rgba(248, 250, 252, 0.85);
  color: #64748b;
  font-family: inherit;
  font-size: 11px;
}

.tag {
  flex: none;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(238, 242, 247, 0.85);
  color: #64748b;
  font-size: 11px;
  white-space: nowrap;
}
</style>
