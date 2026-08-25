<script setup>
import { reactive, ref, computed, watch } from "vue";
import { PROVIDERS, endpointFor, providerFor } from "../data/providers";

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
const CATEGORIES = [
  { id: "shortcuts", label: "快捷键", desc: "自定义操作方式" },
  { id: "api", label: "API 设置", desc: "模型与备用模型" },
  { id: "behavior", label: "界面与行为", desc: "窗口显示方式" },
  { id: "audio", label: "发音", desc: "翻译发音偏好" },
];
const SHORTCUTS = [
  { key: "shortcut", label: "打开主窗口", hint: "全局唤起或隐藏 EmbedQuickRef" },
  { key: "detailShortcut", label: "查看详情", hint: "快捷窗口有结果时，跳转到主窗口详情" },
  { key: "settingsShortcut", label: "打开设置", hint: "从任意应用直接进入设置页面" },
];

function createFallback(item = {}) {
  const baseUrl = String(item.baseUrl || "");
  return {
    providerId: String(item.providerId || providerFor(baseUrl, item.model)?.id || ""),
    baseUrl,
    model: String(item.model || ""),
    apiKey: String(item.apiKey || ""),
  };
}

const form = reactive({
  ...props.settings,
  fallbacks: Array.isArray(props.settings.fallbacks) ? props.settings.fallbacks.map(createFallback) : [],
});
const activeCategory = ref("shortcuts");
const capturing = ref("");
const formError = ref("");
const providerId = ref("");
{
  const p = PROVIDERS.find((x) => x.baseUrl === String(form.baseUrl || "").replace(/\/+$/, ""));
  if (p) providerId.value = p.id;
}
const currentProvider = computed(() => PROVIDERS.find((x) => x.id === providerId.value) || null);
const endpoint = computed(() => endpointFor(form.model));

function shortcutFromEvent(e) {
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return "";
  const modifiers = [];
  if (e.ctrlKey) modifiers.push("Ctrl");
  if (e.altKey) modifiers.push("Alt");
  if (e.shiftKey) modifiers.push("Shift");
  if (e.metaKey) modifiers.push("Super");
  const names = {
    " ": "Space", Escape: "Escape", Enter: "Enter", Tab: "Tab", Backspace: "Backspace",
    Delete: "Delete", Insert: "Insert", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
    ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
  };
  const key = names[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return key ? [...modifiers, key].join("+") : "";
}

function captureShortcut(e, key) {
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") {
    capturing.value = "";
    return;
  }
  const value = shortcutFromEvent(e);
  if (!value) return;
  form[key] = value;
  capturing.value = "";
  formError.value = "";
}

function startCapture(key) {
  capturing.value = key;
  formError.value = "";
}

function addFallback() { form.fallbacks.push(createFallback()); }
function removeFallback(index) { form.fallbacks.splice(index, 1); }
function moveFallback(index, offset) {
  const target = index + offset;
  if (target < 0 || target >= form.fallbacks.length) return;
  const [item] = form.fallbacks.splice(index, 1);
  form.fallbacks.splice(target, 0, item);
}
function setFallbackProvider(row, id) {
  row.providerId = id;
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) return;
  row.baseUrl = p.baseUrl;
  if (p.models.length) row.model = p.models[0];
}
function fallbackProvider(row) { return PROVIDERS.find((x) => x.id === row.providerId) || providerFor(row.baseUrl, row.model); }

function saveForm() {
  const values = SHORTCUTS.map((item) => String(form[item.key] || "").trim());
  if (values.some((value) => !value)) {
    formError.value = "请为每个操作设置一个快捷键；重新点击输入框即可录入。";
    activeCategory.value = "shortcuts";
    return;
  }
  if (new Set(values).size !== values.length) {
    formError.value = "快捷键不能重复，请为不同操作设置不同组合键。";
    activeCategory.value = "shortcuts";
    return;
  }
  emit("save", {
    ...form,
    fallbacks: form.fallbacks.map((row) => ({ ...row, model: String(row.model || "").trim() })).filter((row) => row.model),
  });
}

