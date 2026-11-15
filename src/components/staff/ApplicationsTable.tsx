"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  APPLICANT_FILTERS,
  applicantState,
  filterApplicants,
  type ApplicantRow,
  type ApplicantState,
} from "@/lib/applications";
import { APPLICATION_QUESTIONS } from "@/lib/validation";
import { clearDecisions, getResumeUrl, setDecisions } from "@/app/staff/applications/actions";

const STATE_LABELS = Object.fromEntries(APPLICANT_FILTERS.map(f => [f.value, f.label])) as Record<ApplicantState, string>;

const STATE_STYLES: Record<ApplicantState, string> = {
  pending: "bg-gray-100 text-gray-700",
  accepted_unsent: "bg-green-50 text-green-800 border border-dashed border-green-400",
  rejected_unsent: "bg-red-50 text-red-800 border border-dashed border-red-400",
  accepted: "bg-green-100 text-green-800",
  confirmed: "bg-emerald-200 text-emerald-900",
  declined: "bg-gray-200 text-gray-700",
  rejected: "bg-red-100 text-red-800",
  waitlist: "bg-yellow-100 text-yellow-800",
};

const smallButton =
  "rounded-lg border border-[#560700]/30 bg-white px-3 py-1 text-sm text-[#560700] hover:bg-[#560700]/10 disabled:opacity-50";

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
}

/** Review table for /staff/applications: filter + search, per-row and bulk accept/reject/undo, expandable details */
export function ApplicationsTable({ rows }: { rows: ApplicantRow[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [filter, setFilter] = useState<ApplicantState | "all">("pending");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = filterApplicants(rows, filter, query);
  // Only applicants still under review can get a decision
  const selectable = visible.filter(r => r.status === "pending");
  const chosen = selectable.filter(r => selected.has(r.userId));
  const allChosen = selectable.length > 0 && chosen.length === selectable.length;

  function toggle(userId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChosen ? new Set() : new Set(selectable.map(r => r.userId)));
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong");
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  function decide(targets: ApplicantRow[], decision: "accepted" | "rejected") {
    if (!targets.length) return;
    if (decision === "rejected") {
      const n = targets.length;
      const names = targets.map(r => r.name);
      if (!window.confirm(`Reject ${n} applicant${n === 1 ? "" : "s"}? ${names.join(", ")}\n\nThey won't be told until an owner sends decisions.`)) {
        return;
      }
    }
    run(() => setDecisions(targets.map(r => r.userId), decision));
  }

  async function openResume(userId: string) {
    setError(null);
    // Open the tab now (inside the click) so popup blockers allow it, then point it at the signed URL
    const tab = window.open("", "_blank");
    const res = await getResumeUrl(userId);
    if (!res.ok || !res.url) {
      tab?.close();
      setError(res.error ?? "Couldn't open the resume");
      return;
    }
    if (tab) tab.location.href = res.url;
    else window.open(res.url, "_blank", "noopener");
  }

  return (
    <div className="space-y-4 font-[family-name:var(--font-body)] text-[#560700]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2">
          <span className="text-sm">Show</span>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as ApplicantState | "all")}
            className="rounded-lg border border-[#560700]/30 bg-white px-3 py-2"
          >
            {APPLICANT_FILTERS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </label>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name, email or school"
          aria-label="Search applicants"
          className="w-full rounded-lg border border-[#560700]/30 bg-white px-3 py-2 sm:max-w-sm"
        />
      </div>

      {chosen.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow">
          <span className="font-semibold">{chosen.length} selected</span>
          <button type="button" disabled={busy} onClick={() => decide(chosen, "accepted")} className={smallButton}>
            Accept {chosen.length}
          </button>
          <button type="button" disabled={busy} onClick={() => decide(chosen, "rejected")} className={smallButton}>
            Reject {chosen.length}
          </button>
          <button type="button" disabled={busy} onClick={() => setSelected(new Set())} className={smallButton}>
            Clear
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-3xl bg-white/90 shadow-2xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#560700]/10">
            <tr>
              <th className="p-3">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allChosen}
                  disabled={!selectable.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="p-3">Name</th>
              <th className="p-3">School</th>
              <th className="p-3">Grad year</th>
              <th className="p-3">Submitted</th>
              <th className="p-3">State</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#560700]/70">No applicants here.</td>
              </tr>
            )}
            {visible.map(row => {
              const state = applicantState(row);
              const open = expanded === row.userId;
              return (
                <Fragment key={row.userId}>
                  <tr data-testid="applicant-row" className="border-b border-[#560700]/10 last:border-0">
                    <td className="p-3">
                      {row.status === "pending" && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.name}`}
                          checked={selected.has(row.userId)}
                          onChange={() => toggle(row.userId)}
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : row.userId)}
                        className="text-left font-semibold underline-offset-2 hover:underline"
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className="p-3">{row.school || "—"}</td>
                    <td className="p-3">{row.gradYear || "—"}</td>
                    <td className="p-3 whitespace-nowrap">{fmtDate(row.submittedAt)}</td>
                    <td className="p-3">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${STATE_STYLES[state]}`}>
                        {STATE_LABELS[state]}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {state === "pending" && (
                        <div className="flex gap-2">
                          <button type="button" disabled={busy} onClick={() => decide([row], "accepted")} className={smallButton}>
                            Accept
                          </button>
                          <button type="button" disabled={busy} onClick={() => decide([row], "rejected")} className={smallButton}>
                            Reject
                          </button>
                        </div>
                      )}
                      {(state === "accepted_unsent" || state === "rejected_unsent") && (
                        <button type="button" disabled={busy} onClick={() => run(() => clearDecisions([row.userId]))} className={smallButton}>
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                  {open && <ApplicantDetails row={row} onResume={() => openResume(row.userId)} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApplicantDetails({ row, onResume }: { row: ApplicantRow; onResume: () => void }) {
  const fields: [string, string][] = [
    ["Email", row.email],
    ["Major", row.major],
    ["Level of study", row.levelOfStudy],
    ["Grad year", row.gradYear],
    ["Hackathon experience", row.hackathonExperience],
    ["Engineering skill", row.engineeringSkill ? `${row.engineeringSkill} / 5` : ""],
  ];
  return (
    <tr className="border-b border-[#560700]/10 bg-[#FFE4B3]/30">
      <td colSpan={7} className="p-4">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-[#560700]/60">{label}</dt>
              <dd className="break-words">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 space-y-3">
          {APPLICATION_QUESTIONS.map(q => (
            <div key={q.id}>
              <p className="text-xs text-[#560700]/60">{q.label}</p>
              <p className="whitespace-pre-wrap">{row.responses[q.id] || "—"}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Only http(s): the profile form's URL check would also accept javascript: links */}
          {row.linkedinUrl && /^https?:\/\//i.test(row.linkedinUrl) && (
            <a href={row.linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline">
              LinkedIn
            </a>
          )}
          {row.hasResume ? (
            <button type="button" onClick={onResume} className={smallButton}>
              Resume
            </button>
          ) : (
            <span className="text-[#560700]/60">No resume</span>
          )}
        </div>
      </td>
    </tr>
  );
}
