import { ref } from "vue";
import { load } from "@tauri-apps/plugin-store";

// 词库懒加载：terms.json 约 600KB，拆成独立 chunk 后台预加载，首屏不阻塞
let builtinTerms = null;
let termsPromise = null;
export function ensureTerms() {
  if (builtinTerms) return Promise.resolve(builtinTerms);
  if (!termsPromise) {
    termsPromise = import("../data/terms.json").then((m) => {
      builtinTerms = m.default;
      return builtinTerms;
    });
  }
  return termsPromise;
}

const userTerms = ref([]);
let store = null;
// allTerms 缓存：userTerms 变化时失效，避免每次搜索重建去重 Set
let cachedAll = null;

export async function initUserTerms() {
  store = await load("user-terms.json", { autoSave: false });
  userTerms.value = (await store.get("terms")) || [];
  cachedAll = null;
}

function invalidateCache() {
  cachedAll = null;
}

function allTerms() {
  if (cachedAll) return cachedAll;
  if (!builtinTerms) return [];
  // 去重规则：
  // - 内置词库全部保留（同缩写不同分类的一词多义词条互不冲突，如 ping 的 Linux/U-Boot/Windows 三条）
  // - 用户词库缓存：与内置「同缩写同分类」的词条跳过（内置优先），避免如 ipconfig 重复显示
  const seen = new Set();
  const out = [];
  for (const t of builtinTerms) {
    const k = (t.abbr || "").trim().toLowerCase() + "\u0000" + (t.category || "");
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  for (const t of userTerms.value) {
    const a = (t.abbr || "").trim().toLowerCase();
    const c = t.category || "";
    if (builtinTerms.some((b) => (b.abbr || "").trim().toLowerCase() === a && (b.category || "") === c)) continue;
    const k = a + "\u0000" + c;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  cachedAll = out;
  return out;
}

// AI 回答解析成功后写入个人词库，与内置词库按缩写去重
// 返回: added 新写入 | user-exists 用户词库已有（可更新）| builtin 内置已有 | invalid 无效
export async function addUserTerm(term) {
  const key = (term.abbr || "").trim().toLowerCase();
  if (!key) return "invalid";
  await ensureTerms(); // 词库未加载时先加载，避免内置判定误判
  if (builtinTerms.some((t) => (t.abbr || "").trim().toLowerCase() === key)) return "builtin";
  if (userTerms.value.some((t) => (t.abbr || "").trim().toLowerCase() === key)) return "user-exists";
  userTerms.value = [...userTerms.value, { ...term, source: "ai" }];
  invalidateCache();
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
  invalidateCache();
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
  invalidateCache();
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

// ---------- 术语搜索历史：打开词条时记录，空态/总历史展示 ----------
const TERM_HISTORY_KEY = "embed-quickref-term-history-v1";
const TERM_HISTORY_LIMIT = 30;

export function loadTermHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(TERM_HISTORY_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// 打开词条时记录（最近的在最前，同缩写去重保留最新）
export function addTermHistory(term) {
  if (!term?.abbr) return;
  const entry = {
    abbr: term.abbr,
    full: term.full || "",
    zh: term.zh || "",
    category: term.category || "",
    time: Date.now(),
  };
  const list = loadTermHistory().filter((h) => h.abbr !== entry.abbr);
  list.unshift(entry);
  try {
    localStorage.setItem(TERM_HISTORY_KEY, JSON.stringify(list.slice(0, TERM_HISTORY_LIMIT)));
  } catch {
    /* 存储不可用时忽略 */
  }
}

export function clearTermHistory() {
  try {
    localStorage.removeItem(TERM_HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

export function useSearch() {
  return { search, addUserTerm, updateUserTerm, appendUserTermPoints, userTerms };
}
