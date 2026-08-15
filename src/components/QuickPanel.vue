<script setup>
import { ref, watch, onMounted } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emitTo, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { search, initUserTerms, ensureTerms } from "../composables/useSearch";
import { initSettings, useSettings } from "../composables/useSettings";
import { translateQuery, isSingleWord, speakEnglish } from "../composables/useTranslate";
import { categoryColor } from "../utils/categories";

const win = getCurrentWindow();
const { settings } = useSettings();

// 面板分区：terms(术语) | translate(翻译)；q 需在 currentBusy/watch 之前声明（TDZ）
const panel = ref("terms");
const q = ref("");

// 鼠标进出本窗口时通知主窗口：进入取消隐藏计时，离开重新计时
// busy=正在输入：聚焦后短暂保护窗口（手正放上键盘）、输入法组合输入中（拼音未上屏）、
// 或内容非空——此时移出窗口也保留；纯空输入（含自动聚焦误触）移出则收起
const inputFocused = ref(false);
let focusAt = 0; // 聚焦时间戳：聚焦瞬间用户可能正把手放上键盘，短暂视为使用中
let composing = false; // 输入法 composition 进行中（中文拼音未上屏，q 仍为空）
function currentBusy() {
  return inputFocused.value && (Date.now() - focusAt < 2000 || composing || q.value.trim() !== "");
}
// 统一的输入状态上报（聚焦/失焦/composition/内容变化都走这里）
function reportTyping() {
  emitTo("main", "quick-typing", { typing: inputFocused.value, busy: currentBusy() }).catch(() => {});
}
function onHoverIn() {
  emitTo("main", "quick-hover-in").catch(() => {});
}
function onHoverOut() {
  emitTo("main", "quick-hover-out", { busy: currentBusy() }).catch(() => {});
}

// 输入框聚焦/失焦上报：聚焦期间快捷窗不自动隐藏（鼠标移出也不收）
function onInputFocus() {
  inputFocused.value = true;
  focusAt = Date.now();
  reportTyping();
}
function onInputBlur() {
  inputFocused.value = false;
  reportTyping();
}

// 输入法组合输入（中文拼音等）：上屏前 q 为空，必须单独标记为"正在输入"
function onCompositionStart() {
  composing = true;
  reportTyping();
}
function onCompositionEnd() {
  composing = false;
  reportTyping();
}

// 输入内容变化时实时同步 busy：鼠标停留在圆点上直接打字（未进窗）也要能被识别为"使用中"
watch(q, () => {
  if (inputFocused.value) reportTyping();
});

// 面板分区：terms(术语) | translate(翻译)
const searching = ref(false);
const error = ref("");
// 术语结果（简洁）：abbr/zh/definition 首行 + 分类
const termResults = ref([]);
// 翻译结果（简洁）
const transResult = ref(null);
let seq = 0;
let timer = null;

// AI 词典回复（音标/释义/例句/译文四行）：快捷窗空间有限，只给最有用的中文释义；
// 优先取"释义:"行，兜底跳过音标行取第一行非空
function aiDefinition(reply) {
  const lines = String(reply || "").split("\n");
  for (const l of lines) {
    const t = l.trim();
    if (/^释义\s*[:：]/.test(t)) return t.replace(/^释义\s*[:：]\s*/, "").trim();
  }
  for (const l of lines) {
    const t = l.trim();
    if (t && !/^音标\s*[:：]/.test(t)) return t;
  }
  return "";
}

function catStyle(cat) {
  const { fg, bg } = categoryColor(cat);
  return { color: fg, background: bg };
}

// 查找执行：术语模式搜本地词库，翻译模式走翻译（命中缓存秒出）
async function doSearch() {
  const text = q.value.trim();
  if (!text) return;
  clearTimeout(timer);
  const my = ++seq;
  searching.value = true;
  error.value = "";
  termResults.value = [];
  transResult.value = null;
  if (panel.value === "terms") {
    await ensureTerms().catch(() => {});
    termResults.value = search(text).slice(0, 5);
    searching.value = false;
    return;
  }
  if (!settings.value.apiKey) {
    searching.value = false;
    error.value = "no-api-key";
    return;
  }
  try {
    const r = await translateQuery(text, settings.value);
    if (my !== seq) return;
    transResult.value = r;
  } catch (e) {
    if (my !== seq) return;
    error.value = String(e?.message || e);
  } finally {
    if (my === seq) searching.value = false;
  }
}

function schedule() {
  clearTimeout(timer);
  const text = q.value.trim();
  if (!text) {
    termResults.value = [];
    transResult.value = null;
    error.value = "";
    searching.value = false;
    return;
  }
  searching.value = true;
  timer = setTimeout(doSearch, isSingleWord(text) ? 150 : 300);
}

watch(q, schedule);

// 详情跳转：通知主窗口展开并打开对应内容，然后隐藏本窗口
async function openDetail() {
  let payload = null;
  if (panel.value === "terms") {
    const t = termResults.value[0];
    if (!t) return;
    payload = { kind: "term", abbr: t.abbr };
  } else if (transResult.value) {
    payload = { kind: "translate", text: q.value.trim() };
  }
  if (!payload) return;
  await emitTo("main", "quick-open-detail", payload).catch(() => {});
  await invoke("hide_quick").catch(() => {});
}

