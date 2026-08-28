import { fetch } from "@tauri-apps/plugin-http";
import { invoke } from "@tauri-apps/api/core";
import { useSettings } from "./useSettings";
import { endpointFor } from "../data/providers";
import { assertSafeApiUrl } from "../utils/safeUrl";
import { hasApiCandidate, withApiFallback } from "../utils/apiCandidates";
import { invokeNativeSpeech, prepareSpeechSynthesis } from "../utils/speechSynthesis";
import learningDictionary from "../data/learning-dictionary";
import developmentDictionary from "../data/development-dictionary";

// 专业词库优先，补充词库只填充缺失词，不覆盖已有的更详细释义。
const localDictionary = { ...developmentDictionary, ...learningDictionary };

// 本地学习词典：精确命中 + 词形索引（interrupted -> interrupt）
// 词形索引在模块加载时构建一次，命中后返回原型词条
const formIndex = new Map();
for (const [headword, entry] of Object.entries(localDictionary)) {
  formIndex.set(normalizeWord(headword), headword);
  for (const form of entry.forms || []) formIndex.set(normalizeWord(form), headword);
}

function normalizeWord(s) {
  return (s || "").toLowerCase().replace(/[\s_\-]+/g, " ").trim();
}

function containsChinese(text) {
  return /[\u3400-\u9fff]/.test(text);
}

