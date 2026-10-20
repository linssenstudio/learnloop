import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { CourseOutline } from "@/lib/course-llm";

export interface CourseRow {
  id: string;
  user_id: string;
  title: string;
  goal_text: string | null;
  level: string | null;
  duration_text: string | null;
  outcome: string | null;
  status: "planning" | "active" | "archived";
  created_at: number;
}

export interface DiagnosticInput {
  question: string;
  options: string[];
  answer: string;
  userAnswer: string | null;
  correct: boolean | null;
  ord: number;
}

export function getOwnedCourse(userId: string, courseId: string): CourseRow | null {
  const row = db
    .prepare("SELECT * FROM courses WHERE id = ? AND user_id = ?")
    .get(courseId, userId) as CourseRow | undefined;
  return row ?? null;
}

export function createCourse(params: {
  userId: string;
  title: string;
  goalText?: string;
  level?: string;
  durationText?: string;
  outcome?: string;
  outline: CourseOutline;
  sourceFileIds?: string[];
  diagnostics?: DiagnosticInput[];
}): string {
  const courseId = randomUUID();
  const now = Date.now();
  db.transaction(() => {
    db.prepare(
      "INSERT INTO courses (id, user_id, title, goal_text, level, duration_text, outcome, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)"
    ).run(
      courseId,
      params.userId,
      params.title,
      params.goalText ?? null,
      params.level ?? null,
      params.durationText ?? null,
      params.outcome ?? null,
      now
    );
    insertOutline(courseId, params.outline);
    for (const fileId of (params.sourceFileIds ?? []).slice(0, 20)) {
      const owned = db
        .prepare("SELECT id FROM source_files WHERE id = ? AND user_id = ? AND status = 'ready'")
        .get(fileId, params.userId);
      if (owned) {
        db.prepare("INSERT OR IGNORE INTO course_sources (course_id, source_file_id) VALUES (?, ?)").run(courseId, fileId);
      }
    }
    for (const d of params.diagnostics ?? []) {
      db.prepare(
        "INSERT INTO course_diagnostics (id, course_id, question, options, answer, user_answer, correct, ord) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        randomUUID(),
        courseId,
        d.question,
        JSON.stringify(d.options),
        d.answer,
        d.userAnswer,
        d.correct === null ? null : d.correct ? 1 : 0,
        d.ord
      );
    }
  })();
  return courseId;
}

function insertOutline(courseId: string, outline: CourseOutline): void {
  const unitStmt = db.prepare(
    "INSERT INTO course_units (id, course_id, ord, title, summary, status) VALUES (?, ?, ?, ?, ?, 'pending')"
  );
  const lessonStmt = db.prepare(
    "INSERT INTO lessons (id, course_id, unit_id, ord, title, objectives, est_minutes, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')"
  );
  outline.units.forEach((u, ui) => {
    const unitId = randomUUID();
    unitStmt.run(unitId, courseId, ui, u.title, u.summary);
    u.lessons.forEach((l, li) => {
      lessonStmt.run(randomUUID(), courseId, unitId, li, l.title, JSON.stringify(l.objectives), l.est_minutes);
    });
  });
}

export interface OutlinePatchUnit {
  id?: string;
  title: string;
  summary?: string;
  lessons: { id?: string; title: string; objectives: string[]; est_minutes?: number }[];
}

