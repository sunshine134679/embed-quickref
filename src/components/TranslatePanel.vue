<script setup>
import { ref, watch } from "vue";
import { speakEnglish, isSingleWord, suggestWords } from "../composables/useTranslate";
import { addUserTerm } from "../composables/useSearch";
import WordSuggest from "./WordSuggest.vue";

const props = defineProps({
  query: { type: String, default: "" },
  status: { type: String, default: "idle" }, // idle | loading | done | error
  result: { type: Object, default: null },
  error: { type: String, default: "" },
  history: { type: Array, default: () => [] },
});

const emit = defineEmits(["replay", "clear-history", "open-full", "use-suggestion"]);

// 输入联想：英文单词输入时（未翻译）在搜索栏下方实时给出拼写建议（前缀补全 + 模糊匹配）
const suggestions = ref([]);
watch(
  () => props.query,
  async (q) => {
    if (q && isSingleWord(q) && props.status !== "done") {
      suggestions.value = await suggestWords(q).catch(() => []);
    } else {
      suggestions.value = [];
    }
  }
);

// 历史条目时间显示：今天显示时分，其余显示月日
function fmtTime(t) {
  const d = new Date(t);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const pad = (n) => String(n).padStart(2, "0");
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return sameDay ? hm : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

// 历史摘要首行截断展示
function summaryLine(s) {
  return (s || "").split("\n")[0].slice(0, 60);
}

const copied = ref("");
async function copyText(text, key) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = key;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      copied.value = key;
    } catch (e) {
      console.error("复制失败", e);
    }
    ta.remove();
  }
  setTimeout(() => {
    if (copied.value === key) copied.value = "";
  }, 1200);
}

// ---- 结构化展示辅助 ----

// 词性分组：把 "n. 寄存器；登记  v. 注册；登记" 拆成 [{pos:'n.', meaning:'寄存器；登记'}, ...]
function splitPrimary(primary) {
  if (!primary) return [];
  return (primary || "")
    .split(/\s{2,}/)
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => {
      const m = g.match(/^((?:n|v|adj|adv|pron|prep|conj|int|det|abbr|aux)\.)\s*(.*)$/i);
      return m ? { pos: m[1].toLowerCase(), meaning: m[2] } : { pos: "", meaning: g };
    });
}

// 义项 pos："n. 嵌入式" -> { pos:'n.', field:'嵌入式' }
function splitPos(pos) {
  if (!pos) return { pos: "", field: "" };
  const m = pos.match(/^((?:n|v|adj|adv|pron|prep|conj|int|det|abbr|aux)\.)\s*(.*)$/i);
  if (m) return { pos: m[1].toLowerCase(), field: m[2] };
  return { pos: "", field: pos };
}

// AI 单词解释（音标/释义/例句/译文 固定格式）解析为结构化字段；解析失败返回 null
function parseAiReply(reply) {
  const out = { pronunciation: "", meaning: "", example: "", translated: "" };
  for (const line of (reply || "").split("\n")) {
    const t = line.trim();
    const m = t.match(/^(音标|释义|例句|译文)[:：]\s*(.*)$/);
    if (!m) continue;
    if (m[1] === "音标") out.pronunciation = m[2].trim();
    else if (m[1] === "释义") out.meaning = m[2].trim();
    else if (m[1] === "例句") out.example = m[2].trim();
    else if (m[1] === "译文") out.translated = m[2].trim();
  }
  return out.pronunciation || out.meaning || out.example || out.translated ? out : null;
}

// 可朗读的英文文本：单词卡片读单词；句子英译中读原文，中译英读译文
function speakableText() {
  const r = arguments[0] || null;
  if (!r) return "";
  if (r.kind === "word") return r.word;
  if (r.kind === "word-ai") return r.text;
  return r.target === "zh" ? r.text : r.translated;
}

