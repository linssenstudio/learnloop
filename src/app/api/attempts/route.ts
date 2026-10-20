import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { llmErrorResponse } from "@/lib/course-llm";
import { gradeAnswer, recordAttempt, type QuestionRow } from "@/lib/tutor/grading";

const bodySchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1, "请填写答案").max(4000),
  sessionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 }
    );
  }

  const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(parsed.data.questionId) as
    | QuestionRow
    | undefined;
  if (!question) return NextResponse.json({ error: "NOT_FOUND", message: "题目不存在" }, { status: 404 });
  const owned = db
    .prepare("SELECT id FROM courses WHERE id = ? AND user_id = ?")
    .get(question.course_id, user.id);
  if (!owned) return NextResponse.json({ error: "NOT_FOUND", message: "题目不存在" }, { status: 404 });

  try {
    const grade = await gradeAnswer(question, parsed.data.answer, user.id);
    const attemptId = recordAttempt({
      userId: user.id,
      question,
      sessionId: parsed.data.sessionId ?? null,
      answer: parsed.data.answer,
      grade,
    });
    const mastery = question.concept
      ? (db
          .prepare("SELECT score FROM mastery_states WHERE user_id = ? AND course_id = ? AND concept = ?")
          .get(user.id, question.course_id, question.concept) as { score: number } | undefined)
      : undefined;
    return NextResponse.json({
      attemptId,
      correct: grade.correct,
      score: grade.score,
      feedback: grade.feedback,
      errorTag: grade.errorTag,
      explanation: question.explanation,
      masteryScore: mastery?.score ?? null,
    });
  } catch (err) {
    return llmErrorResponse(err);
  }
}
