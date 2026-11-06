// Server-only: uses the cookie-based Supabase client. Constants live in roles.ts so client components can import them.
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

/**
 * For server actions: re-check the caller's role on every call (don't rely on layouts).
 * Returns { error } when the caller isn't signed in or doesn't have one of `allowed`.
 */
export async function requireRole(allowed: readonly Role[]) {
  const { supabase, user, role } = await getCurrentRole();
  if (!user || !role) return { supabase, user: null, role: null, error: "Not authenticated" } as const;
  if (!allowed.includes(role)) return { supabase, user: null, role, error: "Not allowed" } as const;
  return { supabase, user, role, error: null } as const;
}
