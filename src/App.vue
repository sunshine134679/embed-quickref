<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick, defineAsyncComponent } from "vue";
import { getCurrentWindow, currentMonitor, availableMonitors } from "@tauri-apps/api/window";
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
const SettingsPanel = defineAsyncComponent(() => import("./components/SettingsPage.vue"));
const TranslatePanel = defineAsyncComponent(() => import("./components/TranslatePanel.vue"));
import { initSettings, useSettings } from "./composables/useSettings";
import { fmtWhen } from "./utils/format";
import { categoryColor } from "./utils/categories";
import { initUserTerms, search, addUserTerm, updateUserTerm, appendUserTermPoints, loadTermHistory, addTermHistory, clearTermHistory, ensureTerms } from "./composables/useSearch";
import { askAi, parseAnswer, createSession, restoreSession } from "./composables/useAi";
import { translateQuery, loadHistory, addHistory, clearHistory } from "./composables/useTranslate";
import { hasApiCandidate } from "./utils/apiCandidates";
import { loadFavorites, saveFavorites, toggleFavorite, isFavorite } from "./composables/useFavorites";
import { load } from "@tauri-apps/plugin-store";

const win = getCurrentWindow();
// 快捷查找窗口（label=quick）只渲染 QuickPanel，主窗口渲染完整界面
const isQuick = win.label === "quick";
const { settings, saveSettings, secretStatus } = useSettings();

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
let translateSeq = 0;
let termSearchTimer = null;
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
// 搜索栏下方"最近搜索"：术语历史 + 翻译历史按时间合并（最近的在前，最多 5 条）
const recentMix = computed(() => {
  const items = [
    ...termHistory.value.map((h) => ({ ...h, t: h.time || 0 })),
    ...translateHistory.value.map((h) => ({ ...h, t: h.time || 0 })),
  ];
  items.sort((a, b) => b.t - a.t);
  return items.slice(0, 5);
});
// 翻译历史摘要：首行截断
function transSummaryLine(s) {
  return (s || "").split("\n")[0].slice(0, 60);
}
// 总历史视图（HistoryPanel）当前分区：terms | translate | ai
const historyTab = ref("terms");
// 悬浮圆点模式：compact(圆点) | expanded(主界面)
const form = ref("expanded");
// 界面模式：floating(悬浮圆点，默认) | popup(弹窗) | pinned(固定)
const mode = ref("floating");
const dotPosition = ref(null);
// 展开前的圆点位置：收起时精确还原，避免缩放锚点导致的位置漂移
let dotRestorePos = null;
// 圆点相对展开主窗口左上角的物理像素偏移，保证右侧/底部圆点也能原路收回
let dotAnchorOffset = { x: 0, y: 0 };
// 原生 setPosition 触发的延迟 onMoved：只忽略与最近一次程序化目标完全相同的事件
let expectedProgrammaticPosition = null;
// 动画期间收到的最后一次焦点状态，动画结束后重新核对，避免直接丢弃失焦事件
let pendingFocus = null;
let focusReconcileTimer = null;
// 圆点挂载时机：原生窗口边界动画完成前不挂载，避免圆点在大窗口内淡入后跳变
const dotReady = ref(false);
// 主界面动画期间的视觉隐藏样式
const animStyle = ref(null);
// 展开时的起点圆点代理，主面板完成 CSS 展开后卸载
const expandProxy = ref(false);
const expandProxyStyle = ref(null);
// 收起时在固定的大窗口内播放 CSS 飞行动画，完成后再一次性切换原生窗口边界
const flyStyle = ref(null);
const DOT_SIZE = 64;
const EXPAND_W = 680;
const EXPAND_H = 500;
const WINDOW_ANIMATION_MS = 240;
const FLY_DOT_SIZE = 44;
// 最近一次搜索内容：展开主窗口时恢复输入框（自动全选，方便直接输入搜索）
const LAST_QUERY_KEY = "embed-quickref-last-query";
function loadLastQuery() {
  try {
    return localStorage.getItem(LAST_QUERY_KEY) || "";
  } catch (e) {
    return "";
  }
}
// 当前窗口边界动画。每次新动画都会取消旧令牌，旧异步任务即使晚返回也不能提交状态。
let windowAnimationSeq = 0;
let activeWindowAnimation = null;
// 原生窗口边界调用串行，避免尺寸/位置操作在 Windows 侧倒序到达。
let windowBoundsQueue = Promise.resolve();
// Acrylic 切换也串行，避免旧收起的 clearEffects 覆盖新展开的 setEffects。
let windowEffectsQueue = Promise.resolve();
const transitionPhase = ref("idle"); // idle | expanding | collapsing

function beginWindowAnimation() {
  if (activeWindowAnimation) activeWindowAnimation.cancelled = true;
  clearTimeout(focusReconcileTimer);
  focusReconcileTimer = null;
  pendingFocus = null;
  const token = { id: ++windowAnimationSeq, cancelled: false };
  activeWindowAnimation = token;
  return token;
}

function isCurrentWindowAnimation(token) {
  return activeWindowAnimation === token && !token.cancelled && token.id === windowAnimationSeq;
}

function cancelWindowAnimation() {
  windowAnimationSeq += 1;
  if (activeWindowAnimation) activeWindowAnimation.cancelled = true;
  clearTimeout(focusReconcileTimer);
  focusReconcileTimer = null;
  pendingFocus = null;
  activeWindowAnimation = null;
}

function finishWindowAnimation(token) {
  if (activeWindowAnimation === token) activeWindowAnimation = null;
}

function queueWindowBounds(size, position) {
  const run = () => Promise.all([
    win.setSize(new LogicalSize(Math.max(1, Math.round(size.width)), Math.max(1, Math.round(size.height)))),
    win.setPosition(new PhysicalPosition(Math.round(position.x), Math.round(position.y))),
  ]);
  const task = windowBoundsQueue.then(run, run);
  windowBoundsQueue = task.catch(() => {});
  return task;
}

function queueWindowEffects(run) {
  const task = windowEffectsQueue.then(run, run);
  windowEffectsQueue = task.catch(() => {});
  return task;
}

function markProgrammaticPosition(position) {
  expectedProgrammaticPosition = position ? { x: position.x, y: position.y } : null;
}

function consumeProgrammaticPosition(position) {
  if (!expectedProgrammaticPosition) return false;
  const expected = expectedProgrammaticPosition;
  expectedProgrammaticPosition = null;
  return Math.abs(position.x - expected.x) <= 2 && Math.abs(position.y - expected.y) <= 2;
}

function waitForAnimation(token, duration = WINDOW_ANIMATION_MS) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const check = () => {
      if (!isCurrentWindowAnimation(token)) {
        resolve(false);
        return;
      }
      if (performance.now() - startedAt >= duration) {
        resolve(true);
        return;
      }
      setTimeout(check, 16);
    };
    check();
  });
}

async function readWindowBounds() {
  const [scale, position, size] = await Promise.all([
    win.scaleFactor(),
    win.outerPosition(),
    win.outerSize(),
  ]);
  return {
    scale,
    position: { x: position.x, y: position.y },
    size: {
      width: Math.max(DOT_SIZE, size.width / scale),
      height: Math.max(DOT_SIZE, size.height / scale),
    },
  };
}

async function clampWindowPosition(pos, size, scale, monitor = null) {
  try {
    const mon = monitor || await currentMonitor();
    if (!mon || !pos) return pos;
    const area = mon.workArea || { position: mon.position, size: mon.size };
    const ax = area.position.x;
    const ay = area.position.y;
    const aw = area.size.width;
    const ah = area.size.height;
    const widthPx = Math.round(size.width * scale);
    const heightPx = Math.round(size.height * scale);
    return {
      x: Math.min(Math.max(pos.x, ax), ax + Math.max(0, aw - widthPx)),
      y: Math.min(Math.max(pos.y, ay), ay + Math.max(0, ah - heightPx)),
    };
  } catch {
    return pos;
  }
}

