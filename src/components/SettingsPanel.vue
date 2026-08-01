<script setup>
import { reactive } from "vue";

const props = defineProps({
  settings: { type: Object, required: true },
  mode: { type: String, default: "floating" },
});
const emit = defineEmits(["save", "cancel", "update:mode"]);

const MODES = [
  { value: "floating", label: "悬浮圆点", desc: "桌面小圆点，点击展开，失焦自动缩回" },
  { value: "popup", label: "弹窗", desc: "热键唤起，失焦自动隐藏" },
  { value: "pinned", label: "固定", desc: "置顶最前 + 任务栏图标" },
];

const form = reactive({ ...props.settings });
</script>

<template>
  <div class="settings">
    <h2>设置</h2>
    <label>
      <span>全局热键</span>
      <input v-model="form.shortcut" type="text" spellcheck="false" placeholder="Alt+Q" />
    </label>
    <label>
      <span>API Key</span>
      <input v-model="form.apiKey" type="password" spellcheck="false" placeholder="sk-…（仅保存在本机）" />
    </label>
    <label>
      <span>Base URL</span>
      <input v-model="form.baseUrl" type="text" spellcheck="false" placeholder="https://api.deepseek.com" />
    </label>
    <label>
      <span>模型名</span>
      <input v-model="form.model" type="text" spellcheck="false" placeholder="deepseek-chat" />
    </label>
    <div class="field">
      <label class="field-label">界面模式</label>
      <div class="mode-options">
        <button
          v-for="m in MODES"
          :key="m.value"
          class="mode-opt"
          :class="{ active: mode === m.value }"
          @click="emit('update:mode', m.value)"
        >
          <span class="mode-name">{{ m.label }}</span>
          <span class="mode-desc">{{ m.desc }}</span>
        </button>
      </div>
    </div>
    <p class="hint">API Key 只写入本机配置文件，不会出现在代码或 git 仓库中。</p>
    <div class="actions">
      <button class="primary" @click="emit('save', { ...form })">保存</button>
      <button @click="emit('cancel')">取消</button>
    </div>
  </div>
</template>

<style scoped>
.settings {
  padding: 20px 24px;
}

h2 {
  font-size: 16px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 14px;
}

label {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

label span {
  flex: none;
  width: 72px;
  color: #64748b;
  font-size: 13px;
}

input {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #dbe2ea;
  border-radius: 6px;
  outline: none;
  background: #ffffff;
  color: #1f2937;
  font-size: 13px;
  user-select: text;
}

input:focus {
  border-color: #8fa8c4;
}

.hint {
  margin: 8px 0 14px;
  color: #a3aebc;
  font-size: 12px;
}

.field {
  margin-bottom: 12px;
}

.field-label {
  display: block;
  color: #64748b;
  font-size: 13px;
  margin-bottom: 4px;
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mode-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid #dbe2ea;
  border-radius: 8px;
  background: #ffffff;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.mode-opt.active {
  background: rgba(82, 112, 143, 0.1);
  border-color: rgba(143, 168, 196, 0.8);
  color: #52708f;
}

.mode-name {
  flex: none;
  font-weight: 600;
  min-width: 56px;
}

.mode-desc {
  color: #94a3b8;
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 10px;
}

button {
  padding: 7px 20px;
  border: 1px solid #dbe2ea;
  border-radius: 6px;
  background: #ffffff;
  color: #475569;
  font-size: 13px;
  cursor: pointer;
}

button:hover {
  background: #f1f5f9;
}

button.primary {
  background: #52708f;
  border-color: #52708f;
  color: #ffffff;
}

button.primary:hover {
  background: #46617d;
}
</style>
