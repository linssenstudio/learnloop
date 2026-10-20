import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { llmErrorResponse } from "@/lib/course-llm";
import { respond } from "@/lib/tutor/engine";
import { generateArtifacts } from "@/lib/tutor/artifacts";

const bodySchema = z
  .object({
    answer: z.string().max(4000).optional(),
    question: z.string().max(2000).optional(),
  })
  .refine((v) => (v.answer?.trim() || v.question?.trim()) !== undefined && (v.answer?.trim() || v.question?.trim()) !== "", {
    message: "请提供作答或提问",
  });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const owned = db.prepare("SELECT id, course_id, lesson_id FROM teaching_sessions WHERE id = ? AND user_id = ?").get(id, user.id) as
    | { id: string; course_id: string; lesson_id: string }
    | undefined;
  if (!owned) return NextResponse.json({ error: "NOT_FOUND", message: "会话不存在" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 }
    );
  }

  try {
    const result = await respond(id, user.id, parsed.data);
    if (result.artifactsJobId) {
      const jobId = result.artifactsJobId;
      after(() => generateArtifacts(jobId, user.id, owned.course_id, owned.lesson_id));
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && !(err as { name?: string }).name?.startsWith("Llm")) {
      return NextResponse.json({ error: "BAD_REQUEST", message: err.message }, { status: 400 });
    }
    return llmErrorResponse(err);
  }
}
