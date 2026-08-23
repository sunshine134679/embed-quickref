<script setup>
import { ref, computed, watch, onMounted } from "vue";
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
const hovering = ref(false); // 鼠标是否仍在窗内（搜索结果出来时若已移开则触发收起评估）
let focusAt = 0; // 聚焦时间戳：聚焦瞬间用户可能正把手放上键盘，短暂视为使用中
let focusGuardTimer = null; // 2s 聚焦保护到期后重新上报 busy（否则主窗口侧 quickBusy 停在 true）
let composing = false; // 输入法 composition 进行中（中文拼音未上屏，q 仍为空）
let leftAt = 0; // 鼠标最近一次离开窗口的时间戳（进入窗口时清零）
let searchAt = 0; // 最近一次搜索发起时间：判断结果出来前鼠标是否已离开
let resultShownAt = 0; // 结果展示时间戳：刚出结果短暂保护窗口（用户刚回车要看结果）
let graceTimer = null; // 结果宽限期定时器
const RESULT_GRACE_MS = 1000; // 结果展示后的宽限期：期间移开鼠标不收起

function currentBusy() {
  // 结果刚展示（宽限期内）→ 仍算"使用中"：用户刚回车，要给时间看结果
  if (resultGrace()) return true;
  // 搜索已完成（结果已展示）→ 鼠标移开应收起（重新 hover 会恢复结果）；
  // 但输入框仍聚焦且内容非空（用户在结果上继续输入/修改）→ 仍算"使用中"
  if (transResult.value || termResults.value.length || selectedTerm.value) {
    return inputFocused.value && q.value.trim() !== "";
  }
  return inputFocused.value && (Date.now() - focusAt < 2000 || composing || q.value.trim() !== "");
}
// 统一的输入状态上报（聚焦/失焦/composition/内容变化都走这里）
function reportTyping() {
  emitTo("main", "quick-typing", { typing: inputFocused.value, busy: currentBusy() }).catch(() => {});
}
function onHoverIn() {
  hovering.value = true;
  leftAt = 0; // 进入窗口：之前的离开不再计入"本轮搜索期间已离开"
  emitTo("main", "quick-hover-in").catch(() => {});
}
function onHoverOut() {
  hovering.value = false;
  leftAt = Date.now();
  // 移出窗口的"使用中"判定：结果宽限期内 → 保护（用户刚回车要看结果）；
  // 结果已展示且过宽限期 → 不算；否则只认"真在输入"（内容非空/输入法组合中）。
  // 聚焦 2s 保护（还没输入）不算——鼠标正离开窗口（如移开轨迹穿过窗口）应立即收起，
  // 否则要等聚焦保护到期（最长 2s）窗口才收，延迟明显。"停圆点 → 手放键盘 → 打字"
  // 场景由圆点离开路径（hideQuickOnLeave）的 busy 兜底
  const busy = resultGrace()
    ? true
    : resultShown()
      ? false
      : inputFocused.value && (composing || q.value.trim() !== "");
  emitTo("main", "quick-hover-out", { busy }).catch(() => {});
}
// 结果已展示（术语列表/简介/翻译结果）→ 搜索完成，不算"使用中"
function resultShown() {
  return !!(transResult.value || termResults.value.length || selectedTerm.value);
}
// 结果刚展示（宽限期内）→ 算"使用中"，鼠标移开不收起
function resultGrace() {
  return resultShown() && Date.now() - resultShownAt < RESULT_GRACE_MS;
}

// 搜索完成（结果已展示）：宽限期内 busy 保持 true（用户刚回车，移开鼠标也不收），
// 宽限期结束后才同步 busy=false 并重新评估收起——快速输入+回车不会被当成"用完移开"
// 立刻收起，同时保留"搜索完成移出自动收起"（宽限期后真正移开才收）
function notifyResultDone() {
  resultShownAt = Date.now();
  clearTimeout(graceTimer);
  graceTimer = setTimeout(syncResultDone, RESULT_GRACE_MS);
}

function syncResultDone() {
  // 用当前状态重新评估：鼠标已回到窗内 → 只同步 busy；仍在窗外且搜索期间离开过 → 收起
  if (!hovering.value && leftAt > searchAt) {
    emitTo("main", "quick-hover-out", { busy: false }).catch(() => {});
  } else {
    emitTo("main", "quick-typing", { typing: inputFocused.value, busy: false }).catch(() => {});
  }
}

