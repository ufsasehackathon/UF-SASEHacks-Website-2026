"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lookupHackers, setUserRole, type LookupRow, type RoleHolder } from "@/app/staff/actions";
import { roles, roleLabels, type Role } from "@/lib/roles";

function RoleSelect({ userId, role, onChanged }: { userId: string; role: Role; onChanged: (r: Role) => void }) {
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        disabled={busy}
        onChange={e => {
          const next = e.target.value as Role;
          setErr(null);
          startTransition(async () => {
            const res = await setUserRole(userId, next);
            if (res.ok) onChanged(next); else setErr(res.error ?? "Failed");
          });
        }}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      >
        {roles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
      </select>
      {busy && <span className="text-xs text-gray-500">Saving...</span>}
      {err && <span className="text-xs text-red-700">{err}</span>}
    </div>
  );
}

export default function RoleManager({ holders }: { holders: RoleHolder[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRows([]); return; }
    const t = setTimeout(() => {
      startSearch(async () => {
        const res = await lookupHackers(term, { includeAllRoles: true });
        if (res.ok) setRows(res.rows);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="font-[family-name:var(--font-body)] space-y-8">
      <section className="space-y-3">
        <h3 className="font-semibold text-[#560700]">Find someone</h3>
        <p className="text-sm text-gray-600">They need to have signed in at least once to show up here.</p>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by name, email, or Discord username..."
          className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff9b5e] focus:border-transparent"
        />
        {searching && <p className="text-sm text-gray-500">Searching...</p>}
        <ul className="divide-y divide-gray-200">
          {rows.map(r => (
            <li key={r.user_id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="font-semibold text-[#560700]">{r.name}</p>
                <p className="text-sm text-gray-600">{r.email ?? "-"}</p>
              </div>
              <RoleSelect
                userId={r.user_id}
                role={r.role}
                onChanged={next => { setRows(prev => prev.map(x => x.user_id === r.user_id ? { ...x, role: next } : x)); router.refresh(); }}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-[#560700]">Current owners, staff and judges</h3>
        {holders.length === 0 && <p className="text-sm text-gray-500">No one yet.</p>}
        {(["owner", "staff", "judge"] as const).map(group => {
          const list = holders.filter(h => h.role === group);
          if (!list.length) return null;
          return (
            <div key={group}>
              <p className="text-xs uppercase tracking-wide text-gray-500 mt-4 mb-1">{roleLabels[group]} ({list.length})</p>
              <ul className="divide-y divide-gray-200">
                {list.map(h => (
                  <li key={h.user_id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#560700]">{h.name}</p>
                      <p className="text-sm text-gray-600">{h.email ?? "-"}</p>
                    </div>
                    <RoleSelect userId={h.user_id} role={h.role} onChanged={() => router.refresh()} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
