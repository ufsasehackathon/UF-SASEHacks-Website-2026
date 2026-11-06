"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { roles, type Role } from "@/lib/roles";
import { requireRole } from "@/lib/session";
import { registrationStatuses, type RegistrationStatus } from "@/lib/validation";
import { totalScore } from "@/lib/judging";

const STAFF: Role[] = ["owner", "staff"];
const OWNER: Role[] = ["owner"];

/** Strip characters that would break a PostgREST `or=(...)` filter */
function cleanSearch(q: string) {
  return q.replace(/[,()%*\\]/g, " ").trim().slice(0, 100);
}

async function checkInEventId(supabase: Awaited<ReturnType<typeof requireRole>>["supabase"]) {
  const { data } = await supabase.from("events").select("id").eq("event_name", "Check-in").maybeSingle();
  return data?.id as string | undefined;
}

// ---------------------------------------------------------------------------
// Stats (owner + staff)
// ---------------------------------------------------------------------------

export type StaffStats = {
  counts: Record<RegistrationStatus, number>;
  total: number;
  checkedIn: number;
  tshirts: Record<string, number>;
  dietary: Record<string, number>;
  accessibilityNotes: number;
};

export async function fetchStaffStats(): Promise<{ ok: true; stats: StaffStats } | { ok: false; error: string }> {
  const { supabase, error: authError } = await requireRole(STAFF);
  if (authError) return { ok: false, error: authError };

  const [{ data: regs, error }, eventId] = await Promise.all([
    supabase.from("registrations").select("status, profiles(tshirt, dietary, accessibility)"),
    checkInEventId(supabase),
  ]);
  if (error) return { ok: false, error: error.message };

  const counts = Object.fromEntries(registrationStatuses.map(st => [st, 0])) as Record<RegistrationStatus, number>;
  const tshirts: Record<string, number> = {};
  const dietary: Record<string, number> = {};
  let accessibilityNotes = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (regs ?? []) as any[]) {
    if (r.status in counts) counts[r.status as RegistrationStatus]++;
    if (r.status !== "confirmed") continue;
    // logistics totals only count people who are actually coming
    const p = r.profiles ?? {};
    const size = p.tshirt || "Not given";
    tshirts[size] = (tshirts[size] ?? 0) + 1;
    for (const d of (p.dietary ?? []) as string[]) dietary[d] = (dietary[d] ?? 0) + 1;
    if ((p.accessibility ?? "").trim()) accessibilityNotes++;
  }

  let checkedIn = 0;
  if (eventId) {
    const { count } = await supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    checkedIn = count ?? 0;
  }

  return { ok: true, stats: { counts, total: regs?.length ?? 0, checkedIn, tshirts, dietary, accessibilityNotes } };
}

// ---------------------------------------------------------------------------
// Hacker lookup + check-in (owner + staff)
// ---------------------------------------------------------------------------

export type LookupRow = {
  user_id: string;
  name: string;
  email: string | null;
  discord_username: string | null;
  school: string | null;
  tshirt: string | null;
  dietary: string[];
  accessibility: string | null;
  status: RegistrationStatus | null;
  /** only known to owners (staff can't read other people's roles); null otherwise */
  role: Role | null;
  checked_in: boolean;
};