// ---- AI 单词解释并入词库：与术语功能一致，把 AI 词典式解释存为词条 ----
// 状态："" 未操作 | saving 保存中 | added 已并入 | exists 个人词库已有 | builtin 内置词库已有 | error 失败
const termSaved = ref("");

async function saveWordToDict() {
  const r = props.result;
  if (!r || r.kind !== "word-ai" || termSaved.value === "saving") return;
  const ai = parseAiReply(r.reply);
  const meaning = ai?.meaning || (r.reply || "").split("\n")[0] || "";
  const example = ai?.example || "";
  const term = {
    abbr: (r.text || "").trim(),
    full: "",
    zh: meaning.slice(0, 40),
    category: "其他",
    definition: meaning,
    points: [
      ...(ai?.pronunciation ? [`音标：${ai.pronunciation}`] : []),
      ...(ai?.translated ? [`例句译文：${ai.translated}`] : []),
    ].slice(0, 3),
    usage: "",
    example,
    source: "ai",
  };
  termSaved.value = "saving";
  try {
    const res = await addUserTerm(term);
    termSaved.value = res === "added" ? "added" : res === "user-exists" ? "exists" : res === "builtin" ? "builtin" : "error";
  } catch (e) {
    console.error("翻译并入词库失败", e);
    termSaved.value = "error";
  }
}
</script>

