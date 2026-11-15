"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { STAFF_ROLES } from "@/lib/roles";
import { parseDevpostCsv } from "@/lib/devpost";
import { nextTableNumbers, planAssignments } from "@/lib/judging";

/** 10 MB */
const MAX_CSV_BYTES = 10 * 1024 * 1024;

function revalidateJudging() {
  revalidatePath("/staff/judging");
  revalidatePath("/judge");
}

/**
 * Staff/owner: import Devpost's submissions export (form field `file`). Projects already here
 * (same `devpost_url`) get their title/track/description/team updated but keep their table
 * number; new ones are numbered after the current highest table number, in CSV order.
 */
export async function importDevpostCsv(
  formData: FormData
): Promise<{ ok: boolean; error?: string; created?: number; updated?: number; skippedDrafts?: number }> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file" };
  if (file.size > MAX_CSV_BYTES) return { ok: false, error: "CSV is too large (10 MB max)" };

  const { projects, skippedDrafts, error: parseError } = parseDevpostCsv(await file.text());
  if (parseError) return { ok: false, error: parseError };

  const { data: current, error: loadError } = await supabase.from("projects").select("devpost_url, table_number");
  if (loadError) return { ok: false, error: loadError.message };

  const known = new Set((current ?? []).map(p => p.devpost_url as string | null));
  const numbers = (current ?? []).map(p => p.table_number as number | null).filter((n): n is number => n !== null);
  const currentMax = numbers.length > 0 ? Math.max(...numbers) : null;

  const existing = projects.filter(p => known.has(p.devpost_url));
  const added = projects.filter(p => !known.has(p.devpost_url));

  if (existing.length > 0) {
    // No table_number in these rows, so the upsert leaves it as it is
    const { error } = await supabase.from("projects").upsert(existing, { onConflict: "devpost_url" });
    if (error) return { ok: false, error: error.message };
  }

  if (added.length > 0) {
    const tables = nextTableNumbers(currentMax, added.length);
    const { error } = await supabase.from("projects").insert(added.map((p, i) => ({ ...p, table_number: tables[i] })));
    if (error) return { ok: false, error: error.message };
  }

  revalidateJudging();
  return { ok: true, created: added.length, updated: existing.length, skippedDrafts };
}

/**
 * Staff/owner: give every project up to 3 judges, spreading the load evenly. Only adds rows, so
 * existing assignments never move. `minPerJudge`/`maxPerJudge` are judges' totals after the run.
 */
export async function assignJudges(): Promise<{
  ok: boolean;
  error?: string;
  added?: number;
  minPerJudge?: number;
  maxPerJudge?: number;
}> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return auth;
  const { supabase } = auth;

  const [judges, projects, current] = await Promise.all([
    supabase.from("user_roles").select("user_id").eq("role", "judge").order("created_at").order("user_id"),
    supabase
      .from("projects")
      .select("id")
      .order("table_number", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase.from("judge_assignments").select("judge_id, project_id"),
  ]);
  const loadError = judges.error ?? projects.error ?? current.error;
  if (loadError) return { ok: false, error: loadError.message };

  const judgeIds = (judges.data ?? []).map(j => j.user_id as string);
  const existing = (current.data ?? []).map(a => ({ judgeId: a.judge_id as string, projectId: a.project_id as string }));
  const planned = planAssignments({ projectIds: (projects.data ?? []).map(p => p.id as string), judgeIds, existing });

  if (planned.length > 0) {
    const { error } = await supabase
      .from("judge_assignments")
      .insert(planned.map(a => ({ judge_id: a.judgeId, project_id: a.projectId })));
    if (error) return { ok: false, error: error.message };
  }

  // Count only current judges (rows left from former judges don't count)
  const load = new Map(judgeIds.map(j => [j, 0]));
  for (const a of [...existing, ...planned]) {
    if (load.has(a.judgeId)) load.set(a.judgeId, load.get(a.judgeId)! + 1);
  }
  const totals = [...load.values()];

  revalidateJudging();
  return {
    ok: true,
    added: planned.length,
    minPerJudge: totals.length > 0 ? Math.min(...totals) : 0,
    maxPerJudge: totals.length > 0 ? Math.max(...totals) : 0,
  };
}

/** Staff/owner: put a judge on a project (no-op if they're already on it) */
export async function addJudge(projectId: string, judgeId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return auth;
  const { supabase } = auth;

  // RLS lets staff assign anyone, so check the role here
  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", judgeId)
    .eq("role", "judge")
    .maybeSingle();
  if (roleError) return { ok: false, error: roleError.message };
  if (!role) return { ok: false, error: "That person isn't a judge" };

  const { error } = await supabase
    .from("judge_assignments")
    .upsert({ judge_id: judgeId, project_id: projectId }, { onConflict: "judge_id,project_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };

  revalidateJudging();
  return { ok: true };
}

/** Staff/owner: take a judge off a project */
export async function removeJudge(projectId: string, judgeId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("judge_assignments")
    .delete()
    .eq("project_id", projectId)
    .eq("judge_id", judgeId);
  if (error) return { ok: false, error: error.message };

  revalidateJudging();
  return { ok: true };
}

/** Staff/owner: set a project's table number (null clears it) */
export async function setTableNumber(projectId: string, tableNumber: number | null): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return auth;
  if (tableNumber !== null && !(Number.isInteger(tableNumber) && tableNumber > 0)) {
    return { ok: false, error: "Table number must be a positive whole number" };
  }

  const { error } = await auth.supabase.from("projects").update({ table_number: tableNumber }).eq("id", projectId);
  if (error) return { ok: false, error: error.message };

  revalidateJudging();
  return { ok: true };
}

/** Staff/owner: delete a project (its assignments and score sheets go with it) */
export async function deleteProject(projectId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("projects").delete().eq("id", projectId);
  if (error) return { ok: false, error: error.message };

  revalidateJudging();
  return { ok: true };
}
