// Pure helpers for the staff Applications tab (/staff/applications). Safe for client components.
import type { RegistrationStatus } from "@/lib/validation";

/** One submitted application: registration + profile + any unsent decision (pending_decisions) */
export type ApplicantRow = {
  userId: string;
  name: string;
  email: string;
  school: string;
  major: string;
  gradYear: string;
  levelOfStudy: string;
  hackathonExperience: string;
  engineeringSkill: string;
  linkedinUrl: string | null;
  hasResume: boolean;
  responses: Record<string, string>;
  submittedAt: string | null;
  status: RegistrationStatus;
  decision: "accepted" | "rejected" | null;
};

export type ApplicantState =
  | "pending"
  | "accepted_unsent"
  | "rejected_unsent"
  | "accepted"
  | "confirmed"
  | "declined"
  | "rejected"
  | "waitlist";

/**
 * What the table shows for a row. An unsent decision only counts while the registration is
 * still 'pending' (sendDecisions clears decisions for anyone decided some other way).
 */
export function applicantState(row: ApplicantRow): ApplicantState {
  if (row.status === "pending") {
    if (row.decision === "accepted") return "accepted_unsent";
    if (row.decision === "rejected") return "rejected_unsent";
    return "pending";
  }
  // Drafts aren't loaded by the page; treat a stray one as pending
  if (row.status === "draft") return "pending";
  return row.status;
}

export const APPLICANT_FILTERS: { value: ApplicantState | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "accepted_unsent", label: "Accepted · not sent" },
  { value: "rejected_unsent", label: "Rejected · not sent" },
  { value: "accepted", label: "Accepted" },
  { value: "confirmed", label: "Confirmed" },
  { value: "declined", label: "Declined" },
  { value: "rejected", label: "Rejected" },
  { value: "waitlist", label: "Waitlist" },
  { value: "all", label: "All" },
];

/** Rows in `filter` ("all" = every state) whose name, email or school contains `query` (case-insensitive) */
export function filterApplicants(rows: ApplicantRow[], filter: ApplicantState | "all", query: string): ApplicantRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter(row => {
    if (filter !== "all" && applicantState(row) !== filter) return false;
    if (!q) return true;
    return [row.name, row.email, row.school].some(field => field.toLowerCase().includes(q));
  });
}

/** Unsent decisions the owner's Send decisions bar would email */
export function unsentCounts(rows: ApplicantRow[]): { accepted: number; rejected: number } {
  let accepted = 0;
  let rejected = 0;
  for (const row of rows) {
    const state = applicantState(row);
    if (state === "accepted_unsent") accepted++;
    else if (state === "rejected_unsent") rejected++;
  }
  return { accepted, rejected };
}
