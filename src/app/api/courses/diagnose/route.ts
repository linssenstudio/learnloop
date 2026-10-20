import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chatJson } from "@/lib/llm";
import { getCurrentUser } from "@/lib/session";
import { buildDiagnosePrompt, diagnosticSchema, getSourceContext, llmErrorResponse } from "@/lib/course-llm";

const bodySchema = z.object({
  goal: z.string().min(1, "请填写学习目标"),
  level: z.string().optional(),
  duration: z.string().optional(),
  outcome: z.string().optional(),
  sourceFileIds: z.array(z.string()).optional(),
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
    const { sourceFileIds, ...goal } = parsed.data;
    const context = getSourceContext(user.id, sourceFileIds);
    const prompt = buildDiagnosePrompt(goal, context);
    const result = await chatJson({
      ...prompt,
      schema: diagnosticSchema,
      maxTokens: 4000,
      userId: user.id,
    });
    return NextResponse.json({
      questions: result.questions.map((q) => ({ id: randomUUID(), ...q })),
    });
  } catch (err) {
    return llmErrorResponse(err);
  }
}
