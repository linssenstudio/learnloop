import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { LlmNotConfiguredError, LlmRequestError } from "@/lib/llm";

export const diagnosticSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(z.string().min(1)).length(4),
        answer: z.string().min(1),
        rationale: z.string().min(1),
      })
    )
    .min(3)
    .max(5),
});

export const outlineSchema = z.object({
  title: z.string().min(1),
  units: z
    .array(
      z.object({
        title: z.string().min(1),
        summary: z.string().default(""),
        lessons: z
          .array(
            z.object({
              title: z.string().min(1),
              objectives: z.array(z.string().min(1)).min(2).max(4),
              est_minutes: z.number().int().min(5).max(240),
            })
          )
          .min(2)
          .max(4),
      })
    )
    .min(5),
});

export type DiagnosticResult = z.infer<typeof diagnosticSchema>;
export type CourseOutline = z.infer<typeof outlineSchema>;

export interface GoalInput {
  goal: string;
  level?: string;
  duration?: string;
  outcome?: string;
}

export function getSourceContext(userId: string, fileIds: string[] | undefined): string {
  if (!fileIds || fileIds.length === 0) return "";
  const parts: string[] = [];
  for (const fileId of fileIds.slice(0, 5)) {
    const file = db
      .prepare("SELECT id, name FROM source_files WHERE id = ? AND user_id = ? AND status = 'ready'")
      .get(fileId, userId) as { id: string; name: string } | undefined;
    if (!file) continue;
    const chunks = db
      .prepare("SELECT text FROM source_chunks WHERE file_id = ? ORDER BY ord ASC LIMIT 3")
      .all(fileId) as { text: string }[];
    const excerpt = chunks.map((c) => c.text.slice(0, 400)).join("\n");
    if (excerpt.trim()) parts.push(`【资料：${file.name}】\n${excerpt}`);
  }
  return parts.join("\n\n");
}

function goalDescription(input: GoalInput): string {
  const lines = [`学习目标：${input.goal}`];
  if (input.level) lines.push(`当前基础：${input.level}`);
  if (input.duration) lines.push(`期望时长：${input.duration}`);
  if (input.outcome) lines.push(`产出目标：${input.outcome}`);
  return lines.join("\n");
}

export function buildDiagnosePrompt(input: GoalInput, sourceContext: string): { system: string; user: string } {
  return {
    system:
      "你是一位课程设计专家。根据学习目标出 3-5 道诊断性单项选择题，考查与该目标最相关的前置知识，用于判断学习者的起点水平。",
    user: `${goalDescription(input)}
${sourceContext ? `\n学习者提供的资料节选：\n${sourceContext}\n` : ""}
要求：
- 每题 4 个选项，只有 1 个正确答案
- answer 必须是 options 中某一项的原文
- rationale 用一两句话解释为什么选该项
- 输出 JSON：{"questions":[{"question":"...","options":["...","...","...","..."],"answer":"...","rationale":"..."}]}`,
  };
}

export function buildPlanPrompt(
  input: GoalInput,
  diagnosticAnswers: { question: string; userAnswer: string; correct: boolean }[],
  sourceContext: string
): { system: string; user: string } {
  const diagText =
    diagnosticAnswers.length > 0
      ? `\n诊断题作答情况：\n${diagnosticAnswers
          .map((d, i) => `${i + 1}. ${d.question} → 作答「${d.userAnswer}」（${d.correct ? "正确" : "错误"}）`)
          .join("\n")}\n请根据作答情况调整起点难度与详略。\n`
      : "";
  return {
    system:
      "你是一位课程设计专家。根据学习目标设计结构化的课程大纲，单元之间有清晰的逻辑递进，由浅入深。",
    user: `${goalDescription(input)}
${diagText}${sourceContext ? `\n学习者提供的资料节选：\n${sourceContext}\n课程应尽量围绕这些资料的内容展开。\n` : ""}
要求：
- 至少 5 个单元，单元之间有逻辑递进
- 每个单元 2-4 节课
- 每节课 2-4 条可检验的学习目标（objectives，用动词开头，如"能解释…""能独立完成…"）
- est_minutes 为每节课的估计学习分钟数（15-90 之间）
- 输出 JSON：{"title":"课程标题","units":[{"title":"...","summary":"...","lessons":[{"title":"...","objectives":["...","..."],"est_minutes":45}]}]}`,
  };
}

export function llmErrorResponse(err: unknown): NextResponse {
  if (err instanceof LlmNotConfiguredError) {
    return NextResponse.json(
      { error: "LLM_NOT_CONFIGURED", message: "请在 .env.local 配置 LLM_API_KEY" },
      { status: 503 }
    );
  }
  if (err instanceof LlmRequestError) {
    return NextResponse.json({ error: "LLM_REQUEST_FAILED", message: err.message }, { status: 502 });
  }
  throw err;
}
