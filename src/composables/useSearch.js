import { ref } from "vue";
import { load } from "@tauri-apps/plugin-store";
import { emit } from "@tauri-apps/api/event";
import { buildTermSearchIndex, searchTermIndex } from "../utils/termSearchIndex";

// 词库懒加载：terms.json 约 600KB，拆成独立 chunk 后台预加载，首屏不阻塞
let builtinTerms = null;
let termsPromise = null;
export function ensureTerms() {
  if (builtinTerms) return Promise.resolve(builtinTerms);
  if (!termsPromise) {
    termsPromise = import("../data/terms.json").then((m) => {
      builtinTerms = m.default;
      cachedAll = null;
      cachedSearchIndex = buildTermSearchIndex(allTerms());
      return builtinTerms;
    });
  }
  return termsPromise;
}

const userTerms = ref([]);
let store = null;
// allTerms 缓存：userTerms 变化时失效，避免每次搜索重建去重 Set
let cachedAll = null;
let cachedSearchIndex = null;

export async function initUserTerms() {
  store = await load("user-terms.json", { autoSave: false });
  userTerms.value = (await store.get("terms")) || [];
  cachedAll = null;
  cachedSearchIndex = builtinTerms ? buildTermSearchIndex(allTerms()) : null;
}

function invalidateCache() {
  cachedAll = null;
  cachedSearchIndex = null;
}

// 词库在各 WebView 是独立内存快照（快捷窗启动时加载一次）：落盘后广播让快捷窗
// 重新 initUserTerms，否则主窗口 AI 并入/更新词条后快捷窗搜不到
function notifyTermsChanged() {
  emit("user-terms-changed").catch(() => {});
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
  notifyTermsChanged();
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
  notifyTermsChanged();
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
  notifyTermsChanged();
  return true;
}

// 匹配优先级：缩写精确 > 缩写前缀 > 缩写包含 > 全称/中文包含 > 定义包含
// 后缀词条（abbr 不带点）额外支持带点号输入："main.c" -> c、".h" -> h、"a.b.py" -> py
export function search(query) {
  if (!cachedSearchIndex) cachedSearchIndex = buildTermSearchIndex(allTerms());
  return searchTermIndex(cachedSearchIndex, query);
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