// 输入框聚焦/失焦上报：聚焦期间快捷窗不自动隐藏（鼠标移出也不收）
function onInputFocus() {
  inputFocused.value = true;
  focusAt = Date.now();
  reportTyping();
  // 2s 聚焦保护到期后重新评估并上报：若此时未输入内容，busy 应变 false，
  // 否则主窗口侧 quickBusy 一直停在 true，鼠标快速移开圆点（没碰快捷窗）时窗口永不收起
  clearTimeout(focusGuardTimer);
  focusGuardTimer = setTimeout(() => {
    if (inputFocused.value) reportTyping();
  }, 2000);
}
function onInputBlur() {
  inputFocused.value = false;
  clearTimeout(focusGuardTimer);
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
// 当前查看的术语简介（快捷窗内展示，不跳主界面）；null 时显示列表
const selectedTerm = ref(null);
// 本轮搜索是否精确命中（abbr 完全等于输入）：未命中时按 Tab 可直接问 AI；
// exactHitQ 记录结论对应的输入——防抖窗口内又改了字时据此判定缓存已过期
let exactHit = false;
let exactHitQ = "";
// 翻译结果（简洁）
const transResult = ref(null);
let seq = 0;
let timer = null;

// 未找到/拼写建议：回填建议词并查找。赋值经 watch(q)->schedule 防抖触发一次搜索；
// 同词重复点击时 watch 不触发，手动补一次（避免赋值+手动各搜一次的双重请求）
function pickSuggestion(word) {
  if (q.value === word) {
    doSearch();
    return;
  }
  q.value = word;
}

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

// 释义中的词性/词义分离，让两者用不同颜色区分：
// "<动词> 埋葬；安葬" 或 "n. 浮点数；漂浮物" → { pos, meaning }
function splitAiMeaning(def) {
  const s = String(def || "").trim();
  const m = s.match(/^<([^>]+)>\s*(.*)$/);
  if (m) return { pos: m[1].trim(), meaning: m[2].trim() };
  const m2 = s.match(/^((?:n|v|adj|adv|pron|prep|conj|int|det|abbr|aux)\.)\s*(.*)$/i);
  if (m2) return { pos: m2[1].toLowerCase(), meaning: m2[2].trim() };
  return { pos: "", meaning: s };
}

// 本地词典 primary（"n. 浮点数；漂浮物  v. 漂浮；使浮动"）按双空格拆成多组词性+释义
function splitPrimary(primary) {
  if (!primary) return [];
  return String(primary)
    .split(/\s{2,}/)
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => {
      const m = g.match(/^((?:n|v|adj|adv|pron|prep|conj|int|det|abbr|aux)\.)\s*(.*)$/i);
      return m ? { pos: m[1].toLowerCase(), meaning: m[2].trim() } : { pos: "", meaning: g };
    });
}

// AI 词典释义的词性/词义分离（computed：解析一次供模板复用）
const aiMeaning = computed(() => {
  const r = transResult.value;
  if (!r || r.kind !== "word-ai") return { pos: "", meaning: "" };
  return splitAiMeaning(aiDefinition(r.reply));
});

function catStyle(cat) {
  const { fg, bg } = categoryColor(cat);
  return { color: fg, background: bg };
}

// 查找执行：术语模式搜本地词库，翻译模式走翻译（命中缓存秒出）
async function doSearch() {
  const text = q.value.trim();
  if (!text) return;
  searchAt = Date.now(); // 本轮搜索起点：结果出来前鼠标离开窗口才触发"完成即收起"
  clearTimeout(timer);
  const my = ++seq;
  searching.value = true;
  error.value = "";
  termResults.value = [];
  selectedTerm.value = null;
  transResult.value = null;
  if (panel.value === "terms") {
    await ensureTerms().catch(() => {});
    const all = search(text);
    const key = text.trim().toLowerCase();
    // 精确命中（abbr 完全等于输入）：单条直接显示简介，一词多义（同缩写不同分类）列列表选择
    const exact = all.filter((t) => (t.abbr || "").trim().toLowerCase() === key);
    exactHit = exact.length > 0; // 未精确命中（仅模糊/无结果）时按 Tab 可问 AI
    exactHitQ = key;
    selectedTerm.value = exact.length === 1 ? exact[0] : null;
    termResults.value = exact.length === 1 ? [] : (exact.length > 1 ? exact : all).slice(0, 5);
    searching.value = false;
    notifyResultDone();
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
    notifyResultDone();
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
    selectedTerm.value = null;
    transResult.value = null;
    error.value = "";
    searching.value = false;
    exactHit = false;
    clearTimeout(graceTimer); // 结果已清空，宽限期不再有意义
    return;
  }
  searching.value = true;
  searchAt = Date.now(); // 防抖窗口内移开鼠标也算"搜索期间离开"，结果出来直接收起
  timer = setTimeout(doSearch, isSingleWord(text) ? 150 : 300);
}

