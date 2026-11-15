import { getCurrentRole } from "@/lib/session";
import { unsentCounts, type ApplicantRow } from "@/lib/applications";
import { levelOfStudyLabels, majorLabels, type RegistrationStatus } from "@/lib/validation";
import { ApplicationsTable } from "@/components/staff/ApplicationsTable";
import { SendDecisionsBar } from "@/components/staff/SendDecisionsBar";

type ProfileFields = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  school: string | null;
  major: string | null;
  grad_year: string | null;
  level_of_study: string | null;
  hackathon_experience: string | null;
  engineering_skill: string | null;
  linkedin_url: string | null;
};

type RegistrationWithProfile = {
  user_id: string;
  status: RegistrationStatus;
  submitted_at: string | null;
  resume_url: string | null;
  responses: Record<string, string> | null;
  profiles: ProfileFields | ProfileFields[] | null;
};

const label = (labels: Record<string, string>, value: string | null) => (value ? labels[value] ?? value : "");

/** Submitted applications (owner + staff; the /staff layout checks the role). Owners also get the Send decisions bar. */
export default async function StaffApplicationsPage() {
  const { supabase, role } = await getCurrentRole();

  const [regs, decisions] = await Promise.all([
    supabase
      .from("registrations")
      .select(
        "user_id, status, submitted_at, resume_url, responses, profiles(full_name, first_name, last_name, email, school, major, grad_year, level_of_study, hackathon_experience, engineering_skill, linkedin_url)"
      )
      .neq("status", "draft")
      .order("submitted_at", { ascending: true }),
    supabase.from("pending_decisions").select("user_id, decision"),
  ]);

  const loadError = regs.error ?? decisions.error;
  if (loadError) {
    return <p className="font-[family-name:var(--font-body)] text-red-700">Couldn&apos;t load applications: {loadError.message}</p>;
  }

  const decisionByUser = new Map(
    ((decisions.data ?? []) as { user_id: string; decision: "accepted" | "rejected" }[]).map(d => [d.user_id, d.decision])
  );

  const rows: ApplicantRow[] = ((regs.data ?? []) as RegistrationWithProfile[]).map(r => {
    const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) ?? ({} as Partial<ProfileFields>);
    const name = p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || "(no name)";
    return {
      userId: r.user_id,
      name,
      email: p.email ?? "",
      school: p.school ?? "",
      major: label(majorLabels, p.major ?? null),
      gradYear: p.grad_year ?? "",
      levelOfStudy: label(levelOfStudyLabels, p.level_of_study ?? null),
      hackathonExperience: p.hackathon_experience ?? "",
      engineeringSkill: p.engineering_skill ?? "",
      linkedinUrl: p.linkedin_url || null,
      hasResume: Boolean(r.resume_url),
      responses: r.responses ?? {},
      submittedAt: r.submitted_at,
      status: r.status,
      decision: decisionByUser.get(r.user_id) ?? null,
    };
  });

  const counts = unsentCounts(rows);

  return (
    <div className="space-y-6">
      {role === "owner" && <SendDecisionsBar accepted={counts.accepted} rejected={counts.rejected} />}
      <ApplicationsTable rows={rows} />
    </div>
  );
}
