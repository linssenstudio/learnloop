export function LlmGuide() {
  return (
    <div className="rounded-2xl border border-amber-900/60 bg-amber-950/30 p-6">
      <h3 className="font-medium text-amber-200">尚未配置 AI 模型</h3>
      <p className="mt-2 text-sm leading-relaxed text-amber-200/70">
        此功能需要调用大模型。请在项目根目录创建 <code className="rounded bg-zinc-800 px-1">.env.local</code>
        （可参考 <code className="rounded bg-zinc-800 px-1">.env.example</code>），填入
        <code className="rounded bg-zinc-800 px-1">LLM_API_KEY</code>（支持任意 OpenAI 兼容端点，默认
        Moonshot/Kimi），然后重启服务。
      </p>
    </div>
  );
}
