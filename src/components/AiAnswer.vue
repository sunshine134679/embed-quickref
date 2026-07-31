<script setup>
defineProps({
  query: { type: String, required: true },
  text: { type: String, default: "" },
  status: { type: String, default: "idle" },
  error: { type: String, default: "" },
  saved: { type: Boolean, default: false },
});
</script>

<template>
  <div class="ai-answer">
    <div class="head">
      <span class="query">{{ query }}</span>
      <span v-if="status === 'loading'" class="state">思考中…</span>
      <span v-else-if="status === 'streaming'" class="state">回答中…</span>
      <span v-else-if="status === 'done'" class="state done">完成</span>
      <span v-if="saved" class="tag saved">已存入个人词库</span>
    </div>
    <p v-if="status === 'error'" class="error">{{ error }}</p>
    <pre v-else-if="text" class="answer">{{ text }}</pre>
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
  gap: 10px;
  flex-wrap: wrap;
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

.answer {
  margin-top: 14px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid #e8edf3;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.8;
  color: #334155;
}

.error {
  margin-top: 14px;
  padding: 12px 14px;
  background: #fbf1f1;
  border: 1px solid #eddada;
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
