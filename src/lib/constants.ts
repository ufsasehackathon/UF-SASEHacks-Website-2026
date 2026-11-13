export const HACK_NAME = "SASEHacks";
export const DOMAIN = "sasehacks.com";
export const SITE_URL = `https://${DOMAIN}`;
export const DATES = "February 26-28, 2027";
export const CITY = "Gainesville, FL";
export const VENUE = "Harrell Medical Education Building";

export const DISCORD_INVITE = "https://discord.gg/gJJVmEPzc6";
export const DEVPOST_URL = "https://sasehacks.devpost.com/";

// Master switches, set per environment (e.g. on for Vercel Preview/dev, off for Production
// until launch). NEXT_PUBLIC_ because the header (a client component) reads LOGIN_ENABLED;
// they're inlined at build time, so redeploy after changing them.
export const REGISTRATIONS_ENABLED = process.env.NEXT_PUBLIC_REGISTRATIONS_ENABLED === "true";
export const LOGIN_ENABLED = process.env.NEXT_PUBLIC_LOGIN_ENABLED === "true";

// PLACEHOLDERS: confirm with organizers.
// Keep APPLICATIONS_CLOSE in sync with public.settings.applications_close (enforced by the DB).
export const APPLICATIONS_CLOSE = "2027-02-01T23:59:00-05:00";
export const DECISIONS_BY = "February 8, 2027";
// Accepted hackers have this many days from when their decision email is sent to RSVP.
export const RSVP_WINDOW_DAYS = 7;
// Walk-ins can be added to the on-site waitlist only during the event.
export const EVENT_START = "2027-02-26T08:00:00-05:00";
export const EVENT_END = "2027-02-28T18:00:00-05:00";

/** Evaluated per call so the deadline takes effect without a redeploy */
export function registrationsOpen() {
  return REGISTRATIONS_ENABLED && Date.now() < Date.parse(APPLICATIONS_CLOSE);
}

/** True during the event window (EVENT_START..EVENT_END, inclusive). Not gated on REGISTRATIONS_ENABLED. */
export function walkInsOpen(now: number = Date.now()): boolean {
  return Date.parse(EVENT_START) <= now && now <= Date.parse(EVENT_END);
}

/** RSVP deadline for a decision sent at `sentAt`: RSVP_WINDOW_DAYS days later. */
export function rsvpDeadlineFrom(sentAt: Date): Date {
  return new Date(sentAt.getTime() + RSVP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}
