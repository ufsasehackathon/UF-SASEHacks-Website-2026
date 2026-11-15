import { getCurrentRole } from "@/lib/session";
import { ProjectImport } from "@/components/staff/ProjectImport";
import { ProjectsTable, type JudgeOption, type JudgingProject } from "@/components/staff/ProjectsTable";

type ProfileName = { id: string; full_name: string | null; first_name: string | null; last_name: string | null; email: string | null };

const displayName = (p: ProfileName | undefined) =>
  p?.full_name?.trim() || [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || p?.email || "(no name)";

/** Judging (owner + staff; the /staff layout checks the role): Devpost import, projects with table numbers and judges */
export default async function StaffJudgingPage() {
  const { supabase } = await getCurrentRole();

  const [projects, assignments, judgeRoles] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, devpost_url, table_number")
      .order("table_number", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase.from("judge_assignments").select("judge_id, project_id"),
    supabase.from("user_roles").select("user_id").eq("role", "judge"),
  ]);
  const loadError = projects.error ?? assignments.error ?? judgeRoles.error;

  const judgeIds = new Set((judgeRoles.data ?? []).map(r => r.user_id as string));
  const assigned = (assignments.data ?? []) as { judge_id: string; project_id: string }[];
  // Names for current judges and anyone still assigned after losing the role
  const peopleIds = [...new Set([...judgeIds, ...assigned.map(a => a.judge_id)])];
  const people = loadError || peopleIds.length === 0
    ? { data: [] as ProfileName[], error: null }
    : await supabase.from("profiles").select("id, full_name, first_name, last_name, email").in("id", peopleIds);

  const error = loadError ?? people.error;
  if (error) {
    return <p className="font-[family-name:var(--font-body)] text-red-700">Couldn&apos;t load projects: {error.message}</p>;
  }

  const names = new Map(((people.data ?? []) as ProfileName[]).map(p => [p.id, displayName(p)]));
  const nameOf = (id: string) => names.get(id) ?? "(no name)";
  const judges: JudgeOption[] = [...judgeIds].map(id => ({ id, name: nameOf(id) })).sort((a, b) => a.name.localeCompare(b.name));

  const rows: JudgingProject[] = (
    (projects.data ?? []) as { id: string; title: string; devpost_url: string | null; table_number: number | null }[]
  ).map(p => ({
    id: p.id,
    title: p.title,
    devpostUrl: p.devpost_url,
    tableNumber: p.table_number,
    judges: assigned
      .filter(a => a.project_id === p.id)
      .map(a => ({ id: a.judge_id, name: nameOf(a.judge_id), isJudge: judgeIds.has(a.judge_id) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));

  return (
    <div className="space-y-6">
      <ProjectImport />
      <ProjectsTable projects={rows} judges={judges} />
    </div>
  );
}