// 直接选中术语列表里的某条
function pickTerm(t) {
  emitTo("main", "quick-open-detail", { kind: "term", abbr: t.abbr }).catch(() => {});
  invoke("hide_quick").catch(() => {});
}

function speak() {
  const r = transResult.value;
  if (!r) return;
  if (r.kind === "word") speakEnglish(r.word);
  else if (r.kind === "word-ai") speakEnglish(r.text);
  else speakEnglish(r.target === "zh" ? r.text : r.translated);
}

function onKeydown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    clearTimeout(timer);
    doSearch();
  } else if (e.key === "Escape") {
    e.preventDefault();
    invoke("hide_quick").catch(() => {});
  }
}

function closeSelf() {
  invoke("hide_quick").catch(() => {});
}

const shellRef = ref(null);

onMounted(async () => {
  await initSettings().catch(() => {});
  // 词库与用户词库并行加载（词库独立 chunk，后台拉取）
  await Promise.all([ensureTerms(), initUserTerms()]).catch(() => {});
  // 主窗口收起动画：播放退场（淡出），动画结束窗口才真正隐藏
  listen("quick-hide", () => shellRef.value?.classList.add("closing")).catch(() => {});
  // 窗口每次显示（hover 弹出/防抖后）：恢复内容可见并聚焦输入框（挂载时窗口隐藏，focus 无效，必须显示后再聚焦）
  listen("quick-show", () => {
    shellRef.value?.classList.remove("closing");
    setTimeout(() => document.querySelector(".quick-input")?.focus(), 30);
  }).catch(() => {});
  // 窗口失焦（用户点击窗外/切走）：通知主窗口安排收起
  win
    .onFocusChanged(({ payload: focused }) => {
      if (!focused) emitTo("main", "quick-blur").catch(() => {});
    })
    .catch(() => {});
});
</script>

<template>
  <div ref="shellRef" class="quick-shell" @mouseenter="onHoverIn" @mouseleave="onHoverOut">
    <header class="quick-top">
      <div class="seg">
        <button :class="{ on: panel === 'terms' }" @click="panel = 'terms'; q = ''; schedule()">术语</button>
        <button :class="{ on: panel === 'translate' }" @click="panel = 'translate'; q = ''; schedule()">翻译</button>
      </div>
      <div class="quick-actions">
        <button class="icon-btn" title="收起" @click="closeSelf">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </header>

    <div class="quick-input-row">
      <input
        class="quick-input"
        v-model="q"
        :placeholder="panel === 'terms' ? '查术语：I2C、DTS…' : '翻译：单词或句子…'"
        spellcheck="false"
        autocomplete="off"
        @keydown="onKeydown"
        @focus="onInputFocus"
        @blur="onInputBlur"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
      />
      <button class="quick-go" :disabled="!q.trim() || searching" @click="doSearch">
        {{ searching ? "…" : "查找" }}
      </button>
    </div>

    <main class="quick-body">
      <!-- 等待 -->
      <div v-if="searching" class="qdots"><i></i><i></i><i></i></div>

      <!-- 错误 -->
      <p v-else-if="error" class="q-error">
        {{ error === "no-api-key" ? "翻译需要 API Key，请到主窗口设置" : error }}
      </p>

      <!-- 术语结果：简洁列表 -->
      <template v-else-if="panel === 'terms'">
        <div v-if="termResults.length" class="q-term-list">
          <button v-for="(t, i) in termResults" :key="i" class="q-term" @click="pickTerm(t)">
            <span class="qt-abbr">{{ t.abbr }}</span>
            <span class="qt-body">
              <span v-if="t.zh" class="qt-zh">{{ t.zh }}</span>
              <span v-if="t.definition" class="qt-def">{{ t.definition }}</span>
            </span>
            <span class="tag" :style="catStyle(t.category)">{{ t.category }}</span>
          </button>
          <button class="q-detail-btn" @click="openDetail">查看「{{ termResults[0].abbr }}」详情 ›</button>
        </div>
        <div v-else-if="q.trim()" class="q-empty">本地词库未命中，试试翻译分区</div>
        <div v-else class="q-hint">输入缩写或关键词，如 I2C、DTS、bootcmd</div>
      </template>

      <!-- 翻译结果：简洁译文 + 发音 -->
      <template v-else>
        <div v-if="transResult" class="q-trans">
          <template v-if="transResult.kind === 'word'">
            <div class="qt-word">{{ transResult.word }}</div>
            <div class="qt-zh">{{ transResult.entry.primary }}</div>
          </template>
          <template v-else-if="transResult.kind === 'word-ai'">
            <div class="qt-word">{{ transResult.text }}</div>
            <div class="qt-zh">{{ aiDefinition(transResult.reply) }}</div>
          </template>
          <template v-else>
            <div class="qt-dir">{{ transResult.target === "zh" ? "英 → 中" : "中 → 英" }}</div>
            <div class="qt-trans-text">{{ transResult.translated }}</div>
          </template>
          <div class="q-trans-actions">
            <button class="q-mini-btn" @click="speak()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" class="q-spk-icon">
                <path d="M4 9v6h4l5 4V5L8 9H4z" />
                <path d="M16.5 8.5a5 5 0 0 1 0 7" />
                <path d="M19 6a8.5 8.5 0 0 1 0 12" />
              </svg>
              发音
            </button>
            <button class="q-detail-btn" @click="openDetail">查看详情 ›</button>
          </div>
        </div>
        <div v-else-if="q.trim()" class="q-hint">按 Enter 翻译</div>
        <div v-else class="q-hint">输入英文单词或句子，如 interrupt</div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.quick-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 10px 12px;
  background: rgba(250, 251, 253, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  user-select: none;
  /* 展开：快速淡入+轻微上浮（窗口本身是透明的，内容动画即窗口动画） */
  animation: quick-pop 160ms ease-out;
  /* 收起：退场动画由主窗口发 quick-hide 后切 .closing 触发 */
  transition: opacity 120ms ease, transform 120ms ease;
}