async function restoreExpandedBounds() {
  await win.setMinSize(new LogicalSize(DOT_SIZE, DOT_SIZE));
  const current = await readWindowBounds();
  const target = { width: EXPAND_W, height: EXPAND_H };
  const monitor = await currentMonitor().catch(() => null);
  // 主窗口尽量沿用圆点位置；若大窗口靠近屏幕边缘，则只移动窗口本身，保留圆点偏移作为动画原点。
  const targetPosition = await clampWindowPosition(current.position, target, current.scale, monitor);
  const origin = {
    x: (current.position.x - targetPosition.x) / current.scale + DOT_SIZE / 2,
    y: (current.position.y - targetPosition.y) / current.scale + DOT_SIZE / 2,
  };
  return { current, target, targetPosition, origin };
}

// 固定模式：不随失焦隐藏，显示任务栏图标，可从任务栏切回
const pinned = ref(false);
// 指针是否在窗口内：点击边框缩放/拖动会瞬时失焦，此时不能隐藏窗口
let pointerInside = false;
let hideTimer = null;
let moveTimer = null; // onMoved 防抖保存（onMounted 内赋值，卸载时统一清理）
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

function searchTermsNow(q) {
  results.value = search(q);
  selectedIndex.value = 0;
  if (view.value !== "search") view.value = "search";
}

watch(query, (q) => {
  clearTimeout(termSearchTimer);
  // 记忆最近一次搜索内容：展开主窗口时恢复（术语/翻译共用）
  try {
    localStorage.setItem(LAST_QUERY_KEY, q);
  } catch (e) {}
  if (panel.value === "translate") {
    if (view.value !== "search") view.value = "search";
    // 手动触发：输入只清空结果，等待用户回车/点翻译按钮。
    // 但程序化回填（历史回放/联想/快捷窗跳转）是先改 query 再 runTranslateNow：
    // 此时已在 loading，复位会把 loading/结果冲掉，按钮闪回"翻译"字样
    if (translateStatus.value !== "loading") {
      translateStatus.value = "idle";
      translateResult.value = null;
      translateError.value = "";
    }
    return;
  }
  clearTimeout(termSearchTimer);
  termSearchTimer = setTimeout(() => {
    termSearchTimer = null;
    if (panel.value === "terms" && query.value === q) searchTermsNow(q);
  }, 40);
});

// 词库懒加载完成后若搜索框已有内容则重新搜索（避免加载完成前输入得到空结果）
ensureTerms().then(() => {
  if (query.value.trim() && panel.value === "terms") {
    searchTermsNow(query.value);
  }
}).catch((e) => {
  // 词库 chunk 加载失败：标记错误态，空态展示「加载失败+重试」而非静默伪装成"未命中"
  console.error("内置词库加载失败", e);
  termsError.value = true;
});

// ---------- 英语翻译分区：与专业名词查询分离 ----------

// 翻译流式中用户手动改输入：作废在途请求的结果（防止旧文本继续上屏与输入框错位）。
// 只由用户键入触发（input 事件透传自 SearchBox 根元素）；历史回放/联想/快捷窗跳转等
// 程序化回填只改 query 不产生 input 事件，保持"先改 query 再 runTranslateNow"路径不受影响
function onUserEditQuery() {
  if (panel.value !== "translate" || translateStatus.value !== "loading") return;
  translateSeq++;
  translateAbortCtrl?.abort();
  translateAbortCtrl = null;
  translateStatus.value = "idle";
  translateResult.value = null;
  translateError.value = "";
}

// ---------- 全局轻量通知（toast）：发音失败/保存失败等一次性提示 ----------
const notice = ref(null); // { text, kind: "error" | "info" }
let noticeTimer = null;
function showNotice(text, kind = "error") {
  notice.value = { text, kind };
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = null;
  }, 3200);
}

// 立即翻译（Enter/Tab/翻译按钮触发）
function runTranslateNow() {
  const text = (query.value || "").trim();
  if (!text) return;
  runTranslate(text);
}

// 序号守卫：只采纳最后一次触发的翻译结果（快速改输入时丢弃过期响应）
// 每次触发同时中止上一次仍在途的请求：真实取消网络占用，而非只丢弃显示
let translateAbortCtrl = null;
async function runTranslate(text) {
  // 与发音截断上限一致的输入侧拦截：超长文本直接报错，避免白等 30s 网络超时
  if ((text || "").trim().length > 6000) {
    translateAbortCtrl?.abort();
    translateAbortCtrl = null;
    translateSeq++;
    translateStatus.value = "error";
    translateResult.value = null;
    translateError.value = "文本过长（超过 6000 字符），请分段翻译";
    return;
  }
  translateAbortCtrl?.abort();
  const ctrl = new AbortController();
  translateAbortCtrl = ctrl;
  const seq = ++translateSeq;
  translateStatus.value = "loading";
  translateError.value = "";
  try {
    const result = await translateQuery(text, settings.value, (partial, target) => {
      // 流式上屏：长句翻译逐段更新结果卡片；过期响应丢弃
      if (seq !== translateSeq) return;
      translateResult.value = { kind: "sentence", text, target, translated: partial };
    }, ctrl.signal);
    if (seq !== translateSeq) return;
    translateResult.value = result;
    translateStatus.value = "done";
    // 未找到/拼写错误不算有效翻译，不写入历史
    if (result.kind !== "word-not-found") {
      addHistory(result, text);
      translateHistory.value = loadHistory();
    }
  } catch (e) {
    if (seq !== translateSeq) return;
    const msg = String(e?.message || e);
    // no-api-key 是内部错误码，直接展示对用户无意义
    translateError.value = msg === "no-api-key" ? "尚未配置 API Key：请到设置页添加服务商与密钥" : msg;
    translateStatus.value = "error";
  } finally {
    if (translateAbortCtrl === ctrl) translateAbortCtrl = null; // 只清理本次句柄，不误伤新请求
  }
}

