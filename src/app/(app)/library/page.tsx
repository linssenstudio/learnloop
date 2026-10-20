import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listFiles } from "@/lib/files";
import { LibraryClient } from "@/components/library-client";

export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <LibraryClient initialFiles={listFiles(user.id)} />;
}
