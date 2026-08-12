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
// 返回: added 新写入 | user-exists 用户词库已有（可更新）| builtin 内置已有 | invalid 无效
export async function addUserTerm(term) {
  const key = (term.abbr || "").trim().toLowerCase();
  if (!key) return "invalid";
  if (builtinTerms.some((t) => (t.abbr || "").trim().toLowerCase() === key)) return "builtin";
  if (userTerms.value.some((t) => (t.abbr || "").trim().toLowerCase() === key)) return "user-exists";
  userTerms.value = [...userTerms.value, { ...term, source: "ai" }];
  await store.set("terms", userTerms.value);
  await store.save();
  return "added";
}

// 用新的 AI 回答更新用户词库中同缩写词条（不存在则追加）
export async function updateUserTerm(term) {
  const key = (term.abbr || "").trim().toLowerCase();
  if (!key) return false;
  const i = userTerms.value.findIndex((t) => (t.abbr || "").trim().toLowerCase() === key);
  const next = { ...term, source: "ai" };
  userTerms.value =
    i >= 0
      ? [...userTerms.value.slice(0, i), next, ...userTerms.value.slice(i + 1)]
      : [...userTerms.value, next];
  await store.set("terms", userTerms.value);
  await store.save();
  return true;
}

// 把额外要点并入个人词库词条：保留词条已有要点（多次并入不互相覆盖），按内容去重；
// 词条不存在时用 fallback 字段新建（与内置词条共存）。返回是否成功
export async function appendUserTermPoints(abbr, extra, fallback) {
  const key = (abbr || "").trim().toLowerCase();
  if (!key || !extra?.length) return false;
  const i = userTerms.value.findIndex((t) => (t.abbr || "").trim().toLowerCase() === key);
  const existing = i >= 0 ? userTerms.value[i] : null;
  const points = [...(existing?.points || []), ...extra].filter(
    (p, j, arr) => arr.indexOf(p) === j
  );
  const next = { ...(existing || fallback || { abbr }), points, source: "ai" };
  userTerms.value =
    i >= 0
      ? [...userTerms.value.slice(0, i), next, ...userTerms.value.slice(i + 1)]
      : [...userTerms.value, next];
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
  // 提取带空格输入的前缀组合作为命令候选："git commit -m" -> ["git commit -m","git commit","git"]、"ls -l" -> ["ls -l","ls"]
  const qTokens = q.includes(" ") ? q.split(/\s+/) : null;
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
    // 命令+参数输入：前缀组合与词条精确匹配（"git commit -m" -> git commit、"ls -l" -> ls）；段数越多分越高
    if (qTokens) {
      for (let k = qTokens.length; k >= 1; k--) {
        const cand = qTokens.slice(0, k).join(" ");
        if (abbr === cand) {
          score = Math.max(score, 94 + k);
          break;
        }
      }
    }
    if (score > 0) scored.push({ term, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.term.abbr.length - b.term.abbr.length
  );
  return scored.slice(0, 20).map((s) => s.term);
}

export function useSearch() {
  return { search, addUserTerm, updateUserTerm, appendUserTermPoints, userTerms };
}
