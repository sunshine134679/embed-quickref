<script setup>
import { reactive, ref, computed, watch } from "vue";
import { PROVIDERS, endpointFor } from "../data/providers";

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
// 服务商预设：按当前 Base URL 自动匹配（自定义 URL 不选中任何预设）
const providerId = ref("");
{
  const p = PROVIDERS.find((x) => x.baseUrl === String(form.baseUrl || "").replace(/\/+$/, ""));
  if (p) providerId.value = p.id;
}
const currentProvider = computed(() => PROVIDERS.find((x) => x.id === providerId.value) || null);
// 端点自动判定：gpt-*/grok-* 走 OpenAI Responses，其余走 OpenAI 兼容
const endpoint = computed(() => endpointFor(form.model));

// 手动修改 Base URL：若与预设一致则同步高亮
watch(
  () => form.baseUrl,
  (url) => {
    const p = PROVIDERS.find((x) => x.baseUrl === String(url || "").replace(/\/+$/, ""));
    if (p) providerId.value = p.id;
    else if (!currentProvider.value) providerId.value = "";
  }
);
// 选中预设：自动填 Base URL 与推荐模型
watch(providerId, (id) => {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) return;
  form.baseUrl = p.baseUrl;
  if (p.models.length) form.model = p.models[0];
});
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
      <span>服务商</span>
      <select v-model="providerId" class="provider-select">
        <option value="">自定义</option>
        <option v-for="p in PROVIDERS" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </label>
    <label>
      <span>Base URL</span>
      <input v-model="form.baseUrl" type="text" spellcheck="false" placeholder="https://api.deepseek.com" />
    </label>
    <label>
      <span>模型名</span>
      <input v-model="form.model" type="text" spellcheck="false" placeholder="deepseek-chat" />
    </label>
    <div v-if="currentProvider?.models?.length" class="model-chips">
      <button
        v-for="m in currentProvider.models"
        :key="m"
        class="model-chip"
        :class="{ active: form.model === m }"
        @click="form.model = m"
      >
        {{ m }}
      </button>
    </div>
    <p class="hint">
      接口：{{ endpoint === "responses" ? "OpenAI Responses (/responses)" : "OpenAI 兼容 (/chat/completions)" }}
      —— gpt-*/grok-* 模型自动走 /responses
    </p>
    <div class="field">
      <label class="field-label">发音口音</label>
      <div class="accent-options">
        <button :class="{ active: form.accent !== 'en' }" @click="form.accent = 'us'">美式英语</button>
        <button :class="{ active: form.accent === 'en' }" @click="form.accent = 'en'">英式英语</button>
      </div>
    </div>
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

.provider-select {
  flex: 1;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #dbe2ea;
  border-radius: 6px;
  outline: none;
  background: #ffffff;
  color: #1f2937;
  font-size: 13px;
  cursor: pointer;
}

/* 推荐模型：点击即填入，选中态高亮 */
.model-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: -2px 0 10px 84px;
}

.model-chip {
  padding: 3px 10px;
  border: 1px solid #dbe2ea;
  border-radius: 999px;
  background: #ffffff;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
}

.model-chip.active {
  border-color: rgba(var(--accent-rgb), 0.6);
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  font-weight: 600;
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

/* 发音口音：紧凑双按钮选择 */
.accent-options {
  display: flex;
  gap: 8px;
}

.accent-options button {
  height: 32px;
  padding: 0 16px;
  border: 1px solid #dbe2ea;
  border-radius: 8px;
  background: #ffffff;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
}

.accent-options button.active {
  border-color: rgba(var(--accent-rgb), 0.6);
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  font-weight: 600;
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