watch(() => form.baseUrl, (url) => {
  const p = PROVIDERS.find((x) => x.baseUrl === String(url || "").replace(/\/+$/, ""));
  if (p) providerId.value = p.id;
  else if (!currentProvider.value) providerId.value = "";
});
watch(providerId, (id) => {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) return;
  form.baseUrl = p.baseUrl;
  if (p.models.length) form.model = p.models[0];
});
watch(() => form.fallbacks.map((row) => row.baseUrl), () => {
  for (const row of form.fallbacks) row.providerId = providerFor(row.baseUrl, row.model)?.id || "";
});
</script>

<template>
  <div class="settings-page">
    <header class="settings-header">
      <div><h2>设置</h2><p>按功能分类管理 EmbedQuickRef</p></div>
      <button type="button" class="settings-back" @click="emit('cancel')">返回主界面</button>
    </header>

    <div class="settings-layout">
      <nav class="settings-nav" aria-label="设置分类">
        <button v-for="category in CATEGORIES" :key="category.id" type="button" class="settings-nav-item" :class="{ active: activeCategory === category.id }" :aria-current="activeCategory === category.id ? 'page' : undefined" @click="activeCategory = category.id">
          <span>{{ category.label }}</span><small>{{ category.desc }}</small>
        </button>
      </nav>

      <section class="settings-content">
        <div v-if="activeCategory === 'shortcuts'" class="settings-section">
          <div class="section-title"><h3>快捷键</h3><p>点击输入框后直接按下新的组合键，松开后会自动记录。</p></div>
          <div class="shortcut-list">
            <div v-for="item in SHORTCUTS" :key="item.key" class="shortcut-row">
              <div class="shortcut-copy"><strong>{{ item.label }}</strong><span>{{ item.hint }}</span></div>
              <input :value="capturing === item.key ? '请按下组合键…' : form[item.key]" class="shortcut-input" :class="{ recording: capturing === item.key }" readonly :aria-label="`${item.label}快捷键`" @focus="startCapture(item.key)" @click="startCapture(item.key)" @keydown="captureShortcut($event, item.key)" @blur="capturing = ''" />
            </div>
          </div>
          <p class="shortcut-note">修改后点击“保存”才会注册新快捷键；查看详情快捷键仅在快捷窗口有结果时执行。</p>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>

        <div v-else-if="activeCategory === 'api'" class="settings-section">
          <div class="section-title"><h3>API 设置</h3><p>配置主模型，以及请求失败时按顺序启用的备用模型。</p></div>
          <label class="form-row"><span>API Key</span><input v-model="form.apiKey" type="password" spellcheck="false" placeholder="sk-…（仅保存在本机）" /></label>
          <label class="form-row"><span>服务商</span><select v-model="providerId" class="provider-select"><option value="">自定义</option><option v-for="p in PROVIDERS" :key="p.id" :value="p.id">{{ p.name }}</option></select></label>
          <label class="form-row"><span>Base URL</span><input v-model="form.baseUrl" type="text" spellcheck="false" placeholder="https://api.deepseek.com" /></label>
          <label class="form-row"><span>模型名</span><input v-model="form.model" type="text" spellcheck="false" placeholder="deepseek-chat" /></label>
          <div v-if="currentProvider?.models?.length" class="model-chips"><button v-for="m in currentProvider.models" :key="m" type="button" class="model-chip" :class="{ active: form.model === m }" @click="form.model = m">{{ m }}</button></div>
          <p class="hint">接口：{{ endpoint === "responses" ? "OpenAI Responses (/responses)" : "OpenAI 兼容 (/chat/completions)" }} —— gpt-*/grok-* 模型自动走 /responses</p>
          <section class="fallback-section">
            <div class="section-header"><div><div class="field-label">备用模型</div><p class="hint">主模型请求失败时按顺序自动切换，数量不限；备用项留空会复用主 Key 和 Base URL。</p></div><button type="button" class="add-button" @click="addFallback">+ 添加备用模型</button></div>
            <div v-if="form.fallbacks.length" class="fallback-list">
              <div v-for="(row, index) in form.fallbacks" :key="index" class="fallback-card">
                <div class="fallback-card-head"><span>备用 {{ index + 1 }}</span><div class="fallback-controls"><button type="button" :disabled="index === 0" title="上移" @click="moveFallback(index, -1)">↑</button><button type="button" :disabled="index === form.fallbacks.length - 1" title="下移" @click="moveFallback(index, 1)">↓</button><button type="button" class="remove-button" @click="removeFallback(index)">删除</button></div></div>
                <div class="fallback-grid"><select :value="row.providerId" class="provider-select" @change="setFallbackProvider(row, $event.target.value)"><option value="">自定义</option><option v-for="p in PROVIDERS" :key="p.id" :value="p.id">{{ p.name }}</option></select><input v-model="row.model" type="text" spellcheck="false" placeholder="模型名，如 deepseek-chat" /><input v-model="row.baseUrl" type="text" spellcheck="false" placeholder="留空复用主 Base URL" /><input v-model="row.apiKey" type="password" spellcheck="false" placeholder="留空复用主 API Key" /></div>
                <div v-if="fallbackProvider(row)?.models?.length" class="model-chips fallback-chips"><button v-for="m in fallbackProvider(row).models" :key="m" type="button" class="model-chip" :class="{ active: row.model === m }" @click="row.model = m">{{ m }}</button></div>
              </div>
            </div>
            <p v-else class="empty-fallback">尚未添加备用模型，当前只使用主模型。</p>
          </section>
          <p class="hint">API Key 只写入本机配置文件，不会出现在代码或 git 仓库中。</p>
        </div>

        <div v-else-if="activeCategory === 'behavior'" class="settings-section">
          <div class="section-title"><h3>界面与行为</h3><p>决定软件平时以什么方式出现在桌面上。</p></div>
          <div class="field"><label class="field-label">界面模式</label><div class="mode-options"><button v-for="m in MODES" :key="m.value" type="button" class="mode-opt" :class="{ active: mode === m.value }" @click="emit('update:mode', m.value)"><span class="mode-name">{{ m.label }}</span><span class="mode-desc">{{ m.desc }}</span></button></div></div>
        </div>

        <div v-else class="settings-section">
          <div class="section-title"><h3>发音</h3><p>选择翻译结果播放时使用的英语口音。</p></div>
          <div class="field"><label class="field-label">发音口音</label><div class="accent-options"><button type="button" :class="{ active: form.accent !== 'en' }" @click="form.accent = 'us'">美式英语</button><button type="button" :class="{ active: form.accent === 'en' }" @click="form.accent = 'en'">英式英语</button></div></div>
        </div>
      </section>
    </div>
    <footer class="settings-actions"><button type="button" class="primary" @click="saveForm">保存设置</button><button type="button" @click="emit('cancel')">取消</button></footer>
  </div>
