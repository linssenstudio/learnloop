import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { chatJson } from "@/lib/llm";
import { rollupUnitStatus, type CourseRow } from "@/lib/courses";
import { formatChunksForPrompt, resolveCitations, retrieveCourseChunks, type Citation, type RetrievedChunk } from "./retrieval";
import { gradeAnswer, insertQuestion, recordAttempt, type QuestionRow } from "./grading";

export interface SessionRow {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string | null;
  state: string;
  step: number;
  context: string | null;
  created_at: number;
}

export interface MessageRow {
  id: string;
  session_id: string;
  role: "tutor" | "student" | "system";
  kind: "narration" | "question" | "answer" | "feedback" | "remediation" | "note";
  content: string;
  citations: string | null;
  step: number;
  created_at: number;
}

interface SessionContext {
  pointIndex: number;
  phase: "teach" | "apply";
  pendingQuestionId: string | null;
}

interface LessonRow {
  id: string;
  course_id: string;
  unit_id: string | null;
  title: string;
  objectives: string | null;
  status: string;
}

const checkQuestionSchema = z.object({
  question: z.string().min(1),
  type: z.enum(["single", "short"]),
  options: z.array(z.string().min(1)).length(4).optional(),
  answer: z.string().min(1),
  concept: z.string().min(1),
});

const turnSchema = z.object({
  narration: z.string().min(1),
  check_question: checkQuestionSchema,
  citations: z.array(z.number().int()).default([]),
});

const qaSchema = z.object({
  answer: z.string().min(1),
  covered: z.boolean(),
  citations: z.array(z.number().int()).default([]),
});

const summarySchema = z.object({
  summary: z.string().min(1),
  citations: z.array(z.number().int()).default([]),
});

function getSession(sessionId: string): SessionRow | null {
  return (db.prepare("SELECT * FROM teaching_sessions WHERE id = ?").get(sessionId) as SessionRow | undefined) ?? null;
}

function getLesson(lessonId: string): LessonRow | null {
  return (db.prepare("SELECT * FROM lessons WHERE id = ?").get(lessonId) as LessonRow | undefined) ?? null;
}

function lessonPoints(lesson: LessonRow): string[] {
  try {
    const v = JSON.parse(lesson.objectives ?? "[]");
    if (Array.isArray(v) && v.length > 0) return v.map(String);
  } catch {
    // 忽略解析失败
  }
  return [lesson.title];
}

function parseContext(session: SessionRow): SessionContext {
  try {
    if (session.context) {
      const v = JSON.parse(session.context) as SessionContext;
      if (typeof v.pointIndex === "number" && (v.phase === "teach" || v.phase === "apply")) return v;
    }
  } catch {
    // 损坏的 context 重置
  }
  return { pointIndex: 0, phase: "teach", pendingQuestionId: null };
}

function saveSession(sessionId: string, state: string, step: number, ctx: SessionContext): void {
  db.prepare("UPDATE teaching_sessions SET state = ?, step = ?, context = ? WHERE id = ?").run(
    state,
    step,
    JSON.stringify(ctx),
    sessionId
  );
}

export function listMessages(sessionId: string): MessageRow[] {
  return db
    .prepare("SELECT * FROM tutor_messages WHERE session_id = ? ORDER BY created_at ASC, rowid ASC")
    .all(sessionId) as MessageRow[];
}

