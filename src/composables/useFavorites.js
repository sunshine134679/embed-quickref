// 收藏词条：localStorage 持久化，按「缩写+分类」唯一（与词库去重约定一致）
const STORAGE_KEY = "embed-quickref-favorites-v1";
const LIMIT = 50;

export function loadFavorites() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveFavorites(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* 存储不可用时忽略 */
  }
}

// 切换收藏：返回切换后的新列表（调用方持有并持久化），新收藏置顶、限量
export function toggleFavorite(list, term) {
  if (!term?.abbr) return list;
  const key = (f) => f.abbr === term.abbr && f.category === term.category;
  const rest = list.filter((f) => !key(f));
  if (rest.length === list.length) {
    return [{ abbr: term.abbr, category: term.category, full: term.full, zh: term.zh, time: Date.now() }, ...rest].slice(0, LIMIT);
  }
  return rest;
}

export function isFavorite(list, term) {
  return !!term?.abbr && list.some((f) => f.abbr === term.abbr && f.category === term.category);
}
