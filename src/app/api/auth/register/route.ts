import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AuthError,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  createUser,
} from "@/lib/auth";

const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位"),
  name: z.string().min(1, "请填写昵称").max(32, "昵称过长"),
});

export async function POST(req: NextRequest) {
  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 }
    );
  }

  try {
    const user = createUser(parsed.data.email, parsed.data.password, parsed.data.name);
    const { token, expiresAt } = createSession(user.id);
    const res = NextResponse.json({ user }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(expiresAt),
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return res;
  } catch (err) {
    if (err instanceof AuthError && err.code === "EMAIL_TAKEN") {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 409 });
    }
    throw err;
  }
}