export function replaceOutline(courseId: string, units: OutlinePatchUnit[]): void {
  const existingUnits = db
    .prepare("SELECT id FROM course_units WHERE course_id = ?")
    .all(courseId) as { id: string }[];
  const existingUnitIds = new Set(existingUnits.map((u) => u.id));
  const existingLessons = db
    .prepare("SELECT id, status FROM lessons WHERE course_id = ?")
    .all(courseId) as { id: string; status: string }[];
  const lessonStatus = new Map(existingLessons.map((l) => [l.id, l.status]));

  const keepUnitIds = new Set(units.map((u) => u.id).filter((id): id is string => !!id && existingUnitIds.has(id)));
  const keepLessonIds = new Set(
    units.flatMap((u) => u.lessons.map((l) => l.id)).filter((id): id is string => !!id && lessonStatus.has(id))
  );

  db.transaction(() => {
    for (const id of existingUnitIds) {
      if (!keepUnitIds.has(id)) db.prepare("DELETE FROM course_units WHERE id = ?").run(id);
    }
    for (const l of existingLessons) {
      if (!keepLessonIds.has(l.id)) db.prepare("DELETE FROM lessons WHERE id = ?").run(l.id);
    }
    const updateUnit = db.prepare("UPDATE course_units SET ord = ?, title = ?, summary = ? WHERE id = ?");
    const insertUnit = db.prepare(
      "INSERT INTO course_units (id, course_id, ord, title, summary, status) VALUES (?, ?, ?, ?, ?, 'pending')"
    );
    const updateLesson = db.prepare(
      "UPDATE lessons SET unit_id = ?, ord = ?, title = ?, objectives = ?, est_minutes = ? WHERE id = ?"
    );
    const insertLesson = db.prepare(
      "INSERT INTO lessons (id, course_id, unit_id, ord, title, objectives, est_minutes, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')"
    );
    units.forEach((u, ui) => {
      const unitId = u.id && keepUnitIds.has(u.id) ? u.id : randomUUID();
      if (keepUnitIds.has(unitId)) updateUnit.run(ui, u.title, u.summary ?? "", unitId);
      else insertUnit.run(unitId, courseId, ui, u.title, u.summary ?? "");
      u.lessons.forEach((l, li) => {
        const objectives = JSON.stringify(l.objectives);
        const est = l.est_minutes ?? 30;
        if (l.id && keepLessonIds.has(l.id)) {
          updateLesson.run(unitId, li, l.title, objectives, est, l.id);
        } else {
          insertLesson.run(randomUUID(), courseId, unitId, li, l.title, objectives, est);
        }
      });
    });
  })();
}

export interface CourseListItem extends CourseRow {
  unit_count: number;
  lesson_count: number;
  done_count: number;
}

export function listCourses(userId: string): CourseListItem[] {
  return db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM course_units u WHERE u.course_id = c.id) AS unit_count,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.status = 'done') AS done_count
       FROM courses c WHERE c.user_id = ? ORDER BY c.created_at DESC`
    )
    .all(userId) as CourseListItem[];
}

export interface UnitNode {
  id: string;
  ord: number;
  title: string;
  summary: string;
  status: string;
  lessons: LessonNode[];
}

export interface LessonNode {
  id: string;
  ord: number;
  title: string;
  objectives: string[];
  est_minutes: number | null;
  status: string;
}

export interface CourseDetail {
  course: CourseRow;
  units: UnitNode[];
  sources: { id: string; name: string; page_count: number | null }[];
  diagnostics: {
    id: string;
    question: string;
    options: string[];
    answer: string;
    user_answer: string | null;
    correct: number | null;
    ord: number;
  }[];
  progress: { total: number; done: number };
}

export function getCourseDetail(courseId: string): CourseDetail | null {
  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as CourseRow | undefined;
  if (!course) return null;
  const units = db
    .prepare("SELECT * FROM course_units WHERE course_id = ? ORDER BY ord ASC")
    .all(courseId) as { id: string; ord: number; title: string; summary: string; status: string }[];
  const lessons = db
    .prepare("SELECT * FROM lessons WHERE course_id = ? ORDER BY ord ASC")
    .all(courseId) as {
    id: string;
    unit_id: string;
    ord: number;
    title: string;
    objectives: string | null;
    est_minutes: number | null;
    status: string;
  }[];
  const sources = db
    .prepare(
      "SELECT f.id, f.name, f.page_count FROM course_sources cs JOIN source_files f ON f.id = cs.source_file_id WHERE cs.course_id = ?"
    )
    .all(courseId) as { id: string; name: string; page_count: number | null }[];
  const diagnostics = db
    .prepare("SELECT * FROM course_diagnostics WHERE course_id = ? ORDER BY ord ASC")
    .all(courseId) as {
    id: string;
    question: string;
    options: string | null;
    answer: string;
    user_answer: string | null;
    correct: number | null;
    ord: number;
  }[];

  const parseJson = (s: string | null): string[] => {
    if (!s) return [];
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  };

  return {
    course,
    units: units.map((u) => ({
      id: u.id,
      ord: u.ord,
      title: u.title,
      summary: u.summary ?? "",
      status: u.status,
      lessons: lessons
        .filter((l) => l.unit_id === u.id)
        .map((l) => ({
          id: l.id,
          ord: l.ord,
          title: l.title,
          objectives: parseJson(l.objectives),
          est_minutes: l.est_minutes,
          status: l.status,
        })),
    })),
    sources,
    diagnostics: diagnostics.map((d) => ({ ...d, options: parseJson(d.options) })),
    progress: { total: lessons.length, done: lessons.filter((l) => l.status === "done").length },
  };
}
