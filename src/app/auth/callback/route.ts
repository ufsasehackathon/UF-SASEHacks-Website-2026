import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safeNext";
import { ROLE_HOME, toRole } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  const supabase = await createSupabaseServerClient();

  try {
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    }
  } catch {
    // ignore this
  }

  // No (usable) next: send them to their role's dashboard. Uses the same client, which holds the new session.
  let home = ROLE_HOME.hacker;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase.rpc("user_role", { p_uid: user.id });
    home = ROLE_HOME[toRole(data)];
  }

  return NextResponse.redirect(new URL(safeNextPath(url.searchParams.get("next"), home), url.origin));
}
