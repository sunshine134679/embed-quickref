<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick, defineAsyncComponent } from "vue";
import { getCurrentWindow, currentMonitor } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu } from "@tauri-apps/api/menu";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { listen, emitTo } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import SearchBox from "./components/SearchBox.vue";
import ResultList from "./components/ResultList.vue";
import TermCard from "./components/TermCard.vue";
import FloatingDot from "./components/FloatingDot.vue";
import QuickPanel from "./components/QuickPanel.vue";
// 非首屏组件异步加载：首屏只打包搜索/详情/FloatingDot，其余视图按需拉取
const AiAnswer = defineAsyncComponent(() => import("./components/AiAnswer.vue"));
const HistoryPanel = defineAsyncComponent(() => import("./components/HistoryPanel.vue"));
const SettingsPanel = defineAsyncComponent(() => import("./components/SettingsPanel.vue"));
const TranslatePanel = defineAsyncComponent(() => import("./components/TranslatePanel.vue"));
import { initSettings, useSettings } from "./composables/useSettings";
import { fmtWhen } from "./utils/format";
import { categoryColor } from "./utils/categories";
import { initUserTerms, search, addUserTerm, updateUserTerm, appendUserTermPoints, loadTermHistory, addTermHistory, clearTermHistory, ensureTerms } from "./composables/useSearch";
import { askAi, parseAnswer, createSession, restoreSession } from "./composables/useAi";
import { translateQuery, loadHistory, addHistory, clearHistory } from "./composables/useTranslate";
import { load } from "@tauri-apps/plugin-store";

const win = getCurrentWindow();
// 快捷查找窗口（label=quick）只渲染 QuickPanel，主窗口渲染完整界面
const isQuick = win.label === "quick";
const { settings, saveSettings } = useSettings();

function catStyle(cat) {
  const { fg, bg } = categoryColor(cat);
  return { color: fg, background: bg };
}

const view = ref("search"); // search | detail | ai | history | settings
// 记录进入 AI 页面前的视图，Esc 从 AI 页逐级返回（ai -> detail/history -> search）
const aiFromView = ref("search");
// 搜索分区：terms(术语/缩写) | translate(英语翻译)，与专业名词查询分离
const panel = ref("terms");
const query = ref("");
const results = ref([]);
const selectedIndex = ref(0);
const currentTerm = ref(null);
// 翻译分区状态：status idle | loading | done | error
const translateStatus = ref("idle");
const translateResult = ref(null);
const translateError = ref("");
// 翻译历史（最近的在前），翻译成功后更新
const translateHistory = ref(loadHistory());
let translateTimer = null;
let translateSeq = 0;
const aiQuery = ref("");
const aiMessages = ref([]); // 含 system 的完整多轮会话
const aiStatus = ref("idle"); // idle | loading | streaming | done | error
const aiError = ref("");
const aiSaved = ref(false);
// AI 回答词条在用户词库已存在时提供更新入口
const aiCanUpdate = ref(false);
// 最近一次解析成功的 AI 词条（供"更新个人词库"使用）
let lastParsed = null;

const aiSessions = ref([]); // AI 解释历史，新的在前
let aiSessionId = null;
let aiStore = null;
const searchBox = ref(null);
// 术语搜索历史（打开过的词条）
const termHistory = ref(loadTermHistory());
// 总历史视图（HistoryPanel）当前分区：terms | translate | ai
const historyTab = ref("terms");
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
// 最近一次搜索内容：展开主窗口时恢复输入框（自动全选，方便直接输入搜索）
const LAST_QUERY_KEY = "embed-quickref-last-query";
function loadLastQuery() {
  try {
    return localStorage.getItem(LAST_QUERY_KEY) || "";
  } catch (e) {
    return "";
  }
}
// 进行中的平滑缩窗任务与取消标志（动画路径：淡出与缩窗并行）
let shrinkTask = null;
let shrinkCancel = false;
// 收起动画进行中标志：动画路径防重复触发（双击收起/热键连按），避免并行飞行任务与圆点提前挂载
let collapsing = false;

