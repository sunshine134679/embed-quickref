import { ref } from "vue";
import { load } from "@tauri-apps/plugin-store";
import builtinTerms from "../data/terms.json";

const userTerms = ref([]);
let store = null;

export async function initUserTerms() {
  store = await load("user-terms.json", { autoSave: false });
  userTerms.value = (await store.get("terms")) || [];
}

function allTerms() {
  return [...builtinTerms, ...userTerms.value];
}

// AI 回答解析成功后写入个人词库，与内置词库按缩写去重
export async function addUserTerm(term) {
  const key = (term.abbr || "").trim().toLowerCase();
  if (!key) return false;
  if (allTerms().some((t) => (t.abbr || "").trim().toLowerCase() === key)) return false;
  userTerms.value = [...userTerms.value, { ...term, source: "ai" }];
  await store.set("terms", userTerms.value);
  await store.save();
  return true;
}

// 匹配优先级：缩写精确 > 缩写前缀 > 缩写包含 > 全称/中文包含 > 定义包含
export function search(query) {
  const raw = query.trim();
  const q = raw.toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const term of allTerms()) {
    const abbr = (term.abbr || "").toLowerCase();
    const full = (term.full || "").toLowerCase();
    const zh = term.zh || "";
    let score = 0;
    if (abbr === q) score = 100;
    else if (abbr.startsWith(q)) score = 80;
    else if (abbr.includes(q)) score = 65;
    else if (full.includes(q) || zh.includes(raw)) score = 50;
    else if ((term.definition || "").toLowerCase().includes(q)) score = 25;
    if (score > 0) scored.push({ term, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.term.abbr.length - b.term.abbr.length
  );
  return scored.slice(0, 20).map((s) => s.term);
}

export function useSearch() {
  return { search, addUserTerm, userTerms };
}
