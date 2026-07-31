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
import SettingsPanel from "./components/SettingsPanel.vue";
import { initSettings, useSettings } from "./composables/useSettings";
import { initUserTerms, search, addUserTerm } from "./composables/useSearch";
import { askAi, parseAnswer } from "./composables/useAi";

const win = getCurrentWindow();
const { settings, saveSettings } = useSettings();

const view = ref("search"); // search | detail | ai | settings
const query = ref("");
const results = ref([]);
const selectedIndex = ref(0);
const currentTerm = ref(null);
const aiQuery = ref("");
const aiText = ref("");
const aiStatus = ref("idle"); // idle | loading | streaming | done | error
const aiError = ref("");
const aiSaved = ref(false);
const searchBox = ref(null);

watch(query, (q) => {
  results.value = search(q);
  selectedIndex.value = 0;
  if (view.value !== "search") view.value = "search";
});

function openDetail(term) {
  currentTerm.value = term;
  view.value = "detail";
}

async function runAi(q) {
  const text = q.trim();
  if (!text) return;
  if (!settings.value.apiKey) {
    view.value = "settings";
    return;
  }
  aiQuery.value = text;
  aiText.value = "";
  aiError.value = "";
  aiSaved.value = false;
  aiStatus.value = "loading";
  view.value = "ai";
  try {
    const answer = await askAi(text, settings.value, (t) => {
      aiText.value = t;
      aiStatus.value = "streaming";
    });
    aiStatus.value = "done";
    const parsed = parseAnswer(answer);
    if (parsed) aiSaved.value = await addUserTerm(parsed);
  } catch (e) {
    aiStatus.value = "error";
    aiError.value = String(e.message || e);
  }
}

function goBack() {
  if (view.value === "search") {
    if (query.value) query.value = "";
    else win.hide();
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
    if (results.value.length) openDetail(results.value[selectedIndex.value]);
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

async function toggleWindow() {
  if (await win.isVisible()) {
    await win.hide();
  } else {
    await win.center();
    await win.show();
    await win.setFocus();
    focusInput();
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
    if (!focused) win.hide();
  });
  window.addEventListener("keydown", onKeydown);
  focusInput();
});
</script>

<template>
  <div class="shell">
    <header class="topbar" data-tauri-drag-region>
      <SearchBox ref="searchBox" v-model="query" />
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
    </header>
    <main class="content">
      <template v-if="view === 'search'">
        <ResultList
          v-if="results.length"
          :results="results"
          :selected-index="selectedIndex"
          @hover="selectedIndex = $event"
          @open="openDetail"
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
        :text="aiText"
        :status="aiStatus"
        :error="aiError"
        :saved="aiSaved"
      />
      <SettingsPanel
        v-else-if="view === 'settings'"
        :settings="settings"
        @save="onSaveSettings"
        @cancel="view = 'search'; focusInput()"
      />
    </main>
    <footer class="statusbar">
      <span><kbd>↑↓</kbd> 选择</span>
      <span><kbd>Enter</kbd> 详情</span>
      <span><kbd>Tab</kbd> 问 AI</span>
      <span><kbd>Esc</kbd> 返回 / 隐藏</span>
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

.shell {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid #eef2f6;
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
  background: #f1f5f9;
  color: #475569;
}

.icon-btn svg {
  width: 18px;
  height: 18px;
}

.content {
  flex: 1;
  overflow-y: auto;
  background: #f9fafb;
}

.content::-webkit-scrollbar {
  width: 6px;
}

.content::-webkit-scrollbar-thumb {
  background: #d7dde4;
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
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid #eef2f6;
  background: #ffffff;
  color: #94a3b8;
  font-size: 12px;
}

kbd {
  display: inline-block;
  padding: 1px 5px;
  border: 1px solid #dbe2ea;
  border-bottom-width: 2px;
  border-radius: 4px;
  background: #f8fafc;
  color: #64748b;
  font-family: inherit;
  font-size: 11px;
}

.tag {
  flex: none;
  padding: 2px 8px;
  border-radius: 10px;
  background: #eef2f7;
  color: #64748b;
  font-size: 11px;
  white-space: nowrap;
}
</style>