watch(q, schedule);

// 详情跳转：通知主窗口展开并打开对应内容，然后隐藏本窗口（简介页"查看详情"）
async function openDetail() {
  let payload = null;
  if (panel.value === "terms") {
    const t = selectedTerm.value || termResults.value[0];
    if (!t) return;
    // 带上分类：同缩写多义（如 ping 的 Linux/U-Boot/Windows）主窗口才能定位到正看的这条
    payload = { kind: "term", abbr: t.abbr, category: t.category || "" };
  } else if (transResult.value) {
    payload = { kind: "translate", text: q.value.trim() };
  }
  if (!payload) return;
  await emitTo("main", "quick-open-detail", payload).catch(() => {});
  await invoke("hide_quick").catch(() => {});
}

// 选中术语列表里的某条：在快捷窗内展示简介（不跳主界面）
function pickTerm(t) {
  selectedTerm.value = t;
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
  } else if (e.key === "Tab" && !e.shiftKey) {
    // Tab 保留给 AI 跳转：其余情况一律拦掉默认焦点移动（焦点跑出输入框会误触收起链）
    e.preventDefault();
    const text = q.value.trim();
    // 即时核对输入是否仍与上次搜索一致：防抖窗口内刚改过字时 exactHit 还是上一轮的结论
    const fresh = !!text && text.toLowerCase() === exactHitQ;
    // 术语未精确命中（仅模糊结果/无结果）：一键跳主窗口用 AI 搜索
    if (panel.value === "terms" && text && !(fresh && exactHit)) {
      emitTo("main", "quick-ask-ai", { text }).catch(() => {});
      invoke("hide_quick").catch(() => {});
    }
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
  // 主窗口保存设置/写入词库后会广播变更：重载本地快照，保证与主窗口数据一致
  listen("settings-changed", () => initSettings()).catch(() => {});
  listen("user-terms-changed", () => initUserTerms()).catch(() => {});
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

      <!-- 术语结果：简介视图（精确单条/列表选择后，快捷窗内展示） -->
      <template v-else-if="panel === 'terms'">
        <div v-if="selectedTerm" class="q-term-detail">
          <header class="qtd-head">
            <span class="qtd-abbr">{{ selectedTerm.abbr }}</span>
            <span v-if="selectedTerm.full" class="qtd-full">{{ selectedTerm.full }}</span>
            <span v-if="selectedTerm.category" class="tag" :style="catStyle(selectedTerm.category)">{{ selectedTerm.category }}</span>
          </header>
          <p v-if="selectedTerm.zh" class="qtd-zh">{{ selectedTerm.zh }}</p>
          <p v-if="selectedTerm.definition" class="qtd-def">{{ selectedTerm.definition }}</p>
          <div v-if="selectedTerm.usage" class="qtd-usage">
            <span class="qtd-label">用法</span>{{ selectedTerm.usage }}
          </div>
          <div v-if="selectedTerm.example" class="qtd-example">
            <code>{{ Array.isArray(selectedTerm.example) ? selectedTerm.example.join("\n") : selectedTerm.example }}</code>
          </div>
          <div class="qtd-actions">
            <button v-if="termResults.length" class="q-mini-btn" @click="selectedTerm = null">返回列表</button>
            <button class="q-detail-btn" @click="openDetail">查看详情 ›</button>
          </div>
        </div>
        <!-- 列表：一词多义（同缩写不同分类）或普通匹配，点击后在快捷窗内看简介 -->
        <div v-else-if="termResults.length" class="q-term-list">
          <button v-for="(t, i) in termResults" :key="i" class="q-term" @click="pickTerm(t)">
            <span class="qt-abbr">{{ t.abbr }}</span>
            <span class="qt-body">
              <span v-if="t.zh" class="qt-zh">{{ t.zh }}</span>
              <span v-if="t.definition" class="qt-def">{{ t.definition }}</span>
            </span>
            <span class="tag" :style="catStyle(t.category)">{{ t.category }}</span>
          </button>
          <button class="q-detail-btn" @click="openDetail">查看「{{ termResults[0].abbr }}」详情 ›</button>
          <!-- 未精确命中（仅模糊匹配）：提示可直接按 Tab 问 AI -->
          <p v-if="!exactHit" class="q-tab-hint">
            没有完全匹配「{{ q.trim() }}」· 按 <kbd>Tab</kbd> 用 AI 搜索
          </p>
        </div>
        <div v-else-if="q.trim()" class="q-empty">
          本地词库未命中，试试翻译分区 · 按 <kbd>Tab</kbd> 用 AI 搜索
        </div>
        <div v-else class="q-hint">输入缩写或关键词，如 I2C、DTS、bootcmd</div>
      </template>

      <!-- 翻译结果：简洁译文 + 发音 -->
      <template v-else>
        <!-- 未找到：拼写错误/不完整单词——明确报错，不硬编结果 -->
        <div v-if="transResult && transResult.kind === 'word-not-found'" class="q-notfound">
          <p class="qnf-title">未找到「{{ transResult.text }}」</p>
          <p v-if="!transResult.suggestions.length" class="qnf-hint">请检查拼写，或输入完整单词</p>
          <div v-else class="qnf-sugg">
            <button
              v-for="(s, i) in transResult.suggestions"
              :key="i"
              class="qnf-item"
              @click="pickSuggestion(s.word)"
            >
              {{ s.word }}<span v-if="s.zh" class="qnf-zh">{{ s.zh }}</span>
            </button>
          </div>
        </div>
        <div v-else-if="transResult" class="q-trans">
          <template v-if="transResult.kind === 'word'">
            <div class="qt-word">{{ transResult.word }}</div>
            <!-- 词性/词义分离显示：词性 chip 与词义不同颜色 -->
            <div v-for="(p, i) in splitPrimary(transResult.entry.primary)" :key="i" class="qt-pos-row">
              <span v-if="p.pos" class="qt-pos">{{ p.pos }}</span>
              <span class="qt-meaning">{{ p.meaning }}</span>
            </div>
          </template>
          <template v-else-if="transResult.kind === 'word-ai'">
            <div class="qt-word">{{ transResult.text }}</div>
            <div v-if="aiMeaning.pos" class="qt-pos-row">
              <span class="qt-pos">{{ aiMeaning.pos }}</span>
              <span class="qt-meaning">{{ aiMeaning.meaning }}</span>
            </div>
            <div v-else class="qt-zh">{{ aiMeaning.meaning || aiDefinition(transResult.reply) }}</div>
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
/* 术语简介：快捷窗内展示的词条卡片（选择后），底部"查看详情"跳主界面 */
.q-term-detail {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.75);
  border-radius: 10px;
}

