"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LlmGuide } from "@/components/llm-guide";

interface UnitNode {
  id: string;
  title: string;
  lessons: { id: string; title: string; status: string }[];
}

interface Message {
  id: string;
  role: "tutor" | "student" | "system";
  kind: "narration" | "question" | "answer" | "feedback" | "remediation" | "note";
  content: string;
  citations: string | null;
  step: number;
}

interface SessionInfo {
  id: string;
  state: string;
  step: number;
}

interface QuestionPayload {
  questionId: string;
  question: string;
  type: "single" | "short";
  options?: string[];
}

interface Citation {
  file_id: string;
  file_name: string;
  page: number | null;
  snippet: string;
}

interface QuizQuestion {
  id: string;
  concept: string;
  type: "single" | "short";
  difficulty: number;
  question: string;
  options?: string[];
}

function parseQuestion(m: Message): QuestionPayload | null {
  if (m.kind !== "question" || m.role !== "tutor") return null;
  try {
    return JSON.parse(m.content) as QuestionPayload;
  } catch {
    return null;
  }
}

function parseCitations(m: Message): Citation[] {
  if (!m.citations) return [];
  try {
    return JSON.parse(m.citations) as Citation[];
  } catch {
    return [];
  }
}

function parseFeedback(m: Message): { correct: boolean; feedback: string; errorTag: string | null } | null {
  if (m.kind !== "feedback") return null;
  try {
    return JSON.parse(m.content);
  } catch {
    return null;
  }
}

