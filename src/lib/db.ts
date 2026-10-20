import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "learnloop.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

const globalForDb = globalThis as unknown as { __learnloopDb?: Database.Database };

function createDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export const db: Database.Database = globalForDb.__learnloopDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__learnloopDb = db;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS source_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'parsing' CHECK (status IN ('parsing','ready','failed')),
  error TEXT,
  page_count INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_source_files_user_id ON source_files(user_id);

CREATE TABLE IF NOT EXISTS source_chunks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL,
  page INTEGER,
  heading TEXT,
  text TEXT NOT NULL,
  embedding BLOB,
  UNIQUE (file_id, ord)
);
CREATE INDEX IF NOT EXISTS idx_source_chunks_user_id ON source_chunks(user_id);

CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
  text,
  content='source_chunks',
  content_rowid='rowid',
  tokenize='trigram'
);

CREATE TRIGGER IF NOT EXISTS chunk_fts_insert AFTER INSERT ON source_chunks BEGIN
  INSERT INTO chunk_fts(rowid, text) VALUES (new.rowid, new.text);
END;
CREATE TRIGGER IF NOT EXISTS chunk_fts_delete AFTER DELETE ON source_chunks BEGIN
  INSERT INTO chunk_fts(chunk_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;
CREATE TRIGGER IF NOT EXISTS chunk_fts_update AFTER UPDATE ON source_chunks BEGIN
  INSERT INTO chunk_fts(chunk_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO chunk_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal_text TEXT,
  level TEXT,
  duration_text TEXT,
  outcome TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','archived')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id);

CREATE TABLE IF NOT EXISTS course_units (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','done'))
);
CREATE INDEX IF NOT EXISTS idx_course_units_course_id ON course_units(course_id);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  unit_id TEXT REFERENCES course_units(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL,
  title TEXT NOT NULL,
  objectives TEXT,
  est_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','done'))
);
CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_unit_id ON lessons(unit_id);

CREATE TABLE IF NOT EXISTS course_sources (
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  source_file_id TEXT NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, source_file_id)
);

CREATE TABLE IF NOT EXISTS course_diagnostics (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options TEXT,
  answer TEXT,
  user_answer TEXT,
  correct INTEGER,
  ord INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_course_diagnostics_course_id ON course_diagnostics(course_id);

CREATE TABLE IF NOT EXISTS teaching_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'explain' CHECK (state IN ('explain','check','remediate','advance','apply','summarize','done')),
  step INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_teaching_sessions_user_id ON teaching_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_teaching_sessions_course_id ON teaching_sessions(course_id);

CREATE TABLE IF NOT EXISTS tutor_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES teaching_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('tutor','student','system')),
  kind TEXT NOT NULL CHECK (kind IN ('narration','question','answer','feedback','remediation','note')),
  content TEXT NOT NULL,
  citations TEXT,
  step INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tutor_messages_session_id ON tutor_messages(session_id);

CREATE TABLE IF NOT EXISTS board_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES teaching_sessions(id) ON DELETE CASCADE,
  step INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_board_actions_session_id ON board_actions(session_id);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  concept TEXT,
  type TEXT NOT NULL CHECK (type IN ('single','multi','short')),
  difficulty INTEGER NOT NULL DEFAULT 1,
  question TEXT NOT NULL,
  options TEXT,
  answer TEXT,
  explanation TEXT
);
CREATE INDEX IF NOT EXISTS idx_questions_course_id ON questions(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_lesson_id ON questions(lesson_id);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES teaching_sessions(id) ON DELETE SET NULL,
  answer TEXT,
  correct INTEGER NOT NULL,
  score REAL,
  error_tag TEXT,
  hints_used INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question_id ON attempts(question_id);

CREATE TABLE IF NOT EXISTS mastery_states (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  last_at INTEGER,
  PRIMARY KEY (user_id, course_id, concept)
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content_md TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_course_id ON notes(course_id);

CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  source_ref TEXT,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0,
  due_at INTEGER,
  reps INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_due_at ON flashcards(due_at);

CREATE TABLE IF NOT EXISTS review_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flashcard_id TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_events_user_id ON review_events(user_id);
CREATE INDEX IF NOT EXISTS idx_review_events_flashcard_id ON review_events(flashcard_id);

CREATE TABLE IF NOT EXISTS study_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('new','review','practice')),
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_study_tasks_user_id ON study_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_study_tasks_due_date ON study_tasks(due_date);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('parse_file','plan_course','generate_quiz','generate_artifact')),
  ref_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  progress INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON usage_records(user_id);
`;

function migrateChunkFtsToTrigram(): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'chunk_fts'")
    .get() as { sql: string } | undefined;
  if (row && !row.sql.includes("trigram")) {
    db.exec(`
      DROP TRIGGER IF EXISTS chunk_fts_insert;
      DROP TRIGGER IF EXISTS chunk_fts_delete;
      DROP TRIGGER IF EXISTS chunk_fts_update;
      DROP TABLE chunk_fts;
    `);
  }
}

export function initDb(): void {
  migrateChunkFtsToTrigram();
  db.exec(SCHEMA);
  const ftsRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'chunk_fts'")
    .get() as { sql: string } | undefined;
  if (ftsRow) {
    const needsRebuild =
      (db.prepare("SELECT COUNT(*) c FROM source_chunks").get() as { c: number }).c > 0 &&
      (db.prepare("SELECT COUNT(*) c FROM chunk_fts").get() as { c: number }).c === 0;
    if (needsRebuild) {
      db.exec("INSERT INTO chunk_fts(chunk_fts) VALUES ('rebuild')");
    }
  }
}

initDb();
