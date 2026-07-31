<script setup>
import { reactive } from "vue";

const props = defineProps({
  settings: { type: Object, required: true },
});
const emit = defineEmits(["save", "cancel"]);

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
