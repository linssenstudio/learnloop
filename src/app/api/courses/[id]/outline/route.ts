import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { getOwnedCourse, replaceOutline } from "@/lib/courses";

const outlinePatchSchema = z.object({
  units: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().min(1, "单元标题不能为空"),
        summary: z.string().optional(),
        lessons: z
          .array(
            z.object({
              id: z.string().optional(),
              title: z.string().min(1, "课时标题不能为空"),
              objectives: z.array(z.string()).max(8),
              est_minutes: z.number().int().min(5).max(240).optional(),
            })
          )
          .min(1),
      })
    )
    .min(1, "至少保留一个单元"),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  if (!getOwnedCourse(user.id, id)) {
    return NextResponse.json({ error: "NOT_FOUND", message: "课程不存在" }, { status: 404 });
  }
  const parsed = outlinePatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "参数不合法" },
      { status: 400 }
    );
  }
  replaceOutline(id, parsed.data.units);
  return NextResponse.json({ ok: true });
}
