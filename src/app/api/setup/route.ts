import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { isLlmConfigured, testConnection, writeEnvLocal } from "@/lib/setup";

const bodySchema = z.object({
  baseUrl: z.string().url("Base URL 格式不正确"),
  apiKey: z.string().min(1, "请填写 API Key"),
  model: z.string().min(1, "请选择模型"),
});

export async function POST(req: NextRequest) {
  if (isLlmConfigured()) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "已配置状态下需登录后才能修改配置" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 }
    );
  }
  const check = await testConnection(parsed.data.baseUrl, parsed.data.apiKey);
  if (!check.ok) return NextResponse.json(check, { status: 400 });
  try {
    writeEnvLocal(parsed.data);
  } catch {
    return NextResponse.json({ ok: false, message: "写入 .env.local 失败，请检查项目目录写权限" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
