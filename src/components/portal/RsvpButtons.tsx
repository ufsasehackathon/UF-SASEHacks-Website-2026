"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { rsvp } from "@/app/portal/actions";

type Props = {
  status: "accepted" | "confirmed";
  discordUsername: string | null;
};

export default function RsvpButtons({ status, discordUsername }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
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

  function respond(attending: boolean) {
    if (!attending && !confirm("Release your spot? This can't be undone, and your spot will go to someone on the waitlist.")) {
      return;
    }
    setErr(null);
    startTransition(async () => {
      const res = await rsvp(attending);
      if (!res.ok) setErr(res.error ?? "Something went wrong");
      else router.refresh();
    });
  }

  if (status === "confirmed") {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={busy}
          className="font-[family-name:var(--font-body)] text-sm text-[#560700]/70 underline hover:text-[#560700] disabled:opacity-50"
        >
          I can&apos;t make it anymore
        </button>
        {err && <p className="font-[family-name:var(--font-body)] text-sm text-red-700">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 font-[family-name:var(--font-body)]">
      {/* Step 1: Discord */}
      <div className="p-4 rounded-xl bg-[#FFE4B3]/40">
        <p className="text-sm text-gray-700 mb-2">Step 1: Connect Discord</p>
        {discordUsername ? (
          <p className="text-sm font-semibold text-green-700">✓ Connected as {discordUsername}</p>
        ) : (
          <button
            type="button"
            onClick={connectDiscord}
            disabled={linking}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white bg-[#5865F2] hover:bg-[#4752C4] transition-all shadow-lg disabled:opacity-50"
          >
            {linking ? "Redirecting to Discord..." : "Connect Discord"}
          </button>
        )}
      </div>

      {/* Step 2: RSVP */}
      <div className="p-4 rounded-xl bg-[#FFE4B3]/40">
        <p className="text-sm text-gray-700 mb-2">Step 2: Confirm your spot</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => respond(true)}
            disabled={busy || !discordUsername}
            className="flex-1 rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            I&apos;m coming!
          </button>
          <button
            type="button"
            onClick={() => respond(false)}
            disabled={busy}
            className="flex-1 rounded-xl px-5 py-3 text-sm font-semibold text-[#560700] bg-white border border-[#560700]/30 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            I can&apos;t make it
          </button>
        </div>
        {!discordUsername && (
          <p className="text-xs text-gray-600 mt-2">Connect Discord first to confirm.</p>
        )}
      </div>

      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}
