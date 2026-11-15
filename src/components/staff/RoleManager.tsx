"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { roles, type Role } from "@/lib/roles";
import { searchProfilesWithRoles, setRole, type PersonWithRole } from "@/app/staff/people/actions";

const ROLE_LABELS: Record<Role, string> = { owner: "Owner", staff: "Staff", judge: "Judge", hacker: "Hacker" };

/** Name, email and a role select that saves on change (reverts and shows the error if it fails) */
function PersonRow({ person, onSaved }: { person: PersonWithRole; onSaved: () => void }) {
  const [value, setValue] = useState<Role>(person.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(role: Role) {
    const previous = value;
    setValue(role);
    setError(null);
    setSaving(true);
    const res = await setRole(person.userId, role);
    setSaving(false);
    if (!res.ok) {
      setValue(previous);
      setError(res.error ?? "Couldn't change the role");
      return;
    }
    onSaved();
  }

  return (
    <tr data-testid="person-row" className="align-top">
      <td className="px-4 py-3 font-semibold">{person.name}</td>
      <td className="break-all px-4 py-3 text-sm text-[#560700]/70">{person.email}</td>
      <td className="px-4 py-3">
        <select
          value={value}
          disabled={saving}
          onChange={e => void change(e.target.value as Role)}
          aria-label={`Role for ${person.name}`}
          className="rounded-lg border border-[#560700]/30 bg-white px-2 py-1 text-sm disabled:opacity-50"
        >
          {roles.map(r => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      </td>
    </tr>
  );
}

function PeopleTable({ people, label, onSaved }: { people: PersonWithRole[]; label: string; onSaved: () => void }) {
  return (
    <div className="overflow-x-auto rounded-3xl bg-white/90 shadow-2xl">
      <table aria-label={label} className="w-full text-left">
        <thead className="text-sm text-[#560700]/70">
          <tr>
            <th className="px-4 py-3 font-normal">Name</th>
            <th className="px-4 py-3 font-normal">Email</th>
            <th className="px-4 py-3 font-normal">Role</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#560700]/10">
          {people.map(p => (
            // keyed by role too, so a row resets when the server's role for it changes
            <PersonRow key={`${p.userId}:${p.role}`} person={p} onSaved={onSaved} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** People tab (owners): current role holders, then a search to give anyone else a role */
export function RoleManager({ holders }: { holders: PersonWithRole[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonWithRole[]>([]);
  // The query the shown results are for (so "No matches" waits for the debounced search)
  const [searched, setSearched] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  // Only the newest search may update the results
  const latest = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const id = ++latest.current;
    // searchProfilesWithRoles needs 2+ characters; skip the round trip
    const res = q.trim().length < 2 ? { ok: true, error: undefined, people: [] } : await searchProfilesWithRoles(q);
    if (id !== latest.current) return;
    setSearchError(res.ok ? null : res.error ?? "Search failed");
    setResults(res.people);
    setSearched(q);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void runSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  function saved() {
    router.refresh();
    void runSearch(query);
  }

  return (
    <div className="space-y-6 font-[family-name:var(--font-body)] text-[#560700]">
      <p className="text-sm text-[#560700]/70">People must sign in once before they appear here.</p>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-heading)] text-xl">Current roles</h2>
        {holders.length > 0 ? (
          <PeopleTable people={holders} label="Current roles" onSaved={saved} />
        ) : (
          <p className="text-sm text-[#560700]/70">No one has a role yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-heading)] text-xl">Find someone</h2>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name, email or Discord username"
          aria-label="Search people"
          className="w-full rounded-lg border border-[#560700]/30 bg-white px-3 py-2 sm:max-w-md"
        />
        {searchError && <p className="text-sm text-red-700">{searchError}</p>}
        {results.length > 0 && <PeopleTable people={results} label="Search results" onSaved={saved} />}
        {results.length === 0 && searched === query && query.trim().length >= 2 && !searchError && (
          <p className="text-sm text-[#560700]/70">No one matches that search.</p>
        )}
      </section>
    </div>
  );
}
