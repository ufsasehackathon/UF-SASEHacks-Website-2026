import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  // Only allow same-site paths, so the login link can't redirect to another site
  const rawNext = url.searchParams.get("next") ?? "/portal";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") ? rawNext : "/portal";

  const supabase = await createSupabaseServerClient();

  try {
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    }
  } catch {
    // ignore this
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
