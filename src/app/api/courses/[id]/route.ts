import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getCourseDetail, getOwnedCourse } from "@/lib/courses";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  goalText: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  durationText: z.string().nullable().optional(),
  outcome: z.string().nullable().optional(),
  status: z.enum(["planning", "active", "archived"]).optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  if (!getOwnedCourse(user.id, id)) {
    return NextResponse.json({ error: "NOT_FOUND", message: "课程不存在" }, { status: 404 });
  }
  const detail = getCourseDetail(id);
  return NextResponse.json(detail);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  if (!getOwnedCourse(user.id, id)) {
    return NextResponse.json({ error: "NOT_FOUND", message: "课程不存在" }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 }
    );
  }
  const d = parsed.data;
  const sets: string[] = [];
  const values: unknown[] = [];
  const fields: Record<string, unknown> = {
    title: d.title,
    goal_text: d.goalText,
    level: d.level,
    duration_text: d.durationText,
    outcome: d.outcome,
    status: d.status,
  };
  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      values.push(val);
    }
  }
  if (sets.length > 0) {
    db.prepare(`UPDATE courses SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  if (!getOwnedCourse(user.id, id)) {
    return NextResponse.json({ error: "NOT_FOUND", message: "课程不存在" }, { status: 404 });
  }
  db.prepare("DELETE FROM courses WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
