"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OutlineEditor, type EditableUnit } from "@/components/outline-editor";

export function CourseActions({ courseId, units }: { courseId: string; units: EditableUnit[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableUnit[]>(units);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const cleaned = draft.map((u) => ({
        ...u,
        lessons: u.lessons.map((l) => ({ ...l, objectives: l.objectives.map((s) => s.trim()).filter(Boolean) })),
      }));
      const res = await fetch(`/api/courses/${courseId}/outline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units: cleaned }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "保存大纲失败");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("确定删除这门课程吗？相关的大纲、诊断与学习记录都会被删除。")) return;
    const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/courses");
      router.refresh();
    }
  }

  if (editing) {
    return (
      <div className="space-y-3">
        {error && (
          <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
        <OutlineEditor units={draft} onChange={setDraft} />
        <div className="flex gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存大纲"}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setDraft(units);
            }}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setEditing(true)}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500"
      >
        编辑大纲
      </button>
      <button
        onClick={onDelete}
        className="rounded-lg border border-red-900/60 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-950/40"
      >
        删除课程
      </button>
    </div>
  );
}
