<script setup>
import { ref } from "vue";
import { speakEnglish } from "../composables/useTranslate";

defineProps({
  query: { type: String, default: "" },
  status: { type: String, default: "idle" }, // idle | loading | done | error
  result: { type: Object, default: null },
  error: { type: String, default: "" },
});

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

// 可朗读的英文文本：单词卡片读单词；句子英译中读原文，中译英读译文
function speakableText() {
  const r = arguments[0] || null;
  if (!r) return "";
  if (r.kind === "word") return r.word;
  if (r.kind === "word-ai") return r.text;
  return r.target === "zh" ? r.text : r.translated;
}
</script>

<template>
  <div class="translate-panel">
    <!-- 空态 -->
    <div v-if="!query.trim()" class="empty muted">
      输入英文单词或句子，如 interrupt、float，或 “把内核启动参数传给设备树”
    </div>

    <!-- 等待中 -->
    <div v-else-if="status === 'loading'" class="loading-dots"><i></i><i></i><i></i></div>

    <!-- 错误 -->
    <p v-else-if="status === 'error'" class="error">
      {{ error === "no-api-key" ? "翻译需要 API Key，请先在设置中配置" : error }}
    </p>

    <!-- 本地学习词典命中的单词卡片 -->
    <article v-else-if="result && result.kind === 'word'" class="translate-card">
      <div class="head">
        <h1>{{ result.word }}</h1>
        <span v-if="result.entry.pronunciation" class="pron">
          <span v-if="result.entry.pronunciation.uk" class="pron-item">英 {{ result.entry.pronunciation.uk }}</span>
          <span v-if="result.entry.pronunciation.us" class="pron-item">美 {{ result.entry.pronunciation.us }}</span>
        </span>
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
      </div>
      <div v-if="result.entry.primary" class="word-primary">{{ result.entry.primary }}</div>
      <div v-if="result.entry.forms && result.entry.forms.length" class="word-forms">
        <span class="label">词形</span>
        <span v-for="(f, i) in result.entry.forms" :key="i" class="form">{{ f }}</span>
      </div>
      <div v-if="result.entry.usage" class="word-usage">
        <span class="label">用法</span>
        <span class="usage-text">{{ result.entry.usage }}</span>
      </div>
      <section v-for="(s, i) in result.entry.senses" :key="i" class="sense">
        <div class="sense-title">{{ s.pos }} · {{ s.meaning }}</div>
        <div v-if="s.example" class="sense-example">
          <span class="example-label">例句</span>
          <code>{{ s.example }}</code>
          <p v-if="s.exampleZh" class="sense-example-zh">{{ s.exampleZh }}</p>
        </div>
      </section>
      <p class="hint">按 <kbd>Esc</kbd> 返回 · 点击 🔊 可朗读发音</p>
    </article>

    <!-- AI 词典式解释（单词未命中本地词典） -->
    <article v-else-if="result && result.kind === 'word-ai'" class="translate-card">
      <div class="head">
        <h1>{{ result.text }}</h1>
        <button class="speak-btn" title="播放英语读音" @click="speakEnglish(result.text)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <path d="M4 9v6h4l5 4V5L8 9H4z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 6a8.5 8.5 0 0 1 0 12" />
          </svg>
        </button>
      </div>
      <pre class="ai-reply">{{ result.reply }}</pre>
      <p class="hint">按 <kbd>Esc</kbd> 返回 · 点击 🔊 可朗读发音</p>
    </article>

    <!-- 句子翻译 -->
    <article v-else-if="result && result.kind === 'sentence'" class="translate-card sentence-card">
      <div class="sentence-src">
        <span class="label">{{ result.target === "zh" ? "英 → 中" : "中 → 英" }}</span>
        <p class="src-text">{{ result.text }}</p>
      </div>
      <div class="sentence-dst">
        <p class="dst-text">{{ result.translated }}</p>
      </div>
      <div class="actions">
        <button
          class="act-btn"
          :class="{ done: copied === 'dst' }"
          title="复制译文"
          @click="copyText(result.translated, 'dst')"
        >
          {{ copied === "dst" ? "已复制 ✓" : "复制译文" }}
        </button>
        <button class="act-btn" title="播放英语读音" @click="speakEnglish(speakableText(result))">
          🔊 朗读
        </button>
      </div>
      <p class="hint">按 <kbd>Esc</kbd> 返回</p>
    </article>

    <div v-else class="empty muted">输入后自动翻译</div>
  </div>
</template>

<style scoped>
.translate-panel {
  padding: 14px 24px;
  user-select: text;
}

.empty.muted {
  padding: 48px 20px;
  text-align: center;
  color: var(--text-6);
}

/* 加载动画：与 AI 回答风格一致 */
.loading-dots {
  display: flex;
  gap: 6px;
  padding: 24px 4px;
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

.translate-card {
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.75);
  border-radius: 10px;
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
}

.pron {
  display: inline-flex;
  gap: 10px;
  color: var(--text-5);
  font-size: 13px;
  font-family: Consolas, "Cascadia Code", monospace;
}

.speak-btn {
  flex: none;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(219, 226, 234, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  color: var(--text-4);
  cursor: pointer;
}

.speak-btn:hover {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.5);
}

.speak-btn svg {
  width: 16px;
  height: 16px;
}

.word-primary {
  margin-top: 10px;
  color: var(--text-2);
  font-size: 14.5px;
  line-height: 1.7;
}

.word-forms {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.label {
  flex: none;
  padding: 1px 8px;
  border-radius: 10px;
  background: rgba(82, 112, 143, 0.1);
  color: #52708f;
  font-size: 11px;
  font-weight: 600;
}

.form {
  padding: 2px 9px;
  background: #eef2f7;
  border-radius: 6px;
  color: var(--text-3);
  font-size: 12px;
  font-family: Consolas, "Courier New", monospace;
}

.word-usage {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.usage-text {
  color: var(--text-3);
  font-size: 13px;
  line-height: 1.7;
}

.sense {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(238, 242, 246, 0.9);
}

.sense-title {
  color: var(--text-2);
  font-size: 14px;
  font-weight: 600;
}

.sense-example {
  position: relative;
  margin-top: 8px;
  padding: 24px 12px 10px;
  background: #f0f7f4;
  border: 1px solid #d5e8de;
  border-left: 3px solid #6b9e78;
  border-radius: 8px;
}

.example-label {
  position: absolute;
  top: 6px;
  left: 10px;
  font-size: 11px;
  color: #6b9e78;
  font-weight: 600;
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

/* AI 词典式回答：纯文本块 */
.ai-reply {
  margin-top: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.8;
  color: var(--text-2);
  font-size: 13.5px;
}

/* 句子翻译 */
.sentence-src {
  padding-bottom: 10px;
  border-bottom: 1px dashed rgba(219, 226, 234, 0.9);
}

.src-text {
  margin-top: 8px;
  color: var(--text-3);
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
}

.sentence-dst {
  margin-top: 12px;
}

.dst-text {
  color: var(--text-1);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.7;
  word-break: break-word;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.act-btn {
  height: 30px;
  padding: 0 14px;
  border: 1px solid rgba(219, 226, 234, 0.95);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  color: var(--text-4);
  font-size: 12.5px;
  cursor: pointer;
}

.act-btn:hover {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.5);
}

.act-btn.done {
  color: var(--success);
  border-color: rgba(107, 158, 120, 0.5);
}

.hint {
  margin-top: 14px;
  color: var(--text-6);
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