.quick-shell.closing {
  opacity: 0;
  transform: scale(0.96);
}

@keyframes quick-pop {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.quick-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.seg {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(226, 232, 240, 0.55);
}

.seg button {
  height: 26px;
  padding: 0 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-4);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
}

.seg button.on {
  background: rgba(255, 255, 255, 0.92);
  color: var(--accent);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(30, 41, 59, 0.1);
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-5);
  cursor: pointer;
}

.icon-btn:hover {
  background: rgba(241, 245, 249, 0.9);
  color: var(--text-3);
}

.icon-btn svg {
  width: 15px;
  height: 15px;
}

.quick-input-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.quick-input {
  flex: 1;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(219, 226, 234, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  color: #334155;
  font-size: 13.5px;
  font-family: inherit;
  outline: none;
}

.quick-input:focus {
  border-color: rgba(143, 168, 196, 0.9);
}

.quick-input::placeholder {
  color: #a3aebc;
}

.quick-go {
  flex: none;
  height: 34px;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: rgba(82, 112, 143, 0.14);
  color: #52708f;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.quick-go:hover:not(:disabled) {
  background: rgba(82, 112, 143, 0.22);
}

.quick-go:disabled {
  opacity: 0.45;
  cursor: default;
}

.quick-body {
  flex: 1;
  min-height: 0;
  margin-top: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 结果紧贴搜索框下方（顶部对齐），不做垂直居中——居中会让结果悬浮在窗口中部、
   与搜索框之间空出一大段，观感像"中间另开辟一段" */
.q-term-list {
  width: 100%;
}

.quick-body::-webkit-scrollbar {
  width: 5px;
}

.quick-body::-webkit-scrollbar-thumb {
  background: rgba(215, 221, 228, 0.9);
  border-radius: 3px;
}

/* 术语列表 */
.q-term-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.q-term {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.q-term:hover {
  background: #e8eef5;
  border-color: rgba(219, 226, 234, 0.7);
}

.qt-abbr {
  flex: none;
  min-width: 56px;
  font-weight: 700;
  color: var(--text-2);
  font-size: 13px;
}

.qt-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.qt-zh {
  color: var(--text-2);
  font-size: 12.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qt-def {
  color: var(--text-5);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  flex: none;
  padding: 1px 8px;
  border-radius: 10px;
  background: rgba(238, 242, 247, 0.85);
  color: var(--text-4);
  font-size: 10.5px;
  white-space: nowrap;
}

/* 翻译结果 */
.q-trans {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.75);
  border-radius: 10px;
}

.qt-word {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
}

.qt-dir {
  color: var(--text-5);
  font-size: 11px;
  font-weight: 600;
}

.qt-trans-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.6;
  word-break: break-word;
}

.q-trans-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.q-mini-btn,
.q-detail-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 12px;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
}

.q-spk-icon {
  width: 13px;
  height: 13px;
}

.q-mini-btn {
  border: 1px solid rgba(219, 226, 234, 0.9);
  background: rgba(255, 255, 255, 0.85);
  color: var(--text-4);
}

.q-mini-btn:hover {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.5);
}

.q-detail-btn {
  border: 1px solid rgba(143, 168, 196, 0.6);
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  font-weight: 600;
}

.q-detail-btn:hover {
  background: rgba(var(--accent-rgb), 0.18);
}

.q-empty,
.q-hint {
  padding: 24px 8px;
  text-align: center;
  color: var(--text-6);
  font-size: 12.5px;
}

.q-error {
  padding: 10px 12px;
  background: rgba(251, 241, 241, 0.85);
  border-radius: 8px;
  color: #a05d5d;
  font-size: 12.5px;
  line-height: 1.6;
}

/* 等待 */
.qdots {
  display: flex;
  gap: 6px;
  padding: 20px 4px;
}

.qdots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #b8c4d0;
  animation: blink 1.2s infinite ease-in-out;
}

.qdots i:nth-child(2) {
  animation-delay: 0.2s;
}

.qdots i:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
  }
  40% {
    opacity: 1;
  }
}
</style>
