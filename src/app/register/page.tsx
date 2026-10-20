import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
        <h1 className="mb-1 text-xl font-semibold">
          注册 <span className="text-indigo-400">LearnLoop</span>
        </h1>
        <p className="mb-6 text-sm text-zinc-500">创建你的 AI 学习工作台</p>
        <AuthForm mode="register" />
        <p className="mt-6 text-center text-sm text-zinc-500">
          已有账号？
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            去登录
          </Link>
        </p>
      </div>
    </main>
  );
}
