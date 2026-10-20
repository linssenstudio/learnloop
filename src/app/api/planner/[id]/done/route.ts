import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const updated = db
    .prepare("UPDATE study_tasks SET status = 'done' WHERE id = ? AND user_id = ? AND status = 'pending'")
    .run(id, user.id);
  if (updated.changes === 0) {
    return NextResponse.json({ error: "NOT_FOUND", message: "任务不存在或已完成" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
