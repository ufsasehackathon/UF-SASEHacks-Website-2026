"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Links a Discord identity to the signed-in account, then comes back to /portal */
export default function ConnectDiscordButton() {
  const [linking, setLinking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connectDiscord() {
    setErr(null);
    setLinking(true);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/portal")}`;
    const { error } = await supabase.auth.linkIdentity({ provider: "discord", options: { redirectTo } });
    if (error) {
      setErr(error.message);
      setLinking(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={connectDiscord}
        disabled={linking}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white bg-[#5865F2] hover:bg-[#4752C4] transition-all shadow-lg disabled:opacity-50"
      >
        {linking ? "Redirecting to Discord..." : "Connect Discord"}
      </button>
      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}
