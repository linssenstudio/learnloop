import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, findUserByToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? findUserByToken(token) : null;
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
