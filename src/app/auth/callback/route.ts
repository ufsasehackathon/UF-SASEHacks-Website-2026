import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safeNext";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

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
