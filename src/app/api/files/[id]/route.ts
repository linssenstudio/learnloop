import fs from "node:fs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getOwnedFile, listFiles } from "@/lib/files";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const file = getOwnedFile(user.id, id);
  if (!file) return NextResponse.json({ error: "NOT_FOUND", message: "文件不存在" }, { status: 404 });
  const item = listFiles(user.id).find((f) => f.id === id);
  const chunkCount = (db.prepare("SELECT COUNT(*) c FROM source_chunks WHERE file_id = ?").get(id) as { c: number }).c;
  return NextResponse.json({ file: { ...item, chunk_count: chunkCount } });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const file = getOwnedFile(user.id, id);
  if (!file) return NextResponse.json({ error: "NOT_FOUND", message: "文件不存在" }, { status: 404 });

  db.prepare("DELETE FROM jobs WHERE kind = 'parse_file' AND ref_id = ?").run(id);
  db.prepare("DELETE FROM source_files WHERE id = ?").run(id);
  try {
    fs.unlinkSync(file.storage_path);
  } catch {
    // 磁盘文件已不存在时忽略
  }
  return NextResponse.json({ ok: true });
}
