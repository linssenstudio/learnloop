"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Card {
  id: string;
  front: string;
  back: string;
  source_ref: string | null;
  reps: number;
}

const GRADES = [
  { grade: 0, label: "完全不会", cls: "border-red-800 text-red-300 hover:bg-red-950/40" },
  { grade: 1, label: "模糊", cls: "border-amber-800 text-amber-300 hover:bg-amber-950/40" },
  { grade: 2, label: "记住了", cls: "border-indigo-700 text-indigo-300 hover:bg-indigo-950/40" },
  { grade: 3, label: "很熟练", cls: "border-emerald-800 text-emerald-300 hover:bg-emerald-950/40" },
];

export function FlashcardReview({ courseId }: { courseId: string }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    fetch(`/api/flashcards?courseId=${courseId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { cards: Card[]; total: number } | null) => {
        if (d) {
          setCards(d.cards);
          setTotal(d.total);
        }
      })
      .catch(() => {});
  }, [courseId]);

  async function onGrade(grade: number) {
    const card = cards?.[index];
    if (!card) return;
    await fetch(`/api/flashcards/${card.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade }),
    });
    setReviewed((r) => r + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  if (!cards) return <p className="text-sm text-zinc-500">加载中…</p>;

  const current = cards[index];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">闪卡复习</h1>
          <p className="mt-1 text-sm text-zinc-500">
            到期 {cards.length} 张 · 共 {total} 张{reviewed > 0 && ` · 本轮已复习 ${reviewed} 张`}
          </p>
        </div>
        <Link href={`/courses/${courseId}`} className="text-sm text-zinc-500 hover:text-zinc-300">
          返回课程
        </Link>
      </div>

      {!current ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-20 text-center">
          {cards.length === 0 ? (
            <>
              <p className="text-sm text-zinc-500">现在没有到期的闪卡</p>
              <p className="mt-2 text-xs text-zinc-600">完成一节课后会自动生成 3-6 张闪卡，记得按时回来复习。</p>
            </>
          ) : (
            <p className="text-sm text-emerald-300">本轮复习完成，共 {reviewed} 张</p>
          )}
        </div>
      ) : (
        <>
          <button
            onClick={() => setFlipped((f) => !f)}
            className="flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900/60 p-8 text-center transition hover:border-indigo-700/60"
          >
            <p className="text-xs text-zinc-500">{flipped ? "答案" : "问题"}（点击翻面）</p>
            <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed">{flipped ? current.back : current.front}</p>
            {current.source_ref && <p className="mt-4 text-xs text-zinc-600">来源：{current.source_ref}</p>}
          </button>
          <p className="text-center text-xs text-zinc-600">
            第 {index + 1} / {cards.length} 张{current.reps > 0 && ` · 已复习 ${current.reps} 次`}
          </p>
          {flipped && (
            <div className="grid grid-cols-4 gap-2">
              {GRADES.map((g) => (
                <button
                  key={g.grade}
                  onClick={() => onGrade(g.grade)}
                  className={`rounded-lg border px-2 py-2 text-sm transition ${g.cls}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
