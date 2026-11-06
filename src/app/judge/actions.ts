"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { judgeScoreSchema } from "@/lib/judging";

export type AssignedProject = {
  id: string;
  title: string;
  devpost_url: string | null;
  track: string | null;
  table_number: string | null;
  description: string | null;
  team: string | null;
  scored: boolean;
};

/** The caller's assigned projects, unscored first, then by table number */
export async function fetchAssignedProjects(): Promise<{ ok: true; projects: AssignedProject[] } | { ok: false; error: string }> {
  const { supabase, user, error: authError } = await requireRole(["judge", "owner"]);
  if (authError) return { ok: false, error: authError };

  const [assignRes, scoresRes] = await Promise.all([
    supabase
      .from("judge_assignments")
      .select("projects(id, title, devpost_url, track, table_number, description, team)")
      .eq("judge_id", user.id),
    supabase.from("judge_scores").select("project_id").eq("judge_id", user.id),
  ]);
  if (assignRes.error) return { ok: false, error: assignRes.error.message };

  const scored = new Set((scoresRes.data ?? []).map(s => s.project_id));
  const projects = (assignRes.data ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((a: any) => (Array.isArray(a.projects) ? a.projects[0] : a.projects))
    .filter(Boolean)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({ ...p, scored: scored.has(p.id) }) as AssignedProject);

  projects.sort((a, b) =>
    Number(a.scored) - Number(b.scored) ||
    (a.table_number ?? "").localeCompare(b.table_number ?? "", undefined, { numeric: true }) ||
    a.title.localeCompare(b.title)
  );
  return { ok: true, projects };
}

/** Save (or update) the caller's score sheet. RLS also requires the project to be assigned. */
export async function saveScore(projectId: string, input: { scores: Record<string, number>; comments: string }) {
  const { supabase, user, error: authError } = await requireRole(["judge", "owner"]);
  if (authError) return { ok: false, error: authError };

  const parsed = judgeScoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid scores" };

  const { data: assigned } = await supabase
    .from("judge_assignments")
    .select("project_id")
    .eq("judge_id", user.id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!assigned) return { ok: false, error: "This project isn't assigned to you" };

  const { error } = await supabase.from("judge_scores").upsert(
    {
      judge_id: user.id,
      project_id: projectId,
      scores: parsed.data.scores,
      comments: parsed.data.comments || null,
    },
    { onConflict: "judge_id,project_id" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/judge");
  revalidatePath(`/judge/${projectId}`);
  return { ok: true };
}

/** Next assigned project the caller hasn't scored yet (for "Save & next") */
export async function nextUnscored(afterProjectId: string) {
  const res = await fetchAssignedProjects();
  if (!res.ok) return { ok: false, error: res.error };
  const next = res.projects.find(p => !p.scored && p.id !== afterProjectId);
  return { ok: true, projectId: next?.id ?? null };
}
