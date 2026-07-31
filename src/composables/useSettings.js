import { ref } from "vue";
import { load } from "@tauri-apps/plugin-store";

export const DEFAULT_SETTINGS = {
  shortcut: "Alt+Q",
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-chat",
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
}

export function useSettings() {
  return { settings, saveSettings };
}
