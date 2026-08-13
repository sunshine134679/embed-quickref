import { fetch } from "@tauri-apps/plugin-http";

const SYSTEM_PROMPT = `你是嵌入式 Linux 领域的资深专家，专门解释网络协议、总线/通信协议、内核机制、构建工具链、硬件与存储、文件系统相关的术语与缩写。
用户第一次提问时，根据问题类型选择回答格式：
- 若问题核心是在查询某个术语/缩写/命令（如 "SPI"、"SPI 时序"、"make 语法"、"includePath 填什么"），必须严格按以下纯文本格式回答，不要使用 Markdown 标记，不要输出任何多余内容；若问题附带关注点（如时序、用法、区别点），请在"要点"中围绕这些关注点展开：
缩写: <术语的常用缩写，没有则写术语本身>
全称: <英文全称，没有则写 ->
中文名: <中文名称>
分类: <Linux 命令|Windows 命令|Shell 脚本|Make 语法|CMake 语法|汇编指令|Git 操作|VSCode 配置|网络协议|总线协议|内核与系统|构建与工具链|硬件与存储|文件系统|文件后缀|其他>
注意区分命令/术语所属平台：Windows 专属命令（ipconfig、tasklist、netstat、dir、PowerShell cmdlet 如 Get-Process、Set-ExecutionPolicy 等）分类必须填 Windows 命令，不得归入 Linux 命令；Linux 专属命令（ls、grep、systemctl 等）同理；跨平台同名命令（ping、cd、echo 等）按用户提问语境选择平台。若回答的是 Windows/PowerShell/CMD 相关内容，定义与要点中明确标注平台。
定义: <一句话准确定义>
要点:
- <要点1，优先包含关键参数、速率、层级或典型场景>
- <要点2>
- <要点3>
- 若用户提问是"对比/区别/举例/为什么/怎么实现"等开放性问题（如 "ls 和 find 的区别"、"SPI 怎么调试"），不要套用上面的固定格式，直接用简洁的纯文本回答，可以分段或用 "- " 列出要点，同样不要使用 Markdown 标记。
用户后续追问时，不要再使用上述格式，直接用简洁的纯文本回答，可以分段或用 "- " 列出要点，但同样不要使用 Markdown 标记。`;

// 以系统提示词开始一段新的 AI 会话
export function createSession(query) {
  return [
    { role: "system", content: promptFor(query) },
    { role: "user", content: query },
  ];
}

// 历史记录只存用户/助手消息，续聊时把系统提示词补回去（按原查询重新判定模式）
export function restoreSession(messages) {
  const firstUser = messages.find((m) => m.role === "user");
  const prompt = firstUser ? promptFor(firstUser.content) : SYSTEM_PROMPT;
  return [{ role: "system", content: prompt }, ...messages];
}

// 判定查询是否为"完整命令"（如 ls -l /home、git commit -m "msg"）：
// 纯 ASCII、小写命令名开头、后跟空格和参数/选项；排除术语缩写（大写开头/无空格）与中文疑问句
function looksLikeCommand(q) {
  const s = (q || "").trim();
  if (!s) return false;
  if (/[\u4e00-\u9fa5]/.test(s)) return false; // 含中文：术语/疑问/比较场景，不走拆解
  if (!/\s/.test(s)) return false; // 单个 token：是术语缩写（ls、git）而非完整命令
  return /^[a-z][a-z0-9_.-]*\s+\S+/.test(s); // 小写命令名 + 空格 + 参数/选项
}

function promptFor(query) {
  return looksLikeCommand(query) ? COMMAND_BREAKDOWN_PROMPT : SYSTEM_PROMPT;
}

// 完整命令的拆解解析提示词：逐部分解释命令名/选项/参数，而非笼统介绍
const COMMAND_BREAKDOWN_PROMPT = `你是嵌入式 Linux 领域的资深专家。用户输入了一条完整命令（含命令名、选项或参数，如 "ls -l /home"、"git commit -m 'msg'"、"arm-none-eabi-gcc -mcpu=cortex-m4 -mthumb -c main.c"）。请对该命令做逐部分拆解解析，严格按以下纯文本格式回答，不要使用 Markdown 标记，不要输出任何多余内容：
命令: <原样复述用户输入的命令>
作用: <一句话说明这条命令整体在做什么>
拆解:
- <命令名>: 命令本身，<其职能一句话>
- <选项/参数1>: <作用说明，注意区分短选项 -x 与长选项 --xxx、参数路径/文件名/数值的含义>
- <选项/参数2>: ...
执行效果: <描述执行后会发生什么、输出什么、影响什么>
常见变体: <1-2 条相关提示，如缺省选项时的行为、更常用写法或易错点>
若用户输入的不是完整命令而是术语或问题，则按常规术语格式回答。
用户后续追问时直接用简洁纯文本回答。`;

// 单次 AI 请求整体超时（SSE 流式长回答可能较慢，120s 足够）
const REQUEST_TIMEOUT_MS = 120_000;

// DeepSeek OpenAI 兼容接口，SSE 流式；走 tauri http 插件绕开 CORS
// messages 为完整多轮对话（含 system），追问时把历史一起带上
export async function askAi(messages, settings, onDelta) {
  // 超时保护：plugin-http 支持 AbortSignal，中止后 Rust 侧请求一并取消
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
        stream: true,
        temperature: 0.2,
        messages,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`请求失败 (HTTP ${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
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
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onDelta(fullText);
          }
        } catch {
          // 忽略跨分片的不完整 JSON
        }
      }
    }
    return fullText;
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(`AI 请求超时（${REQUEST_TIMEOUT_MS / 1000} 秒），请重试`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 将固定格式的 AI 回答解析为词条对象，解析失败返回 null
export function parseAnswer(text) {
  const get = (label) => {
    const m = text.match(new RegExp(`^${label}[:：]\\s*(.+)$`, "m"));
    return m ? m[1].trim() : "";
  };
  const abbr = get("缩写");
  if (!abbr) return null;
  const points = [...text.matchAll(/^[-•]\s*(.+)$/gm)].map((m) => m[1].trim());
  const full = get("全称");
  return {
    abbr,
    full: full === "-" ? "" : full,
    zh: get("中文名"),
    category: get("分类") || "其他",
    definition: get("定义"),
    points,
  };
}
