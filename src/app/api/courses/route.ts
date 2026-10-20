import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { createCourse, listCourses } from "@/lib/courses";

const editableOutlineSchema = z.object({
  title: z.string().default(""),
  units: z
    .array(
      z.object({
        title: z.string().min(1, "单元标题不能为空"),
        summary: z.string().default(""),
        lessons: z
          .array(
            z.object({
              title: z.string().min(1, "课时标题不能为空"),
              objectives: z.array(z.string().min(1)).min(1, "每节课至少一条学习目标").max(8),
              est_minutes: z.number().int().min(5).max(240),
            })
          )
          .min(1, "每个单元至少一节课"),
      })
    )
    .min(1, "至少一个单元"),
});

const createSchema = z.object({
  title: z.string().min(1, "请填写课程标题").max(120),
  goalText: z.string().optional(),
  level: z.string().optional(),
  durationText: z.string().optional(),
  outcome: z.string().optional(),
  outline: editableOutlineSchema,
  sourceFileIds: z.array(z.string()).optional(),
  diagnostics: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()),
        answer: z.string(),
        userAnswer: z.string().nullable(),
        correct: z.boolean().nullable(),
        ord: z.number().int(),
      })
    )
    .optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  return NextResponse.json({ courses: listCourses(user.id) });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const id = createCourse({
    userId: user.id,
    title: d.title,
    goalText: d.goalText,
    level: d.level,
    durationText: d.durationText,
    outcome: d.outcome,
    outline: d.outline,
    sourceFileIds: d.sourceFileIds,
    diagnostics: d.diagnostics,
  });
  return NextResponse.json({ id }, { status: 201 });
}
