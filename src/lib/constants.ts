export const HACK_NAME = "SASEHacks";
export const DOMAIN = "sasehacks.com";
export const SITE_URL = `https://${DOMAIN}`;
export const DATES = "February 26-28, 2027";
export const CITY = "Gainesville, FL";
export const VENUE = "Harrell Medical Education Building";

export const DISCORD_INVITE = "https://discord.gg/gJJVmEPzc6";
export const DEVPOST_URL = "https://sasehacks.devpost.com/";

// Master switches: flip to true when applications launch
export const REGISTRATIONS_ENABLED = false;
export const LOGIN_ENABLED = false;

// PLACEHOLDERS: confirm with organizers.
// Keep APPLICATIONS_CLOSE in sync with public.settings.applications_close (enforced by the DB).
export const APPLICATIONS_CLOSE = "2027-02-01T23:59:00-05:00";
export const DECISIONS_BY = "February 8, 2027";
export const RSVP_WINDOW_DAYS = 7;
export const EVENT_CAPACITY = 300;

// Resend free plan sends 100 emails/day; raise this if you upgrade
export const EMAIL_DAILY_CAP = 100;

/** Evaluated per call so the deadline takes effect without a redeploy */
export function registrationsOpen() {
  return REGISTRATIONS_ENABLED && Date.now() < Date.parse(APPLICATIONS_CLOSE);
}
