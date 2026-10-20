import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AuthError,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  verifyLogin,
} from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "请输入密码"),
});

export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 }
    );
  }

  try {
    const user = verifyLogin(parsed.data.email, parsed.data.password);
    const { token, expiresAt } = createSession(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(expiresAt),
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return res;
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 401 });
    }
    throw err;
  }
}
