import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getOwnedCourse } from "@/lib/courses";
import { FlashcardReview } from "@/components/flashcard-review";

export default async function FlashcardsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!getOwnedCourse(user.id, id)) notFound();
  return <FlashcardReview courseId={id} />;
}
