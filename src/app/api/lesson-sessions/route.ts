import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getOwnedCourse } from "@/lib/courses";
import { llmErrorResponse } from "@/lib/course-llm";
import { startSession } from "@/lib/tutor/engine";

const bodySchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "参数不合法" }, { status: 400 });
  }
  const { courseId, lessonId } = parsed.data;
  if (!getOwnedCourse(user.id, courseId)) {
    return NextResponse.json({ error: "NOT_FOUND", message: "课程不存在" }, { status: 404 });
  }
  const lesson = db
    .prepare("SELECT id FROM lessons WHERE id = ? AND course_id = ?")
    .get(lessonId, courseId);
  if (!lesson) return NextResponse.json({ error: "NOT_FOUND", message: "课时不存在" }, { status: 404 });

  try {
    const view = await startSession(user.id, courseId, lessonId);
    return NextResponse.json(view, { status: view.resumed ? 200 : 201 });
  } catch (err) {
    return llmErrorResponse(err);
  }
}
