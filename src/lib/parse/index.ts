import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { chunkUnits, type RawUnit } from "./chunk";
import { parsePdf } from "./pdf";
import { parseDocx } from "./docx";
import { parsePptx } from "./pptx";

interface FileRow {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  status: string;
}

export async function runParseJob(jobId: string, fileId: string): Promise<void> {
  const claimed = db
    .prepare("UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ? AND status = 'queued'")
    .run(Date.now(), jobId);
  if (claimed.changes === 0) return;

  const setProgress = (progress: number) =>
    db.prepare("UPDATE jobs SET progress = ?, updated_at = ? WHERE id = ?").run(progress, Date.now(), jobId);

  try {
    const file = db.prepare("SELECT id, user_id, name, storage_path, status FROM source_files WHERE id = ?").get(fileId) as
      | FileRow
      | undefined;
    if (!file) throw new Error("文件记录不存在");
    if (file.status !== "parsing") return;

    const buffer = fs.readFileSync(file.storage_path);
    setProgress(10);

    const ext = path.extname(file.name).toLowerCase();
    let units: RawUnit[];
    if (ext === ".pdf") units = await parsePdf(buffer);
    else if (ext === ".docx") units = await parseDocx(buffer);
    else if (ext === ".pptx") units = await parsePptx(buffer);
    else throw new Error(`不支持的文件类型：${ext}`);
    setProgress(60);

    const chunks = chunkUnits(units);
    if (chunks.reduce((sum, c) => sum + c.text.trim().length, 0) === 0) {
      throw new Error("未能从文件中提取到文本内容，可能是扫描件（图片型 PDF）或空文档");
    }
    const pageCount = ext === ".pdf" || ext === ".pptx" ? units.length : null;

    const insert = db.prepare(
      "INSERT INTO source_chunks (id, user_id, file_id, ord, page, heading, text) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    db.transaction(() => {
      db.prepare("DELETE FROM source_chunks WHERE file_id = ?").run(fileId);
      chunks.forEach((c, i) => insert.run(randomUUID(), file.user_id, fileId, i, c.page, c.heading, c.text));
      db.prepare("UPDATE source_files SET status = 'ready', page_count = ?, error = NULL WHERE id = ?").run(pageCount, fileId);
      db.prepare("UPDATE jobs SET status = 'done', progress = 100, updated_at = ? WHERE id = ?").run(Date.now(), jobId);
    })();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.prepare("UPDATE source_files SET status = 'failed', error = ? WHERE id = ?").run(message, fileId);
    db.prepare("UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").run(message, Date.now(), jobId);
  }
}
