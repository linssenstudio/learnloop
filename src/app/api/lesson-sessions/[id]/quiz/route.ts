import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { chatJson } from "@/lib/llm";
import { getCurrentUser } from "@/lib/session";
import { llmErrorResponse } from "@/lib/course-llm";
import { insertQuestion, type QuestionRow } from "@/lib/tutor/grading";
import { formatChunksForPrompt, retrieveCourseChunks } from "@/lib/tutor/retrieval";
import type { SessionRow } from "@/lib/tutor/engine";

const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        concept: z.string().min(1),
        type: z.enum(["single", "multi", "short"]),
        difficulty: z.number().int().min(1).max(5),
        question: z.string().min(1),
        options: z.array(z.string().min(1)).length(4).optional(),
        answer: z.string().min(1),
        explanation: z.string().min(1),
      })
    )
    .min(3)
    .max(5),
});

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const session = db.prepare("SELECT * FROM teaching_sessions WHERE id = ? AND user_id = ?").get(id, user.id) as
    | SessionRow
    | undefined;
  if (!session) return NextResponse.json({ error: "NOT_FOUND", message: "会话不存在" }, { status: 404 });

  try {
    const lesson = db.prepare("SELECT * FROM lessons WHERE id = ?").get(session.lesson_id) as
      | { title: string; objectives: string | null }
      | undefined;
    const course = db.prepare("SELECT title FROM courses WHERE id = ?").get(session.course_id) as { title: string };
    const chunks = retrieveCourseChunks(session.course_id, lesson?.title ?? "", 4);
    const chunkText = chunks.length > 0 ? `\n资料片段：\n${formatChunksForPrompt(chunks)}\n` : "";

    const result = await chatJson({
      system: "你是一位出题老师。根据本课内容出 3-5 道随堂测验题，覆盖不同概念与难度，附解析。",
      user: `课程：${course.title}\n课时：${lesson?.title ?? ""}\n学习目标：${lesson?.objectives ?? ""}\n${chunkText}\n输出 JSON：{"questions":[{"concept":"...","type":"single或short","difficulty":1到5,"question":"...","options":["...","...","...","..."](single 必填),"answer":"...","explanation":"..."}]}`,
      schema: quizSchema,
      maxTokens: 5000,
      userId: user.id,
    });

    const inserted: QuestionRow[] = [];
    db.transaction(() => {
      for (const q of result.questions) {
        inserted.push(
          insertQuestion({
            courseId: session.course_id,
            lessonId: session.lesson_id,
            concept: q.concept,
            type: q.type,
            difficulty: q.difficulty,
            question: q.question,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
          })
        );
      }
    })();
    return NextResponse.json(
      {
        questions: inserted.map((q) => ({
          id: q.id,
          concept: q.concept,
          type: q.type,
          difficulty: q.difficulty,
          question: q.question,
          options: q.options ? (JSON.parse(q.options) as string[]) : undefined,
        })),
      },
      { status: 201 }
    );
  } catch (err) {
    return llmErrorResponse(err);
  }
}
