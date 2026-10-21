"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PRESETS = [
  { label: "Moonshot / Kimi（国内版）", baseUrl: "https://api.moonshot.cn/v1", keyUrl: "https://platform.moonshot.cn" },
  { label: "Moonshot / Kimi（国际版）", baseUrl: "https://api.moonshot.ai/v1", keyUrl: "https://platform.moonshot.ai" },
];

const DEFAULT_MODEL = "kimi-k2-0711-preview";
const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500";

export function SetupWizard() {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState(PRESETS[0].baseUrl);
  const [custom, setCustom] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[] | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [configuredHint, setConfiguredHint] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { configured: boolean; baseUrl: string; model: string; keyHint: string | null } | null) => {
        if (!d) return;
        setBaseUrl(d.baseUrl);
        setModel(d.model);
        if (d.configured) setConfiguredHint(d.keyHint);
      })
      .catch(() => {});
  }, []);

  async function onTest() {
    setError(null);
    setTesting(true);
    setModels(null);
    try {
      const res = await fetch("/api/setup/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; models?: string[]; message?: string };
      if (res.status === 401) {
        setNeedLogin(true);
        return;
      }
      if (!data.ok) {
        setError(data.message ?? "连接失败");
        return;
      }
      const list = data.models ?? [];
      setModels(list);
      if (list.includes(DEFAULT_MODEL)) {
        setModel(DEFAULT_MODEL);
        setModelNote(null);
      } else {
        setModel(list[0]);
        setModelNote(`模型列表中没有默认的 ${DEFAULT_MODEL}，已为你选择 ${list[0]}`);
      }
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setTesting(false);
    }
  }

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey, model }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (res.status === 401) {
        setNeedLogin(true);
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.message ?? "保存失败");
        return;
      }
      router.push("/register");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  const keyUrl = custom ? "https://platform.moonshot.cn" : (PRESETS.find((p) => p.baseUrl === baseUrl)?.keyUrl ?? PRESETS[0].keyUrl);

  return (
    <div className="w-full max-w-lg space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
      {configuredHint && (
        <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          当前已配置（Key：{configuredHint}），可在此重新配置。
        </p>
      )}
      {needLogin && (
        <p className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
          已完成初始配置，修改需要先
          <a href="/login" className="mx-1 underline">
            登录
          </a>
          。
        </p>
      )}

      <section>
        <p className="mb-2 text-sm font-medium text-zinc-300">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-indigo-500 text-xs text-indigo-300">1</span>
          选择服务商
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.baseUrl}
              onClick={() => {
                setBaseUrl(p.baseUrl);
                setCustom(false);
                setModels(null);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                !custom && baseUrl === p.baseUrl
                  ? "border-indigo-500 bg-indigo-950/50 text-indigo-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setCustom(true)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              custom ? "border-indigo-500 bg-indigo-950/50 text-indigo-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            自定义（任意 OpenAI 兼容端点）
          </button>
        </div>
        {custom && (
          <input
            className={`${inputCls} mt-3`}
            placeholder="https://your-endpoint/v1"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setModels(null);
            }}
          />
        )}
      </section>

      <section>
        <p className="mb-2 text-sm font-medium text-zinc-300">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-indigo-500 text-xs text-indigo-300">2</span>
          填入 API Key 并测试连接
        </p>
        <input
          type="password"
          className={inputCls}
          placeholder="sk-..."
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setModels(null);
          }}
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          还没有 Key？
          <a href={keyUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">
            去 {keyUrl.replace("https://", "")} 免费获取 →
          </a>
        </p>
        <button
          onClick={onTest}
          disabled={!apiKey.trim() || !baseUrl.trim() || testing}
          className="mt-3 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-indigo-500 disabled:opacity-50"
        >
          {testing ? "测试连接中…" : "测试连接"}
        </button>
      </section>

      {error && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {models && (
        <section>
          <p className="mb-2 text-sm font-medium text-zinc-300">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-indigo-500 text-xs text-indigo-300">3</span>
            选择模型并保存
          </p>
          <p className="mb-2 text-xs text-emerald-400">✓ 连接成功，发现 {models.length} 个可用模型</p>
          <select className={inputCls} value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {modelNote && <p className="mt-1.5 text-xs text-amber-400">{modelNote}</p>}
          <button
            onClick={onSave}
            disabled={saving}
            className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存并开始使用"}
          </button>
        </section>
      )}
    </div>
  );
}
