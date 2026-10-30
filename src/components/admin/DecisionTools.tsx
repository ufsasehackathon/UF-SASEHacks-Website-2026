"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { expireOverdueRsvps, promoteFromWaitlist, sendPendingEmails } from "@/app/admin/actions";

export default function DecisionTools({ unsentEmails, spotsLeft }: { unsentEmails: number; spotsLeft: number }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [promoteCount, setPromoteCount] = useState(Math.max(spotsLeft, 1));

  function run(fn: () => Promise<string>) {
    setMessage(null);
    startTransition(async () => {
      try {
        setMessage(await fn());
        router.refresh();
      } catch {
        setMessage("Action failed.");
      }
    });
  }

  const btn = "rounded-md border px-3 py-1.5 text-sm bg-white hover:bg-gray-50 disabled:opacity-50";

  return (
    <div className="space-y-3 font-[family-name:var(--font-body)]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={btn}
          disabled={busy}
          onClick={() => run(async () => {
            const res = await expireOverdueRsvps();
            return res.ok ? `Released ${res.count} overdue RSVP(s).` : `Error: ${res.error}`;
          })}
        >
          Expire overdue RSVPs
        </button>

        <span className="mx-2 h-5 w-px bg-gray-300" />

        <label className="text-sm text-gray-700 flex items-center gap-2">
          Promote
          <input
            type="number"
            min={1}
            value={promoteCount}
            onChange={(e) => setPromoteCount(Number(e.target.value))}
            className="w-20 rounded-md border px-2 py-1 text-sm"
          />
          from waitlist
        </label>
        <button
          className={btn}
          disabled={busy}
          onClick={() => {
            if (!confirm(`Accept the top ${promoteCount} waitlisted applicant(s)?`)) return;
            run(async () => {
              const res = await promoteFromWaitlist(promoteCount);
              return res.ok ? `Accepted ${res.count} from the waitlist. Send emails to notify them.` : `Error: ${res.error}`;
            });
          }}
        >
          Promote
        </button>

        <span className="mx-2 h-5 w-px bg-gray-300" />

        <button
          className="rounded-md border px-3 py-1.5 text-sm text-white bg-[#560700] hover:bg-[#6b1003] disabled:opacity-50"
          disabled={busy || unsentEmails === 0}
          onClick={() => {
            if (!confirm(`Send status emails to up to ${unsentEmails} applicant(s)?`)) return;
            run(async () => {
              const res = await sendPendingEmails();
              if (!res.ok) return `Error: ${res.error}${res.sent ? ` (${res.sent} sent before the error)` : ""}`;
              return `Sent ${res.sent} email(s).${res.remaining ? ` ${res.remaining} still queued (daily cap), send again tomorrow.` : ""}${res.skipped ? ` ${res.skipped} skipped (no email address).` : ""}`;
            });
          }}
        >
          Send pending emails ({unsentEmails})
        </button>
      </div>
      {message && <p className="text-sm text-gray-700">{message}</p>}
    </div>
  );
}
