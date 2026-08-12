<script setup>
import { computed, ref, watch, nextTick } from "vue";
import { categoryColor } from "../utils/categories";

const props = defineProps({
  query: { type: String, required: true },
  messages: { type: Array, default: () => [] },
  status: { type: String, default: "idle" },
  error: { type: String, default: "" },
  saved: { type: Boolean, default: false },
  canUpdate: { type: Boolean, default: false },
  canAppend: { type: Boolean, default: false },
  appending: { type: Boolean, default: false },
  // 本轮追问是否已并入词库（父级在并入成功后置位，新会话/新追问时重置）
  appended: { type: Boolean, default: false },
});

const emit = defineEmits(["follow-up", "save-update", "append-followups"]);

const followText = ref("");
const followInput = ref(null);
const bottomEl = ref(null);

// 去掉 system 后的对话线程
const thread = computed(() => props.messages.filter((m) => m.role !== "system"));
// 首条 AI 回答（固定格式，解析成结构化卡片）
const firstAnswer = computed(() => thread.value.find((m) => m.role === "assistant")?.content ?? "");
// 首答之后的追问问答对（自由文本）
const followUps = computed(() => {
  const i = thread.value.findIndex((m) => m.role === "assistant");
  return i === -1 ? [] : thread.value.slice(i + 1);
});
const busy = computed(() => props.status === "loading" || props.status === "streaming");
// 当前正在流式输出的是否是首答
const streamingFirst = computed(() => busy.value && followUps.value.length === 0);

function catStyle(cat) {
  const { fg, bg } = categoryColor(cat);
  return { color: fg, background: bg };
}

const FIELD_RE = /^(缩写|全称|中文名|分类|定义)[:：]\s*(.*)$/;

// AI 首答是固定结构的纯文本，流式过程中逐行解析成结构化字段
const parsed = computed(() => {
  const out = { abbr: "", full: "", zh: "", category: "", definition: "", points: [], extra: [] };
  let hasField = false;
  for (const raw of firstAnswer.value.split("\n")) {
    const line = raw.trim();
    if (!line || /^要点[:：]?$/.test(line)) continue;
    const m = line.match(FIELD_RE);
    if (m) {
      hasField = true;
      const v = m[2].trim();
      if (m[1] === "缩写") out.abbr = v;
      else if (m[1] === "全称") out.full = v === "-" ? "" : v;
      else if (m[1] === "中文名") out.zh = v;
      else if (m[1] === "分类") out.category = v;
      else out.definition = v;
    } else if (/^[-•]\s*/.test(line)) {
      out.points.push(line.replace(/^[-•]\s*/, ""));
    } else {
      out.extra.push(line);
    }
  }
  return hasField ? out : null;
});

function send() {
  const t = followText.value.trim();
  if (!t || busy.value) return;
  emit("follow-up", t);
  followText.value = "";
}

// 流式输出时保持滚动到底部；回答完成后聚焦追问输入框
watch(
  () => thread.value.map((m) => m.content.length).join(","),
  async () => {
    await nextTick();
    bottomEl.value?.scrollIntoView({ block: "end" });
  }
);

watch(
  () => props.status,
  async (s) => {
    if (s === "done") {
      await nextTick();
      followInput.value?.focus();
    }
  }
);
</script>

<template>
  <div class="ai-answer">
    <div class="head">
      <span class="badge-ai">AI</span>
      <span class="query">{{ query }}</span>
      <span v-if="status === 'loading'" class="state">思考中…</span>
      <span v-else-if="status === 'streaming'" class="state">回答中…</span>
      <span v-else-if="status === 'done'" class="state done">完成</span>
      <span v-if="saved" class="tag saved">已存入个人词库</span>
      <button
        v-if="canUpdate"
        class="tag update-btn"
        title="个人词库已有该词条，用本次回答覆盖更新"
        @click="emit('save-update')"
      >
        更新个人词库
      </button>
    </div>

    <!-- 首答：结构化卡片 -->
    <template v-if="firstAnswer">
      <article v-if="parsed" class="card">
        <div class="title-row">
          <span class="abbr">{{ parsed.abbr || "…" }}</span>
          <span v-if="parsed.category" class="cat" :style="catStyle(parsed.category)">{{ parsed.category }}</span>
        </div>
        <p v-if="parsed.full" class="full">{{ parsed.full }}</p>
        <p v-if="parsed.zh" class="zh">{{ parsed.zh }}</p>
        <p v-if="parsed.definition" class="definition">{{ parsed.definition }}</p>
        <ul v-if="parsed.points.length" class="points">
          <li v-for="(p, i) in parsed.points" :key="i">{{ p }}</li>
        </ul>
        <p v-for="(l, i) in parsed.extra" :key="'x' + i" class="extra">{{ l }}</p>
        <span v-if="streamingFirst && status === 'streaming'" class="caret"></span>
      </article>
      <pre v-else class="answer">{{ firstAnswer }}</pre>
    </template>
    <div v-else-if="streamingFirst" class="loading-dots"><i></i><i></i><i></i></div>

    <!-- 追问问答对 -->
    <template v-for="(m, i) in followUps" :key="i">
      <div v-if="m.role === 'user'" class="q-row">
        <div class="q-bubble">{{ m.content }}</div>
      </div>
      <div
        v-else-if="!m.content && busy && i === followUps.length - 1"
        class="loading-dots"
      >
        <i></i><i></i><i></i>
      </div>
      <pre v-else class="answer follow">{{ m.content }}<span
        v-if="status === 'streaming' && i === followUps.length - 1"
        class="caret"
      ></span></pre>
    </template>

    <!-- AI 完成回答后，在最新追问下方提供"并入词库"入口（仅 done 状态出现） -->
    <div v-if="canAppend && status === 'done'" class="append-bar">
      <button
        v-if="!appended && !appending"
        class="append-btn"
        title="AI 先把本轮追问总结为精简要点，再并入个人词库词条"
        @click="emit('append-followups')"
      >
        将本轮追问并入词库
      </button>
      <span v-else-if="appending" class="append-pending">AI 总结中…</span>
      <span v-else class="append-done">已并入词库 ✓</span>
    </div>

    <p v-if="status === 'error'" class="error">{{ error }}</p>
    <div ref="bottomEl" class="bottom-anchor"></div>

    <!-- 追问输入 -->
    <div class="follow-bar">
      <input
        ref="followInput"
        v-model="followText"
        class="follow-input"
        type="text"
        placeholder="继续追问，如：它和 FLL 有什么区别？"
        :disabled="status === 'error' && !firstAnswer"
        @keydown.enter.prevent="send"
        @keydown.esc.stop="followText = ''"
      />
      <button class="follow-send" :disabled="!followText.trim() || busy" @click="send">
        追问
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-answer {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 18px 24px 14px;
  user-select: text;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.badge-ai {
  flex: none;
  padding: 1px 7px;
  border-radius: 6px;
  background: rgba(82, 112, 143, 0.14);
  color: #52708f;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.query {
  font-weight: 600;
  color: #334155;
}

.state {
  color: #94a3b8;
  font-size: 12px;
}

.state.done {
  color: #6b9e78;
}

.saved {
  background: #e9f3ec;
  color: #6b9e78;
}

.update-btn {
  border: 1px solid rgba(82, 112, 143, 0.35);
  background: rgba(82, 112, 143, 0.08);
  color: #52708f;
  font-size: 11px;
  cursor: pointer;
}

.update-btn:hover {
  background: rgba(82, 112, 143, 0.18);
}

/* 结构化回答卡片：浅色、克制 */
.card {
  margin-top: 14px;
  padding: 16px 20px 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.75);
  border-radius: 10px;
}

