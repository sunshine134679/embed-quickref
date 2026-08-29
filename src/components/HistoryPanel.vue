<script setup>
import { ref, watch, nextTick, onMounted } from "vue";
import { loadTermHistory } from "../composables/useSearch";
import { loadHistory } from "../composables/useTranslate";
import { categoryColor } from "../utils/categories";
import AiHistory from "./AiHistory.vue";

const props = defineProps({
  // 打开时初始选中的分区：terms | translate | ai
  initialTab: { type: String, default: "terms" },
  aiSessions: { type: Array, default: () => [] },
  // 收藏词条（[{ abbr, category, full, zh }]）：术语 tab 顶部置顶回看
  favorites: { type: Array, default: () => [] },
});
const emit = defineEmits(["open-term", "open-translate", "open-ai", "remove-ai", "clear-terms", "clear-translate"]);

// tab 默认术语分区，props 有效时立即覆盖（immediate：异步组件首次挂载 props 可能未就绪，
// 不能依赖 ref(props.initialTab) 的初始值，否则打开历史时 3 个 tab 都无选中态）
const tab = ref("terms");
const termHistory = ref(loadTermHistory());
const translateHistory = ref(loadHistory());
const listEl = ref(null);

function refresh() {
  termHistory.value = loadTermHistory();
  translateHistory.value = loadHistory();
  nextTick(() => listEl.value?.scrollTo({ top: 0 }));
}

watch(
  () => props.initialTab,
  (t) => {
    if (t) tab.value = t;
  },
  { immediate: true }
);
// 每次进入视图刷新历史；AI 会话变化（新增/删除）时也刷新
watch(
  () => [props.aiSessions.length, props.initialTab],
  () => refresh(),
  { immediate: true }
);
onMounted(refresh);

function catStyle(cat) {
  const { fg, bg } = categoryColor(cat);
  return { color: fg, background: bg };
}

function fmtTime(t) {
  const d = new Date(t);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const pad = (n) => String(n).padStart(2, "0");
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return sameDay ? hm : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

function openTerm(h) {
  emit("open-term", h);
}
function openTranslate(h) {
  emit("open-translate", h);
}
</script>

<template>
  <div class="history-panel">
    <div class="h-tabs" role="tablist">
      <button
        role="tab"
        :aria-selected="tab === 'terms'"
        :class="{ on: tab === 'terms' }"
        @click="tab = 'terms'"
      >
        术语
        <span class="h-count">{{ termHistory.length }}</span>
      </button>
      <button
        role="tab"
        :aria-selected="tab === 'translate'"
        :class="{ on: tab === 'translate' }"
        @click="tab = 'translate'"
      >
        英语
        <span class="h-count">{{ translateHistory.length }}</span>
      </button>
      <button
        role="tab"
        :aria-selected="tab === 'ai'"
        :class="{ on: tab === 'ai' }"
        @click="tab = 'ai'"
      >
        AI 解释
        <span class="h-count">{{ aiSessions.length }}</span>
      </button>
    </div>

    <div ref="listEl" class="h-body">
      <!-- 术语历史：收藏置顶 + 最近搜索 -->
      <template v-if="tab === 'terms'">
        <div v-if="favorites.length" class="h-list">
          <div class="h-head">
            <span class="h-title">收藏</span>
          </div>
          <button
            v-for="(f, i) in favorites"
            :key="i"
            class="h-item"
            title="打开词条详情"
            @click="openTerm(f)"
          >
            <span class="hi-abbr">{{ f.abbr }}</span>
            <span class="hi-body">
              <span v-if="f.zh" class="hi-zh">{{ f.zh }}</span>
              <span v-if="f.full" class="hi-full">{{ f.full }}</span>
            </span>
            <span v-if="f.category" class="tag" :style="catStyle(f.category)">{{ f.category }}</span>
          </button>
        </div>
        <div v-if="termHistory.length" class="h-list">
          <div class="h-head">
            <span class="h-title">最近搜索</span>
            <button class="h-clear" title="清空术语搜索历史" @click="emit('clear-terms')">清空</button>
          </div>
          <button
            v-for="(h, i) in termHistory"
            :key="i"
            class="h-item"
            title="打开词条详情"
            @click="openTerm(h)"
          >
            <span class="hi-abbr">{{ h.abbr }}</span>
            <span class="hi-body">
              <span v-if="h.zh" class="hi-zh">{{ h.zh }}</span>
              <span v-if="h.full" class="hi-full">{{ h.full }}</span>
            </span>
            <span v-if="h.category" class="tag" :style="catStyle(h.category)">{{ h.category }}</span>
            <span class="hi-time">{{ fmtTime(h.time) }}</span>
          </button>
        </div>
        <div v-if="!termHistory.length && !favorites.length" class="h-empty">还没有术语搜索记录，去搜索一个试试</div>
      </template>

      <!-- 英语历史：最近翻译 -->
      <template v-else-if="tab === 'translate'">
        <div v-if="translateHistory.length" class="h-list">
          <div class="h-head">
            <span class="h-title">最近翻译</span>
            <button class="h-clear" title="清空翻译历史" @click="emit('clear-translate')">清空</button>
          </div>
          <button
            v-for="(h, i) in translateHistory"
            :key="i"
            class="h-item"
            title="重新查看该翻译"
            @click="openTranslate(h)"
          >
            <span class="hi-kind">{{ h.kind === "word" || h.kind === "word-ai" ? "词" : "译" }}</span>
            <span class="hi-body">
              <span class="hi-input">{{ h.input }}</span>
              <span class="hi-summary">{{ (h.summary || "").split("\n")[0].slice(0, 60) }}</span>
            </span>
            <span class="hi-time">{{ fmtTime(h.time) }}</span>
          </button>
        </div>
        <div v-else class="h-empty">还没有翻译记录，去翻译一个试试</div>
      </template>

      <!-- AI 解释历史（复用原组件）；显式条件分支：tab 意外值时不误显示 AI 内容 -->
      <AiHistory
        v-else-if="tab === 'ai'"
        :sessions="aiSessions"
        @open="(s) => emit('open-ai', s)"
        @remove="(id) => emit('remove-ai', id)"
      />
    </div>
  </div>
</template>

<style scoped>
.history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px 12px 0;
}

