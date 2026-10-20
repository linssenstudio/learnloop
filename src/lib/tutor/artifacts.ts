import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { chatJson } from "@/lib/llm";

const artifactsSchema = z.object({
  note_title: z.string().min(1),
  note_md: z.string().min(1),
  cards: z.array(z.object({ front: z.string().min(1), back: z.string().min(1) })).min(3).max(6),
  next_task: z.string().min(1),
});

export async function generateArtifacts(jobId: string, userId: string, courseId: string, lessonId: string): Promise<void> {
  const claimed = db
    .prepare("UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ? AND status = 'queued'")
    .run(Date.now(), jobId);
  if (claimed.changes === 0) return;

  try {
    const lesson = db.prepare("SELECT * FROM lessons WHERE id = ?").get(lessonId) as
      | { id: string; title: string; objectives: string | null }
      | undefined;
    const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as
      | { id: string; title: string }
      | undefined;
    if (!lesson || !course) throw new Error("课程或课时不存在");

    const narrations = db
      .prepare(
        `SELECT m.content FROM tutor_messages m
         JOIN teaching_sessions s ON s.id = m.session_id
         WHERE s.lesson_id = ? AND m.role = 'tutor' AND m.kind IN ('narration', 'remediation', 'note')
         ORDER BY m.created_at ASC LIMIT 30`
      )
      .all(lessonId) as { content: string }[];
    const material = narrations.map((n) => n.content).join("\n").slice(0, 4000);

    const result = await chatJson({
      system:
        "你是一位 AI 教师。根据课堂讲解内容生成结课产出：一份 Markdown 复习笔记、3-6 张问答式闪卡、以及一条下次学习的任务建议。",
      user: `课程：${course.title}\n课时：${lesson.title}\n学习目标：${lesson.objectives ?? lesson.title}\n课堂内容：\n${material || "（无记录，按课时主题生成）"}\n\n输出 JSON：{"note_title":"...","note_md":"Markdown 笔记","cards":[{"front":"问题","back":"答案"}],"next_task":"下次学习任务（一句话）"}`,
      schema: artifactsSchema,
      maxTokens: 6000,
      userId,
    });

    const now = Date.now();
    const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
    const dueDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    db.transaction(() => {
      db.prepare(
        "INSERT INTO notes (id, user_id, course_id, lesson_id, title, content_md, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(randomUUID(), userId, courseId, lessonId, result.note_title, result.note_md, now);
      const cardStmt = db.prepare(
        "INSERT INTO flashcards (id, user_id, course_id, lesson_id, front, back, source_ref, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const card of result.cards) {
        cardStmt.run(randomUUID(), userId, courseId, lessonId, card.front, card.back, lesson.title, now, now);
      }
      db.prepare(
        "INSERT INTO study_tasks (id, user_id, course_id, title, kind, due_date, status, created_at) VALUES (?, ?, ?, ?, 'review', ?, 'pending', ?)"
      ).run(randomUUID(), userId, courseId, result.next_task, dueDate, now);
      db.prepare("UPDATE jobs SET status = 'done', progress = 100, updated_at = ? WHERE id = ?").run(Date.now(), jobId);
    })();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.prepare("UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").run(message, Date.now(), jobId);
  }
}