export async function lookupHackers(q: string): Promise<{ ok: true; rows: LookupRow[] } | { ok: false; error: string }> {
  const { supabase, role: callerRole, error: authError } = await requireRole(STAFF);
  if (authError) return { ok: false, error: authError };

  const term = cleanSearch(q);
  if (term.length < 2) return { ok: true, rows: [] };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, first_name, last_name, email, discord_username, school, tshirt, dietary, accessibility, registrations(status)")
    .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,discord_username.ilike.%${term}%`)
    .order("full_name")
    .limit(20);
  if (error) return { ok: false, error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profiles = (data ?? []) as any[];
  const ids = profiles.map(p => p.id as string);

  const eventId = await checkInEventId(supabase);
  const checkedIn = new Set<string>();
  const roleById = new Map<string, Role>();
  if (ids.length) {
    const [att, rolesRes] = await Promise.all([
      eventId
        ? supabase.from("attendance").select("user_id").eq("event_id", eventId).in("user_id", ids)
        : Promise.resolve({ data: [] as { user_id: string }[] }),
      callerRole === "owner"
        ? supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
    ]);
    for (const a of att.data ?? []) checkedIn.add(a.user_id);
    for (const r of rolesRes.data ?? []) roleById.set(r.user_id, r.role as Role);
  }

  const rows: LookupRow[] = profiles.map(p => {
    const reg = Array.isArray(p.registrations) ? p.registrations[0] : p.registrations;
    return {
      user_id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || "(no name)",
      email: p.email,
      discord_username: p.discord_username,
      school: p.school,
      tshirt: p.tshirt,
      dietary: p.dietary ?? [],
      accessibility: p.accessibility,
      status: (reg?.status ?? null) as RegistrationStatus | null,
      role: callerRole === "owner" ? roleById.get(p.id) ?? "hacker" : null,
      checked_in: checkedIn.has(p.id),
    };
  });
  return { ok: true, rows };
}

export async function checkInHacker(userId: string) {
  const { supabase, error: authError } = await requireRole(STAFF);
  if (authError) return { ok: false, error: authError };

  const { error } = await supabase.rpc("staff_check_in", { p_user_id: userId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  return { ok: true };
}

export async function undoCheckIn(userId: string) {
  const { supabase, error: authError } = await requireRole(STAFF);
  if (authError) return { ok: false, error: authError };

  const { error } = await supabase.rpc("staff_undo_check_in", { p_user_id: userId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Roles (owner only)
// ---------------------------------------------------------------------------

export type RoleHolder = { user_id: string; role: Role; name: string; email: string | null };

/** Everyone with a non-hacker role */
export async function fetchRoleHolders(): Promise<{ ok: true; rows: RoleHolder[] } | { ok: false; error: string }> {
  const { supabase, error: authError } = await requireRole(OWNER);
  if (authError) return { ok: false, error: authError };

  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, role, profiles(full_name, first_name, last_name, email)")
    .order("role");
  if (error) return { ok: false, error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = ((data ?? []) as any[]).map(r => {
    const p = r.profiles ?? {};
    return {
      user_id: r.user_id,
      role: r.role as Role,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || "(no name)",
      email: p.email ?? null,
    };
  });
  return { ok: true, rows };
}

export async function setUserRole(userId: string, role: Role) {
  const { supabase, error: authError } = await requireRole(OWNER);
  if (authError) return { ok: false, error: authError };
  if (!roles.includes(role)) return { ok: false, error: "Unknown role" };

  const { error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/roles");
  revalidatePath("/staff/judging");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Judging (owner only)
// ---------------------------------------------------------------------------

/** Find a CSV column by name, ignoring case and extra spaces */
function pick(row: Record<string, string>, ...names: string[]) {
  const wanted = names.map(n => n.toLowerCase());
  for (const [k, v] of Object.entries(row)) {
    if (wanted.includes(k.trim().toLowerCase())) return (v ?? "").trim();
  }
  return "";
}

/**
 * Import Devpost's project export (Manage hackathon > Metrics > Export submissions).
 * Upserts on the submission URL, so re-importing updates projects instead of duplicating them.
 * Drafts are skipped. Table numbers are only overwritten if the CSV has a "table" column.
 */
export async function importDevpostCsv(formData: FormData) {
  const { supabase, error: authError } = await requireRole(OWNER);
  if (authError) return { ok: false, error: authError };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file" };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "CSV is too large (10 MB max)" };

  const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: true });
  if (parsed.errors.length && !parsed.data.length) {
    return { ok: false, error: `Couldn't read the CSV: ${parsed.errors[0].message}` };
  }

  const headers = (parsed.meta.fields ?? []).map(h => h.trim());
  const tableHeader = headers.find(h => /table/i.test(h));
  let skipped = 0;

  const rows = parsed.data.flatMap(row => {
    const title = pick(row, "Project Title", "Title", "Project Name");
    const url = pick(row, "Submission Url", "Submission URL", "Project URL", "Devpost URL");
    const status = pick(row, "Project Status");
    if (!title || !url || /draft/i.test(status)) {
      skipped++;
      return [];
    }

    // Submitter + "Team Member N First/Last Name" columns
    const names = [`${pick(row, "Submitter First Name")} ${pick(row, "Submitter Last Name")}`.trim()];
    for (let i = 1; i <= 10; i++) {
      const n = `${pick(row, `Team Member ${i} First Name`)} ${pick(row, `Team Member ${i} Last Name`)}`.trim();
      if (n) names.push(n);
    }

    return [{
      title,
      devpost_url: url,
      track: pick(row, "Opt-In Prizes", "Track", "Prizes") || null,
      description: pick(row, "About The Project", "Description", "Elevator Pitch") || null,
      team: names.filter(Boolean).join(", ") || null,
      ...(tableHeader ? { table_number: (row[tableHeader] ?? "").trim() || null } : {}),
    }];
  });

  if (!rows.length) return { ok: false, error: "No submitted projects found. Is this the Devpost submissions export?" };

  const { error } = await supabase.from("projects").upsert(rows, { onConflict: "devpost_url" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/staff/judging");
  return { ok: true, imported: rows.length, skipped };
}

export async function setTableNumber(projectId: string, tableNumber: string) {
  const { supabase, error: authError } = await requireRole(OWNER);
  if (authError) return { ok: false, error: authError };

  const { error } = await supabase
    .from("projects")
    .update({ table_number: tableNumber.trim() || null })
    .eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/judging");
  return { ok: true };
}

export type ProjectSummary = {
  id: string;
  title: string;
  devpost_url: string | null;
  track: string | null;
  table_number: string | null;
  judges: number;
  scored: number;
  averageTotal: number | null;
};

export type JudgeSummary = {
  judge_id: string;
  name: string;
  email: string | null;
  assigned: number;
  sheets: {
    project_id: string;
    project_title: string;
    scores: Record<string, number>;
    total: number | null;
    comments: string | null;
  }[];
};

export async function fetchJudgingOverview(): Promise<
  { ok: true; projects: ProjectSummary[]; judges: JudgeSummary[] } | { ok: false; error: string }
> {
  const { supabase, error: authError } = await requireRole(OWNER);
  if (authError) return { ok: false, error: authError };

  const [projectsRes, assignmentsRes, scoresRes, judgesRes] = await Promise.all([
    supabase.from("projects").select("id, title, devpost_url, track, table_number").order("title"),
    supabase.from("judge_assignments").select("judge_id, project_id"),
    supabase.from("judge_scores").select("judge_id, project_id, scores, comments"),
    supabase.from("user_roles").select("user_id, profiles(full_name, first_name, last_name, email)").eq("role", "judge"),
  ]);
  const err = projectsRes.error ?? assignmentsRes.error ?? scoresRes.error ?? judgesRes.error;
  if (err) return { ok: false, error: err.message };

  const projects = projectsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const scores = scoresRes.data ?? [];
  const titleById = new Map(projects.map(p => [p.id, p.title as string]));

  const projectSummaries: ProjectSummary[] = projects.map(p => {
    const sheets = scores.filter(s => s.project_id === p.id);
    const totals = sheets.map(s => totalScore(s.scores)).filter((t): t is number => t !== null);
    return {
      ...p,
      judges: assignments.filter(a => a.project_id === p.id).length,
      scored: totals.length,
      averageTotal: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null,
    };
  });
  // best first; unscored at the bottom
  projectSummaries.sort((a, b) => (b.averageTotal ?? -1) - (a.averageTotal ?? -1));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const judges: JudgeSummary[] = ((judgesRes.data ?? []) as any[]).map(j => {
    const p = j.profiles ?? {};
    return {
      judge_id: j.user_id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || "(no name)",
      email: p.email ?? null,
      assigned: assignments.filter(a => a.judge_id === j.user_id).length,
      sheets: scores
        .filter(s => s.judge_id === j.user_id)
        .map(s => ({
          project_id: s.project_id,
          project_title: titleById.get(s.project_id) ?? "(deleted project)",
          scores: (s.scores ?? {}) as Record<string, number>,
          total: totalScore(s.scores),
          comments: s.comments,
        })),
    };
  });

  return { ok: true, projects: projectSummaries, judges };
}