.title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.abbr {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: 0.3px;
}

.cat {
  padding: 2px 9px;
  border-radius: 10px;
  background: rgba(82, 112, 143, 0.1);
  color: #52708f;
  font-size: 11px;
}

.full {
  margin-top: 3px;
  color: #64748b;
  font-size: 13px;
  font-family: Consolas, "Cascadia Code", monospace;
}

.zh {
  margin-top: 4px;
  color: #475569;
  font-size: 14px;
}

.definition {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(238, 242, 246, 0.9);
  color: #334155;
  font-size: 14px;
  line-height: 1.7;
}

.points {
  margin-top: 10px;
  list-style: none;
}

.points li {
  position: relative;
  padding: 3px 0 3px 16px;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
}

.points li::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 12px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(82, 112, 143, 0.45);
}

.extra {
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

/* 追问的问题：右对齐浅蓝灰气泡 */
.q-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.q-bubble {
  max-width: 82%;
  padding: 8px 14px;
  border-radius: 10px 10px 3px 10px;
  background: rgba(82, 112, 143, 0.12);
  color: #3b556e;
  font-size: 13px;
  line-height: 1.7;
  word-break: break-word;
}

/* 流式输出光标 */
.caret {
  display: inline-block;
  width: 2px;
  height: 14px;
  margin-left: 2px;
  vertical-align: -2px;
  background: #52708f;
  animation: caret-blink 1s step-end infinite;
}

@keyframes caret-blink {
  50% {
    opacity: 0;
  }
}

/* 追问回答 / 非固定格式首答的纯文本样式 */
.answer {
  margin-top: 14px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(226, 232, 240, 0.75);
  border-radius: 10px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.8;
  color: #334155;
}

.answer.follow {
  margin-top: 10px;
  border-radius: 3px 10px 10px 10px;
  font-size: 13px;
}

.error {
  margin-top: 14px;
  padding: 12px 14px;
  background: rgba(251, 241, 241, 0.85);
  border: 1px solid rgba(237, 218, 218, 0.9);
  border-radius: 8px;
  color: #a05d5d;
  line-height: 1.6;
  word-break: break-all;
}

.loading-dots {
  display: flex;
  gap: 6px;
  padding: 20px 4px;
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

.bottom-anchor {
  flex: 1;
}

/* 追问总结并入词库：最新回答下方的操作条 */
.append-bar {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.append-btn {
  height: 30px;
  padding: 0 14px;
  border: 1px dashed rgba(82, 112, 143, 0.4);
  border-radius: 8px;
  background: rgba(82, 112, 143, 0.06);
  color: #52708f;
  font-size: 12.5px;
  cursor: pointer;
}

.append-btn:hover {
  background: rgba(82, 112, 143, 0.14);
}

.append-done {
  padding: 6px 12px;
  color: #6b9e78;
  font-size: 12.5px;
}

.append-pending {
  padding: 6px 12px;
  color: #94a3b8;
  font-size: 12.5px;
}

/* 底部追问输入条 */
.follow-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 8px;
  margin-top: 14px;
  padding-top: 10px;
}

.follow-input {
  flex: 1;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(219, 226, 234, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  color: #334155;
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.follow-input:focus {
  border-color: rgba(143, 168, 196, 0.9);
}

.follow-input::placeholder {
  color: #a3aebc;
}

.follow-send {
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

.follow-send:hover:not(:disabled) {
  background: rgba(82, 112, 143, 0.22);
}

.follow-send:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
