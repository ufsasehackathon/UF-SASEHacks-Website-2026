"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addJudge, assignJudges, deleteProject, removeJudge, setTableNumber } from "@/app/staff/judging/actions";

export type JudgeOption = { id: string; name: string };

export type JudgingProject = {
  id: string;
  title: string;
  devpostUrl: string | null;
  tableNumber: number | null;
  /** Everyone assigned, including leftover rows for people who are no longer judges (`isJudge: false`) */
  judges: (JudgeOption & { isJudge: boolean })[];
};

const smallButton =
  "rounded-lg border border-[#560700]/30 bg-white px-3 py-1 text-sm text-[#560700] hover:bg-[#560700]/10 disabled:opacity-50";

/** Only link out to web URLs (the CSV is outside input) */
const isWebUrl = (url: string | null): url is string => !!url && /^https?:\/\//i.test(url);

/** Projects on the Judging tab (already sorted by table number): table numbers, judges, delete, plus "Assign judges" */
export function ProjectsTable({ projects, judges }: { projects: JudgingProject[]; judges: JudgeOption[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [assignResult, setAssignResult] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const tableCounts = new Map<number, number>();
  for (const p of projects) {
    if (p.tableNumber !== null) tableCounts.set(p.tableNumber, (tableCounts.get(p.tableNumber) ?? 0) + 1);
  }

  function act(projectId: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setErrors(prev => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setErrors(prev => ({ ...prev, [projectId]: res.error ?? "Something went wrong" }));
      router.refresh();
    });
  }

  function saveTable(p: JudgingProject, value: string) {
    const trimmed = value.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next === p.tableNumber) return;
    act(p.id, () => setTableNumber(p.id, next));
  }

  function remove(p: JudgingProject) {
    if (!window.confirm(`Delete ${p.title}? Its judge assignments and scores are deleted too.`)) return;
    act(p.id, () => deleteProject(p.id));
  }

  function assign() {
    setAssignResult(null);
    setAssignError(null);
    startTransition(async () => {
      const res = await assignJudges();
      if (!res.ok) {
        setAssignError(res.error ?? "Couldn't assign judges");
        return;
      }
      const min = res.minPerJudge ?? 0;
      const max = res.maxPerJudge ?? 0;
      // With no judges there's nothing to report; the hint below says what to do
      if (judges.length > 0) {
        setAssignResult(`Added ${res.added ?? 0} assignments. Each judge has ${min === max ? min : `${min}–${max}`} projects.`);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 font-[family-name:var(--font-body)] text-[#560700]">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={assign}
          className="rounded-lg bg-[#560700] px-4 py-1.5 text-sm text-[#FFE4B3] hover:bg-[#560700]/90 disabled:opacity-50"
        >
          Assign judges
        </button>
        {assignResult && <p className="text-sm">{assignResult}</p>}
        {assignError && <p className="text-sm text-red-700">{assignError}</p>}
      </div>
      {judges.length === 0 && (
        <p className="text-sm text-[#560700]/70">No judges yet. Give people the Judge role in People (owners).</p>
      )}

      <div className="overflow-x-auto rounded-3xl bg-white/90 shadow-2xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#560700]/10">
            <tr>
              <th className="p-3">Table</th>
              <th className="p-3">Project</th>
              <th className="p-3">Devpost</th>
              <th className="p-3">Judges</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-[#560700]/70">No projects yet. Import the Devpost CSV above.</td>
              </tr>
            )}
            {projects.map(p => {
              const duplicate = p.tableNumber !== null && (tableCounts.get(p.tableNumber) ?? 0) > 1;
              const onProject = new Set(p.judges.map(j => j.id));
              const available = judges.filter(j => !onProject.has(j.id));
              return (
                <Fragment key={p.id}>
                  <tr
                    data-testid="project-row"
                    className={`${duplicate ? "bg-red-50" : ""} ${errors[p.id] ? "" : "border-b border-[#560700]/10 last:border-0"}`}
                  >
                    <td className="p-3 align-top whitespace-nowrap">
                      <input
                        key={`${p.id}:${p.tableNumber ?? ""}`}
                        type="number"
                        min={1}
                        step={1}
                        defaultValue={p.tableNumber ?? ""}
                        aria-label={`Table number for ${p.title}`}
                        onBlur={e => saveTable(p, e.currentTarget.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        className="w-20 rounded-lg border border-[#560700]/30 bg-white px-2 py-1"
                      />
                      {duplicate && <p className="mt-1 text-xs text-red-700">Duplicate table</p>}
                    </td>
                    <td className="p-3 align-top font-semibold">{p.title}</td>
                    <td className="p-3 align-top">
                      {isWebUrl(p.devpostUrl) ? (
                        <a href={p.devpostUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          Devpost
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.judges.map(j => (
                          <span
                            key={j.id}
                            data-testid="judge-chip"
                            className="inline-flex items-center gap-1 rounded-full bg-[#560700]/10 py-0.5 pl-3 pr-1"
                          >
                            {j.name}
                            {!j.isJudge && <span className="text-xs text-[#560700]/60">(not a judge)</span>}
                            <button
                              type="button"
                              disabled={busy}
                              aria-label={`Remove ${j.name}`}
                              onClick={() => act(p.id, () => removeJudge(p.id, j.id))}
                              className="rounded-full px-1.5 hover:bg-[#560700]/20 disabled:opacity-50"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {available.length > 0 && (
                          <select
                            value=""
                            disabled={busy}
                            aria-label={`Add judge to ${p.title}`}
                            onChange={e => {
                              const judgeId = e.target.value;
                              if (judgeId) act(p.id, () => addJudge(p.id, judgeId));
                            }}
                            className="rounded-lg border border-[#560700]/30 bg-white px-2 py-1 text-sm"
                          >
                            <option value="">+ judge</option>
                            {available.map(j => (
                              <option key={j.id} value={j.id}>
                                {j.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="p-3 align-top">
                      <button type="button" disabled={busy} onClick={() => remove(p)} className={smallButton}>
                        Delete
                      </button>
                    </td>
                  </tr>
                  {errors[p.id] && (
                    <tr className="border-b border-[#560700]/10">
                      <td colSpan={5} className="px-3 pb-3 text-sm text-red-700">{errors[p.id]}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
