"use client";

import { useEffect, useState } from "react";

interface Task {
  id: string;
  title: string;
  kind: "new" | "review" | "practice";
  due_date: string;
  status: "pending" | "done" | "skipped";
  course_title: string | null;
}

const KIND_BADGE: Record<string, { label: string; cls: string }> = {
  new: { label: "新学", cls: "bg-indigo-950/60 text-indigo-300" },
  review: { label: "复习", cls: "bg-emerald-950/60 text-emerald-300" },
  practice: { label: "练习", cls: "bg-amber-950/60 text-amber-300" },
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PlannerClient() {
  const [tasks, setTasks] = useState<Task[] | null>(null);

  async function refresh() {
    const res = await fetch("/api/planner");
    if (res.ok) setTasks(((await res.json()) as { tasks: Task[] }).tasks);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function markDone(id: string) {
    const res = await fetch(`/api/planner/${id}/done`, { method: "POST" });
    if (res.ok) refresh();
  }

  if (!tasks) return <p className="text-sm text-zinc-500">加载中…</p>;
  const pending = tasks.filter((t) => t.status === "pending");
  const finished = tasks.filter((t) => t.status !== "pending");
  const today = todayStr();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">学习计划</h1>
        <p className="mt-1 text-sm text-zinc-500">{pending.length} 条待办 · {finished.length} 条已完成</p>
      </div>

      {pending.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-16 text-center text-sm text-zinc-500">
          暂无待办任务，完成一节课后会自动生成复习任务。
        </div>
      )}

      <ul className="space-y-2">
        {pending.map((t) => {
          const badge = KIND_BADGE[t.kind] ?? KIND_BADGE.new;
          const overdue = t.due_date < today;
          return (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-indigo-500"
                onChange={() => markDone(t.id)}
                title="标记完成"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{t.title}</p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  {t.course_title ?? "通用"} · 截止 {t.due_date}
                  {overdue && <span className="ml-1 text-red-400">（已逾期）</span>}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
            </li>
          );
        })}
      </ul>

      {finished.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-400">已完成</h2>
          <ul className="space-y-2 opacity-60">
            {finished.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 px-4 py-2.5">
                <span className="text-emerald-400">✓</span>
                <p className="min-w-0 flex-1 truncate text-sm line-through">{t.title}</p>
                <span className="text-xs text-zinc-600">{t.due_date}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
