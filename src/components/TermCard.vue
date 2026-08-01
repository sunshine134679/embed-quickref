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
    <p v-if="term.usage" class="usage">{{ term.usage }}</p>
    <p class="definition">{{ term.definition }}</p>
    <div v-if="term.options && term.options.length" class="options">
      <div v-for="(op, i) in term.options" :key="i" class="opt">
        <code>{{ op.o }}</code>
        <span>{{ op.d }}</span>
      </div>
    </div>
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

.usage {
  margin-top: 10px;
  padding: 10px 14px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  color: #0f172a;
  word-break: break-all;
  line-height: 1.7;
}

.options {
  margin-top: 12px;
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 14px;
  row-gap: 5px;
}

.opt code {
  background: #eef2ff;
  color: #3730a3;
  padding: 1px 8px;
  border-radius: 4px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12.5px;
  white-space: nowrap;
}

.opt span {
  color: #475569;
  font-size: 13.5px;
  line-height: 1.9;
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
