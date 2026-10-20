import { db } from "@/lib/db";

export interface RetrievedChunk {
  id: string;
  file_id: string;
  file_name: string;
  page: number | null;
  text: string;
}

export interface Citation {
  file_id: string;
  file_name: string;
  page: number | null;
  snippet: string;
}

function ftsTokens(text: string): string[] {
  return text
    .replace(/[，。！？；：、（）《》""''\[\]{}.,!?;:()<>]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .slice(0, 6);
}

export function retrieveCourseChunks(courseId: string, queryText: string, limit = 5): RetrievedChunk[] {
  const tokens = ftsTokens(queryText);
  if (tokens.length > 0) {
    const match = tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");
    try {
      const rows = db
        .prepare(
          `SELECT c.id, c.file_id, f.name AS file_name, c.page, c.text
           FROM chunk_fts
           JOIN source_chunks c ON c.rowid = chunk_fts.rowid
           JOIN source_files f ON f.id = c.file_id
           WHERE chunk_fts MATCH ?
             AND c.file_id IN (SELECT source_file_id FROM course_sources WHERE course_id = ?)
           ORDER BY bm25(chunk_fts)
           LIMIT ?`
        )
        .all(match, courseId, limit) as RetrievedChunk[];
      if (rows.length > 0) return rows;
    } catch {
      // 检索失败时退化为顺序取样
    }
  }
  return db
    .prepare(
      `SELECT c.id, c.file_id, f.name AS file_name, c.page, c.text
       FROM source_chunks c
       JOIN source_files f ON f.id = c.file_id
       WHERE c.file_id IN (SELECT source_file_id FROM course_sources WHERE course_id = ?)
       ORDER BY c.file_id, c.ord
       LIMIT ?`
    )
    .all(courseId, limit) as RetrievedChunk[];
}

export function toCitation(chunk: RetrievedChunk): Citation {
  return {
    file_id: chunk.file_id,
    file_name: chunk.file_name,
    page: chunk.page,
    snippet: chunk.text.slice(0, 160),
  };
}

export function resolveCitations(indices: number[], chunks: RetrievedChunk[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const i of indices) {
    const chunk = chunks[i];
    if (!chunk || seen.has(chunk.id)) continue;
    seen.add(chunk.id);
    out.push(toCitation(chunk));
  }
  return out;
}

export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => `[${i}] ${c.file_name}${c.page !== null ? ` 第${c.page}页` : ""}：${c.text.slice(0, 300)}`)
    .join("\n");
}
