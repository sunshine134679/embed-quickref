<script setup>
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
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
import FloatingDot from "./components/FloatingDot.vue";
import { initSettings, useSettings } from "./composables/useSettings";
import { initUserTerms, search, addUserTerm } from "./composables/useSearch";
import { askAi, parseAnswer, createSession, restoreSession } from "./composables/useAi";
import { load } from "@tauri-apps/plugin-store";

const win = getCurrentWindow();
const { settings, saveSettings } = useSettings();

const view = ref("search"); // search | detail | ai | history | settings
// 记录进入 AI 页面前的视图，Esc 从 AI 页逐级返回（ai -> detail/history -> search）
const aiFromView = ref("search");
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
// 悬浮圆点模式：compact(圆点) | expanded(主界面)
const form = ref("expanded");
// 界面模式：floating(悬浮圆点，默认) | popup(弹窗) | pinned(固定)
const mode = ref("floating");
const dotPosition = ref(null);
// 展开前的圆点位置：收起时精确还原，避免缩放锚点导致的位置漂移
let dotRestorePos = null;
// 圆点挂载时机：动画路径下缩窗完成前不挂载，避免圆点在大窗口内淡入后跳变
const dotReady = ref(false);
// 收起飞行动画样式（CSS transform 缩放+平移，GPU 合成 60fps，替代窗口 resize 动画）
const animStyle = ref(null);
const DOT_SIZE = 64;
const EXPAND_W = 680;
const EXPAND_H = 500;
// 进行中的平滑缩窗任务与取消标志（动画路径：淡出与缩窗并行）
let shrinkTask = null;
let shrinkCancel = false;