<template>
  <div class="translate-panel">
    <!-- 空态：与术语分区统一——无历史时一行提示，有历史时直接显示最近翻译 -->
    <div v-if="!query.trim()" class="empty-state">
      <p v-if="!history.length" class="empty-muted">输入英文单词或句子，如 interrupt、float</p>

      <!-- 最近翻译历史 -->
      <div v-else class="history">
        <div class="history-head">
          <span class="history-title">最近翻译</span>
          <button class="history-clear" title="清空翻译历史" @click="emit('clear-history')">清空</button>
        </div>
        <button
          v-for="(h, i) in history.slice(0, 5)"
          :key="i"
          class="history-item"
          title="点击重新查看该翻译"
          @click="emit('replay', h)"
        >
          <span class="hi-kind">{{ h.kind === "word" || h.kind === "word-ai" ? "词" : "译" }}</span>
          <span class="hi-body">
            <span class="hi-input">{{ h.input }}</span>
            <span class="hi-summary">{{ summaryLine(h.summary) }}</span>
          </span>
          <span class="hi-time">{{ fmtTime(h.time) }}</span>
        </button>
        <button class="history-all" @click="emit('open-full')">查看全部记录 ›</button>
      </div>
    </div>

    <!-- 输入联想：英文单词输入中实时拼写建议（防手快输错），点击即翻译 -->
    <div v-else-if="suggestions.length && status !== 'done'" class="suggest-area">
      <WordSuggest :suggestions="suggestions" @pick="(w) => emit('use-suggestion', w)" />
    </div>

    <!-- 等待中：仅在还没有任何结果时显示（句子流式翻译期间 result 已有部分内容，直接展示） -->
    <div v-else-if="status === 'loading' && !result" class="loading-dots"><i></i><i></i><i></i></div>

    <!-- 错误 -->
    <p v-else-if="status === 'error'" class="error">
      {{ error === "no-api-key" ? "翻译需要 API Key，请先在设置中配置" : error }}
    </p>

    <!-- 未找到：拼写错误/不完整单词——明确报错，不硬编结果 -->
    <article v-else-if="result && result.kind === 'word-not-found'" class="not-found-card">
      <p class="nf-title">未找到「{{ result.text }}」</p>
      <p v-if="!result.suggestions.length" class="nf-hint">该单词不存在或拼写有误，请检查后重试</p>
      <template v-else>
        <p class="nf-hint">你是不是想查：</p>
        <div class="nf-sugg">
          <button
            v-for="(s, i) in result.suggestions"
            :key="i"
            class="nf-item"
            @click="emit('replay', { input: s.word })"
          >
            <span class="nf-word">{{ s.word }}</span>
            <span v-if="s.zh" class="nf-zh">{{ s.zh }}</span>
          </button>
        </div>
      </template>
    </article>

    <!-- 本地学习词典命中的单词卡片 -->
    <article v-else-if="result && result.kind === 'word'" class="word-card">
      <header class="word-head">
        <h1>{{ result.word }}</h1>
        <span v-if="result.entry.pronunciation" class="pron">
          <span v-if="result.entry.pronunciation.uk" class="pron-item">英 {{ result.entry.pronunciation.uk }}</span>
          <span v-if="result.entry.pronunciation.us" class="pron-item">美 {{ result.entry.pronunciation.us }}</span>
        </span>
        <span class="head-spacer"></span>
        <button
          class="speak-btn"
          title="播放英语读音"
          @click="speakEnglish(result.word)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 6a8.5 8.5 0 0 1 0 12" />
          </svg>
        </button>
      </header>

      <!-- 词性释义：按词性分组展示 -->
      <div v-if="splitPrimary(result.entry.primary).length" class="pos-list">
        <div v-for="(p, i) in splitPrimary(result.entry.primary)" :key="i" class="pos-row">
          <span v-if="p.pos" class="pos-chip">{{ p.pos }}</span>
          <span class="pos-meaning">{{ p.meaning }}</span>
        </div>
      </div>
      <p v-else-if="result.entry.primary" class="word-primary">{{ result.entry.primary }}</p>

      <div v-if="result.entry.forms && result.entry.forms.length" class="word-forms">
        <span class="label">词形</span>
        <span v-for="(f, i) in result.entry.forms" :key="i" class="form" :class="{ base: i === 0 }">{{ f }}</span>
      </div>

      <div v-if="result.entry.usage" class="word-usage">
        <span class="label">用法</span>
        <span class="usage-text">{{ result.entry.usage }}</span>
      </div>

      <!-- 义项列表 -->
      <section v-for="(s, i) in result.entry.senses" :key="i" class="sense">
        <div class="sense-head">
          <span v-if="splitPos(s.pos).pos" class="pos-chip">{{ splitPos(s.pos).pos }}</span>
          <span v-if="splitPos(s.pos).field" class="field-chip">{{ splitPos(s.pos).field }}</span>
          <span class="sense-meaning">{{ s.meaning }}</span>
        </div>
        <div v-if="s.example" class="sense-example">
          <code>{{ s.example }}</code>
          <p v-if="s.exampleZh" class="sense-example-zh">{{ s.exampleZh }}</p>
        </div>
      </section>

      <p class="hint">按 <kbd>Esc</kbd> 返回 · 点击 🔊 可朗读发音</p>
    </article>

    <!-- AI 词典式解释（单词未命中本地词典） -->
    <article v-else-if="result && result.kind === 'word-ai'" class="word-card">
      <header class="word-head">
        <h1>{{ result.text }}</h1>
        <span class="head-spacer"></span>
        <button class="speak-btn" title="播放英语读音" @click="speakEnglish(result.text)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 6a8.5 8.5 0 0 1 0 12" />
          </svg>
        </button>
      </header>

      <!-- AI 结构化字段 -->
      <template v-if="parseAiReply(result.reply)">
        <div v-if="parseAiReply(result.reply).pronunciation" class="ai-pron">
          <span class="label">音标</span>
          <span class="pron-value">{{ parseAiReply(result.reply).pronunciation }}</span>
        </div>
        <div v-if="parseAiReply(result.reply).meaning" class="ai-meaning">
          <span class="label">释义</span>
          <span class="meaning-text">{{ parseAiReply(result.reply).meaning }}</span>
        </div>
        <div v-if="parseAiReply(result.reply).example" class="ai-example">
          <span class="label">例句</span>
          <code>{{ parseAiReply(result.reply).example }}</code>
        </div>
        <div v-if="parseAiReply(result.reply).translated" class="ai-translated">
          <span class="label">译文</span>
          <span class="translated-text">{{ parseAiReply(result.reply).translated }}</span>
        </div>
      </template>
      <pre v-else class="ai-reply">{{ result.reply }}</pre>

      <!-- AI 单词解释并入词库：与术语功能一致 -->
      <div class="save-bar">
        <button
          v-if="termSaved !== 'added'"
          class="save-btn"
          :disabled="termSaved === 'saving'"
          title="把本次 AI 词典式解释存入个人词库，之后在术语分区也能搜到"
          @click="saveWordToDict"
        >
          {{ termSaved === "saving" ? "保存中…" : "将本词并入词库" }}
        </button>
        <span v-else class="save-done">已并入词库 ✓</span>
        <span v-if="termSaved === 'exists'" class="save-note">个人词库已有该词</span>
        <span v-else-if="termSaved === 'builtin'" class="save-note">内置词库已有该词条</span>
        <span v-else-if="termSaved === 'error'" class="save-note">保存失败，请重试</span>
      </div>

      <p class="hint">按 <kbd>Esc</kbd> 返回 · 点击 🔊 可朗读发音</p>
    </article>

    <!-- 句子翻译 -->
    <article v-else-if="result && result.kind === 'sentence'" class="sentence-card">
      <div class="dir-row">
        <span class="dir-chip">{{ result.target === "zh" ? "英 → 中" : "中 → 英" }}</span>
        <span class="dir-dot">●</span>
        <span class="dir-hint">句子翻译</span>
      </div>
      <div class="sentence-src">
        <span class="block-label">原文</span>
        <p class="src-text">{{ result.text }}</p>
      </div>
      <div class="sentence-dst">
        <span class="block-label dst-label">译文</span>
        <p class="dst-text">{{ result.translated }}</p>
      </div>
      <div class="actions">
        <button
          class="act-btn"
          :class="{ done: copied === 'dst' }"
          title="复制译文"
          @click="copyText(result.translated, 'dst')"
        >
          <svg v-if="copied !== 'dst'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
          {{ copied === "dst" ? "已复制" : "复制译文" }}
        </button>
        <button class="act-btn" title="播放英语读音" @click="speakEnglish(speakableText(result))">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 6a8.5 8.5 0 0 1 0 12" />
          </svg>
          朗读
        </button>
      </div>
      <p class="hint">按 <kbd>Esc</kbd> 返回</p>
    </article>

    <!-- 已输入但未翻译：等待手动触发 -->
    <div v-else class="empty muted">按 <kbd>Enter</kbd> 或点「翻译」按钮</div>
  </div>