</template>

<style scoped>
.settings-page { display:flex; flex-direction:column; min-height:100%; padding:18px 22px 16px; }
.settings-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding-bottom:12px; border-bottom:1px solid rgba(226,232,240,.8); }
h2,h3 { color:#334155; } h2 { font-size:17px; font-weight:650; } h3 { font-size:15px; font-weight:650; }
.settings-header p,.section-title p,.hint,.shortcut-copy span { color:#94a3b8; font-size:12px; } .settings-header p { margin-top:3px; }
.settings-back { padding:6px 10px; color:#52708f; }
.settings-layout { display:grid; grid-template-columns:154px minmax(0,1fr); flex:1; min-height:0; gap:18px; padding-top:14px; }
.settings-nav { display:flex; flex-direction:column; gap:5px; }
.settings-nav-item { display:flex; flex-direction:column; align-items:flex-start; gap:3px; padding:9px 10px; border:1px solid transparent; border-radius:8px; background:transparent; color:#64748b; text-align:left; cursor:pointer; }
.settings-nav-item span { font-size:13px; font-weight:600; } .settings-nav-item small { color:#a3aebc; font-size:11px; }
.settings-nav-item:hover { background:rgba(241,245,249,.75); } .settings-nav-item.active { border-color:rgba(143,168,196,.7); background:rgba(82,112,143,.1); color:#52708f; } .settings-nav-item.active small { color:#7890a9; }
.settings-content { min-width:0; overflow-y:auto; padding-right:3px; } .settings-section { padding:2px 2px 12px; } .section-title { margin-bottom:16px; } .section-title p { margin-top:4px; line-height:1.5; }
.shortcut-list { display:flex; flex-direction:column; gap:10px; } .shortcut-row { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:10px 12px; border:1px solid #e5eaf0; border-radius:8px; background:rgba(255,255,255,.55); }
.shortcut-copy { display:flex; flex-direction:column; gap:4px; min-width:0; } .shortcut-copy strong { color:#475569; font-size:13px; }
.shortcut-input { flex:none; width:150px; height:32px; border:1px solid #dbe2ea; border-radius:7px; background:#fff; color:#52708f; font:600 13px "Segoe UI","Microsoft YaHei",sans-serif; text-align:center; cursor:pointer; } .shortcut-input.recording { border-color:#8fa8c4; background:rgba(82,112,143,.08); }
.shortcut-note { margin-top:13px; color:#a3aebc; font-size:11px; line-height:1.5; } .form-error { margin-top:10px; color:#b45353; font-size:12px; }
.form-row { display:flex; align-items:center; gap:12px; margin-bottom:10px; } .form-row>span { flex:none; width:70px; color:#64748b; font-size:13px; }
input,.provider-select { min-width:0; flex:1; height:32px; padding:0 10px; border:1px solid #dbe2ea; border-radius:6px; outline:none; background:#fff; color:#1f2937; font-size:13px; } input:focus,.provider-select:focus { border-color:#8fa8c4; } .provider-select { padding:0 8px; cursor:pointer; }
.model-chips { display:flex; flex-wrap:wrap; gap:6px; margin:-2px 0 10px 82px; } .model-chip { padding:3px 10px; border:1px solid #dbe2ea; border-radius:999px; background:#fff; color:#64748b; font-size:12px; cursor:pointer; } .model-chip.active { border-color:rgba(var(--accent-rgb),.6); background:rgba(var(--accent-rgb),.1); color:var(--accent); font-weight:600; }
.hint { margin:8px 0 14px; line-height:1.5; } .fallback-section { margin:4px 0 16px; padding:12px; border:1px solid #e5eaf0; border-radius:8px; background:#f8fafc; }
.section-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; } .section-header .hint { margin:4px 0 10px; } .add-button { flex:none; padding:5px 10px; color:#52708f; font-size:12px; }
.fallback-list { display:flex; flex-direction:column; gap:8px; } .fallback-card { padding:9px 10px 8px; border:1px solid #dbe2ea; border-radius:7px; background:#fff; } .fallback-card-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; color:#64748b; font-size:12px; font-weight:600; } .fallback-controls { display:flex; gap:4px; } .fallback-controls button { padding:2px 7px; font-size:12px; } .fallback-controls button:disabled { cursor:default; opacity:.35; } .remove-button { color:#b45353; }
.fallback-grid { display:grid; grid-template-columns:112px 1fr; gap:7px; } .fallback-grid input,.fallback-grid .provider-select { width:auto; } .fallback-chips { margin:7px 0 0; } .empty-fallback { margin:2px 0 0; color:#94a3b8; font-size:12px; }
.field { margin-bottom:12px; } .field-label { display:block; margin-bottom:7px; color:#64748b; font-size:13px; } .mode-options { display:flex; flex-direction:column; gap:7px; } .mode-opt { display:flex; align-items:center; gap:10px; padding:9px 12px; border:1px solid #dbe2ea; border-radius:8px; background:#fff; color:#64748b; font-size:13px; cursor:pointer; text-align:left; } .mode-opt.active { border-color:rgba(143,168,196,.8); background:rgba(82,112,143,.1); color:#52708f; } .mode-name { flex:none; min-width:56px; font-weight:600; } .mode-desc { color:#94a3b8; font-size:12px; }
.accent-options { display:flex; gap:8px; } .accent-options button { height:32px; padding:0 16px; border:1px solid #dbe2ea; border-radius:8px; background:#fff; color:#64748b; font-size:13px; cursor:pointer; } .accent-options button.active { border-color:rgba(var(--accent-rgb),.6); background:rgba(var(--accent-rgb),.1); color:var(--accent); font-weight:600; }
.settings-actions { display:flex; gap:10px; padding-top:12px; border-top:1px solid rgba(226,232,240,.8); } button { border:1px solid #dbe2ea; border-radius:6px; background:#fff; color:#475569; font-size:13px; cursor:pointer; } button:hover { background:#f1f5f9; } button.primary { padding:7px 20px; border-color:#52708f; background:#52708f; color:#fff; } button.primary:hover { background:#46617d; }
</style>
