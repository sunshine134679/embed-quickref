// 服务商预设（OpenAI 兼容 API）：设置面板选中服务商后自动填 Base URL 与推荐模型。
// 端点规则：gpt-*/grok-* 模型走 OpenAI Responses（/responses）——OpenCode Go 套餐
// 仅对这些模型提供该端点；其余走 /chat/completions。
export const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "opencode",
    name: "OpenCode Go",
    baseUrl: "https://opencode.ai/zen/go/v1",
    models: ["gpt-5.6-luna", "deepseek-v4-flash", "deepseek-v4-pro", "mimo-v2.5", "kimi-k3"],
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [],
  },
  {
    id: "moonshot",
    name: "Kimi (Moonshot)",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k"],
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4-flash", "glm-4-plus"],
  },
  {
    id: "dashscope",
    name: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-turbo"],
  },
];

// 端点判定：gpt-*/grok-* 模型走 OpenAI Responses，其余走 OpenAI 兼容 chat/completions
export function endpointFor(model) {
  return /^(gpt-|grok-)/i.test(String(model || "").trim()) ? "responses" : "chat";
}

// 按 Base URL 匹配已选服务商（用于设置面板高亮；自定义 URL 返回 null）
export function providerFor(baseUrl, model) {
  const url = String(baseUrl || "").replace(/\/+$/, "");
  const hit = PROVIDERS.find((p) => p.baseUrl === url);
  if (hit) return hit;
  return null;
}
