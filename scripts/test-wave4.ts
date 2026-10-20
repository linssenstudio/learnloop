// 非 LLM 链路验证：掌握度公式 / SM-2 / 单元状态汇总
// 用法：rm -rf data && npx tsx scripts/test-wave4.ts
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { updateMastery } from "../src/lib/tutor/mastery";
import { reviewFlashcard } from "../src/lib/flashcards";
import { rollupUnitStatus } from "../src/lib/courses";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("PASS:", msg);
}

const now = Date.now();
const userId = randomUUID();
const courseId = randomUUID();
const unitId = randomUUID();
const lesson1 = randomUUID();
const lesson2 = randomUUID();

db.prepare("INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, 'x', 't', ?)").run(userId, `t${now}@t.dev`, now);
db.prepare("INSERT INTO courses (id, user_id, title, status, created_at) VALUES (?, ?, 'T课', 'active', ?)").run(courseId, userId, now);
db.prepare("INSERT INTO course_units (id, course_id, ord, title, status) VALUES (?, ?, 0, 'U1', 'active')").run(unitId, courseId);
db.prepare("INSERT INTO lessons (id, course_id, unit_id, ord, title, status) VALUES (?, ?, ?, 0, 'L1', 'active')").run(lesson1, courseId, unitId);
db.prepare("INSERT INTO lessons (id, course_id, unit_id, ord, title, status) VALUES (?, ?, ?, 1, 'L2', 'pending')").run(lesson2, courseId, unitId);

// 掌握度：3 次答题（对/错/对），难度 2/4/4，无提示 → 0.6*(2/3)+0.2*(10/3/5)+0.2*1 ≈ 0.733
const concept = "反向传播";
const cases = [
  { correct: 1, difficulty: 2 },
  { correct: 0, difficulty: 4 },
  { correct: 1, difficulty: 4 },
];
for (const c of cases) {
  const qid = randomUUID();
  db.prepare(
    "INSERT INTO questions (id, course_id, lesson_id, concept, type, difficulty, question, answer) VALUES (?, ?, ?, ?, 'single', ?, 'q', 'a')"
  ).run(qid, courseId, lesson1, concept, c.difficulty);
  db.prepare(
    "INSERT INTO attempts (id, user_id, question_id, answer, correct, score, hints_used, created_at) VALUES (?, ?, ?, 'x', ?, ?, 0, ?)"
  ).run(randomUUID(), userId, qid, c.correct, c.correct, now);
}
const score = updateMastery(userId, courseId, concept);
const expected = 0.6 * (2 / 3) + 0.2 * (10 / 3 / 5) + 0.2 * 1;
assert(Math.abs(score - expected) < 0.001, `掌握度公式 score=${score} ≈ ${expected.toFixed(3)}`);
const row = db.prepare("SELECT * FROM mastery_states WHERE user_id = ? AND concept = ?").get(userId, concept) as {
  attempts: number;
  correct: number;
};
assert(row.attempts === 3 && row.correct === 2, "mastery_states 计数正确");

// SM-2：grade 3 → reps 1 / interval 1 / ease 2.65；再 grade 0 → reps 0 / interval 0.02 / ease 2.45
const cardId = randomUUID();
db.prepare(
  "INSERT INTO flashcards (id, user_id, course_id, front, back, due_at, created_at) VALUES (?, ?, ?, 'f', 'b', ?, ?)"
).run(cardId, userId, courseId, now, now);
let card = reviewFlashcard(userId, cardId, 3);
assert(card.reps === 1 && card.interval_days === 1 && Math.abs(card.ease - 2.65) < 1e-9, `SM-2 grade3: reps=${card.reps} interval=${card.interval_days} ease=${card.ease}`);
assert(card.due_at! > now, "due_at 在未来");
card = reviewFlashcard(userId, cardId, 0);
assert(card.reps === 0 && card.interval_days === 0.02 && Math.abs(card.ease - 2.45) < 1e-9, `SM-2 grade0: reps=${card.reps} interval=${card.interval_days} ease=${card.ease}`);
const events = db.prepare("SELECT COUNT(*) c FROM review_events WHERE flashcard_id = ?").get(cardId) as { c: number };
assert(events.c === 2, "review_events 写了 2 条");

// 单元汇总：全部课时 done → 单元 done
db.prepare("UPDATE lessons SET status = 'done' WHERE id = ?").run(lesson1);
rollupUnitStatus(courseId);
let unit = db.prepare("SELECT status FROM course_units WHERE id = ?").get(unitId) as { status: string };
assert(unit.status !== "done", "部分课时完成时单元不 done");
db.prepare("UPDATE lessons SET status = 'done' WHERE id = ?").run(lesson2);
rollupUnitStatus(courseId);
unit = db.prepare("SELECT status FROM course_units WHERE id = ?").get(unitId) as { status: string };
assert(unit.status === "done", "全部课时完成后单元 done");

console.log("\n全部通过");
