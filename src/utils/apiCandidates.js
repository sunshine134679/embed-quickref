// 按“主模型 -> 备用模型”顺序生成可用的 API 请求候选。
// 备用项的 baseUrl/apiKey 留空时分别复用主配置，便于只添加一个备用模型名。
export function apiCandidates(settings) {
  const primary = {
    baseUrl: String(settings?.baseUrl || "").trim(),
    model: String(settings?.model || "").trim(),
    apiKey: String(settings?.apiKey || "").trim(),
  };
  const candidates = [];

  addCandidate(candidates, primary);
  for (const fallback of Array.isArray(settings?.fallbacks) ? settings.fallbacks : []) {
    addCandidate(candidates, {
      baseUrl: String(fallback?.baseUrl || primary.baseUrl).trim(),
      model: String(fallback?.model || "").trim(),
      apiKey: String(fallback?.apiKey || primary.apiKey).trim(),
    });
  }
  return candidates;
}

function addCandidate(candidates, candidate) {
  if (candidate.baseUrl && candidate.model && candidate.apiKey) candidates.push(candidate);
}

export function hasApiCandidate(settings) {
  return apiCandidates(settings).length > 0;
}

// 逐个尝试候选模型；request(candidate) 抛错后才进入下一项。
// onRetry 用于清理已经上屏的失败模型的流式内容。
// signal：外部取消（视图离开/手动停止）时立即停止整个备用链，不再尝试下一个模型
export async function withApiFallback(settings, request, onRetry, signal) {
  const candidates = apiCandidates(settings);
  if (!candidates.length) throw new Error("no-api-key");

  let lastError;
  for (let index = 0; index < candidates.length; index += 1) {
    try {
      return await request(candidates[index], index);
    } catch (error) {
      // 外部已取消：原样上抛，跳过备用模型（继续尝试只会打更多无意义的请求）
      if (signal?.aborted) throw error;
      lastError = error;
      if (index < candidates.length - 1) onRetry?.(error, candidates[index], candidates[index + 1]);
    }
  }

  const suffix = candidates.length > 1 ? `（已按顺序尝试 ${candidates.length} 个模型）` : "";
  throw new Error(`${lastError?.message || "请求失败"}${suffix}`);
}