// 纯英文单词（含撇号/连字符），不含空格与中文
export function isSingleWord(text) {
  return /^[A-Za-z]+(?:['-][A-Za-z]+)?$/.test((text || "").trim());
}

// 本地学习词典命中：输入单词或词形，返回 { word, entry }；未命中返回 null
export function lookupWord(text) {
  const key = normalizeWord(text);
  if (!key) return null;
  const headword = deriveLemmaCandidates(key).map((candidate) => formIndex.get(candidate)).find(Boolean);
  if (!headword) return null;
  return { word: headword, entry: localDictionary[headword] };
}

// 对没有显式登记的常见词形做保守词干推导；只有推导结果已存在于本地词库时才命中。
function deriveLemmaCandidates(word) {
  const out = [word];
  const add = (value) => {
    if (value && value.length >= 2 && !out.includes(value)) out.push(value);
  };
  if (word.endsWith("ies") && word.length > 4) add(word.slice(0, -3) + "y");
  if (word.endsWith("ied") && word.length > 4) add(word.slice(0, -3) + "y");
  if (word.endsWith("ing") && word.length > 5) {
    const stem = word.slice(0, -3);
    add(stem);
    add(stem + "e");
    if (/(.)\1$/.test(stem)) add(stem.slice(0, -1));
  }
  if (word.endsWith("ed") && word.length > 4) {
    const stem = word.slice(0, -2);
    add(stem);
    add(stem + "e");
    if (/(.)\1$/.test(stem)) add(stem.slice(0, -1));
  }
  if (word.endsWith("es") && word.length > 4) add(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) add(word.slice(0, -1));
  if (word.endsWith("ly") && word.length > 4) add(word.slice(0, -2));
  return out;
}

// 单个英文单词的词典式 AI 提示词（未命中本地词典时用）
// 末行强调拼写错误必须明说：不完整/乱词不硬编解释
const WORD_PROMPT = `你是专业的英语学习词典。用户输入一个英文单词，请用中文简洁解释，按以下格式回答（不要使用 Markdown 标记，不要输出任何多余内容）：
音标: /美式音标/（可省略则写 /--/）
释义: <词性.> <中文释义，列出主要含义>
例句: <一个体现该词用法的英文例句>
译文: <例句的中文翻译>
如果输入是正常的英文单词，即使本地词库没有收录，也必须给出词典式解释；不要因为它和另一个更长的单词相似就判定为未找到。只有明确的拼写错误、不完整输入或乱码才输出第一行：未找到: <可能的正确拼写，没有则留空>`;

// 中英互译提示词：按输入语言自动选择目标语言
const SENTENCE_PROMPT = `你是专业的中英互译引擎。把用户输入的文本翻译成目标语言：
- 输入包含中文时翻译成英文；
- 输入为英文时翻译成中文。
只输出译文本身，不要任何解释、引号、括号注释或 Markdown 标记。`;

// 单词/句子请求整体超时（DeepSeek 非流式通常 1-3s，给足余量）
const REQUEST_TIMEOUT_MS = 30_000;
// 翻译结果缓存：内存 + localStorage，TTL 30 天
const CACHE_STORAGE_KEY = "embed-quickref-translate-cache-v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const CACHE_LIMIT = 200;
const translateCache = new Map();
try {
  const entries = JSON.parse(localStorage.getItem(CACHE_STORAGE_KEY) || "[]");
  const now = Date.now();
  for (const [key, value, savedAt] of entries) {
    if (typeof key === "string" && typeof value === "string" && Number.isFinite(savedAt) && now - savedAt < CACHE_TTL_MS) {
      translateCache.set(key, { value, savedAt });
  }
  }
} catch {
  /* 缓存损坏则忽略 */
}

function persistCache() {
  try {
    const entries = [...translateCache.entries()]
      .map(([key, entry]) => [key, entry.value, entry.savedAt])
      .slice(-CACHE_LIMIT);
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* localStorage 不可用时忽略 */
  }
}

function cached(key) {
  const entry = translateCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt >= CACHE_TTL_MS) {
    translateCache.delete(key);
    persistCache();
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  translateCache.delete(key);
  translateCache.set(key, { value, savedAt: Date.now() });
  persistCache();
}

// 调用 OpenAI 兼容接口（DeepSeek/OpenCode Go 等），非流式，返回完整文本。
// 端点自动判定：gpt-*/grok-* 模型走 OpenAI Responses（/responses），其余走 /chat/completions
async function askOnce(messages, settings) {
  assertSafeApiUrl(settings.baseUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const endpoint = endpointFor(settings.model);
    const url = `${settings.baseUrl.replace(/\/+$/, "")}/${endpoint === "responses" ? "responses" : "chat/completions"}`;
    const body = endpoint === "responses"
      ? {
          model: settings.model,
          stream: false,
          temperature: 0.3,
          input: messages.map((m) => ({ role: m.role, content: [{ type: "input_text", text: m.content }] })),
        }
      : {
          model: settings.model,
          stream: false,
          temperature: 0.3,
          messages,
        };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(`请求失败 (HTTP ${res.status})${bodyText ? `: ${bodyText.slice(0, 160)}` : ""}`);
    }
    const data = await res.json();
    const content = endpoint === "responses"
      ? extractResponsesText(data)
      : data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("翻译服务返回为空");
    return content.trim();
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`翻译请求超时（${REQUEST_TIMEOUT_MS / 1000} 秒），请重试`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Responses 非流式响应：output 数组中 message 项的 output_text 内容拼接
function extractResponsesText(data) {
  let text = "";
  for (const item of data?.output ?? []) {
    if (item.type !== "message") continue;
    if (typeof item.content === "string") text += item.content;
    else if (Array.isArray(item.content)) {
      for (const p of item.content) {
        if (p?.type === "output_text" && p.text) text += p.text;
      }
    }
  }
  return text;
}

// 流式版（SSE）：长句翻译逐段上屏，减少等待感；onDelta 可选——不传则仅返回最终文本
async function askStream(messages, settings, onDelta) {
  assertSafeApiUrl(settings.baseUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const endpoint = endpointFor(settings.model);
    const url = `${settings.baseUrl.replace(/\/+$/, "")}/${endpoint === "responses" ? "responses" : "chat/completions"}`;
    const body = endpoint === "responses"
      ? {
          model: settings.model,
          stream: true,
          temperature: 0.3,
          input: messages.map((m) => ({ role: m.role, content: [{ type: "input_text", text: m.content }] })),
        }
      : {
          model: settings.model,
          stream: true,
          temperature: 0.3,
          messages,
        };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(`请求失败 (HTTP ${res.status})${bodyText ? `: ${bodyText.slice(0, 160)}` : ""}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        const data = line.trim();
        if (!data.startsWith("data:")) continue;
        const payload = data.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          const delta = endpoint === "responses"
            ? evt.type === "response.output_text.delta" ? evt.delta : ""
            : evt.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            if (onDelta) onDelta(full);
          }
        } catch {
          // 忽略跨分片的不完整 JSON
        }
      }
    }
    return full.trim();
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`翻译请求超时（${REQUEST_TIMEOUT_MS / 1000} 秒），请重试`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 单词拼写建议：词库（术语缩写/全称拆词 + 学习词典）前缀 + 编辑距离模糊匹配 ----------
// 词表懒加载（terms.json 已被 useSearch 缓存为 chunk，此处复用同一模块不会重复加载）
let wordIndex = null;
async function ensureWordIndex() {
  if (wordIndex) return wordIndex;
  const terms = (await import("../data/terms.json")).default;
  const map = new Map();
  const add = (w, zh) => {
    const k = String(w || "").trim().toLowerCase();
    if (k && k.length >= 2 && /^[a-z]+$/.test(k) && !map.has(k)) {
      map.set(k, { word: k, zh: zh || "" });
    }
  };
  for (const t of terms) {
    add(t.abbr, t.zh);
    for (const part of String(t.full || "").split(/[\s\-/]+/)) {
      if (/^[a-z]+$/i.test(part)) add(part.toLowerCase(), t.zh);
    }
  }
  for (const [hw, entry] of Object.entries(localDictionary)) {
    add(hw, entry.primary);
    for (const f of entry.forms || []) add(f, entry.primary);
  }
  wordIndex = { map, words: [...map.values()] };
  return wordIndex;
}

// 编辑距离（Levenshtein）：长度差过大直接放弃（距离上限），控制搜索成本
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  if (Math.abs(m - n) > 3) return 9;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// 输入联想/拼写建议：前缀匹配（补全）优先，其次编辑距离 ≤ 阈值（防手快输错）
// 默认对词表精确命中的输入也返回相似词（排除自身）：如 int 也推荐 init，防止打错；
// 翻译校验场景传 { includeExact: false }：词表精确命中视为有效词（如 echo），不判错
// 返回 [{ word, zh, dist }] 最多 6 条
export async function suggestWords(input, options = {}) {
  const { includeExact = true } = options;
  const idx = await ensureWordIndex();
  const q = String(input || "").trim().toLowerCase().replace(/[\s_\-]+/g, "");
  if (q.length < 2) return [];
  if (!includeExact && idx.map.has(q)) return [];
  const maxDist = q.length <= 3 ? 1 : 2;
  const out = [];
  for (const w of idx.words) {
    if (w.word === q) continue;
    if (w.word.startsWith(q)) {
      out.push({ word: w.word, zh: w.zh, dist: 0 });
    } else if (w.word.length >= q.length - 1) {
      const d = editDistance(q, w.word);
      if (d <= maxDist) out.push({ word: w.word, zh: w.zh, dist: d });
    }
  }
  out.sort((a, b) => a.dist - b.dist || a.word.length - b.word.length);
  // 前缀词（dist 0）易挤满列表把模糊词挤掉（如 int 的 init 是编辑距离 1 而非前缀）：
  // 分组各自截断——前缀最多 3 条 + 模糊最多 5 条（编辑距离 1 的候选多，放宽模糊组保证
  // 用户想纠正的词（int→init）能出现）
  const prefix = [];
  const fuzzy = [];
  for (const s of out) {
    if (s.dist === 0) {
      if (prefix.length < 3) prefix.push(s);
    } else {
      if (fuzzy.length < 5) fuzzy.push(s);
    }
    if (prefix.length >= 3 && fuzzy.length >= 5) break;
  }
  return [...prefix, ...fuzzy];
}

// AI 单词回复中识别"未找到"（拼写错误/不完整/乱词）：不硬编解释
const NOT_FOUND_RE = /未找到|不存在|拼写错误|不是(一个|个)?(有效|正确|真实|合法)?(的)?(英文)?(单词|词汇)|无意义|无效(的)?输入|无法(识别|翻译)/;

// 主入口：根据输入类型返回结果
// - 英文单词命中本地学习词典 -> { kind: "word", word, entry }（零网络）
// - 英文单词经 AI 判定为拼写错误/不完整 -> { kind: "word-not-found", text, suggestions }
// - 本地词库未收录但属于正常单词 -> { kind: "word-ai", text, reply }（AI 词典式解释）
// - 句子/中文 -> { kind: "sentence", text, source, target, translated }（SSE 流式，onDelta 逐段回调）
// onDelta(partialText, target)：句子流式翻译时随内容增长回调（快捷窗不传则静默等最终结果）
// 返回 Promise；无 apiKey 时抛错提示去设置
export async function translateQuery(text, settings, onDelta) {
  const input = (text || "").trim();
  if (!input) return null;
  if (!hasApiCandidate(settings)) throw new Error("no-api-key");

  if (isSingleWord(input)) {
    const local = lookupWord(input);
    if (local) return { kind: "word", word: local.word, spokenText: input, entry: local.entry };
    // 拼写建议：不完整（前缀补全）或高置信近似（编辑距离 1）直接给建议，不调 AI 硬编
    // 严格模式：词表精确命中（echo 等有效命令词）视为有效，不判错
    const q = normalizeWord(input);
    // AI 词典式解释：建议只作为辅助，不再因“本地没有收录”而拦截正常单词。
    // v2 用于淘汰旧逻辑缓存的误判结果。
    const key = "word:v2:" + q;
    let reply = cached(key);
    let sugg = [];
    if (!reply) {
      sugg = await suggestWords(input, { includeExact: false });
      reply = await withApiFallback(
        settings,
        (candidate) => askOnce(
          [
            { role: "system", content: WORD_PROMPT },
            { role: "user", content: input },
          ],
          candidate
        )
      );
      setCache(key, reply);
    } else if (NOT_FOUND_RE.test(reply)) {
      // 仅未找到结果需要补充本地建议；正常缓存命中直接返回，避免重复扫描词表。
      sugg = await suggestWords(input, { includeExact: false });
    }
    // AI 判定拼写错误/不存在：转为“未找到”，并合并本地建议。
    if (NOT_FOUND_RE.test(reply)) {
      const m = String(reply).match(/未找到\s*[:：]?\s*(.+)?/);
      const aiSugg = m && m[1] && m[1].trim() ? [{ word: m[1].trim().split(/\s*[、,，/]\s*/)[0], zh: "", dist: 1 }] : [];
      const allSuggestions = [...aiSugg, ...sugg.filter((item) => !aiSugg.some((ai) => ai.word === item.word))];
      return { kind: "word-not-found", text: input, suggestions: allSuggestions.slice(0, 3) };
    }
    return { kind: "word-ai", text: input, reply };
  }

  const target = containsChinese(input) ? "en" : "zh";
  const key = `sentence:${target}:${normalizeWord(input)}`;
  let translated = cached(key);
  if (!translated) {
    // 长句/中文翻译走 SSE 流式：onDelta 收到的是累计文本，UI 可逐段上屏
    translated = await withApiFallback(
      settings,
      (candidate) => askStream(
        [
          { role: "system", content: SENTENCE_PROMPT },
          { role: "user", content: input },
        ],
        candidate,
        onDelta ? (partial) => onDelta(partial, target) : undefined
      ),
      () => onDelta?.("", target)
    );
    setCache(key, translated);
  }
  return { kind: "sentence", text: input, target, translated };
}

// 发音统一使用本机语音，不访问在线词典或下载音频。
function getSpeechVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices().filter((voice) => /^en(?:-|$)/i.test(voice.lang || ""));
}

export function listSpeechVoices() {
  return getSpeechVoices();
}

export function subscribeSpeechVoices(callback) {
  if (typeof window === "undefined" || !window.speechSynthesis || typeof callback !== "function") return () => {};
  const refresh = () => callback(getSpeechVoices());
  window.speechSynthesis.addEventListener?.("voiceschanged", refresh);
  refresh();
  return () => window.speechSynthesis.removeEventListener?.("voiceschanged", refresh);
}

function speakWithSystemVoice(text, settings) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const Utterance = window.SpeechSynthesisUtterance || globalThis.SpeechSynthesisUtterance;
  if (typeof Utterance !== "function") return;
  prepareSpeechSynthesis(window.speechSynthesis);
  const accent = settings.accent === "en" ? "en-GB" : "en-US";
  const voices = getSpeechVoices();
  const selected = settings.voiceName ? voices.find((voice) => voice.name === settings.voiceName) : null;
  const exact = voices.find((voice) => voice.lang?.toLowerCase() === accent.toLowerCase());
  const regional = voices.find((voice) => voice.lang?.toLowerCase().startsWith(accent.slice(0, 2).toLowerCase()));
  const utterance = new Utterance(text);
  utterance.voice = selected || exact || regional || null;
  utterance.lang = utterance.voice?.lang || accent;
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

export async function speakEnglish(text) {
  const input = String(text || "").trim();
  if (!input) return;
  const { settings } = useSettings();
  window.speechSynthesis?.cancel();

  // 原生 Windows SAPI 负责直接发音，Web Speech 仅作为本机调用失败时的兜底。
  const nativeStarted = await invokeNativeSpeech(invoke, input, settings.value.accent);
  if (!nativeStarted) speakWithSystemVoice(input, settings.value);
}

// ---------- 翻译历史：每次成功翻译写入，空态下快捷回看 ----------
const HISTORY_STORAGE_KEY = "embed-quickref-translate-history-v1";
const HISTORY_LIMIT = 20;

export function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// 记录一次翻译：kind word|word-ai|sentence；保留原输入与一句话摘要（最近的在前）
export function addHistory(result, input) {
  if (!result || !input) return;
  const summary =
    result.kind === "word"
      ? result.entry.primary
      : result.kind === "word-ai"
        ? (result.reply || "").split("\n").find((l) => l.startsWith("释义")) || result.reply
        : result.translated;
  const entry = {
    kind: result.kind,
    input: input.trim(),
    summary: (summary || "").trim().slice(0, 80),
    time: Date.now(),
  };
  const list = loadHistory().filter((h) => h.input !== entry.input);
  list.unshift(entry);
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT)));
  } catch {
    /* 存储不可用时忽略 */
  }
}

// 清空翻译历史
export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
