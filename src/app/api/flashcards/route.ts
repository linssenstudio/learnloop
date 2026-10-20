import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getOwnedCourse } from "@/lib/courses";
import { listDueFlashcards } from "@/lib/flashcards";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const courseId = new URL(req.url).searchParams.get("courseId");
  if (!courseId || !getOwnedCourse(user.id, courseId)) {
    return NextResponse.json({ error: "NOT_FOUND", message: "课程不存在" }, { status: 404 });
  }
  const { cards, total } = listDueFlashcards(user.id, courseId);
  return NextResponse.json({
    cards: cards.map((c) => ({
      id: c.id,
      front: c.front,
      back: c.back,
      source_ref: c.source_ref,
      ease: c.ease,
      interval_days: c.interval_days,
      due_at: c.due_at,
      reps: c.reps,
    })),
    total,
  });
}
