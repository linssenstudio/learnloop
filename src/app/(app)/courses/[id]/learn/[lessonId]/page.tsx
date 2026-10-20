import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getCourseDetail, getOwnedCourse } from "@/lib/courses";
import { Classroom } from "@/components/classroom";
import { db } from "@/lib/db";

export default async function LearnPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id, lessonId } = await params;
  if (!getOwnedCourse(user.id, id)) notFound();
  const lesson = db.prepare("SELECT id FROM lessons WHERE id = ? AND course_id = ?").get(lessonId, id);
  if (!lesson) notFound();
  const detail = getCourseDetail(id);
  if (!detail) notFound();
  return (
    <Classroom
      courseId={id}
      lessonId={lessonId}
      units={detail.units.map((u) => ({
        id: u.id,
        title: u.title,
        lessons: u.lessons.map((l) => ({ id: l.id, title: l.title, status: l.status })),
      }))}
    />
  );
}