// 收起飞行动画：main-view 用 CSS transform 从展开位置缩放+平移到圆点位置（GPU 合成，帧率远高于逐帧 resize），
// 动画结束后内容已完全透明，瞬时缩窗无感知；与主界面淡出并行
async function animateShrink() {
  try {
    const scale = await win.scaleFactor();
    const wPos = await win.outerPosition();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = DOT_SIZE / w; // 缩放比：展开宽 -> 圆点宽
    // 目标：内容中心移到圆点中心（物理像素 -> 逻辑 px 换算）
    const endPos = dotRestorePos || wPos;
    const dx = (endPos.x + DOT_SIZE / 2 - (wPos.x + (w * scale) / 2)) / scale;
    const dy = (endPos.y + DOT_SIZE / 2 - (wPos.y + (h * scale) / 2)) / scale;
    animStyle.value = {
      transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})`,
      opacity: "0",
      transition: "transform 220ms cubic-bezier(0.5, 0, 0.75, 0.4), opacity 200ms ease",
      transformOrigin: "center center",
    };
    await new Promise((r) => setTimeout(r, 230));
  } catch (e) {
    console.error("飞行动画计算失败", e);
  } finally {
    animStyle.value = null; // 清除动画样式（内容已透明，恢复无感知）
    await shrinkToDot(); // 瞬时缩窗：内容不可见，无跳变
  }
}

// 窗口缩为 64×64 并还原到圆点位置（setMinSize 必须先于 setSize，之后缩放与移动并行）
async function shrinkToDot() {
  try {
    await win.setMinSize(new LogicalSize(DOT_SIZE, DOT_SIZE));
    await Promise.all([
      win.setSize(new LogicalSize(DOT_SIZE, DOT_SIZE)),
      dotRestorePos
        ? win.setPosition(new PhysicalPosition(dotRestorePos.x, dotRestorePos.y))
        : Promise.resolve(),
    ]);
  } catch (e) {
    console.error("缩回圆点失败", e);
  }
  dotRestorePos = null;
}

// 主界面淡出完成（Transition after-leave）：等待并行的平滑缩窗完成后挂载圆点
async function onMainLeave() {
  if (form.value !== "compact") return;
  if (shrinkTask) await shrinkTask; // 淡出与缩窗并行，此处等缩窗收尾
  dotReady.value = true; // 缩窗完成后才挂载圆点并淡入
}

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
    await stateStore.set("mode", mode.value);
    await stateStore.set("dotPosition", dotPosition.value);
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
  const savedMode = await stateStore.get("mode");
  if (["floating", "popup", "pinned"].includes(savedMode)) mode.value = savedMode;
  const savedPos = await stateStore.get("dotPosition");
  if (savedPos && typeof savedPos.x === "number" && typeof savedPos.y === "number") {
    dotPosition.value = { x: savedPos.x, y: savedPos.y };
  }
}

watch(query, (q) => {
  results.value = search(q);
  selectedIndex.value = 0;
  if (view.value !== "search") view.value = "search";
});

// ---------- 悬浮圆点模式：形态切换与位置管理 ----------

// 缩回圆点态：64×64 小窗
async function enterCompact(animate = true) {
  // 动画路径：切圆点态触发淡出的同时并行平滑缩窗，消除"淡出完才瞬跳"的卡顿
  if (animate && form.value === "expanded") {
    dotReady.value = false; // 先卸载圆点，避免在大窗口内淡入
    form.value = "compact"; // 触发主界面淡出
    shrinkCancel = false;
    shrinkTask = animateShrink(); // 并行开始平滑缩窗（不等待）
    return;
  }
  shrinkCancel = false;
  await shrinkToDot();
  form.value = "compact";
  dotReady.value = true;
}

// 展开主界面：680×500，就地展开并纠正到可见区
async function enterExpanded(initialView = "search") {
  // 中断进行中的原生平滑缩窗动画（若用户在收起动画期间展开）
  shrinkCancel = true;
  shrinkTask = null;
  // 记录圆点位置：收起时精确还原，避免缩放锚点导致的位置漂移
  if (form.value === "compact") {
    try {
      const pos = await win.outerPosition();
      dotRestorePos = { x: pos.x, y: pos.y };
    } catch (e) {
      console.error("记录圆点位置失败", e);
    }
  }
  try {
    await win.setMinSize(new LogicalSize(520, 300));
    await win.setSize(new LogicalSize(EXPAND_W, EXPAND_H));
    await clampToVisible();
  } catch (e) {
    console.error("展开失败", e);
  }
  form.value = "expanded";
  view.value = initialView;
  if (initialView === "search") focusInput();
}

// 窗口位置纠正到当前显示器可见范围（完整可见 clamp，物理像素）
async function clampToVisible() {
  try {
    const mon = await currentMonitor();
    if (!mon) return;
    const p = await win.outerPosition();
    const s = await win.outerSize();
    const maxX = Math.max(0, mon.size.width - s.width);
    const maxY = Math.max(0, mon.size.height - s.height);
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
  aiFromView.value = view.value; // 记录来源视图，供 Esc 逐级返回
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
  aiFromView.value = view.value; // 记录来源视图（history/search），供 Esc 逐级返回
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

// 未命中空态入口：点击按钮直接问 AI（无 API Key 引导去设置）
function askAiFromEmpty() {
  if (!query.value.trim()) return;
  runAi(query.value);
}

// 归一化：小写 + 去空白，用于历史会话与搜索词的模糊匹配
function norm(s) {
  return (s || "").toLowerCase().replace(/\s+/g, "");
}

// 查找与某词相关的最近一次 AI 解释会话（新的在前，返回最先命中）
function findAiSession(text) {
  const t = norm(text);
  if (!t) return null;
  return (
    aiSessions.value.find((s) => {
      const q = norm(s.query);
      if (!q) return false;
      if (q === t) return true;
      if (t.length >= 2 && q.includes(t)) return true;
      if (q.length >= 2 && t.includes(q)) return true;
      return false;
    }) || null
  );
}

// 详情页对应词条的历史 AI 解释（先用缩写匹配，再尝试全称）
const termAiSession = computed(() => {
  if (view.value !== "detail" || !currentTerm.value) return null;
  return (
    findAiSession(currentTerm.value.abbr) ||
    (currentTerm.value.full ? findAiSession(currentTerm.value.full) : null) ||
    null
  );
});

// 搜索空态对应搜索词的历史 AI 解释
const emptyAiSession = computed(() => {
  if (view.value !== "search" || !query.value.trim()) return null;
  return findAiSession(query.value);
});

// 历史时间的人类可读格式：今天/昨天 HH:MM，更早显示日期
function fmtWhen(ts) {
  const d = new Date(ts);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return `今天 ${hm}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

function goBack() {
  if (view.value === "search") {
    if (query.value) query.value = "";
    else if (mode.value === "floating" && form.value === "expanded") enterCompact();
    else dismissWindow();
  } else if (view.value === "ai") {
    // 逐级返回：回到进入 AI 页前的视图（detail/history），否则回搜索
    const back = ["detail", "history"].includes(aiFromView.value) ? aiFromView.value : "search";
    view.value = back;
    if (back === "search") focusInput();
  } else {
    view.value = "search";
    focusInput();
  }
}

// 点击/聚焦搜索框：从任何页面切回搜索结果视图（保留已输入的搜索词）
function onSearchFocus() {
  if (view.value !== "search") view.value = "search";
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

async function applyShortcut(shortcut) {
  await unregisterAll();
  await register(shortcut, (event) => {
    if (event.state === "Pressed") toggleWindow();
  });
}

// 界面模式切换：立即生效并持久化（floating 即时缩为圆点，其它模式即时展开）
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
  // 悬浮模式：启动即为圆点态并恢复记忆位置
  if (mode.value === "floating") {
    await enterCompact(false);
    if (dotPosition.value) await applyDotPosition(dotPosition.value);
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
    if (mode.value === "floating") {
      // 圆点态常驻桌面；仅展开态失焦后缩回圆点
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
        const mon = await currentMonitor();
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
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("mouseenter", () => (pointerInside = true));
  document.addEventListener("mouseleave", () => (pointerInside = false));
  // mousemove 兜底：避免错过 mouseenter 导致状态不准
  document.addEventListener("mousemove", () => (pointerInside = true));
  focusInput();
});
</script>

<template>
  <div class="shell" :class="{ compact: form === 'compact' }">
    <FloatingDot
      v-if="form === 'compact' && dotReady"
      @expand="onDotExpand"
      @settings="onDotSettings"
      @quit="closeApp"
    />
    <Transition name="fade" @after-leave="onMainLeave"><div v-show="form === `expanded`" class="main-view" :style="animStyle">
    <header class="topbar">
      <div class="grip" title="按住拖动窗口" @mousedown.prevent="startDrag">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
          <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
          <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
        </svg>
      </div>
      <SearchBox ref="searchBox" v-model="query" @focus="onSearchFocus" />
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
        v-if="mode === 'floating'"
        class="icon-btn"
        title="收起为悬浮小圆点"
        @click="enterCompact"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="12" cy="12" r="8.5" stroke-dasharray="2 2.6" />
          <circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none" />
        </svg>
      </button>
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
        <div v-else-if="query.trim()" class="empty empty-ai">
          <p class="empty-title">本地词库未命中</p>
          <p class="empty-hint">
            “{{ query.trim() }}” 不在词库里，可以让 AI 来解释
          </p>
          <template v-if="emptyAiSession">
            <button class="ask-ai-btn" @click="openAiSession(emptyAiSession)">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
              >
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              </svg>
              查看上次 AI 解释 · {{ fmtWhen(emptyAiSession.time) }}
            </button>
            <button class="ask-ai-btn ghost" @click="askAiFromEmpty">重新问 AI</button>
          </template>
          <button v-else class="ask-ai-btn" @click="askAiFromEmpty">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            问 AI：{{ query.trim().slice(0, 18) }}{{ query.trim().length > 18 ? "…" : "" }}
          </button>
          <p class="empty-tip">或按 <kbd>Enter</kbd> / <kbd>Tab</kbd> 直接询问</p>
        </div>
        <div v-else class="empty muted">输入缩写或关键词，如 I2C、MQTT、DTS</div>
      </template>
      <div v-else-if="view === 'detail'" class="detail-wrap">
        <button
          v-if="termAiSession"
          class="ai-entry"
          title="打开之前的 AI 解释会话"
          @click="openAiSession(termAiSession)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
          <span class="ai-entry-text">已用 AI 解释过 · {{ fmtWhen(termAiSession.time) }}</span>
          <span class="ai-entry-arrow">查看解释 ›</span>
        </button>
        <TermCard :term="currentTerm" />
      </div>
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
        :mode="mode"
        @save="onSaveSettings"
        @cancel="view = 'search'; focusInput()"
        @update:mode="onModeChange"
      />
    </main>
    <footer class="statusbar" title="按住拖动窗口" @mousedown.self="startDrag">
      <span><kbd>↑↓</kbd> 选择</span>
      <span><kbd>Enter</kbd> 打开标签</span>
      <span><kbd>Tab</kbd> 问 AI</span>
      <span><kbd>Ctrl+H</kbd> AI 历史</span>
      <span><kbd>Esc</kbd> 返回 / 收起</span>
    </footer>
    </div></Transition>
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

.shell.compact {
  background: transparent;
  border: none;
  overflow: visible;
}

.main-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* 主界面展开/收起淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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

.empty-ai {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: #334155;
}

.empty-hint {
  max-width: 380px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.ask-ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 9px 18px;
  border: 1px solid rgba(143, 168, 196, 0.65);
  border-radius: 10px;
  background: rgba(82, 112, 143, 0.1);
  color: #52708f;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ask-ai-btn:hover {
  background: rgba(82, 112, 143, 0.18);
  border-color: rgba(82, 112, 143, 0.8);
}

.ask-ai-btn:active {
  transform: translateY(1px);
}

.ask-ai-btn svg {
  width: 16px;
  height: 16px;
}

.empty-tip {
  color: #a3aebc;
  font-size: 12px;
}

/* 空态有历史解释时：主按钮查看历史，副按钮重新问 */
.ask-ai-btn.ghost {
  margin-top: 2px;
  padding: 7px 16px;
  background: transparent;
  border-color: rgba(219, 226, 234, 0.95);
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
}

.ask-ai-btn.ghost:hover {
  background: rgba(241, 245, 249, 0.85);
  border-color: rgba(143, 168, 196, 0.7);
}

/* 详情页顶部：历史 AI 解释入口条 */
.detail-wrap {
  padding: 14px 24px 0;
}

.ai-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-bottom: 10px;
  padding: 9px 14px;
  border: 1px solid rgba(143, 168, 196, 0.55);
  border-radius: 10px;
  background: rgba(82, 112, 143, 0.08);
  color: #52708f;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ai-entry:hover {
  background: rgba(82, 112, 143, 0.16);
  border-color: rgba(82, 112, 143, 0.75);
}

.ai-entry:active {
  transform: translateY(1px);
}

.ai-entry svg {
  flex: none;
  width: 15px;
  height: 15px;
}

.ai-entry-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-entry-arrow {
  flex: none;
  font-weight: 600;
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
