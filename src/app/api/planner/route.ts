import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const tasks = db
    .prepare(
      `SELECT t.*, c.title AS course_title
       FROM study_tasks t LEFT JOIN courses c ON c.id = t.course_id
       WHERE t.user_id = ?
       ORDER BY t.status = 'done', t.due_date ASC, t.created_at ASC`
    )
    .all(user.id);
  return NextResponse.json({ tasks });
}
