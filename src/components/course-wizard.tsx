"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LlmGuide } from "@/components/llm-guide";
import { OutlineEditor, type EditableUnit } from "@/components/outline-editor";

interface ReadyFile {
  id: string;
  name: string;
  page_count: number | null;
}

interface DiagQuestion {
  id: string;
  question: string;
  options: string[];
  answer: string;
  rationale: string;
}

interface Outline {
  title: string;
  units: EditableUnit[];
}

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-500";
const STEPS = ["学习目标", "诊断测评", "大纲确认"];

export function CourseWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("");
  const [duration, setDuration] = useState("");
  const [outcome, setOutcome] = useState("");
  const [files, setFiles] = useState<ReadyFile[]>([]);
  const [fileIds, setFileIds] = useState<Set<string>>(new Set());
  const [questions, setQuestions] = useState<DiagQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [diagSubmitted, setDiagSubmitted] = useState(false);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState<"diagnose" | "plan" | "create" | null>(null);
  const [llmMissing, setLlmMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/files")
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d: { files: { id: string; name: string; status: string; page_count: number | null }[] }) =>
        setFiles(d.files.filter((f) => f.status === "ready"))
      )
      .catch(() => {});
  }, []);

  async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 503) setLlmMissing(true);
    return { ok: res.ok, status: res.status, data };
  }

  const goalPayload = () => ({
    goal,
    level: level || undefined,
    duration: duration || undefined,
    outcome: outcome || undefined,
    sourceFileIds: fileIds.size > 0 ? [...fileIds] : undefined,
  });

  async function onDiagnose() {
    setError(null);
    setLoading("diagnose");
    try {
      const { ok, data } = await postJson("/api/courses/diagnose", goalPayload());
      if (!ok) {
        if (!data.error || data.error !== "LLM_NOT_CONFIGURED") setError((data.message as string) ?? "生成诊断题失败");
        return;
      }
      setQuestions((data.questions as DiagQuestion[]) ?? []);
      setAnswers({});
      setDiagSubmitted(false);
      setStep(2);
    } finally {
      setLoading(null);
    }
  }

  async function onPlan() {
    setError(null);
    setLoading("plan");
    try {
      const diagnosticAnswers = questions
        .filter((q) => answers[q.id])
        .map((q) => ({ question: q.question, userAnswer: answers[q.id], correct: answers[q.id] === q.answer }));
      const { ok, data } = await postJson("/api/courses/plan", { ...goalPayload(), diagnosticAnswers });
      if (!ok) {
        if (!data.error || data.error !== "LLM_NOT_CONFIGURED") setError((data.message as string) ?? "生成大纲失败");
        return;
      }
      const o = data.outline as Outline;
      setOutline(o);
      setTitle(o.title);
      setStep(3);
    } finally {
      setLoading(null);
    }
  }

  async function onCreate() {
    if (!outline) return;
    setError(null);
    const cleaned: Outline = {
      title: outline.title,
      units: outline.units.map((u) => ({
        ...u,
        lessons: u.lessons.map((l) => ({ ...l, objectives: l.objectives.map((s) => s.trim()).filter(Boolean) })),
      })),
    };
    setLoading("create");
    try {
      const diagnostics = questions
        .filter((q) => answers[q.id])
        .map((q, i) => ({
          question: q.question,
          options: q.options,
          answer: q.answer,
          userAnswer: answers[q.id],
          correct: answers[q.id] === q.answer,
          ord: i,
        }));
      const { ok, data } = await postJson("/api/courses", {
        title: title || cleaned.title,
        goalText: goal,
        level: level || undefined,
        durationText: duration || undefined,
        outcome: outcome || undefined,
        outline: cleaned,
        sourceFileIds: fileIds.size > 0 ? [...fileIds] : undefined,
        diagnostics,
      });
      if (!ok) {
        setError((data.message as string) ?? "创建课程失败");
        return;
      }
      router.push(`/courses/${data.id}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">创建课程</h1>
        <div className="mt-4 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                  step > i + 1
                    ? "bg-indigo-600 text-white"
                    : step === i + 1
                      ? "border border-indigo-500 text-indigo-300"
                      : "border border-zinc-700 text-zinc-500"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-sm ${step === i + 1 ? "text-zinc-200" : "text-zinc-500"}`}>{label}</span>
              {i < STEPS.length - 1 && <span className="mx-1 text-zinc-700">—</span>}
            </div>
          ))}
        </div>
      </div>

      {llmMissing && <LlmGuide />}
      {error && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">{error}</p>
      )}

      {step === 1 && (
        <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">想学什么？ *</label>
            <textarea
              className={`${inputCls} h-20 resize-y`}
              placeholder="例如：系统学习机器学习，从零基础到能完成分类项目"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">当前基础</label>
              <input className={inputCls} placeholder="如：零基础 / 会 Python" value={level} onChange={(e) => setLevel(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">期望时长</label>
              <input className={inputCls} placeholder="如：4 周，每天 1 小时" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">产出目标</label>
              <input className={inputCls} placeholder="如：独立完成一个项目" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-400">关联资料（可选，从知识库选择）</label>
            {files.length === 0 ? (
              <p className="text-sm text-zinc-600">
                知识库暂无已就绪的资料，可先到「知识库」上传，也可直接继续。
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {files.map((f) => {
                  const active = fileIds.has(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        setFileIds((prev) => {
                          const next = new Set(prev);
                          if (active) next.delete(f.id);
                          else next.add(f.id);
                          return next;
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        active
                          ? "border-indigo-500 bg-indigo-950/50 text-indigo-300"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >
                      {f.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onDiagnose}
              disabled={!goal.trim() || loading !== null}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading === "diagnose" ? "正在生成诊断题…" : "下一步：诊断测评"}
            </button>
            <button
              onClick={onPlan}
              disabled={!goal.trim() || loading !== null}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 disabled:opacity-50"
            >
              {loading === "plan" ? "正在生成大纲…" : "跳过诊断，直接生成大纲"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {questions.map((q, qi) => {
            const selected = answers[q.id];
            return (
              <div key={q.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <p className="mb-3 text-sm font-medium">
                  {qi + 1}. {q.question}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt) => {
                    const isSelected = selected === opt;
                    const isAnswer = diagSubmitted && opt === q.answer;
                    const isWrong = diagSubmitted && isSelected && opt !== q.answer;
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={diagSubmitted}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                        className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                          isAnswer
                            ? "border-emerald-600 bg-emerald-950/40 text-emerald-300"
                            : isWrong
                              ? "border-red-700 bg-red-950/40 text-red-300"
                              : isSelected
                                ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                                : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {diagSubmitted && (
                  <p className="mt-3 rounded-lg bg-zinc-800/60 px-3 py-2 text-xs leading-relaxed text-zinc-400">
                    {selected === q.answer ? "回答正确。" : `正确答案：${q.answer}。`}
                    {q.rationale}
                  </p>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-3">
            {!diagSubmitted ? (
              <button
                onClick={() => setDiagSubmitted(true)}
                disabled={Object.keys(answers).length === 0}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                提交并查看解析
              </button>
            ) : (
              <button
                onClick={onPlan}
                disabled={loading !== null}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading === "plan" ? "正在生成大纲…" : "下一步：生成大纲"}
              </button>
            )}
            <button
              onClick={onPlan}
              disabled={loading !== null}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 disabled:opacity-50"
            >
              跳过，直接生成大纲
            </button>
            <button onClick={() => setStep(1)} className="text-sm text-zinc-500 hover:text-zinc-300">
              返回上一步
            </button>
          </div>
        </div>
      )}

      {step === 3 && outline && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <label className="mb-1 block text-sm text-zinc-400">课程标题</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <OutlineEditor units={outline.units} onChange={(units) => setOutline({ ...outline, units })} />
          <div className="flex items-center gap-3">
            <button
              onClick={onCreate}
              disabled={!title.trim() || loading !== null}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading === "create" ? "正在创建…" : "确认创建课程"}
            </button>
            <button onClick={onPlan} disabled={loading !== null} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 disabled:opacity-50">
              {loading === "plan" ? "正在重新生成…" : "重新生成大纲"}
            </button>
            <button onClick={() => setStep(2)} className="text-sm text-zinc-500 hover:text-zinc-300">
              返回诊断
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
