// 外部 API 地址安全校验：仅允许公网 http/https，
// 拒绝 localhost、环回、私有、链路本地、CGNAT、组播与保留地址（发请求前调用）
export function assertSafeApiUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) throw new Error("未配置 API 地址");
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error("API 地址不是合法的 URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("API 地址仅支持 http/https");
  }
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) throw new Error("不允许访问本机地址（localhost）");
  if (host.includes(":")) {
    // IPv6：环回/ULA/链路本地拒绝，其余公网地址放行（避免误伤合法 IPv6 端点）
    if (host === "::" || host === "::1") throw new Error("不允许访问本机地址");
    if (/^fe[89ab]/.test(host) || /^fc|^fd/.test(host)) throw new Error("不允许访问私有地址");
    const m = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m && isPrivateV4(m[1])) throw new Error("不允许访问私有地址");
    return u;
  }
  if (isPrivateV4(host)) throw new Error("不允许访问私有地址");
  return u;
}

// 端点主机一致性（纵深防御）：请求 URL 与配置 baseUrl 必须同主机同端口，
// 防止配置被污染/篡改后把请求（含 Authorization 头）发往其他端点。
// 注：capabilities http:default 保持 https://** 以支持自定义 baseUrl，
// 运行时校验兜底；配合 assertSafeApiUrl（拦截私有/localhost）构成双层防线
export function assertEndpointMatches(urlStr, baseUrlStr) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error("请求地址不是合法的 URL");
  }
  let b;
  try {
    b = new URL(baseUrlStr);
  } catch {
    throw new Error("API 地址不是合法的 URL");
  }
  if (u.host.toLowerCase() !== b.host.toLowerCase()) {
    throw new Error("请求地址与配置的 API 端点不一致，已阻止请求");
  }
  return u;
}

function isPrivateV4(host) {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true; // 0/8、10/8、环回、组播与保留
  if (a === 169 && b === 254) return true; // 链路本地 169.254/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  return false;
}
