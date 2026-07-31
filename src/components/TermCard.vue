<script setup>
defineProps({
  term: { type: Object, required: true },
});
</script>

<template>
  <div class="term-card">
    <div class="head">
      <h1>{{ term.abbr }}</h1>
      <span class="tag">{{ term.category }}</span>
      <span class="tag source">{{ term.source === "ai" ? "AI 缓存" : "内置词库" }}</span>
    </div>
    <p v-if="term.full" class="full">{{ term.full }}</p>
    <p v-if="term.zh" class="zh">{{ term.zh }}</p>
    <p class="definition">{{ term.definition }}</p>
    <ul v-if="term.points && term.points.length" class="points">
      <li v-for="(p, i) in term.points" :key="i">{{ p }}</li>
    </ul>
    <p class="hint">按 <kbd>Tab</kbd> 让 AI 展开讲讲 · <kbd>Esc</kbd> 返回</p>
  </div>
</template>

<style scoped>
.term-card {
  padding: 20px 24px;
  user-select: text;
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
}

h1 {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
}

.source {
  background: #e8f0f9;
  color: #5b7a9d;
}

.full {
  margin-top: 8px;
  font-size: 15px;
  color: #475569;
  font-style: italic;
}

.zh {
  margin-top: 2px;
  color: #64748b;
}

.definition {
  margin-top: 14px;
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid #e8edf3;
  border-radius: 8px;
  line-height: 1.7;
  color: #334155;
}

.points {
  margin-top: 12px;
  padding-left: 18px;
  color: #475569;
  line-height: 1.9;
}

.hint {
  margin-top: 18px;
  color: #a3aebc;
  font-size: 12px;
}
</style>
