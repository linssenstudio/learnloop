import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

interface CourseRow {
  id: string;
  title: string;
  status: string;
  created_at: number;
}

interface TaskRow {
  id: string;
  title: string;
  kind: string;
  status: string;
}

function localDateStr(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreak(dates: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  if (!dates.has(localDateStr(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dates.has(localDateStr(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const KIND_LABEL: Record<string, string> = { new: "新学", review: "复习", practice: "练习" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const recentCourses = db
    .prepare("SELECT id, title, status, created_at FROM courses WHERE user_id = ? ORDER BY created_at DESC LIMIT 5")
    .all(user.id) as CourseRow[];

  const today = localDateStr(Date.now());
  const todayTasks = db
    .prepare(
      "SELECT id, title, kind, status FROM study_tasks WHERE user_id = ? AND due_date = ? AND status = 'pending' ORDER BY created_at ASC"
    )
    .all(user.id, today) as TaskRow[];

  const activityDates = new Set<string>();
  for (const row of db.prepare("SELECT created_at FROM attempts WHERE user_id = ?").all(user.id) as { created_at: number }[]) {
    activityDates.add(localDateStr(row.created_at));
  }
  for (const row of db
    .prepare("SELECT created_at FROM study_tasks WHERE user_id = ? AND status = 'done'")
    .all(user.id) as { created_at: number }[]) {
    activityDates.add(localDateStr(row.created_at));
  }
  const streak = computeStreak(activityDates);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">你好，{user.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {streak > 0 ? `已连续学习 ${streak} 天，继续保持` : "今天开始新的学习循环吧"}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickEntry href="/courses/new" title="学新东西" desc="用 AI 规划一门新课程" />
        <QuickEntry href="/library" title="上传资料" desc="把 PDF / 文档变成学习素材" />
        <QuickEntry title="讲解难点" desc="开发中" disabled />
        <QuickEntry title="生成资料" desc="开发中" disabled />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">最近课程</h2>
            <Link href="/courses" className="text-sm text-indigo-400 hover:text-indigo-300">
              全部课程
            </Link>
          </div>
          {recentCourses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center">
              <p className="text-sm text-zinc-500">还没有课程</p>
              <Link
                href="/courses/new"
                className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                创建第一门课程
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentCourses.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/courses/${c.id}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 px-4 py-3 transition hover:border-zinc-600"
                  >
                    <span className="text-sm">{c.title}</span>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">今日待办</h2>
            <Link href="/planner" className="text-sm text-indigo-400 hover:text-indigo-300">
              学习计划
            </Link>
          </div>
          {todayTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
              今天暂无待办任务
            </div>
          ) : (
            <ul className="space-y-2">
              {todayTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 px-4 py-3"
                >
                  <span className="text-sm">{t.title}</span>
                  <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
                    {KIND_LABEL[t.kind] ?? t.kind}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function QuickEntry({
  href,
  title,
  desc,
  disabled,
}: {
  href?: string;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  const cls =
    "block rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition " +
    (disabled ? "opacity-50" : "hover:border-indigo-700/60 hover:bg-zinc-900");
  const inner = (
    <>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{desc}</p>
    </>
  );
  if (disabled || !href) return <div className={cls}>{inner}</div>;
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    planning: { label: "规划中", cls: "bg-amber-950/60 text-amber-300" },
    active: { label: "进行中", cls: "bg-indigo-950/60 text-indigo-300" },
    archived: { label: "已归档", cls: "bg-zinc-800 text-zinc-400" },
  };
  const item = map[status] ?? { label: status, cls: "bg-zinc-800 text-zinc-400" };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs ${item.cls}`}>{item.label}</span>;
}