function insertMessage(
  sessionId: string,
  role: MessageRow["role"],
  kind: MessageRow["kind"],
  content: string,
  citations: Citation[] | null,
  step: number
): void {
  db.prepare(
    "INSERT INTO tutor_messages (id, session_id, role, kind, content, citations, step, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(randomUUID(), sessionId, role, kind, content, citations && citations.length > 0 ? JSON.stringify(citations) : null, step, Date.now());
}

interface TurnBundle {
  narration: string;
  citations: Citation[];
  question: QuestionRow;
}

async function generateTeachTurn(params: {
  userId: string;
  course: CourseRow;
  lesson: LessonRow;
  pointObjective: string;
  mode: "explain" | "remediate" | "apply";
  wrongAnswer?: string;
  errorTag?: string | null;
}): Promise<TurnBundle> {
  const { course, lesson, pointObjective, mode } = params;
  const chunks = retrieveCourseChunks(course.id, `${lesson.title} ${pointObjective}`, 5);
  const chunkText = chunks.length > 0 ? `\n可参考的资料片段（citations 只能从这里选编号，禁止编造其他引用）：\n${formatChunksForPrompt(chunks)}\n` : "\n本课程没有关联资料，citations 输出空数组，禁止编造引用。\n";
  const modeInstruction =
    mode === "remediate"
      ? `学生刚才答错了（作答：「${params.wrongAnswer}」，错误类型：${params.errorTag ?? "未知"}）。请换一种讲法或用一个生活化类比重新讲解同一个知识点，然后出一道新的检查题。`
      : mode === "apply"
        ? "这是本课的最后一个环节：请引导学生把本课知识综合应用到一个实际问题中，讲解要求后出一道应用题（type 用 short）。"
        : "请开始讲解这个教学点，然后出一道检查题确认学生是否理解。";

  const result = await chatJson({
    system:
      "你是一位耐心的 AI 教师，采用小步教学法：每轮只讲一小步（narration 不超过 300 字），然后必须出一道检查题与学生互动，绝不一次讲完整课。讲解要基于给定资料，引用资料原文编号。",
    user: `课程：${course.title}${course.goal_text ? `（目标：${course.goal_text}）` : ""}
课时：${lesson.title}
当前教学点：${pointObjective}
${modeInstruction}
${chunkText}
输出 JSON：{"narration":"...","check_question":{"question":"...","type":"single或short","options":["...","...","...","..."](type 为 single 时必填),"answer":"...","concept":"本题考查的概念"},"citations":[资料编号数组]}`,
    schema: turnSchema,
    maxTokens: 3000,
    userId: params.userId,
  });

  const question = insertQuestion({
    courseId: course.id,
    lessonId: lesson.id,
    concept: result.check_question.concept,
    type: result.check_question.type,
    difficulty: mode === "apply" ? 3 : 2,
    question: result.check_question.question,
    options: result.check_question.options,
    answer: result.check_question.answer,
  });
  return { narration: result.narration, citations: resolveCitations(result.citations, chunks), question };
}

async function generateSummaryTurn(params: {
  userId: string;
  course: CourseRow;
  lesson: LessonRow;
}): Promise<{ summary: string; citations: Citation[] }> {
  const { course, lesson } = params;
  const chunks = retrieveCourseChunks(course.id, lesson.title, 4);
  const chunkText = chunks.length > 0 ? `\n资料片段：\n${formatChunksForPrompt(chunks)}\n` : "";
  const result = await chatJson({
    system: "你是一位 AI 教师。为学生刚学完的一节课写 200 字以内的结课小结：回顾要点、指出下一步。",
    user: `课程：${course.title}\n课时：${lesson.title}\n学习目标：${lessonPoints(lesson).join("；")}\n${chunkText}\n输出 JSON：{"summary":"...","citations":[资料编号数组，没有资料则为空数组]}`,
    schema: summarySchema,
    maxTokens: 1500,
    userId: params.userId,
  });
  return { summary: result.summary, citations: resolveCitations(result.citations, chunks) };
}

export interface SessionView {
  session: { id: string; courseId: string; lessonId: string | null; state: string; step: number };
  messages: MessageRow[];
  resumed: boolean;
}

function toView(session: SessionRow, messages: MessageRow[], resumed: boolean): SessionView {
  return {
    session: { id: session.id, courseId: session.course_id, lessonId: session.lesson_id, state: session.state, step: session.step },
    messages,
    resumed,
  };
}

export async function startSession(userId: string, courseId: string, lessonId: string): Promise<SessionView> {
  const existing = db
    .prepare(
      "SELECT * FROM teaching_sessions WHERE user_id = ? AND lesson_id = ? AND state != 'done' ORDER BY created_at DESC LIMIT 1"
    )
    .get(userId, lessonId) as SessionRow | undefined;
  if (existing) return toView(existing, listMessages(existing.id), true);

  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as CourseRow | undefined;
  const lesson = getLesson(lessonId);
  if (!course || !lesson || lesson.course_id !== courseId) throw new Error("课时不存在");

  const sessionId = randomUUID();
  const ctx: SessionContext = { pointIndex: 0, phase: "teach", pendingQuestionId: null };
  db.prepare(
    "INSERT INTO teaching_sessions (id, user_id, course_id, lesson_id, state, step, context, created_at) VALUES (?, ?, ?, ?, 'explain', 0, ?, ?)"
  ).run(sessionId, userId, courseId, lessonId, JSON.stringify(ctx), Date.now());
  db.prepare("UPDATE lessons SET status = 'active' WHERE id = ? AND status = 'pending'").run(lessonId);

  const points = lessonPoints(lesson);
  const turn = await generateTeachTurn({ userId, course, lesson, pointObjective: points[0], mode: "explain" });
  insertMessage(sessionId, "tutor", "narration", turn.narration, turn.citations, 1);
  insertMessage(
    sessionId,
    "tutor",
    "question",
    JSON.stringify({
      questionId: turn.question.id,
      question: turn.question.question,
      type: turn.question.type,
      options: turn.question.options ? (JSON.parse(turn.question.options) as string[]) : undefined,
    }),
    null,
    1
  );
  ctx.pendingQuestionId = turn.question.id;
  saveSession(sessionId, "check", 1, ctx);

  const session = getSession(sessionId)!;
  return toView(session, listMessages(sessionId), false);
}

export interface RespondResult {
  messages: MessageRow[];
  state: string;
  step: number;
  done: boolean;
  artifactsJobId: string | null;
}

export async function respond(
  sessionId: string,
  userId: string,
  input: { answer?: string; question?: string }
): Promise<RespondResult> {
  const session = getSession(sessionId);
  if (!session || session.user_id !== userId) throw new Error("会话不存在");
  if (session.state === "done") throw new Error("本课已结课");
  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(session.course_id) as CourseRow;
  const lesson = session.lesson_id ? getLesson(session.lesson_id) : null;
  if (!lesson) throw new Error("课时不存在");
  const ctx = parseContext(session);
  const before = listMessages(sessionId).map((m) => m.id);
  const newStep = session.step + 1;

  if (input.question && input.question.trim()) {
    const chunks = retrieveCourseChunks(session.course_id, input.question, 5);
    const chunkText =
      chunks.length > 0
        ? `\n课程资料片段（citations 只能选这里的编号）：\n${formatChunksForPrompt(chunks)}\n`
        : "\n（本课程没有关联资料）\n";
    const result = await chatJson({
      system:
        "你是一位 AI 教师，正在课堂中回答学生的即兴提问。优先依据课程资料回答；若资料未涵盖，covered 输出 false 并基于通用知识简要回答。citations 禁止编造。",
      user: `课程：${course.title}\n当前课时：${lesson.title}\n学生提问：${input.question}\n${chunkText}\n输出 JSON：{"answer":"300字以内","covered":true或false,"citations":[资料编号数组]}`,
      schema: qaSchema,
      maxTokens: 2000,
      userId,
    });
    insertMessage(sessionId, "student", "question", input.question.trim(), null, newStep);
    const answerText = result.covered ? result.answer : `资料中未涵盖这个问题，以下为通用知识：${result.answer}`;
    insertMessage(sessionId, "tutor", "answer", answerText, resolveCitations(result.citations, chunks), newStep);
    saveSession(sessionId, session.state, newStep, ctx);
    return { messages: listMessages(sessionId).filter((m) => !before.includes(m.id)), state: session.state, step: newStep, done: false, artifactsJobId: null };
  }

  if (!input.answer || !input.answer.trim()) throw new Error("请提供作答或提问");
  if (!ctx.pendingQuestionId) throw new Error("当前没有待回答的问题");
  const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(ctx.pendingQuestionId) as QuestionRow | undefined;
  if (!question) throw new Error("问题不存在");

  const grade = await gradeAnswer(question, input.answer, userId);
  recordAttempt({ userId, question, sessionId, answer: input.answer.trim(), grade });
  insertMessage(sessionId, "student", "answer", input.answer.trim(), null, newStep);
  insertMessage(
    sessionId,
    "tutor",
    "feedback",
    JSON.stringify({ correct: grade.correct, score: grade.score, feedback: grade.feedback, errorTag: grade.errorTag }),
    null,
    newStep
  );

  let artifactsJobId: string | null = null;
  let nextState: string;

  if (!grade.correct) {
    const points = lessonPoints(lesson);
    const objective = ctx.phase === "apply" ? "综合应用" : (points[ctx.pointIndex] ?? lesson.title);
    const turn = await generateTeachTurn({
      userId,
      course,
      lesson,
      pointObjective: objective,
      mode: "remediate",
      wrongAnswer: input.answer.trim(),
      errorTag: grade.errorTag,
    });
    insertMessage(sessionId, "tutor", "remediation", turn.narration, turn.citations, newStep);
    insertMessage(
      sessionId,
      "tutor",
      "question",
      JSON.stringify({
        questionId: turn.question.id,
        question: turn.question.question,
        type: turn.question.type,
        options: turn.question.options ? (JSON.parse(turn.question.options) as string[]) : undefined,
      }),
      null,
      newStep
    );
    ctx.pendingQuestionId = turn.question.id;
    nextState = ctx.phase === "apply" ? "apply" : "remediate";
  } else if (ctx.phase === "teach") {
    const points = lessonPoints(lesson);
    const nextIndex = ctx.pointIndex + 1;
    if (nextIndex < points.length) {
      const turn = await generateTeachTurn({ userId, course, lesson, pointObjective: points[nextIndex], mode: "explain" });
      insertMessage(sessionId, "tutor", "narration", turn.narration, turn.citations, newStep);
      insertMessage(
        sessionId,
        "tutor",
        "question",
        JSON.stringify({
          questionId: turn.question.id,
          question: turn.question.question,
          type: turn.question.type,
          options: turn.question.options ? (JSON.parse(turn.question.options) as string[]) : undefined,
        }),
        null,
        newStep
      );
      ctx.pointIndex = nextIndex;
      ctx.pendingQuestionId = turn.question.id;
      nextState = "advance";
    } else {
      const turn = await generateTeachTurn({ userId, course, lesson, pointObjective: "综合应用", mode: "apply" });
      insertMessage(sessionId, "tutor", "narration", turn.narration, turn.citations, newStep);
      insertMessage(
        sessionId,
        "tutor",
        "question",
        JSON.stringify({
          questionId: turn.question.id,
          question: turn.question.question,
          type: turn.question.type,
        }),
        null,
        newStep
      );
      ctx.phase = "apply";
      ctx.pendingQuestionId = turn.question.id;
      nextState = "apply";
    }
  } else {
    const { summary, citations } = await generateSummaryTurn({ userId, course, lesson });
    insertMessage(sessionId, "tutor", "note", summary, citations, newStep);
    ctx.pendingQuestionId = null;
    nextState = "done";
    db.prepare("UPDATE lessons SET status = 'done' WHERE id = ?").run(lesson.id);
    rollupUnitStatus(course.id);
    const now = Date.now();
    artifactsJobId = randomUUID();
    db.prepare(
      "INSERT INTO jobs (id, user_id, kind, ref_id, status, progress, created_at, updated_at) VALUES (?, ?, 'generate_artifact', ?, 'queued', 0, ?, ?)"
    ).run(artifactsJobId, userId, lesson.id, now, now);
  }

  saveSession(sessionId, nextState, newStep, ctx);
  return {
    messages: listMessages(sessionId).filter((m) => !before.includes(m.id)),
    state: nextState,
    step: newStep,
    done: nextState === "done",
    artifactsJobId,
  };
}
