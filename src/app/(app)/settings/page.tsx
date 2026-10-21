import Link from "next/link";
import { setupStatus } from "@/lib/setup";

function DevCard({ title, note, badge }: { title: string; note: string; badge: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 opacity-70">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        <span className="rounded-full border border-indigo-900/60 bg-indigo-950/40 px-2.5 py-0.5 text-xs text-indigo-300">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-500">{note}</p>
    </div>
  );
}

export default function SettingsPage() {
  const status = setupStatus();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">设置</h1>
        <p className="mt-1 text-sm text-zinc-500">模型接入与偏好</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">模型接入</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs ${
              status.configured ? "bg-emerald-950/60 text-emerald-300" : "bg-amber-950/60 text-amber-300"
            }`}
          >
            {status.configured ? "已配置" : "未配置"}
          </span>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Base URL</dt>
            <dd className="truncate text-zinc-300">{status.baseUrl}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">模型</dt>
            <dd className="text-zinc-300">{status.model}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">API Key</dt>
            <dd className="text-zinc-300">{status.keyHint ?? "未设置"}</dd>
          </div>
        </dl>
        <Link
          href="/setup"
          className="mt-4 inline-block rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-indigo-500"
        >
          {status.configured ? "重新配置" : "去配置"}
        </Link>
        <p className="mt-3 text-xs text-zinc-600">
          也可以手动编辑项目根目录的 .env.local（LLM_BASE_URL / LLM_API_KEY / LLM_MODEL），保存后重新配置即时生效。
        </p>
      </div>

      <DevCard title="教师风格" note="调整 AI 教师的讲解风格、语言与节奏偏好" badge="开发中（P1）" />
      <DevCard title="隐私与数据" note="本地数据导出、清除与账号管理" badge="开发中（P2）" />
      <DevCard title="用量统计" note="Token 用量与费用估算报表" badge="开发中（P1）" />
    </div>
  );
}