// 收起飞行动画：main-view 用 CSS transform 从展开位置缩放+平移到圆点位置（GPU 合成，帧率远高于逐帧 resize），
// 动画结束后内容已完全透明，瞬时缩窗无感知；与主界面淡出并行
async function animateShrink() {
  try {
    // 注：acrylic 已在 enterCompact 中提前关闭，此处不再重复
    const scale = await win.scaleFactor();
    const wPos = await win.outerPosition();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = DOT_SIZE / w; // 缩放比：展开宽 -> 圆点宽
    // 目标：内容中心移到圆点中心（物理像素 -> 逻辑 px 换算）
    const endPos = dotRestorePos || wPos;
    // 物理像素差换算为逻辑 px 后，再叠加"窗口中心 -> 圆点中心"的偏移（DOT_SIZE 与 w/h 同属逻辑像素）
    const dx = (endPos.x - wPos.x) / scale + DOT_SIZE / 2 - w / 2;
    const dy = (endPos.y - wPos.y) / scale + DOT_SIZE / 2 - h / 2;
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
    // 动画期间若用户已重新展开（热键/托盘），放弃缩窗，仅清理动画样式
    if (!shrinkCancel) await shrinkToDot();
    animStyle.value = null;
    collapsing = false;
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
  await win.setIgnoreCursorEvents(false).catch(() => {}); // 动画结束恢复鼠标事件
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
// 持久化串行链：快速连续操作（开标签/切固定/关标签）时保证 set/save 顺序执行，
// 避免并发 save 导致最终落盘状态错乱
let saveChain = Promise.resolve();

function persistState() {
  saveChain = saveChain.then(() => doPersist()).catch(() => {});
  return saveChain;
}

async function doPersist() {
  if (!stateStore) return;
  try {
    await stateStore.set("tabs", tabs.value);
    await stateStore.set("activeTab", activeTab.value);
    await stateStore.set("pinned", pinned.value);
    await stateStore.set("mode", mode.value);
    await stateStore.set("panel", panel.value);
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
  const savedPanel = await stateStore.get("panel");
  if (["terms", "translate"].includes(savedPanel)) panel.value = savedPanel;
  const savedPos = await stateStore.get("dotPosition");
  if (savedPos && typeof savedPos.x === "number" && typeof savedPos.y === "number") {
    dotPosition.value = { x: savedPos.x, y: savedPos.y };
  }
  // 恢复上次激活的标签（供展开时直接回到该词条）
  const savedActive = await stateStore.get("activeTab");
  if (savedActive && tabs.value.some((t) => t.abbr === savedActive)) {
    activeTab.value = savedActive;
    currentTerm.value = tabs.value.find((t) => t.abbr === savedActive);
  }
}

watch(query, (q) => {
  // 记忆最近一次搜索内容：展开主窗口时恢复（术语/翻译共用）
  try {
    localStorage.setItem(LAST_QUERY_KEY, q);
  } catch (e) {}
  if (panel.value === "translate") {
    if (view.value !== "search") view.value = "search";
    // 手动触发：输入只清空结果，等待用户回车/点翻译按钮
    translateStatus.value = "idle";
    translateResult.value = null;
    translateError.value = "";
    return;
  }
  results.value = search(q);
  selectedIndex.value = 0;
  if (view.value !== "search") view.value = "search";
});

// 词库懒加载完成后若搜索框已有内容则重新搜索（避免加载完成前输入得到空结果）
ensureTerms().then(() => {
  if (query.value.trim() && panel.value === "terms") {
    results.value = search(query.value);
    selectedIndex.value = 0;
  }
});

// ---------- 英语翻译分区：与专业名词查询分离 ----------

// 立即翻译（Enter/Tab/翻译按钮触发）：先取消未执行的防抖，再执行
function runTranslateNow() {
  clearTimeout(translateTimer);
  const text = (query.value || "").trim();
  if (!text) return;
  runTranslate(text);
}

// 序号守卫：只采纳最后一次触发的翻译结果（快速改输入时丢弃过期响应）
async function runTranslate(text) {
  const seq = ++translateSeq;
  translateStatus.value = "loading";
  translateError.value = "";
  try {
    const result = await translateQuery(text, settings.value);
    if (seq !== translateSeq) return;
    translateResult.value = result;
    translateStatus.value = "done";
    addHistory(result, text);
    translateHistory.value = loadHistory();
  } catch (e) {
    if (seq !== translateSeq) return;
    translateError.value = String(e?.message || e);
    translateStatus.value = "error";
  }
}

// 切换搜索分区：切换即清空输入并回到搜索视图；已选中同分区时也回到搜索视图
function switchPanel(p) {
  if (panel.value !== p) {
    panel.value = p;
    translateSeq++; // 作废进行中的翻译
    clearTimeout(translateTimer);
    query.value = "";
    results.value = [];
    selectedIndex.value = 0;
    translateStatus.value = "idle";
    translateResult.value = null;
    translateError.value = "";
    persistState();
  }
  if (view.value !== "search") view.value = "search";
  focusInput();
}

// ---------- 悬浮圆点模式：形态切换与位置管理 ----------

// 缩回圆点态：64×64 小窗
async function enterCompact(animate = true) {
  // 收起动画进行中：忽略重复触发（双击收起/热键连按），避免并行飞行任务与圆点提前挂载
  if (collapsing) return;
  // 动画路径：切圆点态触发淡出的同时并行平滑缩窗，消除"淡出完才瞬跳"的卡顿
  if (animate && form.value === "expanded") {
    collapsing = true;
    dotReady.value = false; // 先卸载圆点，避免在大窗口内淡入
    // 动画期间窗口纯透明且不拦截鼠标（点击穿透到桌面），动画结束由 onMainLeave 恢复
    win.setIgnoreCursorEvents(true).catch(() => {});
    // 先关闭 acrylic 毛玻璃再启动动画：避免动画期间残留"大边框"与效果切换闪烁
    await win.clearEffects().catch((e) => console.error("关闭窗口效果失败", e));
    form.value = "compact"; // 触发主界面淡出
    shrinkCancel = false;
    shrinkTask = animateShrink(); // 并行开始平滑缩窗（不等待）
    return;
  }
  shrinkCancel = false;
  // 圆点态：关闭毛玻璃背景，保持纯透明（圆点由 CSS 绘制）
  await win.clearEffects().catch(() => {});
  await shrinkToDot();
  form.value = "compact";
  dotReady.value = true;
}

// 展开主界面：680×500，就地展开并纠正到可见区
async function enterExpanded(initialView = "search") {
  // 展开主窗口时隐藏快捷查找窗：避免小窗叠在大窗口上（quick 窗口只服务圆点态 hover）
  invoke("hide_quick").catch(() => {});
  clearTimeout(quickHideTimer);
  // 中断进行中的收起动画（若用户在动画期间展开）：标记取消并清除飞行动画样式
  shrinkCancel = true;
  shrinkTask = null;
  animStyle.value = null;
  collapsing = false; // 动画被中断：解除重复触发守卫
  win.setIgnoreCursorEvents(false).catch(() => {}); // 恢复鼠标事件（动画期间已穿透）
  // 展开态：恢复 acrylic 毛玻璃背景
  await win.setEffects({ effects: ["acrylic"] }).catch((e) => console.error("恢复窗口效果失败", e));
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
  // 有上次搜索内容时优先回搜索态并恢复输入框（自动聚焦+全选，方便直接输入）；设置视图除外
  const savedQuery = loadLastQuery();
  if (savedQuery && initialView !== "settings") {
    view.value = "search";
    query.value = savedQuery;
  }
  if (view.value === "search") focusInput();
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

// 展开时默认视图：若恢复了上次打开的标签则直接展示该词条，否则回搜索
function expandInitialView() {
  return currentTerm.value ? "detail" : "search";
}

// 圆点点击展开（FloatingDot 事件）
async function onDotExpand() {
  await win.show();
  await enterExpanded(expandInitialView());
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
    tabs.value.unshift(term); // 最新打开的标签排在最左边
    persistState();
  }
  activeTab.value = term.abbr;
  currentTerm.value = term;
  view.value = "detail";
  // 记录术语搜索历史（空态/总历史展示）
  addTermHistory(term);
  termHistory.value = loadTermHistory();
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
        lastParsed = parsed;
        const res = await addUserTerm(parsed);
        aiSaved.value = res === "added";
        // 用户词库已有旧缓存：不自动覆盖，提供"更新个人词库"入口（内置词条不覆盖）
        aiCanUpdate.value = res === "user-exists";
        // AI 结果静默加入标签页（最新的排在最左），方便回看
        if (!tabs.value.some((t) => t.abbr === parsed.abbr)) {
          tabs.value.unshift(parsed);
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
  // 防重：请求进行中忽略再次触发（连按 Tab/Enter），避免并发请求重置会话
  if (aiStatus.value === "loading" || aiStatus.value === "streaming") return;
  if (!settings.value.apiKey) {
    view.value = "settings";
    return;
  }
  aiQuery.value = text;
  aiSaved.value = false;
  aiCanUpdate.value = false;
  aiAppended.value = false;
  lastParsed = null;
  aiSessionId = Date.now();
  aiFromView.value = view.value; // 记录来源视图，供 Esc 逐级返回
  aiMessages.value = createSession(text);
  view.value = "ai";
  await streamAi(true);
}

async function runFollowUp(q) {
  const text = q.trim();
  if (!text || aiStatus.value === "loading" || aiStatus.value === "streaming") return;
  aiAppended.value = false; // 新追问到来，并入按钮复位
  aiMessages.value.push({ role: "user", content: text });
  await streamAi(false);
}


// 用本次 AI 回答覆盖更新个人词库中的同缩写词条
async function updateCachedTerm() {
  if (!lastParsed) return;
  const ok = await updateUserTerm(lastParsed);
  if (ok) {
    aiSaved.value = true;
    aiCanUpdate.value = false;
  }
}

// 会话存在追问即显示"追问并入词库"（无论首答是否已缓存/内置/自由回答）
const canAppendFollowups = computed(() => {
  const i = aiMessages.value.findIndex((m) => m.role === "assistant");
  return i >= 0 && aiMessages.value.length > i + 1; // 首答之后还有消息（追问）
});

// AI 总结追问中（按钮显示"总结中…"）
const aiAppending = ref(false);
// 本轮追问是否已成功并入个人词库（由并入流程置位，新会话/新追问时重置）
const aiAppended = ref(false);

// 把本次会话的追问并入词库：先让 AI 把整轮追问总结为精简要点，避免原始拼接杂乱；
// 总结失败时降级为逐条截断拼接，保证内容不丢
async function appendFollowupsToTerm() {
  const i = aiMessages.value.findIndex((m) => m.role === "assistant");
  if (i < 0) return;
  const qas = [];
  let q = "";
  for (const m of aiMessages.value.slice(i + 1)) {
    if (m.role === "user") q = (m.content || "").trim();
    else if (m.role === "assistant" && q) {
      qas.push([q, (m.content || "").trim()]);
      q = "";
    }
  }
  if (!qas.length) return;
  aiAppending.value = true;
  let extra = [];
  try {
    const msgs = [
      {
        role: "system",
        content:
          "你是嵌入式 Linux 领域的资深专家。请把下面的追问对话总结为 2-5 条精简要点：合并重复内容，去除寒暄，每条不超过 30 字，聚焦关键技术点。直接输出要点列表，每行以 \"- \" 开头，不要输出其他任何内容。",
      },
      {
        role: "user",
        content: `术语：${lastParsed?.abbr || aiQuery.value || ""}\n追问对话：\n${qas
          .map(([qq, aa]) => `问：${qq}\n答：${aa}`)
          .join("\n\n")}`,
      },
    ];
    const summary = await askAi(msgs, settings.value, () => {});
    const sumPoints = [...summary.matchAll(/^[-•]\s*(.+)$/gm)]
      .map((m) => m[1].trim())
      .filter(Boolean);
    extra = sumPoints.length
      ? sumPoints.slice(0, 6).map((p) => `追问补充：${p}`)
      : [`追问补充：${summary.replace(/\s+/g, " ").slice(0, 120)}`];
  } catch (e) {
    console.error("追问总结失败，降级为原始拼接", e);
    extra = qas.map(([qq, aa]) => `追问「${qq.replace(/\s+/g, " ").slice(0, 40)}」：${aa.replace(/\s+/g, " ").slice(0, 120)}`);
  } finally {
    aiAppending.value = false;
  }
  // 有解析词条则并入；否则用搜索词创建笔记词条（存个人词库，与内置词条共存）
  const base = lastParsed || {
    abbr: (aiQuery.value || "").trim().slice(0, 20) || "AI 笔记",
    zh: (aiQuery.value || "").trim().slice(0, 20) || "AI 笔记",
    category: "其他",
    definition: "AI 追问笔记",
    points: [],
  };
  let ok = false;
  try {
    // 合并要点而非整体替换：多次追问并入不互相覆盖，按内容去重
    ok = await appendUserTermPoints(base.abbr, extra, base);
  } catch (e) {
    console.error("追问并入词库失败", e);
  }
  if (ok) {
    aiSaved.value = true;
    aiCanUpdate.value = false;
    aiAppended.value = true; // 成功后才显示"已并入"，失败保持可重试
  }
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
  aiCanUpdate.value = false;
  aiAppended.value = false;
  lastParsed = null;
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

// 打开总历史视图（可指定初始分区 terms/translate/ai），再次触发关闭
function toggleHistory(tabName = null) {
  if (view.value === "history") {
    view.value = "search";
    focusInput();
  } else {
    if (tabName) historyTab.value = tabName;
    view.value = "history";
  }
}

// 空态「查看全部记录」：跳转总历史对应分区
function openFullHistory(tabName) {
  historyTab.value = tabName;
  view.value = "history";
}

// 术语历史（最近搜索/总历史）：点击 → 回填搜索框并选中结果第一项（可直接回车/点击进入详情）
function openTermFromHistory(h) {
  if (view.value !== "search") view.value = "search";
  if (panel.value !== "terms") panel.value = "terms";
  query.value = h.abbr;
  // query 未变化时 watch 不触发：手动确保结果列表选中第一项（含选中样式）
  selectedIndex.value = 0;
  focusInput();
}

// 总历史：翻译记录点击 → 回填输入并立即翻译（命中缓存秒出）
function replayHistory(h) {
  query.value = h.input;
  runTranslateNow();
}

// 总历史：清空术语/翻译历史
function clearTermHist() {
  clearTermHistory();
  termHistory.value = [];
}
function clearTransHist() {
  clearHistory();
  translateHistory.value = [];
}

async function dismissWindow() {
  // 收起键：最小化到任务栏（临时显示任务栏图标，点击图标可快速恢复打开）
  try {
    await win.setSkipTaskbar(false);
    await win.minimize();
  } catch (e) {
    console.error("最小化失败，改为隐藏", e);
    await win.hide();
  }
}

// 关闭按钮：先弹确认框防误触，确认后退出程序
const confirmQuit = ref(false);
function closeApp() {
  confirmQuit.value = true;
}
function cancelQuit() {
  confirmQuit.value = false;
}
async function doQuit() {
  confirmQuit.value = false;
  await win.destroy();
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
    if (confirmQuit.value) {
      cancelQuit();
      return;
    }
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
  // 翻译分区：无结果列表，Enter/Tab 均立即翻译
  if (panel.value === "translate") {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      runTranslateNow();
    }
    return;
  }
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

// 指针位置跟踪：供失焦隐藏/收起判定（鼠标进入窗口视为"仍在操作"）
function onPointerEnter() {
  pointerInside = true;
}
function onPointerLeave() {
  pointerInside = false;
}
function onPointerMove() {
  pointerInside = true;
}

async function focusInput() {
  await nextTick();
  searchBox.value?.focus();
}

// ---------- 快捷查找窗口（quick）：圆点 hover 弹出 / 详情跳转回主窗口 ----------

let quickShowTimer = null; // 弹出防抖：鼠标快速划过圆点不弹窗（避免闪烁与残留）
let quickHideTimer = null; // 收起缓冲：离开后留出移动到快捷窗的时间
let quickGen = 0; // 显示代次：退场动画期间重新显示则取消隐藏
// 快捷窗输入状态：聚焦期间不自动隐藏（鼠标移出窗口也不收）
let quickTyping = false;
// 正在输入且内容非空：真正的"使用中"，此时移出圆点/窗口都不收
let quickBusy = false;
const QUICK_SHOW_DELAY = 120; // 弹出防抖时长：鼠标停留超过才弹
const QUICK_HIDE_DELAY = 350; // 离开缓冲：留出从圆点/窗口移向对方的时间
const QUICK_FADE = 140; // 退场动画时长（与 QuickPanel .closing 的 transition 同步）

// 鼠标悬停在悬浮圆点上：防抖后显示快捷查找窗口（定位到圆点旁，位置计算在 Rust 侧）
function showQuickOnHover() {
  clearTimeout(quickShowTimer);
  clearTimeout(quickHideTimer);
  if (form.value !== "compact" || !dotReady.value) return;
  quickGen++; // 预约显示：取消一切进行中的隐藏（含退场动画）
  quickShowTimer = setTimeout(doShowQuick, QUICK_SHOW_DELAY);
}

async function doShowQuick() {
  try {
    const pos = await win.outerPosition();
    await invoke("show_quick", { x: pos.x, y: pos.y });
    // 清除可能残留的退场动画类（退场中重新弹出时恢复内容可见）
    emitTo("quick", "quick-show").catch(() => {});
  } catch (e) {
    console.error("显示快捷查找窗口失败", e);
  }
}

// 统一收起：先播退场动画再隐藏；动画期间若重新显示则放弃隐藏
async function hideQuick() {
  const g = quickGen;
  emitTo("quick", "quick-hide").catch(() => {});
  await new Promise((r) => setTimeout(r, QUICK_FADE));
  if (g !== quickGen) {
    emitTo("quick", "quick-show").catch(() => {}); // 退场期间重新弹出：恢复内容
    return;
  }
  invoke("hide_quick").catch(() => {});
}

function hideQuickDelayed() {
  clearTimeout(quickShowTimer);
  clearTimeout(quickHideTimer);
  quickHideTimer = setTimeout(hideQuick, QUICK_HIDE_DELAY);
}

// 鼠标离开圆点：快速划过时防抖已取消弹出；已弹出则延迟隐藏（快捷窗口内 hover/输入会取消）
function hideQuickOnLeave() {
  if (quickBusy) return; // 正在输入且有内容：不自动隐藏
  hideQuickDelayed();
}

// 快捷窗口内鼠标进入：取消隐藏计时（用户正在移向/使用快捷窗）
function onQuickHoverIn() {
  clearTimeout(quickHideTimer);
}

// 快捷窗口内鼠标离开：正在输入且有内容则保留，否则重新开始隐藏计时
function onQuickHoverOut(e) {
  clearTimeout(quickHideTimer);
  quickBusy = e?.payload?.busy === true;
  if (quickBusy) return;
  hideQuickDelayed();
}

// 快捷窗口失焦（用户点击窗外/切走）：无论是否在输入都安排收起
function onQuickBlur() {
  clearTimeout(quickHideTimer);
  hideQuickDelayed();
}

// 快捷窗口输入框聚焦/失焦：聚焦期间窗口保持，失焦后恢复 hover 自动隐藏
function onQuickTyping(e) {
  quickTyping = e?.payload?.typing === true;
  if (e?.payload?.busy !== undefined) quickBusy = e?.payload?.busy === true;
  if (quickTyping) clearTimeout(quickHideTimer);
}

// 快捷窗口点"查看详情"：展开主窗口并打开对应内容（term 打开词条详情，translate 进入翻译分区）
async function onQuickOpenDetail(payload) {
  if (!payload) return;
  await win.show();
  if (form.value === "compact") {
    await enterExpanded(payload.kind === "translate" ? "search" : "detail");
  }
  if (payload.kind === "term") {
    const t = search(payload.abbr || "")[0];
    if (t) openTab(t);
  } else if (payload.kind === "translate") {
    panel.value = "translate";
    query.value = payload.text || "";
    runTranslateNow();
  }
  await win.setFocus();
}

// 注册快捷窗口事件：hover 弹出 + 详情跳转
async function setupQuickListeners() {
  try {
    await listen("quick-open-detail", (e) => onQuickOpenDetail(e.payload));
    await listen("quick-hover-in", onQuickHoverIn);
    await listen("quick-hover-out", onQuickHoverOut);
    await listen("quick-typing", onQuickTyping);
    await listen("quick-blur", onQuickBlur);
  } catch (err) {
    console.error("快捷窗口事件监听失败", err);
  }
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
      await enterExpanded(expandInitialView());
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
    if (await win.isMinimized()) {
      // 最小化到任务栏时热键唤回：先还原再聚焦
      await win.unminimize();
      await win.setFocus();
      focusInput();
    } else {
      await win.hide();
    }
  } else {
    await win.center();
    await showAndFocus();
  }
}

async function applyShortcut(shortcut, prevShortcut = null) {
  // 先注册新热键，成功后再注销旧的：注册失败时旧热键继续可用，避免热键静默丢失
  try {
    await register(shortcut, (event) => {
      if (event.state === "Pressed") toggleWindow();
    });
    if (prevShortcut && prevShortcut !== shortcut) {
      await unregister(prevShortcut).catch(() => {});
    }
  } catch (e) {
    console.error("热键注册失败", e);
  }
}

// 界面模式切换：立即生效并持久化（floating 即时缩为圆点，其它模式即时展开）
async function onModeChange(m) {
  if (mode.value === m) return;
  mode.value = m;
  persistState();
  if (m === "floating") {
    await enterCompact();
    await win.setSkipTaskbar(true).catch(() => {});
  } else {
    // 固定模式保留任务栏图标，弹窗模式不显示图标
    await win.setSkipTaskbar(m !== "pinned").catch(() => {});
    if (m === "pinned") await win.setAlwaysOnTop(true);
    if (form.value === "compact") {
      await enterExpanded(expandInitialView());
      await win.setFocus();
    }
  }
}

async function onSaveSettings(next) {
  const prev = settings.value.shortcut;
  await saveSettings(next);
  if (next.shortcut !== prev) {
    await applyShortcut(next.shortcut, prev);
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
  // 快捷查找窗口：不初始化主界面逻辑
  if (isQuick) return;
  // 并行初始化：settings / 用户词库 / 状态恢复 / 内置词库预加载互不依赖，
  // 一次 IPC 往返并行减少启动等待（词库拆独立 chunk 后台拉取，不阻塞首屏）
  await Promise.allSettled([
    initSettings(),
    initUserTerms(),
    restoreState(),
    ensureTerms(),
  ]);
  // 启动形态：visible:false 配置下先完成初始化再展示，避免启动闪现完整窗口
  try {
    if (mode.value === "floating") {
      // 悬浮模式：启动即为圆点态并恢复记忆位置（走 enterCompact 统一缩窗路径）
      await enterCompact(false);
      if (dotPosition.value) await applyDotPosition(dotPosition.value);
      await win.show();
    } else if (mode.value === "pinned") {
      // 固定模式：置顶 + 任务栏图标，直接展示主界面
      await Promise.all([win.setAlwaysOnTop(true), win.setSkipTaskbar(false)]);
      await win.show();
      await win.setFocus();
      focusInput();
    }
    // popup 模式：保持隐藏，由全局热键/托盘唤出
  } catch (e) {
    console.error("初始窗口形态设置失败", e);
    await win.show();
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
      // 悬浮/弹窗模式：从"最小化到任务栏"还原后恢复无任务栏图标（dismissWindow 最小化时临时显示）
      if (!pinned.value && mode.value !== "pinned") {
        win.setSkipTaskbar(true).catch(() => {});
      }
      return;
    }
    // 固定（图钉按钮 pinned 或固定模式）：不随失焦收起为圆点 / 隐藏窗口
    if (pinned.value || mode.value === "pinned") return;
    if (mode.value === "floating") {
      // 圆点态常驻桌面；仅展开态失焦后缩回圆点
      if (form.value !== "expanded") return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(async () => {
        if (form.value !== "expanded" || pointerInside) return;
        if (await win.isFocused()) return;
        if (await win.isMinimized()) return; // 最小化到任务栏时抑制缩回圆点
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
    // 展开态拖动窗口：立即同步圆点还原位置（收起时圆点跟随窗口当前位置，不等待防抖）
    if (form.value === "expanded") dotRestorePos = { x: pos.x, y: pos.y };
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
  try {
    await setupQuickListeners();
  } catch (e) {
    console.error("快捷窗口初始化失败", e);
  }
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("mouseenter", onPointerEnter);
  document.addEventListener("mouseleave", onPointerLeave);
  // mousemove 兜底：避免错过 mouseenter 导致状态不准
  document.addEventListener("mousemove", onPointerMove);
  focusInput();
});

// 组件卸载时清理全局监听器（单实例常驻下主要在 HMR/开发环境触发）
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  document.removeEventListener("mouseenter", onPointerEnter);
  document.removeEventListener("mouseleave", onPointerLeave);
  document.removeEventListener("mousemove", onPointerMove);
});
</script>

<template>
  <QuickPanel v-if="isQuick" />
  <div v-else class="shell" :class="{ compact: form === 'compact' }">
    <FloatingDot
      v-if="form === 'compact' && dotReady"
      @expand="onDotExpand"
      @settings="onDotSettings"
      @quit="closeApp"
      @mouseenter="showQuickOnHover"
      @mouseleave="hideQuickOnLeave"
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
      <div class="panel-switch" role="tablist" aria-label="搜索分区">
        <button
          role="tab"
          :aria-selected="panel === 'terms'"
          :class="{ on: panel === 'terms' }"
          title="查询专业名词 / 缩写 / 命令"
          @click="switchPanel('terms')"
        >
          术语
        </button>
        <button
          role="tab"
          :aria-selected="panel === 'translate'"
          :class="{ on: panel === 'translate' }"
          title="翻译英语单词或句子"
          @click="switchPanel('translate')"
        >
          翻译
        </button>
      </div>
      <SearchBox
        ref="searchBox"
        v-model="query"
        :placeholder="panel === 'translate' ? '输入英语单词或句子，回车翻译' : '查询缩写 / 协议 / 术语…'"
        @focus="onSearchFocus"
      />
      <button
        v-if="panel === 'translate'"
        class="translate-go"
        :disabled="!query.trim() || translateStatus === 'loading'"
        title="翻译（Enter）"
        @click="runTranslateNow"
      >
        {{ translateStatus === "loading" ? "翻译中…" : "翻译" }}
      </button>
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
        title="历史记录 (Ctrl+H)"
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
        v-if="mode !== 'floating'"
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
        <template v-if="panel === 'terms'">
          <ResultList
            v-if="results.length"
            :results="results"
            :selected-index="selectedIndex"
            :query="query"
            @hover="selectedIndex = $event"
            @open="openTab"
          />
          <div v-else-if="query.trim()" class="empty empty-ai">
            <p class="empty-title">本地词库未命中</p>
            <p class="empty-hint">
              “{{ query.trim() }}” 不在词库里，可以让 AI 来解释
            </p>
            <p class="empty-tip">按 <kbd>Tab</kbd> 键可直接询问 AI，无需点击按钮</p>
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
          </div>
          <div v-else-if="termHistory.length" class="empty recent-terms">
            <div class="recent-head">
              <span class="recent-title">最近搜索</span>
              <button class="recent-clear" title="清空术语搜索历史" @click="clearTermHist">清空</button>
            </div>
            <div class="recent-list">
              <button
                v-for="(h, i) in termHistory.slice(0, 5)"
                :key="i"
                class="recent-item"
                title="回填搜索并选中结果"
                @click="openTermFromHistory(h)"
              >
                <span class="ri-abbr">{{ h.abbr }}</span>
                <span class="ri-body">
                  <span v-if="h.zh" class="ri-zh">{{ h.zh }}</span>
                  <span v-if="h.full" class="ri-full">{{ h.full }}</span>
                </span>
                <span v-if="h.category" class="tag" :style="catStyle(h.category)">{{ h.category }}</span>
              </button>
            </div>
            <button class="recent-all" @click="openFullHistory('terms')">查看全部记录 ›</button>
          </div>
          <div v-else class="empty muted">输入缩写或关键词，如 I2C、MQTT、DTS</div>
        </template>
        <TranslatePanel
          v-else
          :query="query"
          :status="translateStatus"
          :result="translateResult"
          :error="translateError"
          :history="translateHistory"
          @replay="replayHistory"
          @clear-history="translateHistory = []; clearHistory()"
          @open-full="openFullHistory('translate')"
        />
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
        :can-update="aiCanUpdate"
        :can-append="canAppendFollowups"
        :appending="aiAppending"
        :appended="aiAppended"
        @follow-up="runFollowUp"
        @save-update="updateCachedTerm"
        @append-followups="appendFollowupsToTerm"
      />
      <HistoryPanel
        v-else-if="view === 'history'"
        :initial-tab="historyTab"
        :ai-sessions="aiSessions"
        @open-term="openTermFromHistory"
        @open-translate="replayHistory"
        @open-ai="openAiSession"
        @remove-ai="removeAiSession"
        @clear-terms="clearTermHist"
        @clear-translate="clearTransHist"
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

    <!-- 退出确认弹窗 -->
    <div v-if="confirmQuit" class="confirm-mask" @click.self="cancelQuit">
      <div class="confirm-box">
        <p class="confirm-title">退出 EmbedQuickRef？</p>
        <p class="confirm-hint">退出后需重新打开应用（热键或托盘可唤回）</p>
        <div class="confirm-actions">
          <button class="btn-cancel" @click="cancelQuit">取消</button>
          <button class="btn-quit" @click="doQuit">退出</button>
        </div>
      </div>
    </div>

    <footer class="statusbar" title="按住拖动窗口" @mousedown.self="startDrag">
      <template v-if="panel === 'terms'">
        <span><kbd>↑↓</kbd> 选择</span>
        <span><kbd>Enter</kbd> 打开标签</span>
        <span><kbd>Tab</kbd> 问 AI</span>
      </template>
      <template v-else>
        <span><kbd>Enter</kbd> 翻译</span>
      </template>
      <span><kbd>Ctrl+H</kbd> AI 历史</span>
      <span><kbd>Esc</kbd> 返回 / 收起</span>
    </footer>
    </div></Transition>
  </div>
</template>

<style>
/* 设计 token：颜色统一入口（组件 scoped 样式同样可引用 var()） */
:root {
  /* 文本层级 */
  --text-1: #1f2937;
  --text-2: #334155;
  --text-3: #475569;
  --text-4: #64748b;
  --text-5: #94a3b8;
  --text-6: #a3aebc;
  /* 品牌色 */
  --accent: #52708f;
  --accent-rgb: 82, 112, 143;
  /* 语义色 */
  --success: #6b9e78;
  --danger: #b45353;
  --danger-hover: #a14343;
  --danger-soft: #c05252;
  /* 表面 */
  --bg-card: rgba(250, 251, 253, 0.66);
  --border: #dbe2ea;
  --border-soft: #e2e8f0;
}

/* 键盘导航焦点可见性 */
:focus-visible {
  outline: 2px solid rgba(var(--accent-rgb), 0.55);
  outline-offset: 1px;
}

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
  color: var(--text-1);
  -webkit-font-smoothing: antialiased;
  user-select: none;
  cursor: default;
  overflow: hidden;
}

/* 玻璃外壳：Acrylic 负责底层磨砂；卡片表面（背景/边框）挂在 main-view 上，
   随收起动画一起淡出，避免动画开始时底板瞬间消失 */
.shell {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  border-radius: 12px;
  overflow: hidden;
}

/* 收起动画期间允许飞行内容超出圆角范围 */
.shell.compact {
  overflow: visible;
}

.main-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--bg-card);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 12px;
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
  color: var(--text-5);
}

.grip:active {
  cursor: grabbing;
}

.grip svg {
  width: 14px;
  height: 14px;
}

/* 术语/翻译分区切换：浅灰分段控件，选中态白底浮起 + accent 文字 + 底部指示条 */
.panel-switch {
  flex: none;
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(226, 232, 240, 0.55);
}

.panel-switch button {
  position: relative;
  height: 28px;
  padding: 0 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-4);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.panel-switch button:hover {
  color: var(--text-2);
}

.panel-switch button.on {
  background: rgba(255, 255, 255, 0.92);
  color: var(--accent);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(30, 41, 59, 0.1);
}

.panel-switch button.on::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 2px;
  transform: translateX(-50%);
  width: 14px;
  height: 2px;
  border-radius: 1px;
  background: rgba(var(--accent-rgb), 0.75);
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
  color: var(--text-5);
  cursor: pointer;
}

.icon-btn:hover {
  background: rgba(241, 245, 249, 0.85);
  color: var(--text-3);
}

.icon-btn.active {
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent);
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
  color: var(--danger-soft);
}

