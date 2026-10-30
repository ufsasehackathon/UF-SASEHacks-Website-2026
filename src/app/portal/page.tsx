import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureRows } from "./actions";
import Link from "next/link";
import {
  HACK_NAME,
  DISCORD_INVITE,
  DEVPOST_URL,
  DATES,
  VENUE,
  CITY,
  DECISIONS_BY,
  APPLICATIONS_CLOSE,
  registrationsOpen,
} from "@/lib/constants";
import { registrationStatusLabels, type RegistrationStatus } from "@/lib/validation";
import RsvpButtons from "@/components/portal/RsvpButtons";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }) + " ET";

export default async function PortalPage() {
  await ensureRows();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, full_name, discord_username")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const { data: reg } = await supabase
    .from("registrations")
    .select("status, editing_locked, resume_url, resume_updated_at, submitted_at, rsvp_deadline")
    .eq("user_id", user?.id ?? "")
    .single();

  const status = (reg?.status ?? "draft") as RegistrationStatus;
  const locked = reg?.editing_locked ?? false;
  const name = profile?.first_name || profile?.full_name || "";
  const rsvpOverdue = status === "accepted" && reg?.rsvp_deadline && Date.now() > Date.parse(reg.rsvp_deadline);

  const getStatusColor = (status: RegistrationStatus) => {
    switch (status) {
      case "accepted":
      case "confirmed":
        return "from-green-500 to-emerald-600";
      case "waitlist":
        return "from-yellow-500 to-orange-600";
      case "rejected":
      case "declined":
        return "from-gray-400 to-gray-600";
      default:
        return "from-blue-500 to-indigo-600";
    }
  };

  const getStatusIcon = (status: RegistrationStatus) => {
    switch (status) {
      case "accepted":
        return "🎉";
      case "confirmed":
        return "✓";
      case "waitlist":
        return "⏳";
      case "rejected":
      case "declined":
        return "–";
      case "draft":
        return "✎";
      default:
        return "⋯";
    }
  };

  const statusCopy: Record<RegistrationStatus, { title: string; body: React.ReactNode }> = {
    draft: registrationsOpen()
      ? {
          title: "Finish your application",
          body: <>You haven&apos;t submitted an application yet. Applications close {fmt(APPLICATIONS_CLOSE)}.</>,
        }
      : {
          title: "Applications are closed",
          body: <>We aren&apos;t accepting applications right now. Join our mailing list on the home page to hear about next year.</>,
        },
    pending: {
      title: "Application received",
      body: <>
        {reg?.submitted_at ? <>Submitted {fmt(reg.submitted_at)}. </> : null}
        Our team is reviewing applications, and decisions go out by {DECISIONS_BY}. We&apos;ll email you.
      </>,
    },
    accepted: rsvpOverdue
      ? {
          title: "RSVP deadline passed",
          body: <>The RSVP deadline has passed. Reach out to the organizers on Discord if you think this is a mistake.</>,
        }
      : {
          title: "You're in! 🎉",
          body: <>
            Congratulations, you&apos;re accepted to {HACK_NAME}! Connect Discord and confirm your spot
            {reg?.rsvp_deadline ? <> by <strong>{fmt(reg.rsvp_deadline)}</strong></> : null}, or it will go to the waitlist.
          </>,
        },
    confirmed: {
      title: "See you there!",
      body: <>You&apos;re confirmed for {HACK_NAME}, {DATES} at {VENUE} in {CITY}. Announcements happen on Discord.</>,
    },
    waitlist: {
      title: "You're on the waitlist",
      body: <>We had more applicants than spots. If one opens up, we&apos;ll email you right away.</>,
    },
    declined: {
      title: "Spot released",
      body: <>Your spot has been released. We hope to see you at a future {HACK_NAME}!</>,
    },
    rejected: {
      title: "Thank you for applying",
      body: <>We couldn&apos;t offer you a spot this year, but we&apos;d love to see you apply again next year.</>,
    },
  };

  const { title, body } = statusCopy[status];

  return (
    <div className="min-h-screen bg-[#FFE4B3] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-[#ebb8ce] opacity-30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-[#ebb8ce] opacity-20 rounded-full blur-3xl"></div>

      <div className="relative z-10 mx-auto max-w-screen-xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 pt-18">
          <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-6xl text-[#560700]">
            Dashboard
          </h1>
          <p className="font-[family-name:var(--font-body)] text-lg text-[#560700]/70 mt-2">
            {name ? `Hi ${name}, welcome` : "Welcome"} to {HACK_NAME}
          </p>
        </div>

        {/* Lock warning */}
        {locked && status !== "draft" && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-400 p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-2xl">🔒</div>
              <div className="font-[family-name:var(--font-body)]">
                <p className="font-semibold text-yellow-900">Editing is locked</p>
                <p className="text-sm text-yellow-800 mt-1">
                  You can still view your information and resume timestamp, but editing has been disabled.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Status Card: the hacker's next step */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-20 blur-xl"></div>
            <div className="relative backdrop-blur-xl bg-white/90 rounded-3xl shadow-2xl border border-[#FFE4B3]/30 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getStatusColor(status)} flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
                  {getStatusIcon(status)}
                </div>
                <div>
                  <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[#560700]">
                    {title}
                  </h2>
                  <p className="font-[family-name:var(--font-body)] text-xs text-gray-600">
                    Status: {registrationStatusLabels[status]}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="font-[family-name:var(--font-body)] text-gray-700">{body}</p>

                {status === "draft" && registrationsOpen() && (
                  <Link
                    href="/portal/onboarding"
                    className="group w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[#560700] to-[#6b1003] text-white hover:from-[#6b1003] hover:to-[#560700] transition-all shadow-lg hover:shadow-xl"
                  >
                    <span className="font-[family-name:var(--font-body)] font-semibold">Continue application</span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}

                {status === "accepted" && !rsvpOverdue && (
                  <RsvpButtons status="accepted" discordUsername={profile?.discord_username ?? null} />
                )}

                {status === "confirmed" && (
                  <>
                    {profile?.discord_username && (
                      <div className="p-4 rounded-xl bg-[#FFE4B3]/40">
                        <p className="font-[family-name:var(--font-body)] text-gray-700 text-sm mb-1">Discord</p>
                        <p className="font-[family-name:var(--font-body)] text-sm font-semibold text-[#560700]">
                          {profile.discord_username}
                        </p>
                      </div>
                    )}
                    <RsvpButtons status="confirmed" discordUsername={profile?.discord_username ?? null} />
                  </>
                )}

                {reg?.resume_updated_at && status !== "draft" && (
                  <div className="p-4 rounded-xl bg-[#FFE4B3]/40">
                    <p className="font-[family-name:var(--font-body)] text-gray-700 text-sm mb-1">Resume Updated</p>
                    <p className="font-[family-name:var(--font-body)] text-sm font-medium text-[#560700]">
                      {new Date(reg.resume_updated_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="space-y-6">
            {status !== "draft" && (
            <div className="relative">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#ff9b5e] to-[#560700] opacity-20 blur-xl"></div>
              <div className="relative backdrop-blur-xl bg-white/90 rounded-3xl shadow-2xl border border-[#FFE4B3]/30 p-8">
                <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[#560700] mb-6">
                  Quick Actions
                </h2>

                <div className="space-y-3">
                  <Link
                    href="/portal/profile"
                    className="group w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[#560700] to-[#6b1003] text-white hover:from-[#6b1003] hover:to-[#560700] transition-all shadow-lg hover:shadow-xl"
                  >
                    <span className="font-[family-name:var(--font-body)] font-semibold">
                      {locked ? "View Profile" : "Edit Profile"}
                    </span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>

                  <Link
                    href="/portal/resume"
                    className="group w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[#ff9b5e] to-[#ff7f3e] text-white hover:from-[#ff7f3e] hover:to-[#ff9b5e] transition-all shadow-lg hover:shadow-xl"
                  >
                    <span className="font-[family-name:var(--font-body)] font-semibold">
                      {reg?.resume_url ? "Replace Resume" : "Upload Resume"}
                    </span>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
            )}

            {/* Links Card */}
            <div className="relative">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#BFDCFF] to-[#D0FFCB] opacity-30 blur-xl"></div>
              <div className="relative backdrop-blur-xl bg-white/90 rounded-3xl shadow-2xl border border-[#FFE4B3]/30 p-8">
                <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[#560700] mb-6">
                  Community
                </h2>

                <div className="space-y-3">
                  <a
                    href={DISCORD_INVITE}
                    target="_blank"
                    rel="noreferrer"
                    className="group w-full flex items-center justify-between p-4 rounded-xl bg-[#5865F2] text-white hover:bg-[#4752C4] transition-all shadow-lg hover:shadow-xl"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                      <span className="font-[family-name:var(--font-body)] font-semibold">Join Discord</span>
                    </div>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  <a
                    href={DEVPOST_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="group w-full flex items-center justify-between p-4 rounded-xl bg-[#003E54] text-white hover:bg-[#002d3f] transition-all shadow-lg hover:shadow-xl"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6.002 1.61L0 12.004L6.002 22.39h11.996L24 12.004L17.998 1.61H6.002zm1.593 4.084h3.947c3.605 0 6.276 1.695 6.276 6.31c0 4.436-3.21 6.302-6.456 6.302H7.595V5.694zm2.517 2.449v7.714h1.241c2.646 0 3.862-1.55 3.862-3.861c.009-2.569-1.096-3.853-3.767-3.853H10.112z"/>
                      </svg>
                      <span className="font-[family-name:var(--font-body)] font-semibold">View on Devpost</span>
                    </div>
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
