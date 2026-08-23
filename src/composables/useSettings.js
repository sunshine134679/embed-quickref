import { ref } from "vue";
import { load } from "@tauri-apps/plugin-store";
import { emit } from "@tauri-apps/api/event";

export const DEFAULT_SETTINGS = {
  shortcut: "Alt+Q",
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
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
  settings.value = { ...DEFAULT_SETTINGS, ...saved };
  return settings.value;
}

export async function saveSettings(next) {
  settings.value = { ...settings.value, ...next };
  for (const [key, val] of Object.entries(settings.value)) {
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
