import fs from "node:fs";
import path from "node:path";
import { llmConfig } from "./llm";

export const SETUP_PRESETS = [
  { label: "Moonshot / Kimi（国内版）", baseUrl: "https://api.moonshot.cn/v1", keyUrl: "https://platform.moonshot.cn" },
  { label: "Moonshot / Kimi（国际版）", baseUrl: "https://api.moonshot.ai/v1", keyUrl: "https://platform.moonshot.ai" },
];

export function isLlmConfigured(): boolean {
  return !!process.env.LLM_API_KEY;
}

export function setupStatus(): { configured: boolean; baseUrl: string; model: string; keyHint: string | null } {
  const cfg = llmConfig();
  return {
    configured: isLlmConfigured(),
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    keyHint: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}***` : null,
  };
}

export type TestResult = { ok: true; models: string[] } | { ok: false; message: string };

export async function testConnection(baseUrl: string, apiKey: string): Promise<TestResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/models`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timed out") || msg.includes("TimeoutError") || (err instanceof Error && err.name === "TimeoutError")) {
      return { ok: false, message: "连接超时（8 秒），请检查网络或 Base URL 是否正确" };
    }
    return { ok: false, message: "无法连接到服务器，请检查 Base URL 与网络" };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, message: "API Key 无效或已过期，请检查后重试" };
  }
  if (res.status === 404) {
    return { ok: false, message: "端点地址不正确（404），Base URL 通常以 /v1 结尾" };
  }
  if (!res.ok) {
    return { ok: false, message: `服务商返回错误（${res.status}），请稍后重试` };
  }
  try {
    const data = (await res.json()) as { data?: { id?: string }[] };
    const models = (data.data ?? []).map((m) => m.id).filter((id): id is string => !!id);
    if (models.length === 0) return { ok: false, message: "连接成功但未返回任何模型，请确认端点为 OpenAI 兼容接口" };
    return { ok: true, models };
  } catch {
    return { ok: false, message: "响应格式无法解析，请确认端点为 OpenAI 兼容接口" };
  }
}

export function writeEnvLocal(config: { baseUrl: string; apiKey: string; model: string }): void {
  const envPath = path.join(process.cwd(), ".env.local");
  const entries: Record<string, string> = {
    LLM_BASE_URL: config.baseUrl,
    LLM_API_KEY: config.apiKey,
    LLM_MODEL: config.model,
  };
  const remaining = new Set(Object.keys(entries));
  let lines: string[] = [];
  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, "utf8").split("\n");
  }
  const out = lines.map((line) => {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
    if (m && m[1] in entries) {
      remaining.delete(m[1]);
      return `${m[1]}=${entries[m[1]]}`;
    }
    return line;
  });
  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  for (const key of remaining) out.push(`${key}=${entries[key]}`);
  fs.writeFileSync(envPath, out.join("\n") + "\n", "utf8");

  process.env.LLM_BASE_URL = config.baseUrl;
  process.env.LLM_API_KEY = config.apiKey;
  process.env.LLM_MODEL = config.model;
}
