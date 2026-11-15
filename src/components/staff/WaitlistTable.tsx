"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CheckinPerson } from "@/lib/checkin";
import { admitFromWaitlist, removeFromWaitlist } from "@/app/staff/checkin/actions";

const smallButton =
  "rounded-lg border border-[#560700]/30 bg-white px-3 py-1 text-sm text-[#560700] hover:bg-[#560700]/10 disabled:opacity-50";

function fmtAdded(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
}

/** On-site waitlist in the order people were added (from the page's summary): admit & check in, or remove */
export function WaitlistTable({ people }: { people: CheckinPerson[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function act(userId: string, action: (userId: string) => Promise<{ ok: boolean; error?: string }>) {
    setErrors(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    startTransition(async () => {
      const res = await action(userId);
      if (!res.ok) setErrors(prev => ({ ...prev, [userId]: res.error ?? "Something went wrong" }));
      router.refresh();
    });
  }

  function remove(person: CheckinPerson) {
    if (!window.confirm(`Remove ${person.name} from the waitlist? They'll be marked as declined.`)) return;
    act(person.userId, removeFromWaitlist);
  }

  return (
    <div className="overflow-x-auto rounded-3xl bg-white/90 font-[family-name:var(--font-body)] text-[#560700] shadow-2xl">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[#560700]/10">
          <tr>
            <th className="p-3">#</th>
            <th className="p-3">Name</th>
            <th className="p-3">Added</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {people.length === 0 && (
            <tr>
              <td colSpan={4} className="p-6 text-center text-[#560700]/70">No one is on the waitlist.</td>
            </tr>
          )}
          {people.map((p, i) => (
            <Fragment key={p.userId}>
              <tr data-testid="waitlist-row" className={errors[p.userId] ? "" : "border-b border-[#560700]/10 last:border-0"}>
                <td className="p-3">{i + 1}</td>
                <td className="p-3 font-semibold">{p.name}</td>
                <td className="p-3 whitespace-nowrap" suppressHydrationWarning>{fmtAdded(p.waitlistedAt)}</td>
                <td className="p-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={busy} onClick={() => act(p.userId, admitFromWaitlist)} className={smallButton}>
                      Admit &amp; check in
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(p)}
                      className="text-xs text-[#560700]/70 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
              {errors[p.userId] && (
                <tr className="border-b border-[#560700]/10">
                  <td colSpan={4} className="px-3 pb-3 text-sm text-red-700">{errors[p.userId]}</td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
