import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getOwnedFile } from "@/lib/files";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  if (!getOwnedFile(user.id, id)) {
    return NextResponse.json({ error: "NOT_FOUND", message: "文件不存在" }, { status: 404 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? 20) || 20));
  const total = (db.prepare("SELECT COUNT(*) c FROM source_chunks WHERE file_id = ?").get(id) as { c: number }).c;
  const chunks = db
    .prepare("SELECT id, ord, page, heading, text FROM source_chunks WHERE file_id = ? ORDER BY ord ASC LIMIT ? OFFSET ?")
    .all(id, size, (page - 1) * size);
  return NextResponse.json({ chunks, total, page, size });
}
