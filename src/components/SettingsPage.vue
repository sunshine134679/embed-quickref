<script setup>
import { reactive, ref, computed, watch, onMounted, onUnmounted } from "vue";
import { PROVIDERS, endpointFor, providerFor } from "../data/providers";
import { listSpeechVoices, subscribeSpeechVoices, testApiConnection } from "../composables/useTranslate";

const props = defineProps({
  settings: { type: Object, required: true },
  mode: { type: String, default: "floating" },
  // 父级保存失败信息（磁盘写入/热键注册失败）：footer 以错误态展示，不再只显示乐观的"已自动保存"
  saveError: { type: String, default: "" },
});
const emit = defineEmits(["auto-save", "cancel", "update:mode"]);

const MODES = [
  { value: "floating", label: "悬浮圆点", desc: "桌面小圆点，点击展开，失焦自动缩回" },
  { value: "popup", label: "弹窗", desc: "热键唤起，失焦自动隐藏" },
  { value: "pinned", label: "固定", desc: "置顶最前 + 任务栏图标" },
];
const CATEGORIES = [
  { id: "shortcuts", label: "快捷键", desc: "键盘操作" },
  { id: "api", label: "模型服务", desc: "API 与备用模型" },
  { id: "behavior", label: "窗口行为", desc: "显示与交互" },
  { id: "audio", label: "发音偏好", desc: "翻译语音" },
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
const autoSaved = ref(false);
const fallbackExpanded = ref(false);
let autoSavedTimer = null;
let autoSaveTimer = null;
const providerId = ref("");
const speechVoices = ref([]);
let stopSpeechVoices = () => {};
{
  const p = PROVIDERS.find((x) => x.baseUrl === String(form.baseUrl || "").replace(/\/+$/, ""));
  if (p) providerId.value = p.id;
}
const currentProvider = computed(() => PROVIDERS.find((x) => x.id === providerId.value) || null);
const endpoint = computed(() => endpointFor(form.model));
const fallbackSummary = computed(() => form.fallbacks.length ? `${form.fallbacks.length} 个已配置` : "未配置");

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
  // 无修饰键的单键（如直接按 A）不允许注册为系统级全局热键——几乎必然与所有应用冲突；F1~F12 例外
  const hasModifier = /^(Ctrl|Alt|Shift|Super)\+/.test(value);
  const isFunctionKey = /^F([1-9]|1[0-2])$/.test(value.split("+").pop() || "");
  if (!hasModifier && !isFunctionKey) {
    formError.value = "请带上 Ctrl / Alt / Shift 等修饰键（F1~F12 功能键可单独使用）";
    return;
  }
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

// 测试连接：用表单当前值直接发最小请求验证 baseUrl/model/apiKey，结果分类展示
const testing = ref(false);
const testResult = ref(null); // { ok, message }
const canTest = computed(() => !!(form.apiKey && form.baseUrl && form.model));
async function runTest() {
  if (testing.value || !canTest.value) return;
  testing.value = true;
  testResult.value = null;
  try {
    testResult.value = await testApiConnection({
      baseUrl: form.baseUrl,
      model: form.model,
      apiKey: form.apiKey,
    });
  } catch (e) {
    testResult.value = { ok: false, message: String(e?.message || e) };
  } finally {
    testing.value = false;
  }
}
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

function autoSavePayload() {
  return {
    ...form,
    fallbacks: form.fallbacks.map((row) => ({ ...row, model: String(row.model || "").trim() })).filter((row) => row.model),
  };
}

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    emit("auto-save", autoSavePayload());
    autoSaved.value = true;
    clearTimeout(autoSavedTimer);
    autoSavedTimer = setTimeout(() => { autoSaved.value = false; }, 1800);
  }, 260);
}

