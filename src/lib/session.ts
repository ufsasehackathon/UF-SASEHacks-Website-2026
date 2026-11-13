// Server-only: uses the cookie-based Supabase client. Constants live in roles.ts so client components can import them.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toRole, type Role } from "@/lib/roles";

/** The signed-in user and their role (role is null when signed out) */
export async function getCurrentRole() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null } as const;

  const { data } = await supabase.rpc("user_role", { p_uid: user.id });
  return { supabase, user, role: toRole(data) } as const;
}

export type RequireRoleResult =
  | { ok: true; supabase: SupabaseClient; user: User; role: Role }
  | { ok: false; error: string };

/** Server actions start with this: the caller must be signed in with one of `allowed` (e.g. STAFF_ROLES, OWNER_ROLES) */
export async function requireRole(allowed: readonly Role[]): Promise<RequireRoleResult> {
  const { supabase, user, role } = await getCurrentRole();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (!allowed.includes(role)) return { ok: false, error: "Not allowed" };
  return { ok: true, supabase, user, role };
}
