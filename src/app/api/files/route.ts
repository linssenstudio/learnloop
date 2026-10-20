import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { runParseJob } from "@/lib/parse";
import { ACCEPTED_TYPES, MAX_FILE_SIZE, extOf, listFiles } from "@/lib/files";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });
  return NextResponse.json({ files: listFiles(user.id) });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED", message: "未登录" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "NO_FILE", message: "请选择要上传的文件" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "EMPTY_FILE", message: "文件内容为空" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "FILE_TOO_LARGE", message: "文件超过 30MB 限制" }, { status: 413 });
  }
  const ext = extOf(file.name);
  const mimes = ACCEPTED_TYPES[ext];
  const mimeOk = !file.type || file.type === "application/octet-stream" || (mimes?.includes(file.type) ?? false);
  if (!mimes || !mimeOk) {
    return NextResponse.json(
      { error: "UNSUPPORTED_TYPE", message: "仅支持 PDF / DOCX / PPTX 格式" },
      { status: 415 }
    );
  }

  const fileId = randomUUID();
  const dir = path.join(process.cwd(), "data", "uploads", user.id);
  fs.mkdirSync(dir, { recursive: true });
  const storagePath = path.join(dir, `${fileId}${ext}`);
  fs.writeFileSync(storagePath, Buffer.from(await file.arrayBuffer()));

  const now = Date.now();
  const jobId = randomUUID();
  db.prepare(
    "INSERT INTO source_files (id, user_id, name, mime, size, storage_path, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'parsing', ?)"
  ).run(fileId, user.id, file.name, file.type || mimes[0], file.size, storagePath, now);
  db.prepare(
    "INSERT INTO jobs (id, user_id, kind, ref_id, status, progress, created_at, updated_at) VALUES (?, ?, 'parse_file', ?, 'queued', 0, ?, ?)"
  ).run(jobId, user.id, fileId, now, now);

  after(() => runParseJob(jobId, fileId));

  return NextResponse.json({ file: listFiles(user.id).find((f) => f.id === fileId) }, { status: 201 });
}
