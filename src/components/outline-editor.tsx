"use client";

export interface EditableLesson {
  id?: string;
  title: string;
  objectives: string[];
  est_minutes?: number;
}

export interface EditableUnit {
  id?: string;
  title: string;
  summary: string;
  lessons: EditableLesson[];
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-indigo-500";
const btnCls = "rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-30";

export function OutlineEditor({
  units,
  onChange,
}: {
  units: EditableUnit[];
  onChange: (units: EditableUnit[]) => void;
}) {
  const totalMinutes = units.reduce(
    (sum, u) => sum + u.lessons.reduce((s, l) => s + (l.est_minutes ?? 0), 0),
    0
  );

  const setUnit = (i: number, patch: Partial<EditableUnit>) =>
    onChange(units.map((u, idx) => (idx === i ? { ...u, ...patch } : u)));
  const setLesson = (ui: number, li: number, patch: Partial<EditableLesson>) =>
    setUnit(ui, {
      lessons: units[ui].lessons.map((l, idx) => (idx === li ? { ...l, ...patch } : l)),
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        共 {units.length} 个单元、{units.reduce((s, u) => s + u.lessons.length, 0)} 节课，预计总学时约{" "}
        {Math.round((totalMinutes / 60) * 10) / 10} 小时
      </p>
      {units.map((u, ui) => (
        <div key={u.id ?? ui} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-zinc-500">单元 {ui + 1}</span>
            <input className={inputCls} value={u.title} onChange={(e) => setUnit(ui, { title: e.target.value })} />
            <button className={btnCls} disabled={ui === 0} onClick={() => onChange(move(units, ui, ui - 1))}>
              ↑
            </button>
            <button className={btnCls} disabled={ui === units.length - 1} onClick={() => onChange(move(units, ui, ui + 1))}>
              ↓
            </button>
            <button
              className={btnCls}
              disabled={units.length <= 1}
              onClick={() => onChange(units.filter((_, idx) => idx !== ui))}
            >
              删除
            </button>
          </div>
          <input
            className={`${inputCls} mt-2 text-zinc-400`}
            placeholder="单元简介（可选）"
            value={u.summary}
            onChange={(e) => setUnit(ui, { summary: e.target.value })}
          />
          <div className="mt-3 space-y-3 border-l-2 border-zinc-800 pl-4">
            {u.lessons.map((l, li) => (
              <div key={l.id ?? li} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs text-zinc-600">{ui + 1}.{li + 1}</span>
                  <input
                    className={inputCls}
                    value={l.title}
                    onChange={(e) => setLesson(ui, li, { title: e.target.value })}
                  />
                  <input
                    type="number"
                    min={5}
                    max={240}
                    className={`${inputCls} w-24 shrink-0`}
                    title="预计分钟数"
                    value={l.est_minutes ?? 30}
                    onChange={(e) => setLesson(ui, li, { est_minutes: Number(e.target.value) || 30 })}
                  />
                  <button className={btnCls} disabled={li === 0} onClick={() => setUnit(ui, { lessons: move(u.lessons, li, li - 1) })}>
                    ↑
                  </button>
                  <button
                    className={btnCls}
                    disabled={li === u.lessons.length - 1}
                    onClick={() => setUnit(ui, { lessons: move(u.lessons, li, li + 1) })}
                  >
                    ↓
                  </button>
                  <button
                    className={btnCls}
                    disabled={u.lessons.length <= 1}
                    onClick={() => setUnit(ui, { lessons: u.lessons.filter((_, idx) => idx !== li) })}
                  >
                    删除
                  </button>
                </div>
                <textarea
                  className={`${inputCls} h-16 resize-y text-xs text-zinc-400`}
                  placeholder="学习目标（每行一条）"
                  value={l.objectives.join("\n")}
                  onChange={(e) => setLesson(ui, li, { objectives: e.target.value.split("\n") })}
                />
              </div>
            ))}
            <button
              className={btnCls}
              onClick={() =>
                setUnit(ui, { lessons: [...u.lessons, { title: "新课时", objectives: ["能描述本课主题"], est_minutes: 30 }] })
              }
            >
              + 添加课时
            </button>
          </div>
        </div>
      ))}
      <button
        className="rounded-lg border border-dashed border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-indigo-600 hover:text-indigo-300"
        onClick={() =>
          onChange([
            ...units,
            { title: `新单元 ${units.length + 1}`, summary: "", lessons: [{ title: "新课时", objectives: ["能描述本课主题"], est_minutes: 30 }] },
          ])
        }
      >
        + 添加单元
      </button>
    </div>
  );
}
