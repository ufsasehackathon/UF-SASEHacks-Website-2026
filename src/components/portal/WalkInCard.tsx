"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinWalkIn } from "@/app/portal/actions";
import ConnectDiscordButton from "./ConnectDiscordButton";

type Props = {
  discordUsername: string | null;
  hasConsents: boolean;
  needsName: boolean;
};

const linkClass = "text-blue-600 hover:underline";

function Consent({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} className="mt-0.5" />
      <span>{children}</span>
    </label>
  );
}

/** During the event: steps a walk-in (or anyone not attending yet) takes before staff add them to the waitlist */
export default function WalkInCard({ discordUsername, hasConsents, needsName }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    startTransition(async () => {
      const res = await joinWalkIn(fd);
      if (!res.ok) setErr(res.error ?? "Something went wrong");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4 font-[family-name:var(--font-body)]">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
          ⏳
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[#560700]">
          At the event? Join the waitlist
        </h2>
      </div>

      {/* Step 1: Discord */}
      <div className="p-4 rounded-xl bg-[#FFE4B3]/40">
        <p className="text-sm text-gray-700 mb-2">Step 1: Connect Discord</p>
        {discordUsername ? (
          <p className="text-sm font-semibold text-green-700">✓ Connected as {discordUsername}</p>
        ) : (
          <ConnectDiscordButton />
        )}
      </div>

      {/* Step 2: agreements */}
      <div className="p-4 rounded-xl bg-[#FFE4B3]/40">
        <p className="text-sm text-gray-700 mb-2">Step 2: Accept the agreements</p>
        {hasConsents ? (
          <p className="text-sm font-semibold text-green-700">✓ Agreements accepted</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {needsName && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-gray-700">First name</span>
                  <input name="first_name" autoComplete="given-name" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2" />
                </label>
                <label className="block text-sm">
                  <span className="text-gray-700">Last name</span>
                  <input name="last_name" autoComplete="family-name" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2" />
                </label>
              </div>
            )}

            <Consent name="accuracy_agreement">
              I have filled out this application to the best of my knowledge and that I have not provided false, inaccurate, or misleading information. *
            </Consent>
            <Consent name="terms_and_conditions">
              I have read and agreed to the UF SASE Hacks Privacy Policy and the UF SASE Hacks Terms and Conditions *
            </Consent>
            <Consent name="code_of_conduct">
              I have read and agreed to the UF SASE Hacks Code of Conduct *
            </Consent>
            <Consent name="mlh_code_of_conduct">
              I have read and agree to the{" "}
              <a href="https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md" target="_blank" rel="noopener noreferrer" className={linkClass}>
                MLH Code of Conduct
              </a>. *
            </Consent>
            <Consent name="mlh_data_sharing">
              I authorize you to share my application/registration information with Major League Hacking for event administration, ranking, and MLH administration in-line with the{" "}
              <a href="https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md" target="_blank" rel="noopener noreferrer" className={linkClass}>
                MLH Privacy Policy
              </a>. I further agree to the terms of both the{" "}
              <a href="https://github.com/MLH/mlh-policies/blob/main/contest-terms.md" target="_blank" rel="noopener noreferrer" className={linkClass}>
                MLH Contest Terms and Conditions
              </a>{" "}
              and the{" "}
              <a href="https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md" target="_blank" rel="noopener noreferrer" className={linkClass}>
                MLH Privacy Policy
              </a>. *
            </Consent>
            <Consent name="can_photograph">
              I consent to photography at the event (optional)
            </Consent>
            <Consent name="share_resume_with_companies">
              I consent to having my resume shared with participating companies for recruitment purposes (optional)
            </Consent>
            <Consent name="mlh_communications">
              I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements. (optional)
            </Consent>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#560700] to-[#6b1003] shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {busy ? "Saving..." : "Accept agreements"}
            </button>
            {err && <p className="text-sm text-red-700">{err}</p>}
          </form>
        )}
      </div>

      {/* Step 3: ready */}
      {discordUsername && hasConsents && (
        <div className="p-4 rounded-xl bg-green-100">
          <p className="text-sm font-semibold text-green-800">
            You&apos;re ready. Show this screen to a staff member at check-in.
          </p>
        </div>
      )}
    </div>
  );
}
