import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export interface FlashcardRow {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string | null;
  front: string;
  back: string;
  source_ref: string | null;
  ease: number;
  interval_days: number;
  due_at: number | null;
  reps: number;
  created_at: number;
}

export function listDueFlashcards(userId: string, courseId: string): { cards: FlashcardRow[]; total: number } {
  const now = Date.now();
  const cards = db
    .prepare(
      "SELECT * FROM flashcards WHERE user_id = ? AND course_id = ? AND (due_at IS NULL OR due_at <= ?) ORDER BY due_at ASC LIMIT 50"
    )
    .all(userId, courseId, now) as FlashcardRow[];
  const total = (
    db.prepare("SELECT COUNT(*) c FROM flashcards WHERE user_id = ? AND course_id = ?").get(userId, courseId) as { c: number }
  ).c;
  return { cards, total };
}

export function reviewFlashcard(userId: string, cardId: string, grade: number): FlashcardRow {
  const card = db.prepare("SELECT * FROM flashcards WHERE id = ? AND user_id = ?").get(cardId, userId) as
    | FlashcardRow
    | undefined;
  if (!card) throw new Error("卡片不存在");

  let { ease, interval_days: interval, reps } = card;
  if (grade <= 1) {
    reps = 0;
    interval = 0.02;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps += 1;
    interval = reps === 1 ? 1 : Math.max(1, interval * ease);
    ease = Math.min(3, Math.max(1.3, ease + (grade === 3 ? 0.15 : 0)));
  }
  const dueAt = Date.now() + Math.round(interval * 24 * 60 * 60 * 1000);

  db.prepare("UPDATE flashcards SET ease = ?, interval_days = ?, reps = ?, due_at = ? WHERE id = ?").run(
    ease,
    interval,
    reps,
    dueAt,
    cardId
  );
  db.prepare("INSERT INTO review_events (id, user_id, flashcard_id, grade, at) VALUES (?, ?, ?, ?, ?)").run(
    randomUUID(),
    userId,
    cardId,
    grade,
    Date.now()
  );
  return db.prepare("SELECT * FROM flashcards WHERE id = ?").get(cardId) as FlashcardRow;
}