// 切换搜索分区：切换即清空输入并回到搜索视图；已选中同分区时也回到搜索视图
function switchPanel(p) {
  if (panel.value !== p) {
    panel.value = p;
    translateSeq++; // 作废进行中的翻译
    translateAbortCtrl?.abort();
    translateAbortCtrl = null;
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
  if (transitionPhase.value === "collapsing") return;
  const token = beginWindowAnimation();
  transitionPhase.value = "collapsing";
  dotReady.value = false;
  expandProxy.value = false;
  flyStyle.value = null;
  animStyle.value = animate && form.value === "expanded" ? { visibility: "hidden" } : null;
  await win.setIgnoreCursorEvents(true).catch(() => {});

  try {
    const clearEffectsTask = queueWindowEffects(() =>
      win.clearEffects().catch((e) => console.error("关闭窗口效果失败", e)),
    );

    await win.setMinSize(new LogicalSize(DOT_SIZE, DOT_SIZE));
    const current = await readWindowBounds();
    const targetPosition = await clampWindowPosition(
      dotRestorePos || {
        x: current.position.x + dotAnchorOffset.x,
        y: current.position.y + dotAnchorOffset.y,
      },
      { width: DOT_SIZE, height: DOT_SIZE },
      current.scale,
    );
    if (animate && form.value === "expanded") {
      const w = current.size.width;
      const h = current.size.height;
      const dx = (targetPosition.x - current.position.x) / current.scale + DOT_SIZE / 2 - w / 2;
      const dy = (targetPosition.y - current.position.y) / current.scale + DOT_SIZE / 2 - h / 2;
      // 原生窗口保持大尺寸，真正的位移由 CSS 动画完成，避免 Tauri IPC 调尺寸造成低帧率。
      flyStyle.value = {
        left: `${w / 2 - FLY_DOT_SIZE / 2}px`,
        top: `${h / 2 - FLY_DOT_SIZE / 2}px`,
        "--fly-dx": `${dx.toFixed(1)}px`,
        "--fly-dy": `${dy.toFixed(1)}px`,
      };
      const [effectsCleared, animationFinished] = await Promise.all([
        clearEffectsTask.then(() => true),
        waitForAnimation(token),
      ]);
      if (!effectsCleared || !animationFinished || !isCurrentWindowAnimation(token)) return;
    } else {
      await clearEffectsTask;
      if (!isCurrentWindowAnimation(token)) return;
    }
    markProgrammaticPosition(targetPosition);
    const completed = await queueWindowBounds(
      { width: DOT_SIZE, height: DOT_SIZE },
      targetPosition,
    ).then(() => true);
    if (!completed || !isCurrentWindowAnimation(token)) return;

    flyStyle.value = null;
    form.value = "compact";
    await nextTick();
    animStyle.value = null;
    dotReady.value = true;
    dotRestorePos = null;
    dotAnchorOffset = { x: 0, y: 0 };
    await win.setIgnoreCursorEvents(false).catch(() => {});
  } catch (e) {
    if (isCurrentWindowAnimation(token)) {
      console.error("缩回圆点失败", e);
      // 异常路径也必须复位鼠标穿透：否则窗口对点击完全无响应，只能靠热键再展开恢复
      win.setIgnoreCursorEvents(false).catch(() => {});
    }
  } finally {
    if (isCurrentWindowAnimation(token)) {
      transitionPhase.value = "idle";
      finishWindowAnimation(token);
      if (form.value === "expanded") scheduleFocusReconcile();
    }
  }
}

// 展开主界面：680×500，就地展开并纠正到可见区
// opts.skipRestore：快捷窗跳转（quick-open-detail）时跳过"恢复上次搜索内容"——
// 该场景马上要设置自己的 query/打开详情，恢复会触发 watch 把详情视图覆盖回搜索
// opts.noFocus：跳转后不聚焦搜索框（AI 跳转场景，聚焦会触发 onSearchFocus 把 AI 视图覆盖回搜索）
async function enterExpanded(initialView = "search", opts = {}) {
  if (transitionPhase.value === "expanding") return;
  const token = beginWindowAnimation();
  transitionPhase.value = "expanding";
  dotReady.value = false;
  expandProxy.value = true;
  flyStyle.value = null;
  expandProxyStyle.value = null;
  animStyle.value = {
    transformOrigin: `${DOT_SIZE / 2}px ${DOT_SIZE / 2}px`,
    transform: "scale(0.08)",
    opacity: 0,
    transition: "none",
  };
  // 展开主窗口时隐藏快捷查找窗：避免小窗叠在大窗口上（quick 窗口只服务圆点态 hover）
  await invoke("hide_quick").catch(() => {});
  clearTimeout(quickHideTimer);
  await win.setIgnoreCursorEvents(false).catch(() => {});

  try {
    if (!isCurrentWindowAnimation(token)) return;
    const { current, target, targetPosition, origin } = await restoreExpandedBounds();
    if (!isCurrentWindowAnimation(token)) return;
    // 保存圆点相对主窗口的真实偏移：右侧圆点可能位于展开窗口的右侧区域。
    dotRestorePos = { x: current.position.x, y: current.position.y };
    dotAnchorOffset = {
      x: current.position.x - targetPosition.x,
      y: current.position.y - targetPosition.y,
    };
    expandProxyStyle.value = {
      left: `${origin.x.toFixed(1)}px`,
      top: `${origin.y.toFixed(1)}px`,
    };
    animStyle.value = {
      transformOrigin: `${origin.x.toFixed(1)}px ${origin.y.toFixed(1)}px`,
      transform: "scale(0.08)",
      opacity: 0,
      transition: "none",
    };
    // 先准备最终页面内容；动画期间主面板不可见，避免动画结束后突然换页。
    view.value = initialView;
    // 回到 AI 解释页时不做"恢复上次搜索"：那会把用户从解释页强行拽回旧搜索结果
    const savedQuery = loadLastQuery();
    if (!opts.skipRestore && savedQuery && initialView !== "settings" && initialView !== "ai") {
      view.value = "search";
      query.value = savedQuery;
    }
    // 若圆点位于工作区边缘，原生窗口可以向左/上移动，但视觉起点仍保持在真实圆点上。
    markProgrammaticPosition(targetPosition);
    await queueWindowBounds({ width: DOT_SIZE, height: DOT_SIZE }, targetPosition);
    if (!isCurrentWindowAnimation(token)) return;
    await queueWindowBounds(target, targetPosition);
    if (!isCurrentWindowAnimation(token)) return;
    await win.setMinSize(new LogicalSize(520, 300));
    if (!isCurrentWindowAnimation(token)) return;

    form.value = "expanded";
    expandProxy.value = false;
    expandProxyStyle.value = null;
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (!isCurrentWindowAnimation(token)) return;
    animStyle.value = {
      transformOrigin: `${origin.x.toFixed(1)}px ${origin.y.toFixed(1)}px`,
      transform: "scale(1)",
      opacity: 1,
      transition: `transform ${WINDOW_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease-out`,
    };
    if (!await waitForAnimation(token)) return;
    animStyle.value = null;
    // 等主面板完成 CSS 展开后再恢复 Acrylic，避免原生效果先把整块大窗口瞬间铺出来。
    await queueWindowEffects(() =>
      win.setEffects({ effects: ["acrylic"] }).catch((e) => console.error("恢复窗口效果失败", e)),
    );
    if (!isCurrentWindowAnimation(token)) return;
    if (!opts.noFocus && view.value === "search") focusInput();
  } catch (e) {
    if (isCurrentWindowAnimation(token)) console.error("展开失败", e);
  } finally {
    if (isCurrentWindowAnimation(token)) {
      transitionPhase.value = "idle";
      finishWindowAnimation(token);
    }
  }
}

// 坐标所属显示器：包含该点的优先，否则取矩形中心距离最近的。
// 恢复记忆的圆点位置必须按坐标选屏——窗口此时还在默认主屏位置，
// currentMonitor() 返回的是窗口所在显示器，会把副屏坐标错误钳回主屏并经 onMoved 落盘
async function monitorForPoint(x, y) {
  try {
    const monitors = await availableMonitors();
    if (!monitors || !monitors.length) return null;
    const hit = monitors.find(
      (m) =>
        x >= m.position.x &&
        x < m.position.x + m.size.width &&
        y >= m.position.y &&
        y < m.position.y + m.size.height
    );
    if (hit) return hit;
    let best = null;
    let bestDist = Infinity;
    for (const m of monitors) {
      const d = (m.position.x + m.size.width / 2 - x) ** 2 + (m.position.y + m.size.height / 2 - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    return best;
  } catch {
    return null;
  }
}

// 钳制坐标到显示器可见区内：防最小化（outerPosition 返回 -32000）或异常状态
// 把圆点/窗口带出屏幕（物理像素，与 outerPosition/setPosition 同单位）；
// 显式传入 monitor 时按该显示器钳制（恢复位置按坐标选屏），否则按窗口当前所在显示器
async function clampToWorkArea(pos, size = DOT_SIZE, monitor = null) {
  try {
    if (!pos) return pos;
    const mon = monitor || (await currentMonitor());
    if (!mon) return pos;
    return clampWindowPosition(pos, { width: size, height: size }, mon.scaleFactor || 1, mon);
  } catch {
    return pos;
  }
}

// 应用记忆的圆点位置（钳制到可见区，异常保存值不会把圆点带出屏幕）
async function applyDotPosition(p) {
  try {
    const mon = await monitorForPoint(p.x, p.y);
    const c = await clampToWorkArea(p, DOT_SIZE, mon);
    await win.setPosition(new PhysicalPosition(c.x, c.y));
  } catch (e) {
    console.error("恢复圆点位置失败", e);
  }
}

// 展开时默认视图：回到收起前正在看的页面——
// AI 解释会话保留在内存中（收起再展开应回到上次解释）；搜索/详情/历史也原样返回，
// 避免旧逻辑"有标签就跳详情"把停在搜索页的用户丢到随机的旧详情页。
// settings 属临时视图不恢复；冷启动 view 初值为 search，行为与旧版一致
function expandInitialView() {
  if (view.value === "ai" && aiMessages.value.length) return "ai";
  if (view.value === "detail") return "detail";
  if (view.value === "search" || view.value === "history") return "search";
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
  // 固定 = 置顶最前 + 显示任务栏图标 + 不随失焦隐藏；取消固定必须同步复位置顶
  await win.setAlwaysOnTop(pinned.value);
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

// AI 单会话消息上限：超长追问链不拖垮历史面板与存储（截尾保留最近内容）
const AI_SESSION_MESSAGE_LIMIT = 40;

// 每轮回答完成后把当前会话写入历史（同一会话覆盖更新），最多保留 50 条
async function saveAiSession() {
  if (!aiStore || !aiSessionId) return;
  const messages = aiMessages.value
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-AI_SESSION_MESSAGE_LIMIT);
  if (!messages.some((m) => m.role === "assistant")) return;
  const record = { id: aiSessionId, query: aiQuery.value, time: Date.now(), messages };
  const i = aiSessions.value.findIndex((s) => s.id === aiSessionId);
  if (i === -1) aiSessions.value.unshift(record);
  else {
    // 追问后时间已刷新：移回列表顶部，展示序与“新会话在前”语义一致（原实现原地替换会出现时间新而位置旧）
    aiSessions.value.splice(i, 1);
    aiSessions.value.unshift(record);
  }
  if (aiSessions.value.length > 50) aiSessions.value = aiSessions.value.slice(0, 50);
  try {
    await aiStore.set("sessions", aiSessions.value);
    await aiStore.save();
  } catch (e) {
    console.error("AI 历史保存失败", e);
  }
}

// 会话代次：openAiSession 等整体替换会话时递增，让进行中流式回调按旧代次整体失效，
// 防止流式期间打开历史会话时旧流把内容写进新会话（串话/TypeError/误删消息/坏数据落盘）
let aiSeq = 0;
// 当前流式请求的取消句柄：离开 AI 视图/切换会话时中止网络请求，
// 旧流不再继续写会话、不入库、不落历史（配合 aiSeq 代次双保险）
let aiAbortCtrl = null;

// 离开 AI 视图（Esc/切视图/聚焦搜索框/切换会话）：中止在途请求并复位状态
function cancelAiStream() {
  aiSeq++;
  aiAbortCtrl?.abort();
  aiAbortCtrl = null;
  if (aiStatus.value === "loading" || aiStatus.value === "streaming") {
    aiStatus.value = "idle";
  }
}

// 离开 AI 视图即中止在途请求：一条 watcher 覆盖 Esc/切视图/历史会话等全部退出路径
watch(view, (v) => {
  if (v !== "ai" && (aiStatus.value === "loading" || aiStatus.value === "streaming")) {
    cancelAiStream();
  }
});

// 发起请求并流式写入会话末尾的 assistant 消息
// reuseLast：重试时复用失败的占位消息（从空重新累积），不另起新消息
async function streamAi(isFirstAnswer, reuseLast = false) {
  aiStatus.value = "loading";
  aiError.value = "";
  const payload = aiMessages.value.map((m) => ({ role: m.role, content: m.content }));
  let idx;
  if (reuseLast && aiMessages.value[aiMessages.value.length - 1]?.role === "assistant") {
    idx = aiMessages.value.length - 1;
    aiMessages.value[idx].content = ""; // 清掉失败残留，避免与新输出拼接
  } else {
    aiMessages.value.push({ role: "assistant", content: "" });
    idx = aiMessages.value.length - 1;
  }
  const seq = ++aiSeq;
  const ctrl = new AbortController();
  aiAbortCtrl = ctrl;
  try {
    const answer = await askAi(payload, settings.value, (t) => {
      if (seq !== aiSeq) return; // 会话已被整体替换（如流式期间打开历史），丢弃过期输出
      const m = aiMessages.value[idx];
      if (m && m.role === "assistant") m.content = t;
      aiStatus.value = "streaming";
    }, ctrl.signal);
    if (seq !== aiSeq) return; // 过期流式：不写回、不落历史、不改状态
    if (!answer) throw new Error("AI 返回了空回答"); // 空回答按错误处理，不再静默显示空气泡并落盘
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
    if (seq !== aiSeq) return; // 过期流式的失败不触碰已被替换的新会话
    const partial = aiMessages.value[idx]?.content || "";
    if (!partial) {
      aiMessages.value.splice(idx, 1); // 尚无任何输出：空占位不留在会话里
    }
    // 已有部分输出：保留已显示内容（配合「重试」按钮重新发起），不整段抹掉用户读过的内容
    aiStatus.value = "error";
    aiError.value = String(e.message || e);
  } finally {
    if (aiAbortCtrl === ctrl) aiAbortCtrl = null; // 只清理本次请求的句柄，不误伤新请求
  }
}

async function runAi(q) {
  const text = q.trim();
  if (!text) return;
  // 防重：请求进行中忽略再次触发（连按 Tab/Enter），避免并发请求重置会话
  if (aiStatus.value === "loading" || aiStatus.value === "streaming") return;
  if (!hasApiCandidate(settings.value)) {
    // 不再静默切到设置页：就地给出引导条，用户知道 AI 为何不可用
    noApiHint.value = true;
    return;
  }
  noApiHint.value = false;
  aiQuery.value = text;
  aiSaved.value = false;
  aiCanUpdate.value = false;
  aiAppended.value = false;
  lastParsed = null;
  // 同词重复问 AI：复用同名历史会话 id（覆盖更新），历史列表不堆积重复条目
  const existing = aiSessions.value.find((s) => norm(s.query) === norm(text));
  aiSessionId = existing ? existing.id : Date.now();
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

// 重试失败的回答：保留会话与问题上下文，清空失败残留后重新流式
async function retryAi() {
  if (aiStatus.value !== "error") return;
  const i = aiMessages.value.findIndex((m) => m.role === "assistant");
  if (i === -1) return; // 失败时无任何输出（占位已被删）：回到搜索重新发起
  const isFirst = i === aiMessages.value.length - 1; // 失败的是首答才保留入库语义
  aiSaved.value = false;
  aiCanUpdate.value = false;
  await streamAi(isFirst, true);
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
  cancelAiStream(); // 使进行中流式回调整体失效并中止网络请求（onDelta/收尾/catch 均按代次丢弃）
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

// 清空全部 AI 解释历史（历史面板 AI tab「清空」按钮）
async function clearAiHistory() {
  aiSessions.value = [];
  if (!aiStore) return;
  try {
    await aiStore.set("sessions", []);
    await aiStore.save();
  } catch (e) {
    console.error("AI 历史清空失败", e);
  }
}

// 打开总历史视图（可指定初始分区 terms/translate/ai），再次触发关闭
function toggleHistory(tabName = null) {
  if (view.value === "history") {
    view.value = "search";
    focusInput();
  } else {
    // 顶栏按钮/Ctrl+H 无参数：始终默认术语分区（避免沿用上次的 translate/ai 残留）；
    // 类型守卫：模板若直接传函数引用，Vue 会把 event 当作首参传入
    historyTab.value = typeof tabName === "string" ? tabName : "terms";
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

// ---------- 收藏：词条详情星标切换，历史面板「术语」tab 顶部回看 ----------
const favorites = ref(loadFavorites());

function onToggleStar() {
  favorites.value = toggleFavorite(favorites.value, currentTerm.value);
  saveFavorites(favorites.value);
}

// 总历史：翻译记录点击 → 回填输入并立即翻译（命中缓存秒出）
function replayHistory(h) {
  // 从术语分区/总历史点翻译记录：先切到翻译面板，避免 query 变化落入术语搜索分支
  if (panel.value !== "translate") panel.value = "translate";
  query.value = h.input;
  runTranslateNow();
}

// 输入联想建议点击：回填建议词并立即翻译
function onUseSuggestion(word) {
  query.value = word;
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
// 最近搜索混排列表的清空：术语 + 翻译一起清
function clearRecent() {
  clearTermHist();
  clearTransHist();
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
async function quitApplication() {
  try {
    // 必须退出整个 Tauri 应用，而不是只销毁 main 窗口；quick 窗口和托盘仍会保持进程运行。
    await invoke("exit_app");
  } catch (error) {
    console.error("退出应用失败", error);
  }
}
async function doQuit() {
  confirmQuit.value = false;
  await quitApplication();
}

// 拖动手柄 / 空白栏按下即拖动窗口
function startDrag(e) {
  if (e.buttons === 1) win.startDragging();
}

// 未命中空态入口：点击按钮直接问 AI（无 API Key 时就地引导去设置）
function askAiFromEmpty() {
  if (!query.value.trim()) return;
  runAi(query.value);
}

// 内置词库加载失败 / 未配置 API Key 的引导状态（就地提示，不再静默跳页/伪装未命中）
const termsError = ref(false);
const noApiHint = ref(false);

// 词库加载失败后的手动重试
async function retryLoadTerms() {
  termsError.value = false;
  try {
    await ensureTerms();
    if (query.value.trim() && panel.value === "terms") searchTermsNow(query.value);
  } catch (e) {
    console.error("内置词库重试加载失败", e);
    termsError.value = true;
  }
}

// 配置好 API Key 后自动清除无 Key 引导（下次请求走 hasApiCandidate 判定）
watch(
  () => settings.value.apiKey,
  () => {
    if (noApiHint.value && hasApiCandidate(settings.value)) noApiHint.value = false;
  }
);

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

// 详情页「AI 展开讲讲」/ Tab 快捷键共用入口：无历史会话时也可见
function askAiExplainTerm() {
  const t = currentTerm.value;
  if (!t) return;
  runAi(`详细讲讲 ${t.abbr}${t.full ? `（${t.full}）` : ""}`);
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
      askAiExplainTerm();
    }
    return;
  }
  if (view.value !== "search") return;
  // 翻译分区：无结果列表，Enter/Tab 均立即翻译（在途时不重复触发，与翻译按钮禁用一致）
  if (panel.value === "translate") {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (translateStatus.value === "loading") return;
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
    clearTimeout(termSearchTimer);
    searchTermsNow(query.value);
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

function scheduleFocusReconcile() {
  clearTimeout(focusReconcileTimer);
  focusReconcileTimer = setTimeout(async () => {
    focusReconcileTimer = null;
    const wasBlurredDuringTransition = pendingFocus === false;
    pendingFocus = null;
    if (!wasBlurredDuringTransition || transitionPhase.value !== "idle" || form.value !== "expanded") return;
    if (pointerInside || await win.isFocused().catch(() => true) || await win.isMinimized().catch(() => false)) return;
    await enterCompact();
  }, 120);
}

// ---------- 快捷查找窗口（quick）：圆点 hover 弹出 / 详情跳转回主窗口 ----------

let quickShowTimer = null; // 弹出防抖：鼠标快速划过圆点不弹窗（避免闪烁与残留）
let quickHideTimer = null; // 收起缓冲：离开后留出移动到快捷窗的时间
let quickGen = 0; // 显示代次：退场动画期间重新显示则取消隐藏
let quickShowTicket = 0; // 异步定位/显示令牌：鼠标已离开圆点时丢弃过期的显示请求
// 快捷窗输入状态：聚焦期间不自动隐藏（鼠标移出窗口也不收）
let quickTyping = false;
// 正在输入且内容非空：真正的"使用中"，此时移出圆点/窗口都不收
let quickBusy = false;
// 鼠标是否仍在圆点/快捷窗上：busy 变 false 时据此重新评估是否需要收起
let dotHovered = false;
let quickWindowHovered = false;
// 快捷窗最近一次真正隐藏的时间：刚隐藏后短时间内重新弹出不再抢 OS 焦点
// （用户刚用完移开、鼠标又路过圆点时，不打断正在使用的应用）
let lastQuickHideAt = 0;
const QUICK_SHOW_DELAY = 120; // 弹出防抖时长：鼠标停留超过才弹
const QUICK_HIDE_DELAY = 350; // 离开缓冲：留出从圆点/窗口移向对方的时间
const QUICK_FADE = 140; // 退场等待时长：略大于 QuickPanel .closing 的 120ms transition，留余量防动画截断
const QUICK_FOCUS_COOLDOWN = 1500; // 隐藏后重新弹出不抢焦点的冷却时长
// AI 跳转（快捷窗 Tab）后失焦缩回屏蔽期：展开瞬间 acrylic 效果异步应用等会产生一次失焦，
// 用户鼠标不在窗内（pointerInside=false）时会 200ms 缩回——屏蔽跳转后这段时间的失焦缩回
const AI_JUMP_GUARD_MS = 3000;
let aiJumpGuardUntil = 0;

// 鼠标悬停在悬浮圆点上：防抖后显示快捷查找窗口（定位到圆点旁，位置计算在 Rust 侧）
function showQuickOnHover() {
  clearTimeout(quickShowTimer);
  clearTimeout(quickHideTimer);
  if (form.value !== "compact" || !dotReady.value) return;
  dotHovered = true;
  const ticket = ++quickShowTicket;
  quickGen++; // 预约显示：取消一切进行中的隐藏（含退场动画）
  quickShowTimer = setTimeout(() => doShowQuick(ticket), QUICK_SHOW_DELAY);
}

async function doShowQuick(ticket) {
  try {
    if (ticket !== quickShowTicket || !dotHovered || form.value !== "compact" || !dotReady.value) return;
    const pos = await win.outerPosition();
    // outerPosition 是异步读取；期间鼠标可能已经离开圆点，避免迟到的弹窗覆盖当前应用。
    if (ticket !== quickShowTicket || !dotHovered || form.value !== "compact" || !dotReady.value) return;
    // 刚隐藏过（用户刚用完移开、鼠标又路过圆点）→ 重新弹出不抢焦点，避免反复打断
    const focus = Date.now() - lastQuickHideAt > QUICK_FOCUS_COOLDOWN;
    // 按圆点实际坐标解析所在显示器并传给 Rust：副屏上的圆点不再被主屏参数错屏钳制
    const mon = await monitorForPoint(pos.x, pos.y);
    const wa = mon?.workArea;
    await invoke("show_quick", {
      x: pos.x,
      y: pos.y,
      focus,
      scale: mon?.scaleFactor ?? null,
      areaX: wa ? wa.position.x : null,
      areaY: wa ? wa.position.y : null,
      areaW: wa ? wa.size.width : null,
      areaH: wa ? wa.size.height : null,
    });
    // 清除可能残留的退场动画类（退场中重新弹出时恢复内容可见）；
    // 携带 focus 标志：冷却期重弹（focus=false）时快捷窗不再自动聚焦输入框，
    // 避免"刚用完移开、鼠标又路过圆点"的误触再次劫持键盘输入
    emitTo("quick", "quick-show", { focus }).catch(() => {});
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
    emitTo("quick", "quick-show", { focus: false }).catch(() => {}); // 退场期间重新弹出：恢复内容
    return;
  }
  // 退场期间用户重新使用（回窗 hover/继续输入）：放弃隐藏，恢复内容
  if (quickBusy || quickWindowHovered) {
    emitTo("quick", "quick-show", { focus: false }).catch(() => {});
    return;
  }
  lastQuickHideAt = Date.now();
  invoke("hide_quick").catch(() => {});
}

function hideQuickDelayed() {
  clearTimeout(quickShowTimer);
  clearTimeout(quickHideTimer);
  quickHideTimer = setTimeout(hideQuick, QUICK_HIDE_DELAY);
}

// 鼠标离开圆点：快速划过时防抖已取消弹出；已弹出则延迟隐藏（快捷窗口内 hover/输入会取消）
function hideQuickOnLeave() {
  dotHovered = false;
  quickShowTicket++; // 使尚未完成的异步显示失效
  if (quickBusy) return; // 正在输入且有内容：不自动隐藏
  hideQuickDelayed();
}

// 快捷窗口内鼠标进入：取消隐藏计时（用户正在移向/使用快捷窗）
function onQuickHoverIn() {
  quickWindowHovered = true;
  clearTimeout(quickHideTimer);
}

// 快捷窗口内鼠标离开：正在输入且有内容则保留，否则重新开始隐藏计时
function onQuickHoverOut(e) {
  quickWindowHovered = false;
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
  const prevBusy = quickBusy;
  quickTyping = e?.payload?.typing === true;
  if (e?.payload?.busy !== undefined) quickBusy = e?.payload?.busy === true;
  if (quickTyping) clearTimeout(quickHideTimer);
  // busy 从 true 变 false（2s 聚焦保护到期/内容清空）：鼠标已不在圆点也不在快捷窗
  // → 立即安排收起。否则主窗口侧 quickBusy 停在 true，快速移开圆点（未碰快捷窗）永不收。
  // syncOnly（结果宽限期到期的纯状态同步）除外：用户可能正停在原地看结果，
  // 立即收起就是"看着看着被收走"——等真正的移开圆点/失焦再收
  if (!e?.payload?.syncOnly && prevBusy && !quickBusy && !dotHovered && !quickWindowHovered) {
    hideQuickDelayed();
  }
}

// 快捷窗跳主窗前的退场动画：emit quick-hide 等 140ms，再让 enterExpanded 真正隐藏
async function animateQuickOutBeforeExpand() {
  if (form.value !== "compact") return;
  quickGen++; // 使 hideQuick 的退场竞态分支失效（本函数自行等待动画）
  emitTo("quick", "quick-hide").catch(() => {});
  await new Promise((r) => setTimeout(r, QUICK_FADE));
}

// 快捷窗点"查看详情"：展开主窗口并打开对应内容（term 打开词条详情，translate 进入翻译分区）
async function onQuickOpenDetail(payload) {
  if (!payload) return;
  // 展开前先播快捷窗退场动画（140ms），避免小窗"啪"地瞬消与主窗展开动画同时发生
  await animateQuickOutBeforeExpand();
  await win.show();
  if (form.value === "compact") {
    await enterExpanded(payload.kind === "translate" ? "search" : "detail", { skipRestore: true });
  }
  if (payload.kind === "term") {
    // 同缩写多义词条按分类精确匹配（快捷窗里正看的那条），匹配不到再退回第一条
    const list = search(payload.abbr || "");
    const t = list.find((x) => (x.category || "") === (payload.category || "")) || list[0];
    if (t) openTab(t);
  } else if (payload.kind === "translate") {
    panel.value = "translate";
    query.value = payload.text || "";
    runTranslateNow();
  }
  await win.setFocus();
}

// 快捷窗术语搜不到按 Tab：展开主窗口用 AI 搜索该词
async function onQuickAskAi(payload) {
  const text = (payload?.text || "").trim();
  if (!text) return;
  await animateQuickOutBeforeExpand();
  await win.show();
  if (form.value === "compact") {
    // noFocus：聚焦搜索框会触发 onSearchFocus 把 AI 视图覆盖回搜索
    await enterExpanded("search", { skipRestore: true, noFocus: true });
  }
  // 展开后立即确保 OS 焦点在 main：不聚焦搜索框（不触发 onSearchFocus），
  // 否则 hide_quick 归还焦点给 prev 或窗口效果重建的失焦会让本窗口在 200ms 后缩回圆点
  await win.setFocus().catch(() => {});
  // AI 跳转后的失焦屏蔽期：展开瞬间窗口效果（acrylic）异步应用可能产生一次失焦事件，
  // 期间用户鼠标不在窗内（pointerInside=false）会立刻缩回——屏蔽这段时间的失焦缩回
  aiJumpGuardUntil = Date.now() + AI_JUMP_GUARD_MS;
  runAi(text);
}

// 注册快捷窗口事件：hover 弹出 + 详情跳转
async function setupQuickListeners() {
  try {
    // 反注册函数存入 unlisteners：组件卸载（HMR/开发重载）时统一注销，防回调双发
    unlisteners.push(await listen("quick-open-detail", (e) => onQuickOpenDetail(e.payload)));
    unlisteners.push(await listen("quick-ask-ai", (e) => onQuickAskAi(e.payload)));
    unlisteners.push(await listen("quick-hover-in", onQuickHoverIn));
    unlisteners.push(await listen("quick-hover-out", onQuickHoverOut));
    unlisteners.push(await listen("quick-typing", onQuickTyping));
    unlisteners.push(await listen("quick-blur", onQuickBlur));
    // 快捷窗真正隐藏后统一复位输入状态：无论隐藏路径（Esc/收起按钮/跳主窗/失焦收起），
    // 双端 busy/typing 状态不再依赖 DOM blur 事件对冲
    unlisteners.push(await listen("quick-hidden", () => {
      quickTyping = false;
      quickBusy = false;
    }));
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

async function openSettingsView() {
  if (form.value === "compact") {
    await win.show();
    await enterExpanded("settings");
  } else {
    if (await win.isMinimized().catch(() => false)) await win.unminimize().catch(() => {});
    view.value = "settings";
    await win.show();
  }
  await win.setFocus().catch(() => {});
}

// 快捷窗有结果时由“查看详情”全局热键触发；没有结果时 QuickPanel 会安全忽略。
function triggerQuickDetail() {
  emitTo("quick", "quick-open-detail-shortcut").catch(() => {});
}

const shortcutActions = [
  { key: "shortcut", run: () => toggleWindow() },
  { key: "detailShortcut", run: () => triggerQuickDetail() },
  { key: "settingsShortcut", run: () => openSettingsView() },
];

async function applyShortcuts(next, previous = {}) {
  // 先注册新热键，全部成功后再注销旧热键，避免改键失败时旧热键一起丢失。
  const registered = [];
  try {
    for (const action of shortcutActions) {
      const shortcut = String(next?.[action.key] || "").trim();
      const oldShortcut = String(previous?.[action.key] || "").trim();
      if (!shortcut || shortcut === oldShortcut) continue;
      await register(shortcut, (event) => {
        if (event.state === "Pressed") action.run();
      });
      registered.push({ shortcut, oldShortcut });
    }
    for (const { oldShortcut, shortcut } of registered) {
      if (oldShortcut && oldShortcut !== shortcut) await unregister(oldShortcut).catch(() => {});
    }
  } catch (e) {
    for (const { shortcut } of registered) await unregister(shortcut).catch(() => {});
    // 上抛给调用方（设置保存链）：热键被占用等失败不再只落日志，UI 可见
    throw new Error(`快捷键注册失败：${e?.message || e}`);
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
    // 统一置顶基线：与冷启动浮动态（tauri.conf alwaysOnTop:true）一致。
    // 悬浮圆点常驻桌面，若被其他窗口覆盖则 hover 失效、整个快捷词条功能不可达
    await win.setAlwaysOnTop(true).catch(() => {});
  } else {
    // 固定模式保留任务栏图标，弹窗模式不显示图标
    await win.setSkipTaskbar(m !== "pinned").catch(() => {});
    await win.setAlwaysOnTop(m === "pinned").catch(() => {});
    if (form.value === "compact") {
      await enterExpanded(expandInitialView());
      await win.setFocus();
    }
  }
}

// 设置页采用修改即保存：串行写入，避免连续改动时后一次保存覆盖前一次注册状态。
// 保存/热键注册失败经 settingsSaveError 回传设置页真实展示（不再只显示乐观的"已自动保存"）
let shortcutSaveTask = Promise.resolve();
const settingsSaveError = ref("");
function onAutoSaveSettings(next) {
  shortcutSaveTask = shortcutSaveTask
    .then(async () => {
      const prev = { ...settings.value };
      await saveSettings(next);
      await applyShortcuts(next, prev);
      settingsSaveError.value = "";
    })
    .catch((e) => {
      console.error("设置自动保存失败", e);
      settingsSaveError.value = `保存失败：${String(e?.message || e)}`;
    });
  return shortcutSaveTask;
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
          await openSettingsView();
        },
      },
      { id: "quit", text: "退出", action: quitApplication },
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

// Tauri 事件监听反注册表：单实例常驻下主要在 HMR/开发重载触发卸载，
// 不注销会导致回调成对双发（重复收起计时/重复弹出定位）
const unlisteners = [];

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
    await applyShortcuts(settings.value);
  } catch (e) {
    console.error("热键注册失败", e);
  }
  try {
    await setupTray();
  } catch (e) {
    console.error("托盘创建失败", e);
  }
  unlisteners.push(await win.onFocusChanged(({ payload: focused }) => {
    // 原生边界动画期间记录焦点变化，动画完成后再按实际 OS 焦点状态处理。
    if (transitionPhase.value !== "idle") {
      pendingFocus = focused;
      clearTimeout(hideTimer);
      return;
    }
    if (focused) {
      pendingFocus = true;
      clearTimeout(hideTimer);
      // 悬浮/弹窗模式：从"最小化到任务栏"还原后恢复无任务栏图标（dismissWindow 最小化时临时显示）
      if (!pinned.value && mode.value !== "pinned") {
        win.setSkipTaskbar(true).catch(() => {});
      }
      return;
    }
    pendingFocus = false;
    // 固定（图钉按钮 pinned 或固定模式）：不随失焦收起为圆点 / 隐藏窗口
    if (pinned.value || mode.value === "pinned") return;
    if (mode.value === "floating") {
      // 圆点态常驻桌面；仅展开态失焦后缩回圆点
      if (form.value !== "expanded") return;
      // 快捷窗 Tab 跳转 AI 后的屏蔽期：效果重建等瞬时失焦不缩回（用户刚跳转过来）
      if (Date.now() < aiJumpGuardUntil) return;
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
  }));
  // 悬浮模式：窗口移动后防抖保存位置 + 水平边缘吸附（80px 内贴边）
  unlisteners.push(await win.onMoved(async ({ payload: pos }) => {
    // 动画自身会连续触发 onMoved；不让这些中间坐标覆盖圆点还原位置或触发吸附。
    if (transitionPhase.value !== "idle") return;
    if (consumeProgrammaticPosition(pos)) return;
    // 展开态拖动窗口：保持圆点相对主窗口的偏移，收起时仍回到真实聚焦点。
    const anchorPos = form.value === "expanded"
      ? { x: pos.x + dotAnchorOffset.x, y: pos.y + dotAnchorOffset.y }
      : { x: pos.x, y: pos.y };
    if (form.value === "expanded") dotRestorePos = anchorPos;
    clearTimeout(moveTimer);
    moveTimer = setTimeout(async () => {
      // 钳制到可见区再保存：最小化等异常移动不会把圆点位置存到屏幕外
      dotPosition.value = (await clampToWorkArea(anchorPos)) || anchorPos;
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
        const area = mon.workArea || { position: mon.position, size: mon.size };
        let nx = anchorPos.x;
        if (anchorPos.x - area.position.x < 80 * scale) nx = area.position.x;
        else if (area.position.x + area.size.width - anchorPos.x - dotPx < 80 * scale) {
          nx = area.position.x + area.size.width - dotPx;
        }
        if (nx !== anchorPos.x) {
          markProgrammaticPosition({ x: nx, y: anchorPos.y });
          await win.setPosition(new PhysicalPosition(nx, anchorPos.y));
          dotPosition.value = { x: nx, y: anchorPos.y };
          if (stateStore) {
            await stateStore.set("dotPosition", dotPosition.value);
            await stateStore.save();
          }
        }
      } catch (e) {
        console.error("吸附失败", e);
      }
    }, 400);
  }));
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
  cancelWindowAnimation();
  for (const off of unlisteners) {
    try {
      off();
    } catch {
      // 重复注销无害
    }
  }
  unlisteners.length = 0;
  clearTimeout(termSearchTimer);
  clearTimeout(hideTimer);
  clearTimeout(moveTimer);
  clearTimeout(quickShowTimer);
  clearTimeout(quickHideTimer);
  clearTimeout(focusReconcileTimer);
  clearTimeout(noticeTimer);
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
    <!-- 展开时的起点圆点；收起时的飞行圆点保持在固定大窗口内，保证 CSS 动画高帧率 -->
    <div v-if="expandProxy" class="window-transition-dot" :style="expandProxyStyle"></div>
    <div v-if="flyStyle" class="fly-dot" :style="flyStyle"></div>
    <Transition name="fade"><div v-show="form === `expanded`" class="main-view" :style="animStyle">
    <header v-if="view !== 'settings'" class="topbar">
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
        @input="onUserEditQuery"
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 17v5" />
          <path
            d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"
          />
        </svg>
      </button>
      <button
        class="icon-btn"
        :class="{ active: view === 'history' }"
        title="历史记录 (Ctrl+H)"
        @click="toggleHistory()"
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
    <header v-else class="settings-topbar" @mousedown.self="startDrag">
      <div class="grip" title="按住拖动窗口" @mousedown.prevent="startDrag">
        <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></svg>
      </div>
      <span class="settings-topbar-title">设置</span>
      <button class="icon-btn settings-topbar-close" title="返回主界面" @click="view = 'search'; focusInput()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </header>
    <nav v-if="tabs.length && view !== 'settings'" class="tabbar">
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
            <template v-if="termsError">
              <p class="empty-title">本地词库加载失败</p>
              <p class="empty-hint">词库未能加载（文件缺失/被占用/损坏），搜索与联想可能不完整，AI 解释暂不可用。</p>
              <button class="ask-ai-btn" @click="retryLoadTerms">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
                重试加载词库
              </button>
            </template>
            <template v-else>
              <p class="empty-title">本地词库未命中</p>
              <p class="empty-hint">
                “{{ query.trim() }}” 不在词库里，可以让 AI 来解释
              </p>
              <p class="empty-tip">按 <kbd>Tab</kbd> 键可直接询问 AI，无需点击按钮</p>
              <p v-if="noApiHint" class="noapi-hint">
                未配置 API Key，AI 暂不可用 ·
                <button class="noapi-link" @click="openSettingsView">去设置</button>
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
            </template>
          </div>
          <div v-else-if="recentMix.length" class="empty recent-terms">
            <div class="recent-head">
              <span class="recent-title">最近搜索</span>
              <button class="recent-clear" title="清空术语与翻译历史" @click="clearRecent">清空</button>
            </div>
            <div class="recent-list">
              <button
                v-for="(h, i) in recentMix"
                :key="i"
                class="recent-item"
                :title="h.kind ? '点击回填并重新翻译' : '回填搜索并选中结果'"
                @click="h.kind ? replayHistory(h) : openTermFromHistory(h)"
              >
                <!-- 两类记录统一为：类型标记 + 两行内容 + 可选分类标签，避免混排时首列错位 -->
                <template v-if="h.kind">
                  <span class="ri-kind">{{ h.kind === "sentence" ? "译" : "词" }}</span>
                  <span class="ri-body">
                    <span class="ri-input">{{ h.input }}</span>
                    <span class="ri-sum">{{ transSummaryLine(h.summary) }}</span>
                  </span>
                </template>
                <!-- 术语记录：也使用固定类型标记，不再把缩写直接占据首列 -->
                <template v-else>
                  <span class="ri-kind">术</span>
                  <span class="ri-body">
                    <span class="ri-input">{{ h.abbr }}</span>
                    <span v-if="h.zh || h.full" class="ri-sum">{{ [h.zh, h.full].filter(Boolean).join(" · ") }}</span>
                  </span>
                  <span v-if="h.category" class="tag" :style="catStyle(h.category)">{{ h.category }}</span>
                </template>
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
        @use-suggestion="onUseSuggestion"
        @speak-fail="showNotice('无法播放发音：未找到可用的英语语音，请在设置中检查')"
      />
      </template>
      <div v-else-if="view === 'detail'" class="detail-wrap">
        <p v-if="noApiHint" class="noapi-hint">
          未配置 API Key，AI 解释暂不可用 ·
          <button class="noapi-link" @click="openSettingsView">去设置</button>
        </p>
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
        <button
          v-else
          class="ai-entry"
          title="让 AI 展开讲讲这个词条（也可按 Tab）"
          @click="askAiExplainTerm"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
          <span class="ai-entry-text">让 AI 展开讲讲</span>
          <span class="ai-entry-arrow">Tab 或点击 ›</span>
        </button>
        <TermCard :term="currentTerm" :starred="isFavorite(favorites, currentTerm)" @toggle-star="onToggleStar" />
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
        @retry="retryAi"
        @save-update="updateCachedTerm"
        @append-followups="appendFollowupsToTerm"
      />
      <HistoryPanel
        v-else-if="view === 'history'"
        :initial-tab="historyTab"
        :ai-sessions="aiSessions"
        :favorites="favorites"
        @open-term="openTermFromHistory"
        @open-translate="replayHistory"
        @open-ai="openAiSession"
        @remove-ai="removeAiSession"
        @clear-ai="clearAiHistory"
        @clear-terms="clearTermHist"
        @clear-translate="clearTransHist"
      />
      <SettingsPanel
        v-else-if="view === 'settings'"
        :settings="settings"
        :mode="mode"
        :save-error="settingsSaveError"
        :secret-status="secretStatus"
        @auto-save="onAutoSaveSettings"
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

    <footer v-if="view !== 'settings'" class="statusbar" title="按住拖动窗口" @mousedown.self="startDrag">
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
    <!-- 全局轻量通知（发音失败/保存失败等一次性提示） -->
    <Transition name="notice">
      <div v-if="notice" class="toast" :class="notice.kind">{{ notice.text }}</div>
    </Transition>
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

/* 原生窗口边界动画期间代理圆点不受内容布局影响 */
.shell.compact {
  overflow: visible;
}

/* 原生窗口边界动画期间的代理圆点：窗口本身负责移动和缩放，代理只保持中心位置 */
.window-transition-dot {
  position: fixed;
  left: 32px;
  top: 32px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(35, 48, 66, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow:
    inset 0 1px 3px rgba(255, 255, 255, 0.25),
    inset 0 -2px 6px rgba(0, 0, 0, 0.28),
    0 0 12px rgba(82, 112, 143, 0.45);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 60;
  animation: transition-dot-in 120ms ease-out both;
}

/* 收起时在尚未缩小的窗口内完成平滑位移；原生边界只在动画结束后切换 */
.fly-dot {
  position: fixed;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(35, 48, 66, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow:
    inset 0 1px 3px rgba(255, 255, 255, 0.25),
    inset 0 -2px 6px rgba(0, 0, 0, 0.28),
    0 0 12px rgba(82, 112, 143, 0.45);
  pointer-events: none;
  z-index: 60;
  animation: fly-to-dot 240ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes fly-to-dot {
  from { transform: translate(0, 0) scale(1); opacity: 1; }
  to { transform: translate(var(--fly-dx), var(--fly-dy)) scale(1); opacity: 1; }
}

@keyframes transition-dot-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
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

.settings-topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.58);
  border-bottom: 1px solid rgba(203, 213, 225, 0.8);
}

.settings-topbar-title {
  color: var(--text-2);
  font-size: 14px;
  font-weight: 650;
}

.settings-topbar-close {
  margin-left: auto;
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

/* 无 API Key 的就地引导条（空态/详情页共用） */
.noapi-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 7px 12px;
  background: rgba(180, 83, 83, 0.08);
  border: 1px solid rgba(180, 83, 83, 0.28);
  border-radius: 8px;
  color: var(--danger);
  font-size: 12.5px;
}

.detail-wrap .noapi-hint {
  margin: 0 0 10px;
}

.noapi-link {
  flex: none;
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.noapi-link:hover {
  color: #334f6b;
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
  justify-content: space-between;
  /* 与 .recent-list 同宽：标题/清空分列两缘，和翻译空态的 history-head 统一 */
  width: 100%;
  max-width: 420px;
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
  min-width: 0;
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

/* 翻译记录条目：类型标记 + 输入 + 译文摘要 */
.ri-kind {
  flex: none;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
}

.recent-item .ri-kind {
  width: 24px;
  height: 24px;
}

.ri-input {
  color: var(--text-2);
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ri-sum {
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

/* ---------- 全局轻量通知 toast ---------- */
.toast {
  position: fixed;
  left: 50%;
  bottom: 46px;
  transform: translateX(-50%);
  z-index: 120;
  max-width: 80%;
  padding: 8px 16px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.92);
  color: #fff;
  font-size: 12.5px;
  line-height: 1.5;
  box-shadow: 0 6px 20px rgba(30, 41, 59, 0.25);
  pointer-events: none;
}

.toast.error {
  background: rgba(160, 62, 62, 0.95);
}

.notice-enter-active,
.notice-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
}
</style>
