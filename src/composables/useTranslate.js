import { fetch } from "@tauri-apps/plugin-http";
import learningDictionary from "../data/learning-dictionary";

// 本地学习词典：精确命中 + 词形索引（interrupted -> interrupt）
// 词形索引在模块加载时构建一次，命中后返回原型词条
const formIndex = new Map();
for (const [headword, entry] of Object.entries(learningDictionary)) {
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
  const headword = formIndex.get(key);
  if (!headword) return null;
  return { word: headword, entry: learningDictionary[headword] };
}

// 单个英文单词的词典式 AI 提示词（未命中本地词典时用）
const WORD_PROMPT = `你是专业的英语学习词典。用户输入一个英文单词，请用中文简洁解释，按以下格式回答（不要使用 Markdown 标记，不要输出任何多余内容）：
音标: /美式音标/（可省略则写 /--/）
释义: <词性.> <中文释义，列出主要含义>
例句: <一个体现该词用法的英文例句>
译文: <例句的中文翻译>`;

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

// 调用 DeepSeek（OpenAI 兼容）非流式接口，返回完整文本
async function askOnce(messages, settings) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: settings.model,
        stream: false,
        temperature: 0.3,
        messages,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`请求失败 (HTTP ${res.status})${body ? `: ${body.slice(0, 160)}` : ""}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("翻译服务返回为空");
    return content.trim();
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`翻译请求超时（${REQUEST_TIMEOUT_MS / 1000} 秒），请重试`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 主入口：根据输入类型返回结果
// - 英文单词命中本地学习词典 -> { kind: "word", word, entry }（零网络）
// - 英文单词未命中 -> { kind: "word-ai", text, reply }（AI 词典式解释）
// - 句子/中文 -> { kind: "sentence", text, source, target, translated }
// 返回 Promise；无 apiKey 时抛错提示去设置
export async function translateQuery(text, settings) {
  const input = (text || "").trim();
  if (!input) return null;
  if (!settings.apiKey) throw new Error("no-api-key");

  if (isSingleWord(input)) {
    const local = lookupWord(input);
    if (local) return { kind: "word", word: local.word, entry: local.entry };
    const key = "word:" + normalizeWord(input);
    let reply = cached(key);
    if (!reply) {
      reply = await askOnce(
        [
          { role: "system", content: WORD_PROMPT },
          { role: "user", content: input },
        ],
        settings
      );
      setCache(key, reply);
    }
    return { kind: "word-ai", text: input, reply };
  }

  const target = containsChinese(input) ? "en" : "zh";
  const key = `sentence:${target}:${normalizeWord(input)}`;
  let translated = cached(key);
  if (!translated) {
    translated = await askOnce(
      [
        { role: "system", content: SENTENCE_PROMPT },
        { role: "user", content: input },
      ],
      settings
    );
    setCache(key, translated);
  }
  return { kind: "sentence", text: input, target, translated };
}

// 用 WebView2 的 speechSynthesis 朗读英文（不新增 Rust 命令，失败静默）
export function speakEnglish(text) {
  if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
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
