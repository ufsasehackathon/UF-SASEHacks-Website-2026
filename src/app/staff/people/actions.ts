"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { OWNER_ROLES, toRole, type Role } from "@/lib/roles";
import { profileSearchFilter } from "@/lib/checkin";

/** A row on the People tab */
export type PersonWithRole = { userId: string; name: string; email: string; role: Role };

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  user_roles: { role: string } | { role: string }[] | null;
};

const PROFILE_COLUMNS = "id, full_name, first_name, last_name, email";
const ROLE_ORDER: Record<Role, number> = { owner: 0, staff: 1, judge: 2, hacker: 3 };

function toPerson(p: ProfileRow): PersonWithRole {
  const roleRow = Array.isArray(p.user_roles) ? p.user_roles[0] : p.user_roles;
  return {
    userId: p.id,
    name: p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || "(no name)",
    email: p.email ?? "",
    role: toRole(roleRow?.role),
  };
}

/** Owner: up to 25 people whose name, email or Discord username matches `query`, with their role. A read, so no revalidate. */
export async function searchProfilesWithRoles(query: string): Promise<{ ok: boolean; error?: string; people: PersonWithRole[] }> {
  const auth = await requireRole(OWNER_ROLES);
  if (!auth.ok) return { ...auth, people: [] };

  const filter = profileSearchFilter(query);
  if (!filter) return { ok: true, people: [] };

  const { data, error } = await auth.supabase
    .from("profiles")
    .select(`${PROFILE_COLUMNS}, user_roles(role)`)
    .or(filter)
    .order("first_name", { ascending: true })
    .limit(25);
  if (error) return { ok: false, error: error.message, people: [] };

  return { ok: true, people: ((data ?? []) as unknown as ProfileRow[]).map(toPerson) };
}

/** Owner: everyone with a role (owner → staff → judge, then name). Empty for anyone else. */
export async function listRoleHolders(): Promise<PersonWithRole[]> {
  const auth = await requireRole(OWNER_ROLES);
  if (!auth.ok) return [];

  const { data, error } = await auth.supabase.from("profiles").select(`${PROFILE_COLUMNS}, user_roles!inner(role)`);
  if (error) {
    console.error("listRoleHolders failed:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as ProfileRow[])
    .map(toPerson)
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name));
}

/** Owner: give someone a role ("hacker" removes it). Passes set_user_role's errors through, e.g. "Can't remove the last owner". */
export async function setRole(userId: string, role: Role): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireRole(OWNER_ROLES);
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/staff/people");
  return { ok: true };
}
