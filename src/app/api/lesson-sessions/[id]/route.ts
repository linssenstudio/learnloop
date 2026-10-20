import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { listMessages, type SessionRow } from "@/lib/tutor/engine";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const session = db.prepare("SELECT * FROM teaching_sessions WHERE id = ? AND user_id = ?").get(id, user.id) as
    | SessionRow
    | undefined;
  if (!session) return NextResponse.json({ error: "NOT_FOUND", message: "会话不存在" }, { status: 404 });
  return NextResponse.json({
    session: { id: session.id, courseId: session.course_id, lessonId: session.lesson_id, state: session.state, step: session.step },
    messages: listMessages(session.id),
  });
}
