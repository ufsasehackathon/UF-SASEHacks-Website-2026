import { HACK_NAME, DATES, VENUE, CITY, DISCORD_INVITE, SITE_URL, DECISIONS_BY } from "@/lib/constants";
import type { RegistrationStatus } from "@/lib/validation";

// Sent through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-batch-emails).
// Env: RESEND_API_KEY, EMAIL_FROM (e.g. "SASEHacks <team@sasehacks.com>", on a domain verified
// in Resend), EMAIL_REPLY_TO (an inbox organizers read).

export type OutgoingEmail = { to: string; subject: string; html: string };

type StatusEmailContext = {
  firstName: string | null;
  rsvpDeadline: string | null;
  /** status we last emailed them about, used to word waitlist promotions */
  previousEmailedStatus: string | null;
};

/** Statuses that get an email. draft never does. */
export const EMAILED_STATUSES: RegistrationStatus[] = [
  "pending",
  "accepted",
  "confirmed",
  "declined",
  "waitlist",
  "rejected",
];

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function layout(firstName: string | null, body: string) {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi there,";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2b0400;max-width:560px">
<p>${greeting}</p>
${body}
<p>See you soon,<br/>The ${HACK_NAME} team</p>
</div>`;
}

function button(href: string, label: string) {
  return `<p><a href="${href}" style="display:inline-block;background:#560700;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${label}</a></p>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function formatDeadline(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "full",
    timeStyle: "short",
  }) + " ET";
}

/** Subject + body for a status, or null when that status doesn't send an email */
export function statusEmail(status: string, ctx: StatusEmailContext): { subject: string; html: string } | null {
  const portal = `${SITE_URL}/portal`;
  const deadline = formatDeadline(ctx.rsvpDeadline);

  switch (status) {
    case "pending":
      return {
        subject: `We got your ${HACK_NAME} application`,
        html: layout(ctx.firstName, `<p>Thanks for applying to ${HACK_NAME} (${DATES}, ${CITY})! Your application is in and our team will review it.</p>
<p>Decisions go out by ${DECISIONS_BY}. You can check your status any time in the portal.</p>
${button(portal, "Open the portal")}`),
      };
    case "accepted": {
      const opener = ctx.previousEmailedStatus === "waitlist"
        ? `<p>Good news: a spot opened up and you're off the waitlist. You're accepted to ${HACK_NAME}! 🎉</p>`
        : `<p>Congratulations, you're accepted to ${HACK_NAME}! 🎉</p>`;
      return {
        subject: `You're accepted to ${HACK_NAME}! Please RSVP`,
        html: layout(ctx.firstName, `${opener}
<p>To hold your spot, connect your Discord account and confirm you're coming in the portal${deadline ? ` by <strong>${deadline}</strong>` : ""}. Spots that aren't confirmed in time go to the waitlist.</p>
${button(portal, "RSVP now")}`),
      };
    }
    case "confirmed":
      return {
        subject: `You're confirmed for ${HACK_NAME}`,
        html: layout(ctx.firstName, `<p>You're all set! We'll see you ${DATES} at ${VENUE} in ${CITY}.</p>
<p>Event updates and announcements happen in our Discord, so make sure you've joined.</p>
${button(DISCORD_INVITE, "Join the Discord")}
<p>If your plans change, please release your spot in the portal so someone on the waitlist can go.</p>`),
      };
    case "declined":
      return {
        subject: `Your ${HACK_NAME} spot has been released`,
        html: layout(ctx.firstName, `<p>Your spot at ${HACK_NAME} has been released, either because you let us know you can't make it or because the RSVP deadline passed.</p>
<p>We're sorry to miss you this time and hope to see you at a future event.</p>`),
      };
    case "waitlist":
      return {
        subject: `${HACK_NAME} application update: waitlist`,
        html: layout(ctx.firstName, `<p>Thank you for applying to ${HACK_NAME}. We had more applicants than spots, and you're currently on our waitlist.</p>
<p>Spots open up as accepted hackers RSVP, so we'll email you right away if one becomes available.</p>`),
      };
    case "rejected":
      return {
        subject: `${HACK_NAME} application update`,
        html: layout(ctx.firstName, `<p>Thank you for applying to ${HACK_NAME}. We had far more applicants than spots this year, and unfortunately we can't offer you a place.</p>
<p>We'd love to see you apply again next year.</p>`),
      };
    default:
      return null;
  }
}

/**
 * Send up to 100 emails in one Resend batch request. Resend validates the whole batch, so
 * this either sends all of them or none.
 */
export async function sendEmailBatch(emails: OutgoingEmail[]): Promise<{ ok: boolean; error?: string }> {
  if (!emails.length) return { ok: true };
  if (!emailConfigured()) return { ok: false, error: "Email is not configured (RESEND_API_KEY / EMAIL_FROM)" };
  if (emails.length > 100) return { ok: false, error: "Resend batches are limited to 100 emails" };

  const replyTo = process.env.EMAIL_REPLY_TO;
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      emails.map(e => ({
        from: process.env.EMAIL_FROM,
        to: [e.to],
        subject: e.subject,
        html: e.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }))
    ),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Resend batch failed:", res.status, text);
    return { ok: false, error: `Resend error ${res.status}` };
  }
  return { ok: true };
}
