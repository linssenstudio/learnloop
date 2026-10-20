import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
        <h1 className="mb-1 text-xl font-semibold">
          登录 <span className="text-indigo-400">LearnLoop</span>
        </h1>
        <p className="mb-6 text-sm text-zinc-500">继续你的学习循环</p>
        <AuthForm mode="login" />
        <p className="mt-6 text-center text-sm text-zinc-500">
          还没有账号？
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300">
            立即注册
          </Link>
        </p>
      </div>
    </main>
  );
}
