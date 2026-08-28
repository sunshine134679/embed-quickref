// 发音请求与播放的时间边界，避免失效音频或不可达网络阻塞系统语音兜底。
export const AUDIO_REQUEST_TIMEOUT_MS = 3000;
export const PRONUNCIATION_LOOKUP_TIMEOUT_MS = 3500;
export const AUDIO_PLAY_TIMEOUT_MS = 1500;

export function isAudioResponse(response) {
  const contentType = response?.headers?.get?.("content-type")?.toLowerCase() || "";
  if (!contentType) return true;
  if (contentType.includes("audio/")) return true;
  if (contentType.includes("application/octet-stream")) return true;
  return false;
}
