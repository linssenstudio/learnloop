"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "工作台", icon: "⌂" },
  { href: "/courses", label: "我的课程", icon: "▤" },
  { href: "/library", label: "知识库", icon: "▦" },
  { href: "/tools", label: "学习工具", icon: "⚒" },
  { href: "/planner", label: "学习计划", icon: "◷" },
  { href: "/growth", label: "我的成长", icon: "↗" },
  { href: "/settings", label: "设置", icon: "⚙" },
];

export function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function onLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/40 md:flex">
        <Link href="/dashboard" className="flex h-14 items-center px-5 text-lg font-semibold">
          Learn<span className="text-indigo-400">Loop</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-indigo-600/15 font-medium text-indigo-300"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                }`}
              >
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4 md:px-6">
          <Link href="/dashboard" className="text-base font-semibold md:hidden">
            Learn<span className="text-indigo-400">Loop</span>
          </Link>
          <div className="hidden md:block" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{userName}</span>
            <button
              onClick={onLogout}
              disabled={loggingOut}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
            >
              {loggingOut ? "退出中…" : "登出"}
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