.icon-btn svg {
  width: 18px;
  height: 18px;
}

/* 翻译分区的手动翻译按钮：accent 浅底、与 icon-btn 同高 */
.translate-go {
  flex: none;
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease;
}

.translate-go:hover:not(:disabled) {
  background: rgba(var(--accent-rgb), 0.22);
}

.translate-go:disabled {
  opacity: 0.45;
  cursor: default;
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
  max-width: 180px;
  border: 1px solid rgba(219, 226, 234, 0.7);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.5);
  color: var(--text-4);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.tab-label {
  min-width: 0;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.8);
}

.tab.active {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(143, 168, 196, 0.8);
  color: var(--text-2);
  font-weight: 600;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  color: var(--text-6);
  font-size: 13px;
  line-height: 1;
}

.tab-close:hover {
  background: rgba(226, 232, 240, 0.9);
  color: var(--text-3);
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
  color: var(--text-4);
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
  color: var(--text-2);
}

.empty-hint {
  max-width: 380px;
  color: var(--text-5);
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
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ask-ai-btn:hover {
  background: rgba(var(--accent-rgb), 0.18);
  border-color: rgba(var(--accent-rgb), 0.8);
}

.ask-ai-btn:active {
  transform: translateY(1px);
}

.ask-ai-btn svg {
  width: 16px;
  height: 16px;
}

.empty-tip {
  margin-top: 18px;
  padding: 8px 14px;
  background: rgba(var(--accent-rgb), 0.08);
  border: 1px dashed rgba(var(--accent-rgb), 0.3);
  border-radius: 8px;
  color: var(--accent);
  font-size: 13px;
}

/* 空态有历史解释时：主按钮查看历史，副按钮重新问 */
.ask-ai-btn.ghost {
  margin-top: 2px;
  padding: 7px 16px;
  background: transparent;
  border-color: rgba(219, 226, 234, 0.95);
  color: var(--text-4);
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
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ai-entry:hover {
  background: rgba(var(--accent-rgb), 0.16);
  border-color: rgba(var(--accent-rgb), 0.75);
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
  color: var(--text-6);
}

/* 术语空态：最近搜索（最多 5 条）+ 查看全部 */
.recent-terms {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 40px 20px;
}

.recent-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 4px;
}

.recent-title {
  color: var(--text-5);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
}

.recent-clear {
  border: none;
  background: transparent;
  color: var(--text-6);
  font-size: 11px;
  cursor: pointer;
}

.recent-clear:hover {
  color: var(--danger-soft);
}

.recent-list {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.recent-item:hover {
  background: rgba(241, 245, 249, 0.9);
  border-color: rgba(219, 226, 234, 0.7);
}

.ri-abbr {
  flex: none;
  min-width: 60px;
  font-weight: 700;
  color: var(--text-2);
  font-size: 13px;
}

.ri-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ri-zh {
  color: var(--text-2);
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ri-full {
  color: var(--text-5);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-all {
  margin-top: 10px;
  padding: 7px 16px;
  border: 1px solid rgba(143, 168, 196, 0.6);
  border-radius: 8px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.recent-all:hover {
  background: rgba(var(--accent-rgb), 0.18);
}

.statusbar {
  display: flex;
  gap: 14px;
  padding: 8px 16px;
  border-top: 1px solid rgba(238, 242, 246, 0.7);
  background: rgba(255, 255, 255, 0.42);
  color: var(--text-5);
  font-size: 12px;
}

kbd {
  display: inline-block;
  padding: 1px 5px;
  border: 1px solid rgba(219, 226, 234, 0.9);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: rgba(248, 250, 252, 0.85);
  color: var(--text-4);
  font-family: inherit;
  font-size: 11px;
}

.tag {
  flex: none;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(238, 242, 247, 0.85);
  color: var(--text-4);
  font-size: 11px;
  white-space: nowrap;
}


/* 退出确认弹窗 */
.confirm-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 41, 59, 0.35);
}

.confirm-box {
  width: 300px;
  padding: 22px 24px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(203, 213, 225, 0.8);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(30, 41, 59, 0.18);
}

.confirm-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}

.confirm-hint {
  margin-top: 6px;
  color: var(--text-4);
  font-size: 12.5px;
  line-height: 1.6;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.confirm-actions button {
  height: 32px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-cancel {
  background: rgba(100, 116, 139, 0.1);
  color: var(--text-3);
}

.btn-cancel:hover {
  background: rgba(100, 116, 139, 0.18);
}

.btn-quit {
  background: var(--danger);
  color: #fff;
}

.btn-quit:hover {
  background: var(--danger-hover);
}
</style>