export function Classroom({
  courseId,
  lessonId,
  units,
}: {
  courseId: string;
  lessonId: string;
  units: UnitNode[];
}) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [llmMissing, setLlmMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [viewStep, setViewStep] = useState<number | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResults, setQuizResults] = useState<Record<string, { correct: boolean; explanation: string | null }>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  const boot = useCallback(async () => {
    setBooting(true);
    setError(null);
    setQuiz(null);
    setQuizResults({});
    setQuizAnswers({});
    const res = await fetch("/api/lesson-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, lessonId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      session?: SessionInfo;
      messages?: Message[];
      error?: string;
      message?: string;
    };
    setBooting(false);
    if (res.status === 503) {
      setLlmMissing(true);
      return;
    }
    if (!res.ok || !data.session) {
      setError(data.message ?? "开课失败");
      return;
    }
    setSession(data.session);
    setMessages(data.messages ?? []);
    setViewStep(null);
  }, [courseId, lessonId]);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const steps = useMemo(() => [...new Set(messages.map((m) => m.step))].sort((a, b) => a - b), [messages]);
  const maxStep = steps[steps.length - 1] ?? 0;
  const currentStep = viewStep ?? maxStep;

  const pendingQuestion = useMemo(() => {
    if (!session || session.state === "done") return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const q = parseQuestion(messages[i]);
      if (q) {
        const answered = messages.slice(i + 1).some((m) => m.role === "student" && m.kind === "answer");
        return answered ? null : q;
      }
    }
    return null;
  }, [messages, session]);

  const currentNarration = useMemo(() => {
    const atStep = messages.filter((m) => m.step === currentStep && m.role === "tutor");
    return (
      atStep.find((m) => m.kind === "narration") ??
      atStep.find((m) => m.kind === "remediation") ??
      atStep.find((m) => m.kind === "note") ??
      null
    );
  }, [messages, currentStep]);

  async function send(payload: { answer?: string; question?: string }) {
    if (!session || thinking) return;
    setThinking(true);
    setError(null);
    try {
      const res = await fetch(`/api/lesson-sessions/${session.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        messages?: Message[];
        state?: string;
        step?: number;
        done?: boolean;
        error?: string;
        message?: string;
      };
      if (res.status === 503) {
        setLlmMissing(true);
        return;
      }
      if (!res.ok) {
        setError(data.message ?? "请求失败");
        return;
      }
      setMessages((prev) => [...prev, ...(data.messages ?? [])]);
      if (data.state) setSession({ ...session, state: data.state, step: data.step ?? session.step });
      setViewStep(null);
    } finally {
      setThinking(false);
    }
  }

  async function startQuiz() {
    if (!session || thinking) return;
    setThinking(true);
    setError(null);
    try {
      const res = await fetch(`/api/lesson-sessions/${session.id}/quiz`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { questions?: QuizQuestion[]; message?: string };
      if (res.status === 503) {
        setLlmMissing(true);
        return;
      }
      if (!res.ok) {
        setError(data.message ?? "生成测验失败");
        return;
      }
      setQuiz(data.questions ?? []);
      setQuizAnswers({});
      setQuizResults({});
    } finally {
      setThinking(false);
    }
  }

  async function submitQuizAnswer(q: QuizQuestion) {
    const answer = quizAnswers[q.id];
    if (!answer) return;
    const res = await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q.id, answer, sessionId: session?.id }),
    });
    const data = (await res.json().catch(() => ({}))) as { correct?: boolean; explanation?: string | null; message?: string };
    if (!res.ok) {
      setError(data.message ?? "提交失败");
      return;
    }
    setQuizResults((prev) => ({ ...prev, [q.id]: { correct: !!data.correct, explanation: data.explanation ?? null } }));
  }

  if (llmMissing) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <LlmGuide />
      </div>
    );
  }
  if (booting) {
    return <div className="flex h-[60vh] items-center justify-center text-sm text-zinc-500">正在进入课堂…</div>;
  }
  if (!session) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error ?? "开课失败"}</p>
      </div>
    );
  }

  const done = session.state === "done";
  const stepIndex = steps.indexOf(currentStep);

  return (
    <div className="grid h-[calc(100vh-7.5rem)] gap-4 lg:grid-cols-12">
      <aside className="hidden overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 lg:col-span-3 lg:block">
        <Link href={`/courses/${courseId}`} className="text-xs text-zinc-500 hover:text-zinc-300">
          ← 返回课程
        </Link>
        <div className="mt-3 space-y-4">
          {units.map((u) => (
            <div key={u.id}>
              <p className="mb-1.5 truncate text-xs font-medium text-zinc-400">{u.title}</p>
              <ul className="space-y-1">
                {u.lessons.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/courses/${courseId}/learn/${l.id}`}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition ${
                        l.id === lessonId ? "bg-indigo-600/15 text-indigo-300" : "text-zinc-400 hover:bg-zinc-800/60"
                      }`}
                    >
                      <span className="min-w-0 truncate">{l.title}</span>
                      {l.status === "done" && <span className="ml-1 text-xs text-emerald-400">✓</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col gap-4 overflow-y-auto lg:col-span-5">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
            <span>教学区 · 第 {Math.max(1, stepIndex + 1)} / {Math.max(1, steps.length)} 步</span>
            <div className="flex gap-1.5">
              <button
                disabled={stepIndex <= 0}
                onClick={() => setViewStep(steps[stepIndex - 1])}
                className="rounded border border-zinc-700 px-2 py-0.5 disabled:opacity-30"
              >
                上一步
              </button>
              <button
                disabled={currentStep >= maxStep}
                onClick={() => setViewStep(steps[stepIndex + 1] ?? maxStep)}
                className="rounded border border-zinc-700 px-2 py-0.5 disabled:opacity-30"
              >
                下一步
              </button>
            </div>
          </div>
          {currentNarration ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{currentNarration.content}</p>
          ) : (
            <p className="text-sm text-zinc-600">（本步没有讲解内容）</p>
          )}
          {currentNarration && parseCitations(currentNarration).length > 0 && (
            <div className="mt-4 space-y-2 border-t border-zinc-800 pt-3">
              <p className="text-xs text-zinc-500">引用资料</p>
              {parseCitations(currentNarration).map((c, i) => (
                <details key={i} className="rounded-lg border border-zinc-800 px-3 py-2 text-xs">
                  <summary className="cursor-pointer text-indigo-300">
                    {c.file_name}
                    {c.page !== null && ` · 第 ${c.page} 页`}
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap leading-relaxed text-zinc-400">{c.snippet}</p>
                </details>
              ))}
            </div>
          )}
        </div>

        <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-xs text-zinc-600">
          白板区域 · P1 开发中（Excalidraw）
        </div>

        {error && (
          <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">{error}</p>
        )}

        {done ? (
          <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-5">
            <p className="font-medium text-emerald-300">本课已完成</p>
            <p className="mt-1 text-sm text-zinc-400">结课产出（笔记 / 闪卡 / 复习任务）正在后台生成。</p>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/courses/${courseId}/flashcards`}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
              >
                去刷闪卡
              </Link>
              <Link href="/planner" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300">
                学习计划
              </Link>
            </div>
          </div>
        ) : pendingQuestion && currentStep === maxStep ? (
          <div className="rounded-2xl border border-indigo-900/60 bg-indigo-950/20 p-5">
            <p className="mb-3 text-sm font-medium text-indigo-200">{pendingQuestion.question}</p>
            {pendingQuestion.type === "single" && pendingQuestion.options ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {pendingQuestion.options.map((opt) => (
                  <button
                    key={opt}
                    disabled={thinking}
                    onClick={() => send({ answer: opt })}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-left text-sm text-zinc-200 transition hover:border-indigo-500 disabled:opacity-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="输入你的答案…"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
                <button
                  disabled={thinking || !input.trim()}
                  onClick={() => {
                    send({ answer: input.trim() });
                    setInput("");
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  作答
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-500">
            {thinking ? "AI 教师思考中…" : "在右侧对话框继续互动，或生成随堂测验检验自己。"}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">随堂测验</p>
            <button
              onClick={startQuiz}
              disabled={thinking}
              className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
            >
              {quiz ? "重新生成" : "生成测验"}
            </button>
          </div>
          {quiz === null ? (
            <p className="text-xs text-zinc-600">生成 3-5 道测验题，作答后立即批改并计入掌握度。</p>
          ) : (
            <div className="space-y-4">
              {quiz.map((q, qi) => {
                const result = quizResults[q.id];
                return (
                  <div key={q.id} className="rounded-xl border border-zinc-800 p-3">
                    <p className="text-sm">
                      {qi + 1}. {q.question}
                      <span className="ml-2 text-xs text-zinc-600">
                        {q.concept} · 难度{q.difficulty}
                      </span>
                    </p>
                    {q.type === "single" && q.options ? (
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            disabled={!!result}
                            onClick={() => {
                              setQuizAnswers((prev) => ({ ...prev, [q.id]: opt }));
                            }}
                            className={`rounded border px-2.5 py-1.5 text-left text-xs transition ${
                              quizAnswers[q.id] === opt ? "border-indigo-500 text-indigo-300" : "border-zinc-700 text-zinc-400"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        disabled={!!result}
                        value={quizAnswers[q.id] ?? ""}
                        onChange={(e) => setQuizAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="输入答案…"
                        className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                      />
                    )}
                    {!result ? (
                      <button
                        onClick={() => submitQuizAnswer(q)}
                        disabled={!quizAnswers[q.id]}
                        className="mt-2 rounded bg-indigo-600 px-3 py-1 text-xs text-white disabled:opacity-40"
                      >
                        提交
                      </button>
                    ) : (
                      <p className={`mt-2 text-xs ${result.correct ? "text-emerald-400" : "text-red-400"}`}>
                        {result.correct ? "✓ 回答正确" : "✗ 回答错误"}
                        {result.explanation && <span className="ml-1 text-zinc-400">{result.explanation}</span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 lg:col-span-4">
        <p className="border-b border-zinc-800 px-4 py-3 text-sm font-medium">AI 教师</p>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))}
          {thinking && <p className="text-xs text-zinc-500">AI 教师思考中…</p>}
          <div ref={chatEndRef} />
        </div>
        <div className="border-t border-zinc-800 p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim() && !thinking) {
                  send({ question: input.trim() });
                  setInput("");
                }
              }}
              placeholder={done ? "本课已结课" : "向 AI 教师提问…"}
              disabled={done || thinking}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              disabled={done || thinking || !input.trim()}
              onClick={() => {
                send({ question: input.trim() });
                setInput("");
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              提问
            </button>
          </div>
          {pendingQuestion && pendingQuestion.type === "short" && !done && (
            <button
              disabled={thinking || !input.trim()}
              onClick={() => {
                send({ answer: input.trim() });
                setInput("");
              }}
              className="mt-2 w-full rounded-lg border border-indigo-700 px-3 py-1.5 text-xs text-indigo-300 hover:bg-indigo-950/40 disabled:opacity-50"
            >
              作为答案提交（当前有待答检查题）
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function ChatBubble({ message: m }: { message: Message }) {
  if (m.role === "student") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-indigo-600/80 px-3 py-2 text-sm text-white">
          {m.kind === "question" ? `提问：${m.content}` : m.content}
        </div>
      </div>
    );
  }
  if (m.kind === "question") {
    const q = parseQuestion(m);
    return (
      <div className="max-w-[90%] rounded-xl rounded-bl-sm border border-indigo-900/60 bg-indigo-950/30 px-3 py-2 text-sm">
        <p className="mb-1 text-xs text-indigo-400">检查题</p>
        <p className="text-zinc-200">{q?.question ?? m.content}</p>
        {q?.options && (
          <ul className="mt-1.5 space-y-1 text-xs text-zinc-400">
            {q.options.map((o) => (
              <li key={o}>· {o}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (m.kind === "feedback") {
    const fb = parseFeedback(m);
    return (
      <div
        className={`max-w-[90%] rounded-xl rounded-bl-sm border px-3 py-2 text-sm ${
          fb?.correct ? "border-emerald-900/60 bg-emerald-950/30 text-emerald-200" : "border-red-900/60 bg-red-950/30 text-red-200"
        }`}
      >
        {fb ? (
          <>
            <p className="text-xs">{fb.correct ? "✓ 回答正确" : `✗ 回答错误${fb.errorTag ? `（${fb.errorTag}）` : ""}`}</p>
            <p className="mt-0.5 text-zinc-300">{fb.feedback}</p>
          </>
        ) : (
          m.content
        )}
      </div>
    );
  }
  const label =
    m.kind === "remediation" ? "换种讲法" : m.kind === "note" ? "小结" : m.kind === "answer" ? "解答" : null;
  return (
    <div className="max-w-[90%] rounded-xl rounded-bl-sm bg-zinc-800/70 px-3 py-2 text-sm text-zinc-200">
      {label && <p className="mb-0.5 text-xs text-zinc-500">{label}</p>}
      <p className="whitespace-pre-wrap">{m.content}</p>
    </div>
  );
}
