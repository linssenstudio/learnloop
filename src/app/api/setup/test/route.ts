import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { isLlmConfigured, testConnection } from "@/lib/setup";

const bodySchema = z.object({
  baseUrl: z.string().url("Base URL 格式不正确").optional(),
  apiKey: z.string().min(1, "请填写 API Key"),
});

export async function POST(req: NextRequest) {
  if (isLlmConfigured()) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "已配置状态下需登录后才能重新测试" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 }
    );
  }
  const baseUrl = parsed.data.baseUrl ?? process.env.LLM_BASE_URL ?? "https://api.moonshot.cn/v1";
  return NextResponse.json(await testConnection(baseUrl, parsed.data.apiKey));
}