watch(() => form.baseUrl, (url) => {
  const p = PROVIDERS.find((x) => x.baseUrl === String(url || "").replace(/\/+$/, ""));
  // 手动改成自定义 URL 时必须清空选择：否则下拉仍显示旧预设，与"自定义"选项矛盾
  providerId.value = p ? p.id : "";
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
watch(form, () => scheduleAutoSave(), { deep: true });
onMounted(() => {
  speechVoices.value = listSpeechVoices();
  stopSpeechVoices = subscribeSpeechVoices((voices) => {
    speechVoices.value = voices;
  });
});
onUnmounted(() => {
  clearTimeout(autoSavedTimer);
  stopSpeechVoices();
  // 防抖窗口内的改动在卸载前强制落盘：Esc/返回/关设置页不再无声丢弃待保存项
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
    emit("auto-save", autoSavePayload());
  }
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
          <span class="nav-icon" aria-hidden="true">
            <svg v-if="category.id === 'shortcuts'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v5M17 3v5M3 7h5M16 7h5M7 16v5M17 16v5M3 17h5M16 17h5"/><circle cx="12" cy="12" r="3.2"/></svg>
            <svg v-else-if="category.id === 'api'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision"><path d="M8 4v5M16 4v5M6 9h12v2a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9Z"/><path d="M12 16v4M9 20h6"/></svg>
            <svg v-else-if="category.id === 'behavior'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h3l5 4V6l-5 4H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>
          </span><span class="nav-copy"><strong>{{ category.label }}</strong><small>{{ category.desc }}</small></span>
        </button>
      </nav>

      <section class="settings-content">
        <div v-if="activeCategory === 'shortcuts'" class="settings-section">
          <div class="section-title"><span class="section-kicker">快捷键设置</span><h3>快捷键</h3><p>点击输入框后直接按下新的组合键，松开后会自动记录。</p></div>
          <div class="shortcut-list">
            <div v-for="item in SHORTCUTS" :key="item.key" class="shortcut-row">
              <div class="shortcut-copy"><strong>{{ item.label }}</strong><span>{{ item.hint }}</span></div>
              <input :value="capturing === item.key ? '请按下组合键…' : form[item.key]" class="shortcut-input" :class="{ recording: capturing === item.key }" readonly :aria-label="`${item.label}快捷键`" @focus="startCapture(item.key)" @click="startCapture(item.key)" @keydown="captureShortcut($event, item.key)" @blur="capturing = ''" />
            </div>
          </div>
          <p class="shortcut-note">按下组合键后会立即自动保存并生效；查看详情快捷键仅在快捷窗口有结果时执行。</p>
          <p v-if="formError" class="form-error">{{ formError }}</p>
        </div>

        <div v-else-if="activeCategory === 'api'" class="settings-section">
          <div class="section-title"><span class="section-kicker">服务连接</span><h3>API 设置</h3><p>配置主模型，以及请求失败时按顺序启用的备用模型。</p></div>
          <label class="form-row"><span>API Key</span><input v-model="form.apiKey" type="password" spellcheck="false" placeholder="sk-…（仅保存在本机）" /></label>
          <label class="form-row"><span>服务商</span><select v-model="providerId" class="provider-select"><option value="">自定义</option><option v-for="p in PROVIDERS" :key="p.id" :value="p.id">{{ p.name }}</option></select></label>
          <label class="form-row"><span>Base URL</span><input v-model="form.baseUrl" type="text" spellcheck="false" placeholder="https://api.deepseek.com" /></label>
          <label class="form-row"><span>模型名</span><input v-model="form.model" type="text" spellcheck="false" placeholder="deepseek-chat" /></label>
          <div v-if="currentProvider?.models?.length" class="model-chips"><button v-for="m in currentProvider.models" :key="m" type="button" class="model-chip" :class="{ active: form.model === m }" @click="form.model = m">{{ m }}</button></div>
          <p class="hint">接口：{{ endpoint === "responses" ? "OpenAI Responses (/responses)" : "OpenAI 兼容 (/chat/completions)" }} —— gpt-*/grok-* 模型自动走 /responses</p>
          <div class="test-row">
            <button type="button" class="test-btn" :disabled="testing || !canTest" @click="runTest">
              {{ testing ? "测试中…" : "测试连接" }}
            </button>
            <span v-if="testResult" class="test-result" :class="{ ok: testResult.ok }">{{ testResult.message }}</span>
          </div>
          <section class="fallback-settings">
            <button type="button" class="fallback-toggle" :aria-expanded="fallbackExpanded" @click="fallbackExpanded = !fallbackExpanded">
              <span class="fallback-toggle-main">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10M7 17h10"/><path d="m14 4 3 3-3 3M10 14l-3 3 3 3"/><path d="M17 7a5 5 0 0 1 0 10M7 7a5 5 0 0 0 0 10"/></svg>
                <span><strong>故障转移</strong><small>主模型不可用时按顺序尝试备用模型</small></span>
              </span>
              <span class="fallback-toggle-side"><span>{{ fallbackSummary }}</span><svg class="fallback-chevron" :class="{ open: fallbackExpanded }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
            </button>
            <div v-if="fallbackExpanded" class="fallback-editor">
              <div class="fallback-editor-head"><span>备用模型顺序</span><button type="button" class="add-button" @click="addFallback">添加模型</button></div>
              <div v-if="form.fallbacks.length" class="fallback-list">
                <div v-for="(row, index) in form.fallbacks" :key="index" class="fallback-card">
                  <div class="fallback-card-head"><span>备用 {{ index + 1 }}</span><div class="fallback-controls"><button type="button" :disabled="index === 0" title="上移" @click="moveFallback(index, -1)">↑</button><button type="button" :disabled="index === form.fallbacks.length - 1" title="下移" @click="moveFallback(index, 1)">↓</button><button type="button" class="remove-button" @click="removeFallback(index)">删除</button></div></div>
                  <div class="fallback-grid"><select :value="row.providerId" class="provider-select" @change="setFallbackProvider(row, $event.target.value)"><option value="">自定义</option><option v-for="p in PROVIDERS" :key="p.id" :value="p.id">{{ p.name }}</option></select><input v-model="row.model" type="text" spellcheck="false" placeholder="模型名，如 deepseek-chat" /><input v-model="row.baseUrl" type="text" spellcheck="false" placeholder="留空复用主 Base URL" /><input v-model="row.apiKey" type="password" spellcheck="false" placeholder="留空复用主 API Key" /></div>
                  <div v-if="fallbackProvider(row)?.models?.length" class="model-chips fallback-chips"><button v-for="m in fallbackProvider(row).models" :key="m" type="button" class="model-chip" :class="{ active: row.model === m }" @click="row.model = m">{{ m }}</button></div>
                </div>
              </div>
              <p v-else class="empty-fallback">暂未添加。添加后，主模型失败会按顺序继续尝试。</p>
            </div>
          </section>
          <p class="hint">API Key 只写入本机配置文件，不会出现在代码或 git 仓库中。</p>
        </div>

        <div v-else-if="activeCategory === 'behavior'" class="settings-section">
          <div class="section-title"><span class="section-kicker">窗口体验</span><h3>界面与行为</h3><p>决定软件平时以什么方式出现在桌面上。</p></div>
          <div class="field"><label class="field-label">界面模式</label><div class="mode-options"><button v-for="m in MODES" :key="m.value" type="button" class="mode-opt" :class="{ active: mode === m.value }" @click="emit('update:mode', m.value)"><span class="mode-name">{{ m.label }}</span><span class="mode-desc">{{ m.desc }}</span></button></div></div>
        </div>

        <div v-else class="settings-section">
          <div class="section-title"><span class="section-kicker">翻译体验</span><h3>发音</h3><p>优先使用词典音频，无法获取时自动回退到本机英语语音。</p></div>
          <div class="field"><label class="field-label">发音口音</label><div class="accent-options"><button type="button" :class="{ active: form.accent !== 'en' }" @click="form.accent = 'us'">美式英语</button><button type="button" :class="{ active: form.accent === 'en' }" @click="form.accent = 'en'">英式英语</button></div></div>
          <div class="field"><label class="field-label" for="speech-voice">本机语音</label><select id="speech-voice" v-model="form.voiceName" class="speech-select"><option value="">按口音自动选择</option><option v-for="voice in speechVoices" :key="`${voice.name}:${voice.lang}`" :value="voice.name">{{ voice.name }} · {{ voice.lang }}</option></select><p v-if="!speechVoices.length" class="field-hint">暂未发现英语语音，将使用系统默认语音。</p><p v-else class="field-hint">留空会根据上面的英式/美式设置自动选择。</p></div>
        </div>
      </section>
    </div>
    <footer class="auto-save-status" :class="{ visible: autoSaved, error: !!saveError }">{{ saveError || (autoSaved ? "更改已自动保存" : "更改会自动保存") }}</footer>
  </div>
</template>

<style scoped>
.settings-page { display:flex; flex-direction:column; min-height:100%; padding:22px 26px 18px; background:rgba(248,250,252,.72); }
.settings-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:0 2px 16px; border-bottom:1px solid rgba(203,213,225,.8); }
h2,h3 { color:#334155; } h2 { font-size:17px; font-weight:650; } h3 { font-size:15px; font-weight:650; }
.settings-header p,.section-title p,.hint,.shortcut-copy span { color:#94a3b8; font-size:12px; } .settings-header p { margin-top:3px; }
.settings-back { padding:6px 10px; color:#52708f; }
.settings-layout { display:grid; grid-template-columns:174px minmax(0,1fr); flex:1; min-height:0; gap:22px; padding-top:18px; }
.settings-nav { display:flex; flex-direction:column; gap:4px; padding:6px 0; }
.settings-nav-item { position:relative; display:grid; grid-template-columns:24px 1fr; align-items:center; gap:10px; min-height:56px; padding:8px 12px 8px 16px; border:0; border-radius:0; background:transparent; color:#64748b; text-align:left; cursor:pointer; }
.settings-nav-item::before { content:""; position:absolute; left:0; top:15px; bottom:15px; width:3px; border-radius:0 2px 2px 0; background:transparent; }
.settings-nav-item .nav-icon { display:flex; align-items:center; justify-content:center; width:22px; height:22px; color:#8b9bad; }
.settings-nav-item .nav-icon svg { width:20px; height:20px; }
.settings-nav-item .nav-copy { display:flex; flex-direction:column; gap:3px; min-width:0; } .settings-nav-item strong { font-size:13px; font-weight:500; } .settings-nav-item small { color:#a3aebc; font-size:11px; }
.settings-nav-item:hover { background:rgba(241,245,249,.62); } .settings-nav-item.active { background:transparent; color:#334155; } .settings-nav-item.active::before { background:#52708f; } .settings-nav-item.active .nav-icon { color:#334155; } .settings-nav-item.active small { color:#7890a9; }
.settings-content { min-width:0; overflow-y:auto; padding:18px 20px 6px; border:1px solid rgba(203,213,225,.85); border-radius:12px; background:rgba(255,255,255,.74); box-shadow:0 2px 8px rgba(51,65,85,.04); } .settings-section { padding:0 0 12px; } .section-title { margin-bottom:18px; padding-bottom:13px; border-bottom:1px solid rgba(226,232,240,.8); } .section-title p { margin-top:5px; line-height:1.5; }
.section-kicker { display:block; margin-bottom:5px; color:#7890a9; font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
.shortcut-list { display:flex; flex-direction:column; gap:10px; } .shortcut-row { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:10px 12px; border:1px solid #e5eaf0; border-radius:8px; background:rgba(255,255,255,.55); }
.shortcut-copy { display:flex; flex-direction:column; gap:4px; min-width:0; } .shortcut-copy strong { color:#475569; font-size:13px; }
.shortcut-input { flex:none; width:150px; height:32px; border:1px solid #dbe2ea; border-radius:7px; background:#fff; color:#52708f; font:600 13px "Segoe UI","Microsoft YaHei",sans-serif; text-align:center; cursor:pointer; } .shortcut-input.recording { border-color:#8fa8c4; background:rgba(82,112,143,.08); }
.shortcut-note { margin-top:13px; color:#a3aebc; font-size:11px; line-height:1.5; } .form-error { margin-top:10px; color:#b45353; font-size:12px; }
.form-row { display:flex; align-items:center; gap:12px; margin-bottom:10px; } .form-row>span { flex:none; width:70px; color:#64748b; font-size:13px; }
input,.provider-select { min-width:0; flex:1; height:32px; padding:0 10px; border:1px solid #dbe2ea; border-radius:6px; outline:none; background:#fff; color:#1f2937; font-size:13px; } input:focus,.provider-select:focus { border-color:#8fa8c4; } .provider-select { padding:0 8px; cursor:pointer; }
.model-chips { display:flex; flex-wrap:wrap; gap:6px; margin:-2px 0 10px 82px; } .model-chip { padding:3px 10px; border:1px solid #dbe2ea; border-radius:999px; background:#fff; color:#64748b; font-size:12px; cursor:pointer; } .model-chip.active { border-color:rgba(var(--accent-rgb),.6); background:rgba(var(--accent-rgb),.1); color:var(--accent); font-weight:600; }
.hint { margin:8px 0 14px; line-height:1.5; }
.test-row { display:flex; align-items:center; gap:10px; margin:-4px 0 14px; } .test-btn { height:30px; padding:0 14px; border:1px solid rgba(82,112,143,.55); border-radius:8px; background:rgba(82,112,143,.1); color:#52708f; font-size:12.5px; font-weight:600; cursor:pointer; } .test-btn:hover:not(:disabled) { background:rgba(82,112,143,.2); } .test-btn:disabled { opacity:.5; cursor:default; } .test-result { font-size:12.5px; color:#b45353; } .test-result.ok { color:#6b9e78; }
.fallback-settings { margin:18px 0 14px; border-top:1px solid #e5eaf0; border-bottom:1px solid #e5eaf0; }
.fallback-toggle { display:flex; align-items:center; justify-content:space-between; width:100%; min-height:58px; padding:8px 2px; border:0; border-radius:0; background:transparent; color:#64748b; text-align:left; cursor:pointer; }
.fallback-toggle:hover { background:rgba(241,245,249,.55); }
.fallback-toggle-main { display:flex; align-items:center; gap:10px; min-width:0; }
.fallback-toggle-main svg { flex:none; width:20px; height:20px; color:#7890a9; }
.fallback-toggle-main span { display:flex; flex-direction:column; gap:3px; min-width:0; }
.fallback-toggle-main strong { color:#475569; font-size:13px; font-weight:550; }
.fallback-toggle-main small { color:#a3aebc; font-size:11px; }
.fallback-toggle-side { display:flex; flex-direction:row; align-items:center; justify-content:flex-end; gap:7px; flex:none; height:20px; color:#8b9bad; font-size:11px; line-height:1; white-space:nowrap; }
.fallback-chevron { display:block; width:14px; height:14px; transition:transform .15s ease; } .fallback-chevron.open { transform:rotate(180deg); }
.fallback-editor { padding:2px 0 12px; }
.fallback-editor-head { display:flex; align-items:center; justify-content:space-between; margin:2px 0 8px; color:#7890a9; font-size:11px; font-weight:600; }
.add-button { padding:4px 0; border:0; background:transparent; color:#52708f; font-size:12px; cursor:pointer; } .add-button:hover { color:#334f6b; background:transparent; }
.fallback-list { display:flex; flex-direction:column; gap:8px; } .fallback-card { padding:9px 10px 8px; border:1px solid #e5eaf0; border-radius:7px; background:#fbfcfe; } .fallback-card-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; color:#64748b; font-size:12px; font-weight:600; } .fallback-controls { display:flex; gap:4px; } .fallback-controls button { padding:2px 7px; font-size:12px; } .fallback-controls button:disabled { cursor:default; opacity:.35; } .remove-button { color:#b45353; }
.fallback-grid { display:grid; grid-template-columns:112px 1fr; gap:7px; } .fallback-grid input,.fallback-grid .provider-select { width:auto; } .fallback-chips { margin:7px 0 0; } .empty-fallback { margin:2px 0 0; color:#94a3b8; font-size:12px; }
.field { margin-bottom:12px; } .field-label { display:block; margin-bottom:7px; color:#64748b; font-size:13px; } .mode-options { display:flex; flex-direction:column; gap:7px; } .mode-opt { display:flex; align-items:center; gap:10px; padding:9px 12px; border:1px solid #dbe2ea; border-radius:8px; background:#fff; color:#64748b; font-size:13px; cursor:pointer; text-align:left; } .mode-opt.active { border-color:rgba(143,168,196,.8); background:rgba(82,112,143,.1); color:#52708f; } .mode-name { flex:none; min-width:56px; font-weight:600; } .mode-desc { color:#94a3b8; font-size:12px; }
.accent-options { display:flex; gap:8px; } .accent-options button { height:32px; padding:0 16px; border:1px solid #dbe2ea; border-radius:8px; background:#fff; color:#64748b; font-size:13px; cursor:pointer; } .accent-options button.active { border-color:rgba(var(--accent-rgb),.6); background:rgba(var(--accent-rgb),.1); color:var(--accent); font-weight:600; }
.speech-select { width:100%; height:34px; padding:0 10px; border:1px solid #dbe2ea; border-radius:7px; outline:none; background:#fff; color:#475569; font-size:13px; } .speech-select:focus { border-color:#8fa8c4; } .field-hint { margin-top:5px; color:#a3aebc; font-size:11px; line-height:1.45; }
.auto-save-status { min-height:31px; padding-top:12px; border-top:1px solid rgba(203,213,225,.8); color:#a3aebc; font-size:12px; text-align:right; } .auto-save-status.visible { color:#6b9e78; } .auto-save-status.error { color:#b45353; }
</style>
