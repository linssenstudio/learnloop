import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });

  const mastery = db
    .prepare(
      `SELECT m.course_id, c.title AS course_title, m.concept, m.score, m.attempts, m.correct, m.last_at
       FROM mastery_states m JOIN courses c ON c.id = m.course_id
       WHERE m.user_id = ?
       ORDER BY c.title, m.score ASC`
    )
    .all(user.id);

  const wrongAttempts = db
    .prepare(
      `SELECT a.id, a.answer, a.error_tag, a.created_at,
        q.question, q.answer AS correct_answer, q.explanation, q.concept, q.type,
        c.title AS course_title, c.id AS course_id
       FROM attempts a
       JOIN questions q ON q.id = a.question_id
       JOIN courses c ON c.id = q.course_id
       WHERE a.user_id = ? AND a.correct = 0
       ORDER BY a.created_at DESC
       LIMIT 100`
    )
    .all(user.id);

  return NextResponse.json({ mastery, wrongAttempts });
}
