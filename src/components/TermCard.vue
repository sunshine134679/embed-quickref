<script setup>
import { ref } from "vue";
import { categoryColor } from "../utils/categories";

defineProps({
  term: { type: Object, required: true },
  starred: { type: Boolean, default: false },
});
defineEmits(["toggle-star"]);

// 复制反馈：记录当前复制的块（usage/definition），1.2s 后复位
const copied = ref("");
async function copyText(text, key) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = key;
  } catch {
    // 剪贴板权限不可用时的降级方案
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

function catStyle(cat) {
  const { fg, bg } = categoryColor(cat);
  return { color: fg, background: bg };
}
</script>

<template>
  <div class="term-card">
    <div class="head">
      <h1>{{ term.abbr }}</h1>
      <span class="tag" :style="catStyle(term.category)">{{ term.category }}</span>
      <span class="tag source">{{ term.source === "ai" ? "AI 缓存" : "内置词库" }}</span>
      <button
        class="star-btn"
        :class="{ on: starred }"
        :title="starred ? '取消收藏' : '收藏（历史面板可回看）'"
        @click="$emit('toggle-star')"
      >
        <svg viewBox="0 0 24 24" :fill="starred ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6">
          <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
        </svg>
      </button>
    </div>
    <p v-if="term.full" class="full">{{ term.full }}</p>
    <p v-if="term.zh" class="zh">{{ term.zh }}</p>
    <div v-if="term.usage" class="code-block">
      <button
        class="copy-btn"
        :class="{ done: copied === 'usage' }"
        title="复制命令"
        @click="copyText(term.usage, 'usage')"
      >
        {{ copied === "usage" ? "已复制 ✓" : "复制" }}
      </button>
      <p class="usage">{{ term.usage }}</p>
    </div>
    <div v-if="term.example" class="code-block example-block">
      <span class="example-label">示例</span>
      <button
        class="copy-btn"
        :class="{ done: copied === 'example' }"
        title="复制示例"
        @click="copyText(term.example, 'example')"
      >
        {{ copied === "example" ? "已复制 ✓" : "复制" }}
      </button>
      <p class="example">{{ term.example }}</p>
    </div>
    <div v-if="term.options && term.options.length" class="options">
      <div v-for="(op, i) in term.options" :key="i" class="opt">
        <code>{{ op.o }}</code>
        <span>{{ op.d }}</span>
      </div>
    </div>
    <div class="code-block">
      <button
        class="copy-btn"
        :class="{ done: copied === 'definition' }"
        title="复制定义"
        @click="copyText(term.definition, 'definition')"
      >
        {{ copied === "definition" ? "已复制 ✓" : "复制" }}
      </button>
      <p class="definition">{{ term.definition }}</p>
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
  color: var(--text-1);
}

.source {
  background: #e8f0f9;
  color: #5b7a9d;
}

/* 收藏星标：标题行右侧，选中时 accent 色，未选中低调灰 */
.star-btn {
  flex: none;
  margin-left: auto;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-6);
  cursor: pointer;
}

.star-btn svg {
  width: 17px;
  height: 17px;
}

.star-btn:hover {
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.08);
}

.star-btn.on {
  color: var(--accent);
}

.full {
  margin-top: 8px;
  font-size: 15px;
  color: var(--text-3);
  font-style: italic;
}

.zh {
  margin-top: 2px;
  color: var(--text-4);
}

/* 可复制代码块：右上角悬浮复制按钮 */
.code-block {
  position: relative;
}

.copy-btn {
  position: absolute;
  top: 6px;
  right: 8px;
  z-index: 1;
  padding: 2px 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--text-4);
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.code-block:hover .copy-btn,
.code-block:focus-within .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.5);
}

.copy-btn.done {
  color: var(--success);
  border-color: rgba(107, 158, 120, 0.5);
  opacity: 1;
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

/* 示例块：浅绿底 + 左侧强调边，与 usage（灰蓝）区分；多行示例保留换行 */
.example-block {
  margin-top: 10px;
}

.example-label {
  position: absolute;
  top: 6px;
  left: 10px;
  font-size: 11px;
  color: #6b9e78;
  font-weight: 600;
}

.example {
  margin-top: 10px;
  /* 顶部留出「示例」标签空间（标签位于 top:6px，占约 6-20px） */
  padding: 24px 14px 10px;
  background: #f0f7f4;
  border: 1px solid #d5e8de;
  border-left: 3px solid #6b9e78;
  border-radius: 8px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  color: #0f172a;
  white-space: pre-wrap;
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
  color: var(--text-3);
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
  color: var(--text-2);
}

.points {
  margin-top: 12px;
  padding-left: 18px;
  color: var(--text-3);
  line-height: 1.9;
}

.hint {
  margin-top: 18px;
  color: var(--text-6);
  font-size: 12px;
}
</style>