</template>

<style scoped>
.translate-panel {
  padding: 16px 24px 20px;
  user-select: text;
}

/* 内容区撑满：空态占满，与术语分区风格统一 */
.translate-panel:has(.empty-state) {
  display: flex;
  flex-direction: column;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px 20px;
}

/* 无历史时：一行居中提示（同术语"输入缩写或关键词，如 I2C、MQTT、DTS"） */
.empty-muted {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-6);
  font-size: 13.5px;
}

/* 未找到单词：拼写错误/不完整——明确报错卡片 */
.not-found-card {
  width: 100%;
  max-width: 420px;
  margin: 20px auto 0;
  padding: 16px 18px;
  background: rgba(251, 241, 241, 0.85);
  border: 1px solid rgba(240, 210, 210, 0.8);
  border-radius: 12px;
  text-align: left;
}

.nf-title {
  font-size: 15px;
  font-weight: 600;
  color: #a05d5d;
}

.nf-hint {
  margin-top: 6px;
  color: var(--text-5);
  font-size: 12.5px;
}

.nf-sugg {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.nf-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid rgba(143, 168, 196, 0.6);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  cursor: pointer;
}

.nf-item:hover {
  background: rgba(var(--accent-rgb), 0.12);
}

.nf-word {
  font-weight: 700;
  color: var(--accent);
  font-size: 13px;
}

