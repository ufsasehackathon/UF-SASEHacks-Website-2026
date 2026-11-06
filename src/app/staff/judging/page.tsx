import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/session";
import { fetchJudgingOverview } from "../actions";
import { JUDGING_CRITERIA, MAX_TOTAL } from "@/lib/judging";
import DevpostImport from "@/components/staff/DevpostImport";
import TableNumberInput from "@/components/staff/TableNumberInput";
import { Card, PageShell, StatTile } from "@/components/staff/Card";

export const dynamic = "force-dynamic";

export default async function JudgingPage() {
  const { role } = await getCurrentRole();
  if (role !== "owner") redirect("/staff");

  const res = await fetchJudgingOverview();
  if (!res.ok) {
    return (
      <PageShell title="Judging">
        <Card><p className="text-sm text-red-700">{res.error}</p></Card>
      </PageShell>
    );
  }
  const { projects, judges } = res;
  const sheets = judges.reduce((n, j) => n + j.sheets.length, 0);
  const assignments = judges.reduce((n, j) => n + j.assigned, 0);

  return (
    <PageShell title="Judging" subtitle={<Link href="/staff" className="hover:underline">← Staff dashboard</Link>}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Projects" value={projects.length} />
        <StatTile label="Judges" value={judges.length} />
        <StatTile label="Score sheets" value={`${sheets} / ${assignments}`} />
        <StatTile label="Rubric" value={`${JUDGING_CRITERIA.length} × 1–5`} />
      </div>

      <Card
        title="Import projects from Devpost"
        subtitle="Devpost → Manage hackathon → Metrics → export submissions as CSV. Re-importing updates existing projects instead of duplicating them."
      >
        <DevpostImport />
      </Card>

      <Card
        title="Judge assignment"
        subtitle="Not built yet: we're still deciding how to distribute projects. For now, assign with the SQL snippet at the bottom of supabase/schema.sql."
      >
        <p className="font-[family-name:var(--font-body)] text-sm text-gray-600">
          Give people the Judge role on the <Link href="/staff/roles" className="underline">Roles</Link> page first.
        </p>
      </Card>

      <Card title="Projects" subtitle={`Ranked by average total (out of ${MAX_TOTAL})`}>
        {projects.length === 0 ? (
          <p className="font-[family-name:var(--font-body)] text-sm text-gray-500">No projects yet. Import the Devpost CSV above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-[family-name:var(--font-body)] text-sm">
              <thead className="text-left text-gray-600">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Project</th>
                  <th className="py-2 pr-3">Track</th>
                  <th className="py-2 pr-3">Table</th>
                  <th className="py-2 pr-3">Judges</th>
                  <th className="py-2 pr-3">Scored</th>
                  <th className="py-2 pr-3">Avg total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects.map((p, i) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 text-gray-500">{p.averageTotal !== null ? i + 1 : "-"}</td>
                    <td className="py-2 pr-3">
                      {p.devpost_url ? (
                        <a href={p.devpost_url} target="_blank" rel="noreferrer" className="font-semibold text-[#560700] hover:underline">{p.title}</a>
                      ) : <span className="font-semibold text-[#560700]">{p.title}</span>}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 max-w-xs truncate">{p.track ?? "-"}</td>
                    <td className="py-2 pr-3"><TableNumberInput projectId={p.id} initial={p.table_number} /></td>
                    <td className="py-2 pr-3">{p.judges}</td>
                    <td className="py-2 pr-3">{p.scored}</td>
                    <td className="py-2 pr-3 font-semibold">{p.averageTotal !== null ? p.averageTotal.toFixed(1) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Judges & their scores">
        {judges.length === 0 ? (
          <p className="font-[family-name:var(--font-body)] text-sm text-gray-500">No judges yet. Assign the Judge role on the Roles page.</p>
        ) : (
          <div className="space-y-3 font-[family-name:var(--font-body)]">
            {judges.map(j => (
              <details key={j.judge_id} className="rounded-xl border border-gray-200 bg-white p-4">
                <summary className="cursor-pointer flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold text-[#560700]">{j.name}</span>
                    <span className="text-sm text-gray-600"> · {j.email ?? "-"}</span>
                  </span>
                  <span className="text-sm text-gray-600">{j.sheets.length} / {j.assigned} scored</span>
                </summary>
                {j.sheets.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-3">No scores yet.</p>
                ) : (
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-sm">
                      <thead className="text-left text-gray-600">
                        <tr>
                          <th className="py-1 pr-3">Project</th>
                          {JUDGING_CRITERIA.map(c => <th key={c.id} className="py-1 pr-3">{c.label}</th>)}
                          <th className="py-1 pr-3">Total</th>
                          <th className="py-1 pr-3">Comments</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {j.sheets.map(s => (
                          <tr key={s.project_id}>
                            <td className="py-1 pr-3 font-medium">{s.project_title}</td>
                            {JUDGING_CRITERIA.map(c => <td key={c.id} className="py-1 pr-3">{s.scores[c.id] ?? "-"}</td>)}
                            <td className="py-1 pr-3 font-semibold">{s.total ?? "-"}</td>
                            <td className="py-1 pr-3 text-gray-600 max-w-sm">{s.comments ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  );
}
