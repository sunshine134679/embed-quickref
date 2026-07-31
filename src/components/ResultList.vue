<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  results: { type: Array, required: true },
  selectedIndex: { type: Number, default: 0 },
});
const emit = defineEmits(["hover", "open"]);

const listEl = ref(null);

watch(
  () => props.selectedIndex,
  async (i) => {
    const el = listEl.value?.children?.[i];
    el?.scrollIntoView({ block: "nearest" });
  }
);
</script>

<template>
  <ul ref="listEl" class="result-list">
    <li
      v-for="(t, i) in results"
      :key="t.abbr + '-' + i"
      :class="{ active: i === selectedIndex }"
      @mousemove="emit('hover', i)"
      @click="emit('open', t)"
    >
      <span class="abbr">{{ t.abbr }}</span>
      <span class="full">{{ t.full }}</span>
      <span class="zh">{{ t.zh }}</span>
      <span class="tag">{{ t.category }}</span>
    </li>
  </ul>
</template>

<style scoped>
.result-list {
  list-style: none;
  padding: 6px;
}

li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
}

li.active {
  background: #e8eef5;
}

.abbr {
  flex: none;
  min-width: 64px;
  font-weight: 600;
  color: #334155;
}

.full {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
}

.zh {
  flex: none;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #94a3b8;
  font-size: 13px;
}
</style>
