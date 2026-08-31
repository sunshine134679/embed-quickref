<script setup>
import { fmtWhen } from "../utils/format";

defineProps({
  sessions: { type: Array, default: () => [] },
});

const emit = defineEmits(["open", "remove", "clear"]);

// 摘要优先取首答的"定义"行，取不到就压平全文截断
function preview(s) {
  const a = s.messages.find((m) => m.role === "assistant");
  if (!a) return "";
  const m = a.content.match(/^定义[:：]\s*(.+)$/m);
  const text = m ? m[1] : a.content.replace(/\s+/g, " ");
  return text.length > 64 ? text.slice(0, 64) + "…" : text;
}

// 追问轮数（一问一答为一轮，首轮不计）
function extraTurns(s) {
  return Math.max(0, Math.floor(s.messages.length / 2) - 1);
}
</script>

<template>
  <div class="ai-history">
    <div class="hd">
      <span>AI 解释历史</span>
      <span v-if="sessions.length" class="count">{{ sessions.length }}</span>
      <button v-if="sessions.length" class="clear" title="清空全部 AI 解释历史" @click="emit('clear')">清空</button>
    </div>
    <div v-if="!sessions.length" class="empty">
      还没有 AI 解释记录。词库未命中时按 <kbd>Enter</kbd> 问 AI，记录会自动保存在这里。
    </div>
    <div v-for="s in sessions" :key="s.id" class="item" role="button" tabindex="0" @click="emit('open', s)" @keydown.enter="emit('open', s)">
      <div class="row1">
        <span class="q">{{ s.query }}</span>
        <span v-if="extraTurns(s)" class="turns">+{{ extraTurns(s) }} 追问</span>
        <span class="time">{{ fmtWhen(s.time) }}</span>
        <span class="del" role="button" tabindex="0" title="删除记录" aria-label="删除记录" @click.stop="emit('remove', s.id)" @keydown.enter.stop="emit('remove', s.id)">×</span>
      </div>
      <div v-if="preview(s)" class="pv">{{ preview(s) }}</div>
    </div>
  </div>
</template>

<style scoped>
.ai-history {
  padding: 14px 18px;
}

.hd {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 6px 10px;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.count {
  padding: 1px 8px;
  border-radius: 10px;
  background: rgba(82, 112, 143, 0.12);
  color: #52708f;
  font-size: 11px;
  font-weight: 600;
}

.clear {
  margin-left: auto;
  border: none;
  background: transparent;
  color: #a3aebc;
  font-size: 11px;
  cursor: pointer;
}

.clear:hover {
  color: #b45353;
}

.empty {
  padding: 42px 20px;
  text-align: center;
  color: #a3aebc;
  line-height: 2;
}

.item {
  padding: 10px 12px;
  margin-bottom: 6px;
  border: 1px solid rgba(226, 232, 240, 0.7);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.55);
  cursor: pointer;
}

.item:hover {
  background: rgba(255, 255, 255, 0.88);
  border-color: rgba(143, 168, 196, 0.75);
}

.row1 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.q {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.turns {
  flex: none;
  padding: 1px 7px;
  border-radius: 9px;
  background: rgba(82, 112, 143, 0.1);
  color: #52708f;
  font-size: 11px;
}

.time {
  flex: none;
  color: #a3aebc;
  font-size: 11px;
}

.del {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  color: #a3aebc;
  font-size: 14px;
  line-height: 1;
}

.del:hover {
  background: rgba(226, 232, 240, 0.9);
  color: #475569;
}

.pv {
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.6;
}
</style>