.nf-zh {
  color: var(--text-5);
  font-size: 12px;
}

/* 输入联想区域：搜索栏下方建议列表 */
.suggest-area {
  width: 100%;
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 14px;
  overflow-y: auto;
}

/* 最近翻译历史：空态顶部左对齐列表（同术语最近搜索） */
.history {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  text-align: left;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.history-title {
  color: var(--text-5);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
}

.history-clear {
  border: none;
  background: transparent;
  color: var(--text-6);
  font-size: 11px;
  cursor: pointer;
}

.history-clear:hover {
  color: var(--danger-soft);
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.history-item:hover {
  background: rgba(241, 245, 249, 0.9);
  border-color: rgba(219, 226, 234, 0.7);
}

.hi-kind {
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

.hi-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.hi-input {
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hi-summary {
  color: var(--text-5);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hi-time {
  flex: none;
  color: var(--text-6);
  font-size: 11px;
}

/* 查看全部记录：跳转总历史对应分区 */
.history-all {
  display: block;
  margin: 8px auto 0;
  padding: 7px 16px;
  border: 1px solid rgba(143, 168, 196, 0.6);
  border-radius: 8px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.history-all:hover {
  background: rgba(var(--accent-rgb), 0.18);
}

/* ---------- 加载 ---------- */
.loading-dots {
  display: flex;
  gap: 6px;
  padding: 28px 4px;
}

.loading-dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #b8c4d0;
  animation: blink 1.2s infinite ease-in-out;
}

.loading-dots i:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dots i:nth-child(3) {
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

.error {
  padding: 12px 14px;
  background: rgba(251, 241, 241, 0.85);
  border: 1px solid rgba(237, 218, 218, 0.9);
  border-radius: 8px;
  color: #a05d5d;
  line-height: 1.6;
}

/* ---------- 单词卡片 ---------- */
.word-card {
  padding: 20px 22px 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.75);
  border-radius: 12px;
}

.word-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.word-head h1 {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: 0.2px;
}

.head-spacer {
  flex: 1;
}

.pron {
  display: inline-flex;
  gap: 12px;
  color: var(--text-5);
  font-size: 13px;
  font-family: Consolas, "Cascadia Code", monospace;
}

.speak-btn {
  flex: none;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(219, 226, 234, 0.9);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.85);
  color: var(--text-4);
  cursor: pointer;
  transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;
}

.speak-btn:hover {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.5);
  background: rgba(var(--accent-rgb), 0.06);
}

.speak-btn svg {
  width: 17px;
  height: 17px;
}

/* 词性释义：每行 = 词性 chip + 释义 */
.pos-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pos-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.pos-chip {
  flex: none;
  min-width: 30px;
  padding: 1px 7px;
  border-radius: 6px;
  background: rgba(82, 112, 143, 0.12);
  color: #52708f;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  font-family: Consolas, "Courier New", monospace;
}

.pos-meaning {
  color: var(--text-2);
  font-size: 14.5px;
  line-height: 1.7;
}

.word-primary {
  margin-top: 10px;
  color: var(--text-2);
  font-size: 14.5px;
  line-height: 1.7;
}

/* 词形 */
.word-forms {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.label {
  flex: none;
  padding: 1px 9px;
  border-radius: 10px;
  background: rgba(82, 112, 143, 0.1);
  color: #52708f;
  font-size: 11px;
  font-weight: 600;
}

.form {
  padding: 2px 10px;
  background: #eef2f7;
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 7px;
  color: var(--text-3);
  font-size: 12px;
  font-family: Consolas, "Courier New", monospace;
}

.form.base {
  background: rgba(var(--accent-rgb), 0.12);
  border-color: rgba(143, 168, 196, 0.55);
  color: var(--accent);
  font-weight: 600;
}

/* 用法 */
.word-usage {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
  padding: 11px 13px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
}

.usage-text {
  color: var(--text-3);
  font-size: 13px;
  line-height: 1.7;
}

/* 义项 */
.sense {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(238, 242, 246, 0.9);
}

.sense-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.field-chip {
  flex: none;
  padding: 1px 8px;
  border-radius: 6px;
  background: rgba(27, 138, 125, 0.1);
  color: #1b8a7d;
  font-size: 11px;
  font-weight: 600;
}

.sense-meaning {
  color: var(--text-2);
  font-size: 14px;
  font-weight: 600;
}

.sense-example {
  margin-top: 9px;
  padding: 11px 13px;
  background: #f0f7f4;
  border: 1px solid #d5e8de;
  border-radius: 8px;
}

.sense-example code {
  display: block;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  color: #0f172a;
  word-break: break-all;
  line-height: 1.7;
}

.sense-example-zh {
  margin-top: 6px;
  color: var(--text-4);
  font-size: 12.5px;
  line-height: 1.6;
}

/* AI 单词解释：字段行（音标/释义/例句/译文） */
.ai-pron,
.ai-meaning,
.ai-example,
.ai-translated {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 12px;
}

.ai-meaning .meaning-text,
.ai-translated .translated-text {
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.7;
}

.ai-translated .translated-text {
  color: var(--text-1);
  font-weight: 500;
}

.pron-value {
  color: var(--text-4);
  font-size: 13px;
  font-family: Consolas, "Cascadia Code", monospace;
}

.ai-example code {
  display: block;
  flex: 1;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  color: #0f172a;
  word-break: break-word;
  line-height: 1.7;
  white-space: pre-wrap;
}

.ai-reply {
  margin-top: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.8;
  color: var(--text-2);
  font-size: 13.5px;
}

/* ---------- AI 单词解释并入词库 ---------- */
.save-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}

.save-btn {
  height: 30px;
  padding: 0 14px;
  border: 1px solid rgba(var(--accent-rgb), 0.55);
  border-radius: 8px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}

.save-btn:hover:not(:disabled) {
  background: rgba(var(--accent-rgb), 0.18);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.save-done {
  color: var(--success);
  font-size: 13px;
  font-weight: 600;
}

.save-note {
  color: var(--text-5);
  font-size: 12px;
}

/* ---------- 句子翻译 ---------- */
.sentence-card {
  padding: 16px 22px 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.75);
  border-radius: 12px;
}

.dir-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.dir-chip {
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(82, 112, 143, 0.14);
  color: #45627f;
  font-size: 11px;
  font-weight: 700;
}

.dir-dot {
  color: #b6c2cf;
  font-size: 6px;
}

.dir-hint {
  color: var(--text-4);
  font-size: 12px;
}

/* 原文/译文块：统一带块标签，译文用 accent 浅底突出 */
.block-label {
  display: inline-block;
  margin-bottom: 6px;
  color: var(--text-4);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
}

.dst-label {
  color: #45627f;
}

.sentence-src {
  padding: 12px 14px;
  background: #f4f6f9;
  border: 1px solid #e6ebf1;
  border-radius: 9px;
}

.src-text {
  color: var(--text-3);
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
}

.sentence-dst {
  margin-top: 10px;
  padding: 12px 14px;
  background: rgba(var(--accent-rgb), 0.12);
  border: 1px solid rgba(143, 168, 196, 0.35);
  border-radius: 9px;
}

.dst-text {
  color: var(--text-1);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.7;
  word-break: break-word;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.act-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid rgba(219, 226, 234, 0.95);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  color: var(--text-4);
  font-size: 12.5px;
  cursor: pointer;
  transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;
}

.act-btn:hover {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.5);
  background: rgba(var(--accent-rgb), 0.05);
}

.act-btn svg {
  width: 15px;
  height: 15px;
}

.act-btn.done {
  color: var(--success);
  border-color: rgba(107, 158, 120, 0.5);
}

.hint {
  margin-top: 16px;
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
</style>
