<script setup>
defineProps({
  // [{ word, zh, dist }]：dist 0=前缀补全，>0=编辑距离相似
  suggestions: { type: Array, default: () => [] },
});
const emit = defineEmits(["pick"]);
</script>

<template>
  <div class="word-suggest">
    <div class="ws-head">
      <span>单词建议</span>
      <small>防止手快输错</small>
    </div>
    <button
      v-for="(s, i) in suggestions"
      :key="i"
      class="ws-item"
      title="点击用该单词翻译"
      @click="emit('pick', s.word)"
    >
      <span class="ws-word">{{ s.word }}</span>
      <span v-if="s.zh" class="ws-zh">{{ s.zh }}</span>
      <span class="ws-tag">{{ s.dist === 0 ? "补全" : "相似" }}</span>
    </button>
  </div>
</template>

<style scoped>
.word-suggest {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  text-align: left;
}

.ws-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 4px 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
}

.ws-head small {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-6);
}

.ws-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.ws-item:hover {
  background: #e8eef5;
  border-color: rgba(219, 226, 234, 0.7);
}

.ws-word {
  flex: none;
  min-width: 64px;
  font-weight: 700;
  color: var(--text-2);
  font-size: 13px;
}

.ws-zh {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-4);
  font-size: 12px;
}

.ws-tag {
  flex: none;
  padding: 1px 8px;
  border-radius: 10px;
  background: rgba(238, 242, 247, 0.9);
  color: var(--text-5);
  font-size: 10.5px;
}
</style>
