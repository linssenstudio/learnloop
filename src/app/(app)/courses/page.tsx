import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listCourses } from "@/lib/courses";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  planning: { label: "规划中", cls: "bg-amber-950/60 text-amber-300" },
  active: { label: "进行中", cls: "bg-indigo-950/60 text-indigo-300" },
  archived: { label: "已归档", cls: "bg-zinc-800 text-zinc-400" },
};

export default async function CoursesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const courses = listCourses(user.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">我的课程</h1>
          <p className="mt-1 text-sm text-zinc-500">共 {courses.length} 门课程</p>
        </div>
        <Link
          href="/courses/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          新建课程
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-20 text-center">
          <p className="text-sm text-zinc-500">还没有课程</p>
          <Link
            href="/courses/new"
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            创建第一门课程
          </Link>
          <p className="mt-3 text-xs text-zinc-600">AI 会帮你诊断基础并规划个性化大纲</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => {
            const pct = c.lesson_count > 0 ? Math.round((c.done_count / c.lesson_count) * 100) : 0;
            const badge = STATUS_LABEL[c.status] ?? STATUS_LABEL.active;
            return (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-indigo-700/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 truncate font-medium">{c.title}</h2>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
                </div>
                {c.goal_text && <p className="mt-2 line-clamp-2 text-sm text-zinc-500">{c.goal_text}</p>}
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-zinc-500">
                    <span>
                      {c.unit_count} 个单元 · {c.done_count}/{c.lesson_count} 课时
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-600">
                  创建于 {new Date(c.created_at).toLocaleDateString("zh-CN")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
