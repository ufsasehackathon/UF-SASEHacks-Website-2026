import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPublicImageUrl } from "@/lib/images";
import Image from "next/image";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_admin", { p_uid: user.id });
  if (!isAdmin) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  const { data: registration } = await supabase
    .from("registrations")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFE4B3] via-[#BFDCFF] to-[#D0FFCB] flex items-center justify-center">
        <div className="relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-red-500 to-rose-600 opacity-20 blur-xl"></div>
          <div className="relative backdrop-blur-xl bg-white/95 rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-8">
            <p className="font-[family-name:var(--font-body)] text-xl text-gray-700">User not found</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-700 border-green-300";
      case "waitlist": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "rejected": return "bg-red-100 text-red-700 border-red-300";
      default: return "bg-blue-100 text-blue-700 border-blue-300";
    }
  };

  // Get display name - prefer first_name + last_name, fallback to full_name
  const displayName = profile.first_name && profile.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile.full_name || "Unknown";

  // Get display age - prefer age field, fallback to calculated from date_of_birth
  const getDisplayAge = () => {
    if (profile.age) return profile.age;
    if (profile.date_of_birth) {
      try {
        const dob = new Date(profile.date_of_birth);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          return String(age - 1);
        }
        return String(age);
      } catch {
        return "-";
      }
    }
    return "-";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFE4B3] via-[#BFDCFF] to-[#D0FFCB] relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 right-10 w-64 h-64 bg-[#FFC7E5] opacity-20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-[#E6D4FF] opacity-20 rounded-full blur-3xl"></div>

      {/* Shark mascot decoration */}
      <div className="absolute bottom-0 right-0 opacity-5 pointer-events-none">
        <Image
          src={getPublicImageUrl("shark-mascot.png")}
          alt="Shark mascot"
          width={400}
          height={400}
          className="object-contain"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-screen-lg px-4 py-10">
        {/* Back button and header */}
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-[#560700] hover:underline font-[family-name:var(--font-body)] mb-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin Console
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-6xl text-[#560700]">
                {displayName}
              </h1>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-[family-name:var(--font-body)] text-sm text-gray-600">User ID:</span>
                <code className="font-[family-name:var(--font-body)] text-xs bg-white/80 px-3 py-1 rounded-lg font-mono border border-gray-300">{userId}</code>
              </div>
            </div>

            <div>
              <span className={`inline-flex items-center rounded-2xl px-5 py-2 text-sm font-semibold border-2 ${getStatusColor(registration?.status || "pending")}`}>
                {registration?.status?.toUpperCase() || "PENDING"}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Personal Information */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#560700] to-[#ff9b5e] opacity-10 blur-xl"></div>
            <div className="relative backdrop-blur-xl bg-white/95 rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700] mb-4">Personal Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">First Name</label>
              <p className="font-[family-name:var(--font-body)] text-sm mt-1">{profile.first_name || "-"}</p>
            </div>
            <div>
              <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">Last Name</label>
              <p className="font-[family-name:var(--font-body)] text-sm mt-1">{profile.last_name || "-"}</p>
            </div>
            <div>
              <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">Email</label>
              <p className="font-[family-name:var(--font-body)] text-sm mt-1">{profile.email || "-"}</p>
            </div>
            <div>
              <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">Phone Number</label>
              <p className="font-[family-name:var(--font-body)] text-sm mt-1">{profile.phone_number || "-"}</p>
            </div>
            <div>
              <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">Age</label>
              <p className="font-[family-name:var(--font-body)] text-sm mt-1">{getDisplayAge()}</p>
            </div>
            <div>
              <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">LinkedIn</label>
              <p className="font-[family-name:var(--font-body)] text-sm mt-1">
                {profile.linkedin_url ? (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {profile.linkedin_url}
                  </a>
                ) : "-"}
              </p>
            </div>
            {profile.date_of_birth && (
              <div>
                <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">Date of Birth (legacy)</label>
                <p className="font-[family-name:var(--font-body)] text-sm mt-1 text-gray-500">{profile.date_of_birth}</p>
              </div>
            )}
            {profile.full_name && profile.first_name && (
              <div>
                <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">Full Name (legacy)</label>
                <p className="font-[family-name:var(--font-body)] text-sm mt-1 text-gray-500">{profile.full_name}</p>
              </div>
            )}
          </div>
        </div>
          </div>

        {/* Education */}
        <div className="relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#BFDCFF] to-[#D0FFCB] opacity-20 blur-xl"></div>
          <div className="relative backdrop-blur-xl bg-white/95 rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700] mb-4">Education</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">School</label>
                <p className="font-[family-name:var(--font-body)] text-sm mt-1">{profile.school || "-"}</p>
              </div>
              <div>
                <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">Major</label>
                <p className="font-[family-name:var(--font-body)] text-sm mt-1">{profile.major || "-"}</p>
              </div>
              <div>
                <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">Graduation Year</label>
                <p className="font-[family-name:var(--font-body)] text-sm mt-1">{profile.grad_year || "-"}</p>
              </div>
              <div>
                <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">Level of Study</label>
                <p className="font-[family-name:var(--font-body)] text-sm mt-1 capitalize">{profile.level_of_study?.replace(/-/g, " ") || "-"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Experience */}
        <div className="relative">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#FFC7E5] to-[#E6D4FF] opacity-20 blur-xl"></div>
          <div className="relative backdrop-blur-xl bg-white/95 rounded-3xl shadow-xl border border-[#FFE4B3]/30 p-6 md:p-8">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl md:text-3xl text-[#560700] mb-4">Experience</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">Engineering Skill Level</label>
                <p className="font-[family-name:var(--font-body)] text-sm mt-1">{profile.engineering_skill ? `${profile.engineering_skill}/5` : "-"}</p>
              </div>
              <div>
                <label className="font-[family-name:var(--font-body)] text-sm font-semibold text-gray-600">Hackathon Experience</label>
                <p className="font-[family-name:var(--font-body)] text-sm mt-1">{profile.hackathon_experience || "-"} hackathons attended</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Address Line 1</label>
              <p className="text-sm">{profile.address_line1 || "-"}</p>
            </div>
            {profile.address_line2 && (
              <div>
                <label className="text-sm font-medium text-gray-600">Address Line 2</label>
                <p className="text-sm">{profile.address_line2}</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-gray-600">City</label>
                <p className="text-sm">{profile.city || "-"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">State</label>
                <p className="text-sm">{profile.state || "-"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Zip Code</label>
                <p className="text-sm">{profile.zip_code || "-"}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Country</label>
              <p className="text-sm">{profile.country || "-"}</p>
            </div>
          </div>
        </div>

        {/* Event Preferences */}
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Event Preferences</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-600">T-shirt Size</label>
              <p className="text-sm">{profile.tshirt || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Dietary Restrictions</label>
              <p className="text-sm capitalize">
                {profile.dietary && Array.isArray(profile.dietary) && profile.dietary.length > 0
                  ? profile.dietary.join(", ")
                  : "None"}
              </p>
            </div>
            {profile.accessibility && (
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-600">Accessibility Needs</label>
                <p className="text-sm">{profile.accessibility}</p>
              </div>
            )}
          </div>
        </div>

        {/* Demographics */}
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Demographics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-600">Gender</label>
              <p className="text-sm capitalize">{profile.gender?.split("-").join(" ") || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Race</label>
              <p className="text-sm capitalize">
                {profile.race && Array.isArray(profile.race) && profile.race.length > 0
                  ? profile.race.map((r: string) => r.split("-").join(" ")).join(", ")
                  : "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Registration Status */}
        <div className="rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Registration Status</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <p className="text-sm">
                <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700">
                  {registration?.status || "pending"}
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Editing Locked</label>
              <p className="text-sm">{registration?.editing_locked ? "Yes" : "No"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Resume Uploaded</label>
              <p className="text-sm">{registration?.resume_url ? "Yes" : "No"}</p>
            </div>
            {registration?.resume_updated_at && (
              <div>
                <label className="text-sm font-medium text-gray-600">Resume Updated</label>
                <p className="text-sm">{new Date(registration.resume_updated_at).toLocaleString()}</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-semibold mb-2">Consent Agreements</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={registration?.accuracy_agreement ? "text-green-600" : "text-red-600"}>
                  {registration?.accuracy_agreement ? "✓" : "✗"}
                </span>
                <span>Accuracy Agreement</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={registration?.terms_and_conditions ? "text-green-600" : "text-red-600"}>
                  {registration?.terms_and_conditions ? "✓" : "✗"}
                </span>
                <span>Terms and Conditions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={registration?.code_of_conduct ? "text-green-600" : "text-red-600"}>
                  {registration?.code_of_conduct ? "✓" : "✗"}
                </span>
                <span>Code of Conduct</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={registration?.can_photograph ? "text-green-600" : "text-gray-400"}>
                  {registration?.can_photograph ? "✓" : "✗"}
                </span>
                <span>Photography Consent (optional)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={registration?.share_resume_with_companies ? "text-green-600" : "text-gray-400"}>
                  {registration?.share_resume_with_companies ? "✓" : "✗"}
                </span>
                <span>Share Resume with Companies (optional)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-semibold mb-2">MLH Agreements</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={registration?.mlh_code_of_conduct ? "text-green-600" : "text-red-600"}>
                  {registration?.mlh_code_of_conduct ? "✓" : "✗"}
                </span>
                <span>MLH Code of Conduct</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={registration?.mlh_data_sharing ? "text-green-600" : "text-red-600"}>
                  {registration?.mlh_data_sharing ? "✓" : "✗"}
                </span>
                <span>MLH Data Sharing</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={registration?.mlh_communications ? "text-green-600" : "text-gray-400"}>
                  {registration?.mlh_communications ? "✓" : "✗"}
                </span>
                <span>MLH Communications (optional)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
