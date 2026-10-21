import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";

export function llmConfig(): { baseUrl: string; apiKey: string; model: string; timeoutMs: number } {
  return {
    baseUrl: (process.env.LLM_BASE_URL ?? "https://api.moonshot.cn/v1").replace(/\/$/, ""),
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "kimi-k2-0711-preview",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 60_000),
  };
}

export class LlmNotConfiguredError extends Error {
  constructor() {
    super("请在 .env.local 配置 LLM_API_KEY");
    this.name = "LlmNotConfiguredError";
  }
}

export class LlmRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmRequestError";
  }
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface ChatOptions {
  system: string;
  user: string;
  maxTokens?: number;
  userId?: string;
}

interface CompletionResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

async function callChat(
  messages: ChatMessage[],
  opts: { json: boolean; maxTokens?: number; userId?: string }
): Promise<CompletionResult> {
  const cfg = llmConfig();
  if (!cfg.apiKey) throw new LlmNotConfiguredError();

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: 0.3,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LlmRequestError(`LLM 请求失败（${res.status}）：${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new LlmRequestError("LLM 返回内容为空");

  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  recordUsage(opts.userId ?? null, opts.json ? "chat_json" : "chat_text", cfg.model, promptTokens, completionTokens);

  return { content, promptTokens, completionTokens };
}

function recordUsage(userId: string | null, kind: string, model: string, promptTokens: number, completionTokens: number) {
  try {
    db.prepare(
      "INSERT INTO usage_records (id, user_id, kind, model, prompt_tokens, completion_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(randomUUID(), userId, kind, model, promptTokens, completionTokens, Date.now());
  } catch {
    // 用量记录失败不阻断主流程
  }
}

export async function chatJson<T>(params: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  userId?: string;
}): Promise<T> {
  const { schema, ...rest } = params;
  const messages: ChatMessage[] = [
    { role: "system", content: `${params.system}\n\n只输出符合要求的 JSON 对象，不要输出任何其他文字。` },
    { role: "user", content: params.user },
  ];

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      messages.push({
        role: "user",
        content: `上一次输出无法解析或校验：${lastError instanceof Error ? lastError.message : String(lastError)}。请重新输出合法的 JSON。`,
      });
    }
    const { content } = await callChat(messages, { json: true, maxTokens: rest.maxTokens, userId: rest.userId });
    try {
      return schema.parse(JSON.parse(content));
    } catch (err) {
      lastError = err;
    }
  }
  throw new LlmRequestError(
    `LLM 输出未通过 JSON 校验：${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

export async function chatText(params: ChatOptions): Promise<string> {
  const { content } = await callChat(
    [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    { json: false, maxTokens: params.maxTokens, userId: params.userId }
  );
  return content;
}
