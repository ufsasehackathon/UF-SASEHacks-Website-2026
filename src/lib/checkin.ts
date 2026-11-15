// Pure helpers for the staff Check-in tab (/staff/checkin). Safe for client components.
import type { RegistrationStatus } from "@/lib/validation";

/** Someone staff can look up at check-in: profile + registration + main-event ('Check-in') attendance */
export type CheckinPerson = {
  userId: string;
  name: string;
  email: string;
  discordUsername: string | null;
  /** profiles.discord_id is set */
  hasDiscord: boolean;
  hasConsents: boolean;
  /** null = no registration */
  status: RegistrationStatus | null;
  checkedInAt: string | null;
  waitlistedAt: string | null;
};

export type CheckinState =
  | "checked_in"
  | "can_check_in"
  | "waitlisted"
  | "needs_discord"
  | "needs_agreements"
  | "can_waitlist";

/** What staff can do for this person, first match wins */
export function checkinState(p: CheckinPerson): CheckinState {
  if (p.checkedInAt) return "checked_in";
  if (p.status === "confirmed") return "can_check_in";
  if (p.status === "waitlist") return "waitlisted";
  if (!p.hasDiscord) return "needs_discord";
  if (!p.status || !p.hasConsents) return "needs_agreements";
  return "can_waitlist";
}

const SEARCH_FIELDS = ["first_name", "last_name", "full_name", "email", "discord_username"] as const;

/**
 * PostgREST `.or()` filter for a profile search, or null when the query has fewer than 2 usable
 * characters. Strips PostgREST filter syntax and wildcards (`,()%*\"`); apostrophes are kept so
 * "O'Brien" still matches. A query with a space also matches first name + last name.
 */
export function profileSearchFilter(query: string): string | null {
  const term = query.replace(/[,()%*\\"]/g, "").replace(/\s+/g, " ").trim();
  if (term.length < 2) return null;

  const clauses = SEARCH_FIELDS.map(field => `${field}.ilike.%${term}%`);
  const space = term.indexOf(" ");
  if (space > 0) {
    const first = term.slice(0, space);
    const rest = term.slice(space + 1);
    clauses.push(`and(first_name.ilike.%${first}%,last_name.ilike.%${rest}%)`);
  }
  return clauses.join(",");
}
