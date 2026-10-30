"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveReview, nextUnreviewed, setStatus, type AdminSettableStatus } from "@/app/admin/actions";

type Props = {
  userId: string;
  initialScore: number | null;
  initialNotes: string | null;
};

export default function ReviewForm({ userId, initialScore, initialNotes }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [score, setScore] = useState<number | null>(initialScore);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [message, setMessage] = useState<string | null>(null);

  function save(goNext: boolean) {
    setMessage(null);
    startTransition(async () => {
      const res = await saveReview(userId, score, notes);
      if (!res.ok) { setMessage(`Error: ${res.error}`); return; }
      if (!goNext) { setMessage("Saved."); router.refresh(); return; }

      const next = await nextUnreviewed(userId);
      if (next.ok && next.userId) router.push(`/admin/${next.userId}`);
      else { setMessage("Saved. No more unreviewed applications."); router.refresh(); }
    });
  }

  function decide(status: AdminSettableStatus) {
    setMessage(null);
    startTransition(async () => {
      const res = await setStatus([userId], status);
      setMessage(res.ok ? `Marked ${status}. Their email is queued.` : `Error: ${res.error}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 font-[family-name:var(--font-body)]">
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-2">Score</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(score === n ? null : n)}
              className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-all ${
                score === n ? "bg-[#560700] text-white border-[#560700]" : "bg-white hover:bg-gray-50 border-gray-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-gray-600">Notes (admins only)</span>
        <textarea
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => save(false)}
          className="rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50">
          Save
        </button>
        <button type="button" disabled={busy} onClick={() => save(true)}
          className="rounded-md border px-3 py-1.5 text-sm text-white bg-[#560700] hover:bg-[#6b1003] disabled:opacity-50">
          Save &amp; next unreviewed
        </button>
        <span className="mx-1 h-8 w-px bg-gray-300" />
        <button type="button" disabled={busy} onClick={() => decide("accepted")}
          className="rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50">
          Accept
        </button>
        <button type="button" disabled={busy} onClick={() => decide("waitlist")}
          className="rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50">
          Waitlist
        </button>
        <button type="button" disabled={busy} onClick={() => decide("rejected")}
          className="rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50">
          Reject
        </button>
      </div>

      {message && <p className="text-sm text-gray-700">{message}</p>}
    </div>
  );
}
