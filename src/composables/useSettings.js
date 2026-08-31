import { ref } from "vue";
import { load } from "@tauri-apps/plugin-store";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

// 秘密字段落盘前缀：settings.json 里 apiKey 存 "dpapi:<base64>"（Windows DPAPI 当前用户加密），
// 内存中保持明文供请求使用；旧版明文值首次加载时静默迁移（仅主窗口执行，避免双窗口并发写）
const KEY_PREFIX = "dpapi:";

// 密钥落盘/解密状态（设置页展示，不再无痕降级）：
// encrypted 正常加密 | plain 加密失败退化为明文 | reveal-failed 本机解密失败（Key 已清空）
const secretStatus = ref("encrypted");

async function revealKey(val) {
  if (typeof val === "string" && val.startsWith(KEY_PREFIX)) {
    try {
      return await invoke("secret_reveal", { blob: val.slice(KEY_PREFIX.length) });
    } catch (e) {
      secretStatus.value = "reveal-failed"; // 换机/系统重置：提示用户重新填写，而非静默变空
      return "";
    }
  }
  return typeof val === "string" ? val : "";
}

async function protectKey(plain) {
  try {
    return KEY_PREFIX + (await invoke("secret_protect", { plain }));
  } catch (e) {
    secretStatus.value = "plain"; // 加密失败：明文落盘并让 UI 明确提示，不再无痕降级
    return plain;
  }
}

export const DEFAULT_SETTINGS = {
  shortcut: "Alt+Q",
  detailShortcut: "Alt+Shift+D",
  settingsShortcut: "Alt+Shift+S",
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  fallbacks: [],
  accent: "us", // 发音口音：us(美式) | en(英式)
  voiceName: "", // 留空时按口音自动选择本机英语语音
  // 界面模式/固定状态随其余设置统一持久化（v0.2 起迁入 settings.json；旧 state.json 一次性迁移）
  mode: "floating", // floating(悬浮圆点) | popup(弹窗) | pinned(固定)
  pinned: false,
};

const settings = ref({ ...DEFAULT_SETTINGS });
let store = null;

export async function initSettings() {
  store = await load("settings.json", { autoSave: false });
  const saved = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const val = await store.get(key);
    if (val !== undefined && val !== null) saved[key] = val;
  }
  settings.value = {
    ...DEFAULT_SETTINGS,
    ...saved,
    fallbacks: Array.isArray(saved.fallbacks) ? saved.fallbacks : [],
  };
  // 解密 Disk 上的密文 Key（内存明文；解密失败按空处理）
  settings.value.apiKey = await revealKey(saved.apiKey);
  settings.value.fallbacks = await Promise.all(
    settings.value.fallbacks.map(async (fallback) => ({
      providerId: String(fallback?.providerId || ""),
      baseUrl: String(fallback?.baseUrl || ""),
      model: String(fallback?.model || ""),
      apiKey: await revealKey(fallback?.apiKey),
    }))
  );
  // 静默迁移：旧版明文 Key 首次加载即加密落盘（仅主窗口，避免两 WebView 并发写）
  const hasPlainFallbackKey = settings.value.fallbacks.some(
    (fallback, index) => fallback.apiKey && !String(saved.fallbacks?.[index]?.apiKey || "").startsWith(KEY_PREFIX)
  );
  if (
    ((settings.value.apiKey && !String(saved.apiKey || "").startsWith(KEY_PREFIX)) || hasPlainFallbackKey) &&
    getCurrentWindow().label === "main"
  ) {
    try {
      await store.set("apiKey", await protectKey(settings.value.apiKey));
      if (settings.value.fallbacks.length) {
        await store.set(
          "fallbacks",
          await Promise.all(settings.value.fallbacks.map(async (fallback) => ({
            ...fallback,
            apiKey: fallback.apiKey ? await protectKey(fallback.apiKey) : "",
          })))
        );
      }
      await store.save();
    } catch (e) {}
  }
  // 一次性迁移：旧版界面模式（mode/pinned）存于 state.json，迁入 settings.json 统一持久化
  if (saved.mode === undefined || saved.pinned === undefined) {
    try {
      const stateStore = await load("state.json", { autoSave: false });
      if (saved.mode === undefined) {
        const m = await stateStore.get("mode");
        if (["floating", "popup", "pinned"].includes(m)) {
          settings.value.mode = m;
          await store.set("mode", m);
        }
      }
      if (saved.pinned === undefined) {
        const p = await stateStore.get("pinned");
        if (p === true || p === false) {
          settings.value.pinned = p === true;
          await store.set("pinned", p === true);
        }
      }
      await store.save();
    } catch (e) {
      console.error("界面模式迁移失败", e); // 迁移失败不阻断启动，沿用默认值
    }
  }
  return settings.value;
}

export async function saveSettings(next) {
  settings.value = { ...settings.value, ...next };
  // 落盘副本：Key 加密，其余字段原样；内存保持明文（请求要用）
  const disk = { ...settings.value };
  if (disk.apiKey && !disk.apiKey.startsWith(KEY_PREFIX)) {
    disk.apiKey = await protectKey(disk.apiKey);
  }
  disk.fallbacks = await Promise.all(
    (Array.isArray(settings.value.fallbacks) ? settings.value.fallbacks : []).map(async (fallback) => ({
      providerId: String(fallback?.providerId || ""),
      baseUrl: String(fallback?.baseUrl || ""),
      model: String(fallback?.model || ""),
      apiKey: fallback?.apiKey ? await protectKey(String(fallback.apiKey)) : "",
    }))
  );
  for (const [key, val] of Object.entries(disk)) {
    await store.set(key, val);
  }
  await store.save();
  // 主 Key 已正常加密（或未配置 Key）：清除降级提示（若 protectKey 失败会保持 plain）
  if (!settings.value.apiKey || disk.apiKey.startsWith(KEY_PREFIX)) secretStatus.value = "encrypted";
  // 设置在各 WebView 是独立内存快照（快捷窗启动时加载一次）：落盘后广播，
  // 让快捷窗重新 initSettings，否则改 API Key/model 后快捷窗翻译一直用旧值。
  // 载荷剥离明文 apiKey：快捷窗收到事件后自行从 store 重读，不需要也不应持有 Key 明文
  const { apiKey: _omit, ...safeSettings } = settings.value;
  emit("settings-changed", safeSettings).catch(() => {});
}

export function useSettings() {
  return { settings, saveSettings, secretStatus };
}
