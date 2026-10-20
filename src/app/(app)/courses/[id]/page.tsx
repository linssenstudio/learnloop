import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getCourseDetail, getOwnedCourse } from "@/lib/courses";
import { CourseActions } from "@/components/course-actions";

const LESSON_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "待学", cls: "bg-zinc-800 text-zinc-400" },
  active: { label: "在学", cls: "bg-amber-950/60 text-amber-300" },
  done: { label: "已完成", cls: "bg-emerald-950/60 text-emerald-300" },
};

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!getOwnedCourse(user.id, id)) notFound();
  const detail = getCourseDetail(id);
  if (!detail) notFound();
  const { course, units, sources, progress } = detail;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const totalMinutes = units.reduce(
    (sum, u) => sum + u.lessons.reduce((s, l) => s + (l.est_minutes ?? 0), 0),
    0
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">
            <Link href="/courses" className="hover:text-zinc-300">
              我的课程
            </Link>{" "}
            /
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{course.title}</h1>
        </div>
        <CourseActions
          courseId={course.id}
          units={units.map((u) => ({
            id: u.id,
            title: u.title,
            summary: u.summary,
            lessons: u.lessons.map((l) => ({
              id: l.id,
              title: l.title,
              objectives: l.objectives,
              est_minutes: l.est_minutes ?? 30,
            })),
          }))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-3">
          {units.map((u, ui) => (
            <div key={u.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="font-medium">
                单元 {ui + 1} · {u.title}
              </h2>
              {u.summary && <p className="mt-1 text-sm text-zinc-500">{u.summary}</p>}
              <ul className="mt-3 space-y-2">
                {u.lessons.map((l, li) => {
                  const badge = LESSON_BADGE[l.status] ?? LESSON_BADGE.pending;
                  return (
                    <li
                      key={l.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {ui + 1}.{li + 1} {l.title}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-600">约 {l.est_minutes ?? 30} 分钟</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs ${badge.cls}`}>{badge.label}</span>
                        <Link
                          href={`/courses/${course.id}/learn/${l.id}`}
                          className="rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500"
                        >
                          开始学习
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <aside className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="mb-3 font-medium">学习产出</h2>
            <Link
              href={`/courses/${course.id}/flashcards`}
              className="block rounded-lg border border-zinc-700 px-3 py-2 text-center text-sm text-zinc-300 transition hover:border-indigo-600 hover:text-indigo-300"
            >
              闪卡复习
            </Link>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="mb-3 font-medium">课程信息</h2>
            <dl className="space-y-3 text-sm">
              {course.goal_text && (
                <div>
                  <dt className="text-xs text-zinc-500">学习目标</dt>
                  <dd className="mt-0.5 text-zinc-300">{course.goal_text}</dd>
                </div>
              )}
              {course.level && (
                <div>
                  <dt className="text-xs text-zinc-500">当前基础</dt>
                  <dd className="mt-0.5 text-zinc-300">{course.level}</dd>
                </div>
              )}
              {course.duration_text && (
                <div>
                  <dt className="text-xs text-zinc-500">期望时长</dt>
                  <dd className="mt-0.5 text-zinc-300">{course.duration_text}</dd>
                </div>
              )}
              {course.outcome && (
                <div>
                  <dt className="text-xs text-zinc-500">产出目标</dt>
                  <dd className="mt-0.5 text-zinc-300">{course.outcome}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-zinc-500">预计总学时</dt>
                <dd className="mt-0.5 text-zinc-300">约 {Math.round((totalMinutes / 60) * 10) / 10} 小时</dd>
              </div>
              <div>
                <dt className="mb-1 text-xs text-zinc-500">
                  学习进度 {progress.done}/{progress.total}（{pct}%）
                </dt>
                <dd className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="mb-3 font-medium">关联资料</h2>
            {sources.length === 0 ? (
              <p className="text-sm text-zinc-600">未关联资料</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {sources.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
                    <span className="min-w-0 truncate text-zinc-300">{s.name}</span>
                    {s.page_count !== null && <span className="shrink-0 text-xs text-zinc-600">{s.page_count} 页</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {detail.diagnostics.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="mb-3 font-medium">诊断记录</h2>
              <ul className="space-y-2 text-sm">
                {detail.diagnostics.map((d, i) => (
                  <li key={d.id} className="rounded-lg border border-zinc-800 px-3 py-2">
                    <p className="text-zinc-300">
                      {i + 1}. {d.question}
                    </p>
                    <p className="mt-1 text-xs">
                      {d.correct === null ? (
                        <span className="text-zinc-500">未作答</span>
                      ) : d.correct === 1 ? (
                        <span className="text-emerald-400">回答正确</span>
                      ) : (
                        <span className="text-red-400">回答错误（正确答案：{d.answer}）</span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
