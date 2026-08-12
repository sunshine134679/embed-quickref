<script setup>
import { ref, watch } from "vue";
import { categoryColor } from "../utils/categories";

const props = defineProps({
  results: { type: Array, required: true },
  selectedIndex: { type: Number, default: 0 },
  query: { type: String, default: "" },
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

// ---- 命中高亮：找出词条中与搜索词匹配的片段（缩写 > 全称 > 中文名）----
function hitRange(text, q) {
  if (!text || !q) return null;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  return i >= 0 ? [i, i + q.length] : null;
}

function findHit(t, q) {
  const query = q.trim();
  if (!query) return null;
  for (const field of ["abbr", "full", "zh"]) {
    const r = hitRange(t[field], query);
    if (r) return { field, start: r[0], end: r[1] };
  }
  return null;
}

// 把文本切成 普通/高亮 片段，供模板渲染
function chunks(text, field, hit) {
  if (!text) return [];
  if (!hit || hit.field !== field) return [{ hl: false, t: text }];
  return [
    { hl: false, t: text.slice(0, hit.start) },
    { hl: true, t: text.slice(hit.start, hit.end) },
    { hl: false, t: text.slice(hit.end) },
  ];
}

function catStyle(cat) {
  const { fg, bg } = categoryColor(cat);
  return { color: fg, background: bg };
}
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
      <span class="abbr">
        <template v-for="(c, j) in chunks(t.abbr, 'abbr', findHit(t, query))" :key="j">
          <mark v-if="c.hl" class="hl">{{ c.t }}</mark>
          <template v-else>{{ c.t }}</template>
        </template>
      </span>
      <span class="full">
        <template v-for="(c, j) in chunks(t.full, 'full', findHit(t, query))" :key="j">
          <mark v-if="c.hl" class="hl">{{ c.t }}</mark>
          <template v-else>{{ c.t }}</template>
        </template>
      </span>
      <span class="zh">
        <template v-for="(c, j) in chunks(t.zh, 'zh', findHit(t, query))" :key="j">
          <mark v-if="c.hl" class="hl">{{ c.t }}</mark>
          <template v-else>{{ c.t }}</template>
        </template>
      </span>
      <span class="tag" :style="catStyle(t.category)">{{ t.category }}</span>
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

mark.hl {
  background: rgba(var(--accent-rgb), 0.16);
  color: var(--accent);
  border-radius: 3px;
  padding: 0 1px;
}

.abbr {
  flex: none;
  min-width: 64px;
  font-weight: 600;
  color: var(--text-2);
}

.full {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-4);
}

.zh {
  flex: none;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-5);
  font-size: 13px;
}

.tag {
  flex: none;
}
</style>
