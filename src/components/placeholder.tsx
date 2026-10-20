export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-center">
      <h1 className="text-lg font-semibold text-zinc-200">{title}</h1>
      {note && <p className="mt-2 text-sm text-zinc-500">{note}</p>}
      <span className="mt-4 rounded-full border border-indigo-900/60 bg-indigo-950/40 px-3 py-1 text-xs text-indigo-300">
        开发中（P1）
      </span>
    </div>
  );
}
