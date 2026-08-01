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
// 后缀词条（abbr 不带点）额外支持带点号输入："main.c" -> c、".h" -> h、"a.b.py" -> py
export function search(query) {
  const raw = query.trim();
  const q = raw.toLowerCase();
  if (!q) return [];
  // 提取带点号输入的末段作为后缀候选
  let suffix = null;
  if (q.includes(".")) {
    const parts = q.split(".").filter(Boolean);
    if (parts.length) suffix = parts[parts.length - 1];
  }
  // 提取带空格输入的首段作为命令候选："ls -l" -> ls、"tar czf" -> tar、"i2c 协议" -> I2C
  let cmd = null;
  if (q.includes(" ")) {
    const first = q.split(/\s+/)[0];
    if (first && first !== q) cmd = first;
  }
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
    // 带点号输入：末段与后缀词条精确匹配（以点开头视为明确搜后缀）
    if (suffix && abbr === suffix) {
      score = Math.max(score, q.startsWith(".") ? 100 : 75);
    }
    // 命令+参数输入：首段与词条精确匹配（"ls -l" -> ls），优先级高于前缀匹配
    if (cmd && abbr === cmd) {
      score = Math.max(score, 95);
    }
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
