<script setup>
import { computed } from "vue";

const props = defineProps({
  query: { type: String, required: true },
  text: { type: String, default: "" },
  status: { type: String, default: "idle" },
  error: { type: String, default: "" },
  saved: { type: Boolean, default: false },
});

const FIELD_RE = /^(缩写|全称|中文名|分类|定义)[:：]\s*(.*)$/;

// AI 回答是固定结构的纯文本，流式过程中逐行解析成结构化字段
const parsed = computed(() => {
  const out = { abbr: "", full: "", zh: "", category: "", definition: "", points: [], extra: [] };
  let hasField = false;
  for (const raw of props.text.split("\n")) {
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
    </div>
    <p v-if="status === 'error'" class="error">{{ error }}</p>
    <template v-else-if="text">
      <article v-if="parsed" class="card">
        <div class="title-row">
          <span class="abbr">{{ parsed.abbr || "…" }}</span>
          <span v-if="parsed.category" class="cat">{{ parsed.category }}</span>
        </div>
        <p v-if="parsed.full" class="full">{{ parsed.full }}</p>
        <p v-if="parsed.zh" class="zh">{{ parsed.zh }}</p>
        <p v-if="parsed.definition" class="definition">{{ parsed.definition }}</p>
        <ul v-if="parsed.points.length" class="points">
          <li v-for="(p, i) in parsed.points" :key="i">{{ p }}</li>
        </ul>
        <p v-for="(l, i) in parsed.extra" :key="'x' + i" class="extra">{{ l }}</p>
        <span v-if="status === 'streaming'" class="caret"></span>
      </article>
      <pre v-else class="answer">{{ text }}</pre>
    </template>
    <div v-else class="loading-dots"><i></i><i></i><i></i></div>
  </div>
</template>

<style scoped>
.ai-answer {
  padding: 18px 24px;
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

/* 非固定格式时的纯文本兜底 */
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
</style>
