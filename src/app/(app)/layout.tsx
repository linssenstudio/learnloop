import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/session";
import { isLlmConfigured } from "@/lib/setup";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <AppShell userName={user.name}>
      {!isLlmConfigured() && (
        <Link
          href="/setup"
          className="mb-4 block rounded-xl border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200 transition hover:bg-amber-950/60"
        >
          尚未接入 AI 模型，诊断、大纲与课堂功能暂不可用 → 点击完成接入
        </Link>
      )}
      {children}
    </AppShell>
  );
}
