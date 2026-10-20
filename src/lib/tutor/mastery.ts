import { db } from "@/lib/db";

export function updateMastery(userId: string, courseId: string, concept: string): number {
  const rows = db
    .prepare(
      `SELECT a.correct, a.hints_used, q.difficulty
       FROM attempts a JOIN questions q ON q.id = a.question_id
       WHERE a.user_id = ? AND q.course_id = ? AND q.concept = ?`
    )
    .all(userId, courseId, concept) as { correct: number; hints_used: number; difficulty: number }[];
  if (rows.length === 0) return 0;

  const attempts = rows.length;
  const correct = rows.filter((r) => r.correct === 1).length;
  const accuracy = correct / attempts;
  const difficultyWeight = rows.reduce((s, r) => s + (r.difficulty || 1), 0) / attempts / 5;
  const hintRate = Math.min(1, rows.reduce((s, r) => s + (r.hints_used || 0), 0) / attempts);
  const score = Math.round((0.6 * accuracy + 0.2 * difficultyWeight + 0.2 * (1 - hintRate)) * 1000) / 1000;

  db.prepare(
    `INSERT INTO mastery_states (user_id, course_id, concept, score, attempts, correct, last_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, course_id, concept)
     DO UPDATE SET score = excluded.score, attempts = excluded.attempts, correct = excluded.correct, last_at = excluded.last_at`
  ).run(userId, courseId, concept, score, attempts, correct, Date.now());
  return score;
}
