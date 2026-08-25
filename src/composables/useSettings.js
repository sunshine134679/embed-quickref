import { ref } from "vue";
import { load } from "@tauri-apps/plugin-store";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

// 秘密字段落盘前缀：settings.json 里 apiKey 存 "dpapi:<base64>"（Windows DPAPI 当前用户加密），
// 内存中保持明文供请求使用；旧版明文值首次加载时静默迁移（仅主窗口执行，避免双窗口并发写）
const KEY_PREFIX = "dpapi:";

async function revealKey(val) {
  if (typeof val === "string" && val.startsWith(KEY_PREFIX)) {
    try {
      return await invoke("secret_reveal", { blob: val.slice(KEY_PREFIX.length) });
    } catch (e) {
      return ""; // 解密失败（换机/系统重置）：视为无 Key，用户重新填写
    }
  }
  return typeof val === "string" ? val : "";
}

async function protectKey(plain) {
  try {
    return KEY_PREFIX + (await invoke("secret_protect", { plain }));
  } catch (e) {
    return plain; // 加密失败不阻断保存，退化为明文
  }
}

export const DEFAULT_SETTINGS = {
  shortcut: "Alt+Q",
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
  fallbacks: [],
  accent: "us", // 发音口音：us(美式) | en(英式)
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
  // 设置在各 WebView 是独立内存快照（快捷窗启动时加载一次）：落盘后广播，
  // 让快捷窗重新 initSettings，否则改 API Key/model 后快捷窗翻译一直用旧值
  emit("settings-changed", settings.value).catch(() => {});
}

export function useSettings() {
  return { settings, saveSettings };
}
