import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { chatJson } from "@/lib/llm";
import { updateMastery } from "./mastery";

export interface QuestionRow {
  id: string;
  course_id: string;
  lesson_id: string | null;
  concept: string | null;
  type: "single" | "multi" | "short";
  difficulty: number;
  question: string;
  options: string | null;
  answer: string | null;
  explanation: string | null;
}

export const gradeSchema = z.object({
  correct: z.boolean(),
  score: z.number().min(0).max(1),
  error_tag: z.string().nullable(),
  feedback: z.string(),
  remediation: z.string().nullable(),
});

export type GradeResult = {
  correct: boolean;
  score: number;
  errorTag: string | null;
  feedback: string;
  remediation: string | null;
};

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, "").toLowerCase();
}

export async function gradeAnswer(question: QuestionRow, answer: string, userId?: string): Promise<GradeResult> {
  if (question.type === "single") {
    const correct = normalize(answer) === normalize(question.answer ?? "");
    return {
      correct,
      score: correct ? 1 : 0,
      errorTag: correct ? null : "选项理解偏差",
      feedback: correct ? "回答正确。" : `正确答案是：${question.answer}。`,
      remediation: null,
    };
  }
  if (question.type === "multi") {
    const expected = new Set(
      (question.answer ?? "")
        .split(/[,，;；]/)
        .map(normalize)
        .filter(Boolean)
    );
    const actual = new Set(answer.split(/[,，;；]/).map(normalize).filter(Boolean));
    const correct = expected.size === actual.size && [...expected].every((x) => actual.has(x));
    return {
      correct,
      score: correct ? 1 : 0,
      errorTag: correct ? null : "选项理解偏差",
      feedback: correct ? "回答正确。" : `正确答案是：${question.answer}。`,
      remediation: null,
    };
  }
  const result = await chatJson({
    system:
      "你是一位严格但友善的批改老师。根据标准答案评判学生的简答，给出对错、分数（0-1）、错误类型与一句反馈；若答错，给出一种换一个说法或类比的简短重讲（remediation）。",
    user: `题目：${question.question}\n标准答案：${question.answer ?? "（无固定答案，按要点评判）"}\n学生作答：${answer}\n\n输出 JSON：{"correct":true或false,"score":0到1,"error_tag":"错误类型或null","feedback":"...","remediation":"答错时的重讲或null"}`,
    schema: gradeSchema,
    maxTokens: 1500,
    userId,
  });
  return {
    correct: result.correct,
    score: result.score,
    errorTag: result.error_tag,
    feedback: result.feedback,
    remediation: result.remediation,
  };
}

export function recordAttempt(params: {
  userId: string;
  question: QuestionRow;
  sessionId?: string | null;
  answer: string;
  grade: GradeResult;
  durationMs?: number | null;
}): string {
  const attemptId = randomUUID();
  db.prepare(
    `INSERT INTO attempts (id, user_id, question_id, session_id, answer, correct, score, error_tag, hints_used, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    attemptId,
    params.userId,
    params.question.id,
    params.sessionId ?? null,
    params.answer,
    params.grade.correct ? 1 : 0,
    params.grade.score,
    params.grade.errorTag,
    params.durationMs ?? null,
    Date.now()
  );
  if (params.question.concept) {
    updateMastery(params.userId, params.question.course_id, params.question.concept);
  }
  return attemptId;
}

export function insertQuestion(params: {
  courseId: string;
  lessonId?: string | null;
  concept: string;
  type: "single" | "multi" | "short";
  difficulty: number;
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
}): QuestionRow {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO questions (id, course_id, lesson_id, concept, type, difficulty, question, options, answer, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.courseId,
    params.lessonId ?? null,
    params.concept,
    params.type,
    params.difficulty,
    params.question,
    params.options ? JSON.stringify(params.options) : null,
    params.answer,
    params.explanation ?? null
  );
  return db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as QuestionRow;
}
