import path from "node:path";
import { db } from "@/lib/db";

export const MAX_FILE_SIZE = 30 * 1024 * 1024;

export const ACCEPTED_TYPES: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
};

export function extOf(name: string): string {
  return path.extname(name).toLowerCase();
}

export interface FileListItem {
  id: string;
  name: string;
  mime: string;
  size: number;
  status: "parsing" | "ready" | "failed";
  error: string | null;
  page_count: number | null;
  created_at: number;
  progress: number | null;
}

export function listFiles(userId: string): FileListItem[] {
  return db
    .prepare(
      `SELECT f.id, f.name, f.mime, f.size, f.status, f.error, f.page_count, f.created_at,
        (SELECT j.progress FROM jobs j WHERE j.kind = 'parse_file' AND j.ref_id = f.id ORDER BY j.created_at DESC LIMIT 1) AS progress
       FROM source_files f WHERE f.user_id = ? ORDER BY f.created_at DESC`
    )
    .all(userId) as FileListItem[];
}

export interface OwnedFile {
  id: string;
  user_id: string;
  name: string;
  mime: string;
  size: number;
  storage_path: string;
  status: string;
  error: string | null;
  page_count: number | null;
  created_at: number;
}

export function getOwnedFile(userId: string, fileId: string): OwnedFile | null {
  const row = db
    .prepare("SELECT * FROM source_files WHERE id = ? AND user_id = ?")
    .get(fileId, userId) as OwnedFile | undefined;
  return row ?? null;
}
