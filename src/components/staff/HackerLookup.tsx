"use client";

import { useEffect, useState, useTransition } from "react";
import { lookupHackers, checkInHacker, undoCheckIn, type LookupRow } from "@/app/staff/actions";
import { registrationStatusLabels } from "@/lib/validation";

const statusTone: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  accepted: "bg-emerald-50 text-emerald-700",
  pending: "bg-blue-100 text-blue-800",
  waitlist: "bg-yellow-100 text-yellow-800",
};

export default function HackerLookup() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // search as you type (debounced)
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRows([]); return; }
    const t = setTimeout(() => {
      startSearch(async () => {
        const res = await lookupHackers(term);
        if (res.ok) { setRows(res.rows); setErr(null); } else setErr(res.error);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function toggle(row: LookupRow) {
    setBusyId(row.user_id);
    setErr(null);
    const res = row.checked_in ? await undoCheckIn(row.user_id) : await checkInHacker(row.user_id);
    if (res.ok) {
      setRows(prev => prev.map(r => r.user_id === row.user_id ? { ...r, checked_in: !row.checked_in } : r));
    } else {
      setErr(res.error ?? "Something went wrong");
    }
    setBusyId(null);
  }

  return (
    <div className="font-[family-name:var(--font-body)] space-y-4">
      <input
        autoFocus
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by name, email, or Discord username..."
        className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9b5e] focus:border-transparent"
      />
      {err && <p className="text-sm text-red-700">{err}</p>}
      {searching && <p className="text-sm text-gray-500">Searching...</p>}
      {!searching && q.trim().length >= 2 && rows.length === 0 && !err && (
        <p className="text-sm text-gray-500">No one found.</p>
      )}

      <ul className="space-y-3">
        {rows.map(r => (
          <li key={r.user_id} className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#560700]">{r.name}</p>
                <span className={`text-xs rounded-full px-2 py-0.5 ${statusTone[r.status ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
                  {r.status ? registrationStatusLabels[r.status] : "No application"}
                </span>
                {r.checked_in && <span className="text-xs rounded-full px-2 py-0.5 bg-[#560700] text-white">Checked in</span>}
              </div>
              <p className="text-sm text-gray-600 truncate">
                {r.email ?? "-"}{r.discord_username ? ` · ${r.discord_username}` : ""}{r.school ? ` · ${r.school}` : ""}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                T-shirt: {r.tshirt || "-"}
                {r.dietary.length > 0 && <> · Dietary: {r.dietary.filter(d => d !== "none").join(", ") || "none"}</>}
                {r.accessibility?.trim() && <> · Accessibility: {r.accessibility}</>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle(r)}
              disabled={busyId === r.user_id || (!r.checked_in && r.status !== "confirmed")}
              title={!r.checked_in && r.status !== "confirmed" ? "Only confirmed hackers can be checked in" : undefined}
              className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                r.checked_in
                  ? "bg-white border border-[#560700]/30 text-[#560700] hover:bg-gray-50"
                  : "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow"
              }`}
            >
              {busyId === r.user_id ? "..." : r.checked_in ? "Undo check-in" : "Check in"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
