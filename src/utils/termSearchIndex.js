// 术语搜索索引：只预计算不会改变匹配语义的文本字段，term 保留原始对象引用。
export function buildTermSearchIndex(terms) {
  return (Array.isArray(terms) ? terms : []).map((term) => ({
    term,
    abbr: (term.abbr || "").toLowerCase(),
    full: (term.full || "").toLowerCase(),
    zh: term.zh || "",
    definition: (term.definition || "").toLowerCase(),
  }));
}

// 匹配优先级与原 useSearch.search 保持一致：缩写精确 > 前缀 > 包含 > 全称/中文 > 定义。
export function searchTermIndex(index, query) {
  const raw = String(query || "").trim();
  const q = raw.toLowerCase();
  if (!q) return [];

  let suffix = null;
  if (q.includes(".")) {
    const parts = q.split(".").filter(Boolean);
    if (parts.length) suffix = parts[parts.length - 1];
  }
  const qTokens = q.includes(" ") ? q.split(/\s+/) : null;
  const scored = [];

  for (const record of Array.isArray(index) ? index : []) {
    const { term, abbr, full, zh, definition } = record;
    let score = 0;
    if (abbr === q) score = 100;
    else if (abbr.startsWith(q)) score = 80;
    else if (abbr.includes(q)) score = 65;
    else if (full.includes(q) || zh.includes(raw)) score = 50;
    else if (definition.includes(q)) score = 25;

    if (suffix && abbr === suffix) {
      score = Math.max(score, q.startsWith(".") ? 100 : 75);
    }
    if (qTokens) {
      for (let k = qTokens.length; k >= 1; k--) {
        const candidate = qTokens.slice(0, k).join(" ");
        if (abbr === candidate) {
          score = Math.max(score, 94 + k);
          break;
        }
      }
    }
    if (score > 0) scored.push({ term, score });
  }

  scored.sort((a, b) => b.score - a.score || a.term.abbr.length - b.term.abbr.length);
  return scored.slice(0, 20).map((item) => item.term);
}
