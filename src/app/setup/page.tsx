import type { Metadata } from "next";
import { SetupWizard } from "@/components/setup-wizard";

export const metadata: Metadata = {
  title: "接入 AI 模型 — LearnLoop",
};

export default function SetupPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold">
          欢迎使用 <span className="text-indigo-400">LearnLoop</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          你的 AI 学习工作台。开始之前，先用 30 秒接入一个大模型（支持任意 OpenAI 兼容端点）。
        </p>
      </div>
      <SetupWizard />
      <p className="mt-6 text-xs text-zinc-600">
        配置会写入项目根目录的 .env.local（不会提交到 Git），也可以跳过向导手动创建该文件。
      </p>
    </main>
  );
}