.h-tabs {
  flex: none;
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(226, 232, 240, 0.55);
  align-self: flex-start;
}

.h-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-4);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
}

.h-tabs button.on {
  background: rgba(255, 255, 255, 0.92);
  color: var(--accent);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(30, 41, 59, 0.1);
}

.h-count {
  padding: 0 6px;
  border-radius: 8px;
  background: rgba(100, 116, 139, 0.12);
  color: var(--text-4);
  font-size: 10.5px;
  font-weight: 600;
}

.h-tabs button.on .h-count {
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent);
}

.h-body {
  flex: 1;
  min-height: 0;
  margin-top: 8px;
  overflow-y: auto;
  padding-bottom: 8px;
}

.h-body::-webkit-scrollbar {
  width: 5px;
}

.h-body::-webkit-scrollbar-thumb {
  background: rgba(215, 221, 228, 0.9);
  border-radius: 3px;
}

.h-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

/* 收藏区与最近搜索区之间的间距 */
.h-list + .h-list {
  margin-top: 12px;
}

.h-title {
  color: var(--text-5);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
}

.h-clear {
  border: none;
  background: transparent;
  color: var(--text-6);
  font-size: 11px;
  cursor: pointer;
}

.h-clear:hover {
  color: var(--danger-soft);
}

.h-item {
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

.h-item:hover {
  background: rgba(241, 245, 249, 0.9);
  border-color: rgba(219, 226, 234, 0.7);
}

.hi-abbr {
  flex: none;
  min-width: 60px;
  font-weight: 700;
  color: var(--text-2);
  font-size: 13px;
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

.hi-zh,
.hi-input {
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hi-full,
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

.tag {
  flex: none;
  padding: 1px 8px;
  border-radius: 10px;
  background: rgba(238, 242, 247, 0.85);
  color: var(--text-4);
  font-size: 10.5px;
  white-space: nowrap;
}

.h-empty {
  padding: 48px 20px;
  text-align: center;
  color: var(--text-6);
  font-size: 13px;
}
</style>
