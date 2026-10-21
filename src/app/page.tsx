import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isLlmConfigured } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isLlmConfigured()) redirect("/setup");
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
