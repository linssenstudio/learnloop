"use client";

import { useEffect, useState } from "react";

interface MasteryRow {
  course_id: string;
  course_title: string;
  concept: string;
  score: number;
  attempts: number;
  correct: number;
  last_at: number | null;
}

interface WrongAttempt {
  id: string;
  answer: string;
  error_tag: string | null;
  created_at: number;
  question: string;
  correct_answer: string | null;
  explanation: string | null;
  concept: string | null;
  course_title: string;
}

export function ProgressClient() {
  const [data, setData] = useState<{ mastery: MasteryRow[]; wrongAttempts: WrongAttempt[] } | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  if (!data) return <p className="text-sm text-zinc-500">加载中…</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">我的成长</h1>
        <p className="mt-1 text-sm text-zinc-500">掌握度 = 0.6×正确率 + 0.2×难度加权 + 0.2×(1-提示率)</p>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="mb-4 font-medium">概念掌握度</h2>
        {data.mastery.length === 0 ? (
          <p className="text-sm text-zinc-600">还没有答题记录，去课堂里完成几道检查题吧。</p>
        ) : (
          <div className="space-y-3">
            {data.mastery.map((m) => {
              const pct = Math.round(m.score * 100);
              return (
                <div key={`${m.course_id}-${m.concept}`} className="flex items-center gap-4">
                  <div className="w-48 shrink-0">
                    <p className="truncate text-sm">{m.concept}</p>
                    <p className="text-xs text-zinc-600">{m.course_title}</p>
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-indigo-500" : "bg-amber-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-zinc-500">
                    {pct}% · {m.correct}/{m.attempts} 题
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="mb-4 font-medium">错题本</h2>
        {data.wrongAttempts.length === 0 ? (
          <p className="text-sm text-zinc-600">暂无错题，继续保持。</p>
        ) : (
          <div className="space-y-3">
            {data.wrongAttempts.map((w) => (
              <div key={w.id} className="rounded-xl border border-zinc-800 p-4">
                <p className="text-sm text-zinc-200">{w.question}</p>
                <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                  <p className="text-red-400">你的答案：{w.answer}</p>
                  {w.correct_answer && <p className="text-emerald-400">正确答案：{w.correct_answer}</p>}
                </div>
                <p className="mt-1.5 text-xs text-zinc-500">
                  {w.error_tag && <span className="mr-2 rounded bg-zinc-800 px-1.5 py-0.5">{w.error_tag}</span>}
                  {w.explanation}
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  {w.course_title} · {new Date(w.created_at).toLocaleString("zh-CN", { hour12: false })}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
