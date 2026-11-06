import Link from "next/link";
import { fetchAssignedProjects } from "./actions";
import { Card, PageShell } from "@/components/staff/Card";

export const dynamic = "force-dynamic";

export default async function JudgePage() {
  const res = await fetchAssignedProjects();
  const projects = res.ok ? res.projects : [];
  const done = projects.filter(p => p.scored).length;

  return (
    <PageShell title="Judging" subtitle={res.ok ? `${done} of ${projects.length} projects scored` : undefined}>
      <Card title="Your projects">
        {!res.ok ? (
          <p className="text-sm text-red-700">{res.error}</p>
        ) : projects.length === 0 ? (
          <p className="font-[family-name:var(--font-body)] text-sm text-gray-600">No projects assigned yet. Check back once judging starts.</p>
        ) : (
          <ul className="space-y-3 font-[family-name:var(--font-body)]">
            {projects.map(p => (
              <li key={p.id}>
                <Link
                  href={`/judge/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-all"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#560700] truncate">{p.title}</p>
                    <p className="text-sm text-gray-600 truncate">
                      {p.table_number ? `Table ${p.table_number}` : "No table yet"}{p.track ? ` · ${p.track}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs rounded-full px-3 py-1 ${p.scored ? "bg-green-100 text-green-800" : "bg-[#FFE4B3] text-[#560700]"}`}>
                    {p.scored ? "✓ Scored" : "Not scored"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
