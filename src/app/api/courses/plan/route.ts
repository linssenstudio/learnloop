import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chatJson } from "@/lib/llm";
import { getCurrentUser } from "@/lib/session";
import { buildPlanPrompt, getSourceContext, llmErrorResponse, outlineSchema } from "@/lib/course-llm";

const bodySchema = z.object({
  goal: z.string().min(1, "请填写学习目标"),
  level: z.string().optional(),
  duration: z.string().optional(),
  outcome: z.string().optional(),
  sourceFileIds: z.array(z.string()).optional(),
  diagnosticAnswers: z
    .array(
      z.object({
        question: z.string(),
        userAnswer: z.string(),
        correct: z.boolean(),
      })
    )
    .default([]),
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

  try {
    const { sourceFileIds, diagnosticAnswers, ...goal } = parsed.data;
    const context = getSourceContext(user.id, sourceFileIds);
    const prompt = buildPlanPrompt(goal, diagnosticAnswers, context);
    const outline = await chatJson({
      ...prompt,
      schema: outlineSchema,
      maxTokens: 8000,
      userId: user.id,
    });
    return NextResponse.json({ outline });
  } catch (err) {
    return llmErrorResponse(err);
  }
}