.qtd-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.qtd-abbr {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);
}

.qtd-full {
  font-size: 12px;
  color: var(--text-4);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.qtd-zh {
  margin-top: 5px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.qtd-def {
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--text-3);
}

.qtd-usage {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-4);
}

.qtd-label {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 6px;
  background: rgba(238, 242, 247, 0.9);
  color: var(--text-5);
  font-size: 10.5px;
}

.qtd-example {
  margin-top: 6px;
  padding: 6px 9px;
  background: rgba(236, 245, 237, 0.85);
  border-radius: 7px;
}

.qtd-example code {
  font-size: 11.5px;
  color: #2f6b3a;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: Consolas, "Courier New", monospace;
}

.qtd-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.q-term-detail .q-mini-btn,
.q-term-detail .q-detail-btn {
  height: 28px;
  padding: 0 12px;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
}

.q-term-detail .q-mini-btn {
  border: 1px solid rgba(219, 226, 234, 0.9);
  background: rgba(255, 255, 255, 0.85);
  color: var(--text-4);
}

.q-term-detail .q-mini-btn:hover {
  color: var(--accent);
}

/* 术语结果列表 */
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

/* 未找到：拼写错误/不完整单词 */
.q-notfound {
  padding: 10px 12px;
  background: rgba(251, 241, 241, 0.85);
  border: 1px solid rgba(240, 210, 210, 0.8);
  border-radius: 10px;
}

.qnf-title {
  font-size: 13px;
  font-weight: 600;
  color: #a05d5d;
}

.qnf-hint {
  margin-top: 4px;
  color: var(--text-5);
  font-size: 11.5px;
}

.qnf-sugg {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.qnf-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid rgba(143, 168, 196, 0.6);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.85);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.qnf-item:hover {
  background: rgba(var(--accent-rgb), 0.12);
}

.qnf-zh {
  font-weight: 400;
  color: var(--text-5);
  font-size: 11px;
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

/* 词性/词义分离：词性 chip 用 accent 色，词义正文深色，颜色区分开 */
.qt-pos-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 2px;
}

.qt-pos {
  flex: none;
  padding: 1px 8px;
  border-radius: 9px;
  background: rgba(var(--accent-rgb), 0.13);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
}

.qt-meaning {
  color: var(--text-2);
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.5;
  word-break: break-word;
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

/* 模糊结果列表底部：未精确命中时提示按 Tab 问 AI */
.q-tab-hint {
  margin-top: 6px;
  text-align: center;
  color: var(--text-6);
  font-size: 11.5px;
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
