"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveScore, nextUnscored } from "@/app/judge/actions";
import { JUDGING_CRITERIA, SCORE_MIN, SCORE_MAX } from "@/lib/judging";

type Props = {
  projectId: string;
  initialScores: Record<string, number>;
  initialComments: string | null;
};

const range = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i);

export default function ScoreForm({ projectId, initialScores, initialComments }: Props) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(initialScores);
  const [comments, setComments] = useState(initialComments ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const missing = JUDGING_CRITERIA.filter(c => typeof scores[c.id] !== "number");

  function save(goNext: boolean) {
    setMsg(null);
    startTransition(async () => {
      const res = await saveScore(projectId, { scores, comments });
      if (!res.ok) { setMsg(`Error: ${res.error}`); return; }
      if (!goNext) { setMsg("Saved."); router.refresh(); return; }
      const next = await nextUnscored(projectId);
      if (next.ok && next.projectId) router.push(`/judge/${next.projectId}`);
      else router.push("/judge");
    });
  }

  return (
    <div className="font-[family-name:var(--font-body)] space-y-6">
      {JUDGING_CRITERIA.map(c => (
        <div key={c.id}>
          <p className="font-semibold text-[#560700]">{c.label}</p>
          <p className="text-sm text-gray-600 mb-2">{c.description}</p>
          <div className="flex gap-2">
            {range.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setScores(prev => ({ ...prev, [c.id]: n }))}
                className={`w-12 h-12 rounded-xl border text-base font-semibold transition-all ${
                  scores[c.id] === n ? "bg-[#560700] text-white border-[#560700]" : "bg-white hover:bg-gray-50 border-gray-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <label className="block">
        <span className="font-semibold text-[#560700]">Comments (optional)</span>
        <textarea
          value={comments}
          onChange={e => setComments(e.target.value)}
          maxLength={2000}
          rows={4}
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          placeholder="Notes for the other judges and organizers"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => save(true)}
          disabled={busy || missing.length > 0}
          className="rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#560700] to-[#6b1003] shadow-lg disabled:opacity-50"
        >
          Save &amp; next unscored
        </button>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={busy || missing.length > 0}
          className="rounded-xl px-5 py-3 text-sm font-semibold text-[#560700] bg-white border border-[#560700]/30 disabled:opacity-50"
        >
          Save
        </button>
        {missing.length > 0 && <span className="text-sm text-gray-600">Score {missing.map(c => c.label).join(", ")} to save.</span>}
        {msg && <span className="text-sm text-gray-700">{msg}</span>}
      </div>
    </div>
  );
}
