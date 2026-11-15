"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendDecisions } from "@/app/staff/applications/actions";

type Result = Awaited<ReturnType<typeof sendDecisions>>;

function summary(res: Result): string {
  const parts: string[] = [];
  if (res.ok || res.sent || res.failed) parts.push(`Sent ${res.sent}.`);
  if (res.failed) parts.push(`${res.failed} failed.`);
  if (res.noEmail) parts.push(`${res.noEmail} have no email address.`);
  if (res.stale) parts.push(`${res.stale} were no longer pending and were skipped.`);
  return parts.join(" ");
}

/** Owner only: queued decisions not yet emailed, and the button that sends them */
export function SendDecisionsBar({ accepted, rejected }: { accepted: number; rejected: number }) {
  const router = useRouter();
  const [sending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  // Keep showing the last result after a send empties the queue
  if (accepted + rejected === 0 && !result) return null;

  function send() {
    if (sending) return;
    if (!window.confirm(`Email ${accepted} acceptances and ${rejected} rejections now?`)) return;
    setResult(null);
    startTransition(async () => {
      const res = await sendDecisions();
      setResult(res);
      router.refresh();
    });
  }

  const message = result ? summary(result) : "";

  return (
    <div className="space-y-2 rounded-2xl bg-white/90 px-4 py-3 font-[family-name:var(--font-body)] text-[#560700] shadow">
      {accepted + rejected > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p>
            <strong>{accepted} accepted, {rejected} rejected</strong> not yet sent
          </p>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="rounded-xl bg-[#560700] px-4 py-2 text-sm font-semibold text-[#FFE4B3] hover:bg-[#560700]/90 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send decisions"}
          </button>
        </div>
      )}
      {message && <p className="text-sm">{message}</p>}
      {result?.error && <p className="text-sm text-red-700">{result.error}</p>}
    </div>
  );
}
