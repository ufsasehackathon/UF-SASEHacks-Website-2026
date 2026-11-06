import { ensureRows, upsertProfileAndConsents } from "../actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/forms/ProfileForm";
import { dietaryOptions, raceOptions } from "@/lib/validation";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  await ensureRows();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: registration } = await supabase
    .from("registrations")
    .select("editing_locked, accuracy_agreement, terms_and_conditions, code_of_conduct, can_photograph, share_resume_with_companies, mlh_code_of_conduct, mlh_data_sharing, mlh_communications")
    .eq("user_id", user.id)
    .maybeSingle();
  // Nothing to edit until they've applied (the application form handles drafts)
  if (!registration) redirect("/portal");

  const disabled = registration?.editing_locked ?? false;

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
      initialAge = "";
    }
  }

  return (
    <div className="min-h-screen bg-[#FFE4B3] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-[#ebb8ce] opacity-30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-[#ebb8ce] opacity-20 rounded-full blur-3xl"></div>

      <div className="relative z-10 mx-auto max-w-screen-lg px-4 py-10">
        {/* Header with back button */}
        <div className="mb-8">
          <Link href="/portal" className="inline-flex items-center gap-2 text-[#560700] hover:underline font-[family-name:var(--font-body)] mb-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-6xl text-[#560700]">
            Your Profile
          </h1>
          <p className="font-[family-name:var(--font-body)] text-lg text-[#560700]/70 mt-2">
            {disabled ? "View your registration information" : "Update your registration information"}
          </p>
        </div>

        {disabled && (
          <div className="mb-6 rounded-2xl bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-400 p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-2xl">🔒</div>
              <div className="font-[family-name:var(--font-body)]">
                <p className="font-semibold text-yellow-900">Editing is locked</p>
                <p className="text-sm text-yellow-800 mt-1">
                  Editing is currently locked by admins. You can still view your information.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          <ProfileForm
            initialValues={{
              first_name: initialFirstName,
              last_name: initialLastName,
              email: profile?.email ?? user.email ?? "",
              phone_number: profile?.phone_number ?? "",
              age: initialAge,
              school: profile?.school ?? "",
              major: profile?.major ?? "",
              grad_year: profile?.grad_year ?? "",
              level_of_study: profile?.level_of_study ?? "",
              engineering_skill: profile?.engineering_skill ?? "",
              hackathon_experience: profile?.hackathon_experience ?? "",
              country: profile?.country ?? "",
              linkedin_url: profile?.linkedin_url ?? "",
              tshirt: profile?.tshirt ?? "",
              dietary: Array.isArray(profile?.dietary)
                ? profile.dietary.filter((d: unknown): d is typeof dietaryOptions[number] =>
                    typeof d === 'string' && dietaryOptions.includes(d as typeof dietaryOptions[number])
                  )
                : [],
              accessibility: profile?.accessibility ?? "",
              gender: profile?.gender ?? "",
              race: Array.isArray(profile?.race)
                ? profile.race.filter((r: unknown): r is typeof raceOptions[number] =>
                    typeof r === 'string' && raceOptions.includes(r as typeof raceOptions[number])
                  )
                : [],
            }}
            initialConsents={{
              accuracy_agreement: !!registration?.accuracy_agreement,
              terms_and_conditions: !!registration?.terms_and_conditions,
              code_of_conduct: !!registration?.code_of_conduct,
              can_photograph: !!registration?.can_photograph,
              share_resume_with_companies: !!registration?.share_resume_with_companies,
              mlh_code_of_conduct: !!registration?.mlh_code_of_conduct,
              mlh_data_sharing: !!registration?.mlh_data_sharing,
              mlh_communications: !!registration?.mlh_communications,
            }}
            action={upsertProfileAndConsents}
            disabled={disabled}
          />
        </div>

      </div>
    </div>
  );
}
