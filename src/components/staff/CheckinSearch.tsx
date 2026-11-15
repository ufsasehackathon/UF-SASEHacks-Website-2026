"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkinState, etTime, type CheckinPerson } from "@/lib/checkin";
import { addToWaitlist, checkIn, searchPeople, undoCheckIn } from "@/app/staff/checkin/actions";

const smallButton =
  "rounded-lg border border-[#560700]/30 bg-white px-3 py-1 text-sm text-[#560700] hover:bg-[#560700]/10 disabled:opacity-50";

/**
 * Check-in tab search: debounced name/email/Discord lookup with the check-in or waitlist action for
 * each person. `waitlistIds` is the waitlist in order (from the page's summary), for "Waitlist #n".
 */
export function CheckinSearch({ waitlistIds }: { waitlistIds: string[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<CheckinPerson[]>([]);
  // The query the shown results are for (so "No matches" waits for the debounced search)
  const [searched, setSearched] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  // Only the newest search may update the results
  const latest = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const id = ++latest.current;
    // searchPeople needs 2+ characters; skip the round trip
    const res = q.trim().length < 2 ? { ok: true, error: undefined, people: [] } : await searchPeople(q);
    if (id !== latest.current) return;
    setSearchError(res.ok ? null : res.error ?? "Search failed");
    setPeople(res.people);
    setSearched(q);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void runSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  function act(userId: string, action: (userId: string) => Promise<{ ok: boolean; error?: string }>) {
    setRowErrors(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    startTransition(async () => {
      const res = await action(userId);
      if (!res.ok) setRowErrors(prev => ({ ...prev, [userId]: res.error ?? "Something went wrong" }));
      await runSearch(query);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 font-[family-name:var(--font-body)] text-[#560700]">
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search name, email or Discord username"
        aria-label="Search people"
        className="w-full rounded-lg border border-[#560700]/30 bg-white px-3 py-2 sm:max-w-md"
      />

      {searchError && <p className="text-sm text-red-700">{searchError}</p>}

      {people.length > 0 && (
        <ul className="divide-y divide-[#560700]/10 rounded-3xl bg-white/90 shadow-2xl">
          {people.map(p => {
            const state = checkinState(p);
            const position = waitlistIds.indexOf(p.userId) + 1;
            return (
              <li key={p.userId} data-testid="checkin-result" className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.name}</p>
                    <p className="break-words text-sm text-[#560700]/70">{p.email}</p>
                    <p className="text-sm text-[#560700]/70">{p.discordUsername ?? "Discord not linked"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm">
                    {state === "can_check_in" && (
                      <button type="button" disabled={busy} onClick={() => act(p.userId, checkIn)} className={smallButton}>
                        Check in
                      </button>
                    )}
                    {state === "checked_in" && (
                      <>
                        <span className="text-green-800">Checked in {etTime(p.checkedInAt!)}</span>
                        <button type="button" disabled={busy} onClick={() => act(p.userId, undoCheckIn)} className={smallButton}>
                          Undo
                        </button>
                      </>
                    )}
                    {state === "waitlisted" && <span>{position > 0 ? `Waitlist #${position}` : "Waitlist"}</span>}
                    {state === "can_waitlist" && (
                      <button type="button" disabled={busy} onClick={() => act(p.userId, addToWaitlist)} className={smallButton}>
                        Add to waitlist
                      </button>
                    )}
                    {state === "needs_discord" && (
                      <button type="button" disabled className={smallButton}>
                        Link Discord first
                      </button>
                    )}
                    {state === "needs_agreements" && (
                      <button type="button" disabled className={smallButton}>
                        Agreements not accepted
                      </button>
                    )}
                  </div>
                </div>
                {rowErrors[p.userId] && <p className="mt-2 text-sm text-red-700">{rowErrors[p.userId]}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {people.length === 0 && searched === query && query.trim().length >= 2 && !searchError && (
        <p className="text-sm text-[#560700]/70">No one matches that search.</p>
      )}
    </div>
  );
}
