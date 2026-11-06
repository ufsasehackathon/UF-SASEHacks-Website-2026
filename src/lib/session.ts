// Server-only: uses the cookie-based Supabase client. Constants live in roles.ts so client components can import them.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toRole } from "@/lib/roles";

/** The signed-in user and their role (role is null when signed out) */
export async function getCurrentRole() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null } as const;

  const { data } = await supabase.rpc("user_role", { p_uid: user.id });
  return { supabase, user, role: toRole(data) } as const;
}
