import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OnboardingForm from "@/components/forms/OnboardingForm";
import { upsertProfile, saveRegistrationFlags, uploadResumeOnboarding, saveResponses, submitApplication, ensureRows } from "../actions";
import { HACK_NAME, APPLICATIONS_CLOSE, registrationsOpen } from "@/lib/constants";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await ensureRows();

  // Check if user has already completed onboarding
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: reg } = await supabase
    .from("registrations")
    .select("status, resume_url, responses, accuracy_agreement, terms_and_conditions, code_of_conduct, can_photograph, editing_locked, share_resume_with_companies, mlh_code_of_conduct, mlh_data_sharing, mlh_communications")
    .eq("user_id", user.id)
    .single();

  // Already submitted: the portal shows status, and profile edits go through /portal/profile
  if (reg && reg.status !== "draft") {
    redirect("/portal");
  }

  const locked = reg?.editing_locked ?? false;
  const open = registrationsOpen();
  const closesAt = new Date(APPLICATIONS_CLOSE).toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "long",
    timeStyle: "short",
  });

  // Compute initial values for the new schema, with fallbacks from legacy data
  // Split full_name into first/last if we have legacy data
  let initialFirstName = profile?.first_name ?? "";
  let initialLastName = profile?.last_name ?? "";
  if (!initialFirstName && !initialLastName && profile?.full_name) {
    const parts = profile.full_name.split(" ");
    initialFirstName = parts[0] || "";
    initialLastName = parts.slice(1).join(" ") || "";
  }

  // Compute age from date_of_birth if we have legacy data
  let initialAge = profile?.age ?? "";
  if (!initialAge && profile?.date_of_birth) {
    try {
      const dob = new Date(profile.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      // Map to our age options
      if (age < 18) initialAge = "17";
      else if (age <= 24) initialAge = String(age);
      else if (age <= 34) initialAge = "25-34";
      else if (age <= 44) initialAge = "35-44";
      else initialAge = "45+";
    } catch {
      initialAge = "18";
    }
  }

  return (
    <div className="min-h-screen bg-[#FFE4B3] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-[#ebb8ce] opacity-30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-[#ebb8ce] opacity-20 rounded-full blur-3xl"></div>

      <div className="relative z-10 mx-auto max-w-screen-lg px-4 py-10">
        {!open && (
          <div className="mb-8 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 p-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="font-[family-name:var(--font-body)]">
                <p className="text-sm font-medium text-red-900 mb-1">Applications Closed</p>
                <p className="text-sm text-red-700">
                  We aren&apos;t accepting applications right now. Thank you for your interest in {HACK_NAME}!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 pt-18 text-center">
          <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-6xl text-[#560700] mb-4">
            Apply to {HACK_NAME}
          </h1>
          <p className="font-[family-name:var(--font-body)] text-lg text-[#560700]/70 max-w-2xl mx-auto">
            Fill out the application below and submit it before {closesAt} ET.
          </p>
          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#560700]/10 border border-[#560700]/20">
              <svg className="w-5 h-5 text-[#560700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="font-[family-name:var(--font-body)] text-sm text-[#560700]">All fields marked with * are required</span>
            </div>
          </div>
        </div>

        <OnboardingForm
        initialProfile={{
          first_name: initialFirstName,
          last_name: initialLastName,
          email: profile?.email ?? user.email ?? "",
          phone_number: profile?.phone_number ?? "",
          age: initialAge || "18",

          school: profile?.school ?? "",
          major: profile?.major ?? "",
          grad_year: profile?.grad_year ?? "2026",
          level_of_study: profile?.level_of_study ?? "undergraduate-3-plus-year",

          engineering_skill: profile?.engineering_skill ?? "3",
          hackathon_experience: profile?.hackathon_experience ?? "0",

          address_line1: profile?.address_line1 ?? "",
          address_line2: profile?.address_line2 ?? "",
          city: profile?.city ?? "",
          state: profile?.state ?? "",
          zip_code: profile?.zip_code ?? "",
          country: profile?.country ?? "",

          linkedin_url: profile?.linkedin_url ?? "",

          tshirt: profile?.tshirt ?? "M",
          dietary: profile?.dietary ?? [],
          accessibility: profile?.accessibility ?? "",

          gender: profile?.gender ?? "prefer-not-to-say",
          race: profile?.race ?? [],
        }}
        initialConsents={{
          accuracy_agreement: reg?.accuracy_agreement ?? false,
          terms_and_conditions: reg?.terms_and_conditions ?? false,
          code_of_conduct: reg?.code_of_conduct ?? false,
          can_photograph: reg?.can_photograph ?? false,
          share_resume_with_companies: reg?.share_resume_with_companies ?? false,
          mlh_code_of_conduct: reg?.mlh_code_of_conduct ?? false,
          mlh_data_sharing: reg?.mlh_data_sharing ?? false,
          mlh_communications: reg?.mlh_communications ?? false,
        }}
        profileAction={upsertProfile}
        consentAction={saveRegistrationFlags}
        resumeAction={uploadResumeOnboarding}
        responsesAction={saveResponses}
        submitAction={submitApplication}
        initialResponses={(reg?.responses as Record<string, string> | null) ?? {}}
        hasResume={Boolean(reg?.resume_url)}
        disabled={locked || !open}
      />
      </div>
    </div>
  );
}
