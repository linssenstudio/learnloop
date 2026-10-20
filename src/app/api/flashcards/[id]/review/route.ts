import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { reviewFlashcard } from "@/lib/flashcards";

const bodySchema = z.object({
  grade: z.number().int().min(0).max(3),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "grade 需为 0-3 的整数" }, { status: 400 });
  }
  try {
    const card = reviewFlashcard(user.id, id, parsed.data.grade);
    return NextResponse.json({
      card: { id: card.id, ease: card.ease, interval_days: card.interval_days, due_at: card.due_at, reps: card.reps },
    });
  } catch {
    return NextResponse.json({ error: "NOT_FOUND", message: "卡片不存在" }, { status: 404 });
  }
}
