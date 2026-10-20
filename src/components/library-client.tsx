"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface FileItem {
  id: string;
  name: string;
  size: number;
  status: "parsing" | "ready" | "failed";
  error: string | null;
  page_count: number | null;
  created_at: number;
  progress: number | null;
}

interface Chunk {
  id: string;
  ord: number;
  page: number | null;
  heading: string | null;
  text: string;
}

interface SearchResult {
  id: string;
  file_id: string;
  file_name: string;
  ord: number;
  page: number | null;
  snippet: string;
}

const PAGE_SIZE = 20;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString("zh-CN", { hour12: false });
}

function sanitizeSnippet(snippet: string): string {
  return snippet
    .replace(/<mark>/g, "\x00")
    .replace(/<\/mark>/g, "\x01")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\x00/g, '<mark class="rounded bg-indigo-500/40 px-0.5 text-indigo-100">')
    .replace(/\x01/g, "<\/mark>");
}

export function LibraryClient({ initialFiles }: { initialFiles: FileItem[] }) {
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FileItem | null>(null);
  const [preview, setPreview] = useState<{ chunks: Chunk[]; total: number; page: number } | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [highlightChunk, setHighlightChunk] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshFiles = useCallback(async () => {
    const res = await fetch("/api/files");
    if (res.ok) {
      const data = (await res.json()) as { files: FileItem[] };
      setFiles(data.files);
      setSelected((prev) => (prev ? (data.files.find((f) => f.id === prev.id) ?? prev) : prev));
    }
  }, []);

  useEffect(() => {
    if (!files.some((f) => f.status === "parsing")) return;
    const timer = setInterval(refreshFiles, 2000);
    return () => clearInterval(timer);
  }, [files, refreshFiles]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "上传失败，请稍后重试");
        return;
      }
      await refreshFiles();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setUploading(false);
    }
  }

  async function openPreview(file: FileItem, page = 1, highlight?: string) {
    setSelected(file);
    setHighlightChunk(highlight ?? null);
    const res = await fetch(`/api/files/${file.id}/chunks?page=${page}&size=${PAGE_SIZE}`);
    if (res.ok) {
      const data = (await res.json()) as { chunks: Chunk[]; total: number; page: number };
      setPreview(data);
    }
  }

  async function onDelete(file: FileItem) {
    if (!window.confirm(`确定删除「${file.name}」吗？`)) return;
    const res = await fetch(`/api/files/${file.id}`, { method: "DELETE" });
    if (res.ok) {
      if (selected?.id === file.id) {
        setSelected(null);
        setPreview(null);
      }
      await refreshFiles();
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/search?q=${encodeURIComponent(query.trim())}`);
      const data = (await res.json().catch(() => ({}))) as { results?: SearchResult[]; message?: string };
      if (!res.ok) {
        setError(data.message ?? "检索失败");
        setResults(null);
        return;
      }
      setResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  function jumpTo(result: SearchResult) {
    const file = files.find((f) => f.id === result.file_id);
    if (!file) return;
    setResults(null);
    openPreview(file, Math.floor(result.ord / PAGE_SIZE) + 1, result.id);
  }

  const totalPages = preview ? Math.max(1, Math.ceil(preview.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">知识库</h1>
          <p className="mt-1 text-sm text-zinc-500">上传学习资料，自动解析分块，支持全文检索（3 个字符起）</p>
        </div>
        <div>
          <input ref={inputRef} type="file" accept=".pdf,.docx,.pptx" className="hidden" onChange={onUpload} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {uploading ? "上传中…" : "上传资料"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">{error}</p>
      )}

      <form onSubmit={onSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="检索全部资料内容，如：机器学习"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 disabled:opacity-50"
        >
          {searching ? "检索中…" : "检索"}
        </button>
        {results !== null && (
          <button
            type="button"
            onClick={() => setResults(null)}
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300"
          >
            清除结果
          </button>
        )}
      </form>

      {results !== null ? (
        <section className="space-y-2">
          <p className="text-sm text-zinc-500">找到 {results.length} 条结果</p>
          {results.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
              没有命中「{query}」的内容（注意：检索词至少 3 个字符）
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => jumpTo(r)}
              className="block w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-left transition hover:border-indigo-700/60"
            >
              <p className="mb-1 text-xs text-zinc-500">
                {r.file_name}
                {r.page !== null && <span className="ml-2 text-indigo-400">第 {r.page} 页</span>}
              </p>
              <p
                className="text-sm text-zinc-300"
                dangerouslySetInnerHTML={{ __html: sanitizeSnippet(r.snippet) }}
              />
            </button>
          ))}
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="space-y-2 lg:col-span-2">
            {files.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-16 text-center">
                <p className="text-sm text-zinc-500">知识库还是空的</p>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  上传第一份资料
                </button>
                <p className="mt-3 text-xs text-zinc-600">支持 PDF / DOCX / PPTX，单文件 ≤30MB</p>
              </div>
            ) : (
              files.map((f) => (
                <div
                  key={f.id}
                  className={`rounded-xl border px-4 py-3 transition ${
                    selected?.id === f.id ? "border-indigo-700/60 bg-zinc-900" : "border-zinc-800 bg-zinc-900/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => f.status === "ready" && openPreview(f)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatSize(f.size)}
                        {f.page_count !== null && ` · ${f.page_count} 页`} · {formatTime(f.created_at)}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={f.status} progress={f.progress} />
                      <button
                        onClick={() => onDelete(f)}
                        className="text-xs text-zinc-600 transition hover:text-red-400"
                        title="删除"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  {f.status === "failed" && f.error && (
                    <p className="mt-2 rounded-lg bg-red-950/40 px-3 py-1.5 text-xs text-red-300">{f.error}</p>
                  )}
                </div>
              ))
            )}
          </section>

          <section className="lg:col-span-3">
            {!selected || !preview ? (
              <div className="flex h-full min-h-[40vh] items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-sm text-zinc-600">
                选择左侧已就绪的文件查看原文
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="min-w-0 truncate text-sm font-medium">{selected.name}</h2>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                    <button
                      disabled={preview.page <= 1}
                      onClick={() => openPreview(selected, preview.page - 1)}
                      className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-30"
                    >
                      上一页
                    </button>
                    <span>
                      {preview.page} / {totalPages}
                    </span>
                    <button
                      disabled={preview.page >= totalPages}
                      onClick={() => openPreview(selected, preview.page + 1)}
                      className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-30"
                    >
                      下一页
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {preview.chunks.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-xl border px-4 py-3 ${
                        highlightChunk === c.id ? "border-indigo-500/60 bg-indigo-950/20" : "border-zinc-800"
                      }`}
                    >
                      <p className="mb-1 text-xs text-zinc-500">
                        {c.page !== null && <span className="text-indigo-400">第 {c.page} 页</span>}
                        {c.heading && <span className="ml-2 text-zinc-400">{c.heading}</span>}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{c.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, progress }: { status: FileItem["status"]; progress: number | null }) {
  if (status === "parsing") {
    return (
      <span className="rounded-full bg-amber-950/60 px-2.5 py-0.5 text-xs text-amber-300">
        解析中{progress !== null ? ` ${progress}%` : ""}
      </span>
    );
  }
  if (status === "ready") {
    return <span className="rounded-full bg-emerald-950/60 px-2.5 py-0.5 text-xs text-emerald-300">就绪</span>;
  }
  return <span className="rounded-full bg-red-950/60 px-2.5 py-0.5 text-xs text-red-300">失败</span>;
}
