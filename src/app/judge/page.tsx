import { PageShell } from "@/components/PageShell";
import { getCurrentRole } from "@/lib/session";

type AssignedProject = { id: string; title: string; devpost_url: string | null; table_number: number | null };

/** Only link out to web URLs (project URLs come from the Devpost CSV) */
const isWebUrl = (url: string | null): url is string => !!url && /^https?:\/\//i.test(url);

/** Judges (and owners; the layout checks the role): the projects assigned to the signed-in user, by table number */
export default async function JudgePage() {
  const { supabase, user } = await getCurrentRole();

  // Only the caller's own assignments, so owners (who can read every project) see just theirs
  const { data, error } = await supabase
    .from("judge_assignments")
    .select("projects(id, title, devpost_url, table_number)")
    .eq("judge_id", user?.id ?? "");

  const projects = ((data ?? []) as { projects: AssignedProject | AssignedProject[] | null }[])
    .flatMap(a => (Array.isArray(a.projects) ? a.projects : a.projects ? [a.projects] : []))
    .sort((a, b) => (a.table_number ?? Infinity) - (b.table_number ?? Infinity) || a.title.localeCompare(b.title));

  return (
    <PageShell title="Judge Dashboard">
      <div className="overflow-x-auto rounded-3xl bg-white/90 font-[family-name:var(--font-body)] text-[#560700] shadow-2xl">
        {error ? (
          <p className="p-6 text-red-700">Couldn&apos;t load your projects: {error.message}</p>
        ) : projects.length === 0 ? (
          <p className="p-6 text-center text-[#560700]/70">No projects assigned yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-[#560700]/10 text-sm">
              <tr>
                <th className="p-3">Table</th>
                <th className="p-3">Project</th>
                <th className="p-3">Devpost</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} data-testid="judge-project" className="border-b border-[#560700]/10 last:border-0">
                  <td className="p-3 text-lg font-semibold">{p.table_number ?? "—"}</td>
                  <td className="p-3">{p.title}</td>
                  <td className="p-3">
                    {isWebUrl(p.devpost_url) ? (
                      <a href={p.devpost_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                        Open on Devpost
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  );
}
