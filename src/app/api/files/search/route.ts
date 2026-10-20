import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getOwnedFile } from "@/lib/files";

function buildMatchQuery(q: string): string | null {
  const tokens = q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" ");
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const fileId = url.searchParams.get("file_id");
  const match = buildMatchQuery(q);
  if (!match) {
    return NextResponse.json({ error: "EMPTY_QUERY", message: "请输入检索关键词" }, { status: 400 });
  }
  if (fileId && !getOwnedFile(user.id, fileId)) {
    return NextResponse.json({ error: "NOT_FOUND", message: "文件不存在" }, { status: 404 });
  }

  const sql = `
    SELECT c.id, c.file_id, f.name AS file_name, c.ord, c.page, c.heading,
      snippet(chunk_fts, 0, '<mark>', '</mark>', '…', 24) AS snippet,
      bm25(chunk_fts) AS rank
    FROM chunk_fts
    JOIN source_chunks c ON c.rowid = chunk_fts.rowid
    JOIN source_files f ON f.id = c.file_id
    WHERE chunk_fts MATCH ? AND c.user_id = ? ${fileId ? "AND c.file_id = ?" : ""}
    ORDER BY rank
    LIMIT 50`;
  const params: unknown[] = fileId ? [match, user.id, fileId] : [match, user.id];
  let results: unknown[];
  try {
    results = db.prepare(sql).all(...params);
  } catch {
    return NextResponse.json({ error: "BAD_QUERY", message: "检索词无法解析，请换个关键词" }, { status: 400 });
  }
  return NextResponse.json({ results });
}
