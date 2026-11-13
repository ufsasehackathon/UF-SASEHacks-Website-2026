import { HACK_NAME, DATES, VENUE, CITY, DISCORD_INVITE, SITE_URL, DECISIONS_BY } from "@/lib/constants";

// Sent through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-batch-emails).
// Env: RESEND_API_KEY, EMAIL_FROM (e.g. "SASEHacks <team@sasehacks.com>", on a domain verified
// in Resend), EMAIL_REPLY_TO (an inbox organizers read).

export type OutgoingEmail = { to: string; subject: string; html: string };

/** `rsvpDeadline` is an ISO timestamp, used by the "accepted" email. */
type StatusEmailContext = { firstName: string | null; rsvpDeadline?: string | null };

function emailConfigured() {
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

// Same format as the portal's deadline display.
function formatDeadline(iso: string) {
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }) + " ET";
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/**
 * Subject + body for a status email, or null for statuses without one. Hacker-triggered:
 * application received (pending), RSVP confirm/decline. Decisions: accepted (with the RSVP
 * deadline when given) and rejected. Waitlist has no email.
 */
export function statusEmail(status: string, ctx: StatusEmailContext): { subject: string; html: string } | null {
  const portal = `${SITE_URL}/portal`;

  switch (status) {
    case "pending":
      return {
        subject: `We got your ${HACK_NAME} application`,
        html: layout(ctx.firstName, `<p>Thanks for applying to ${HACK_NAME} (${DATES}, ${CITY})! Your application is in and our team will review it.</p>
<p>Decisions go out by ${DECISIONS_BY}. You can check your status any time in the portal.</p>
${button(portal, "Open the portal")}`),
      };
    case "accepted": {
      const deadline = ctx.rsvpDeadline
        ? ` by <strong>${formatDeadline(ctx.rsvpDeadline)}</strong>, or it will go to someone else`
        : "";
      return {
        subject: `You're in! RSVP for ${HACK_NAME}`,
        html: layout(ctx.firstName, `<p>Congratulations! You've been accepted to ${HACK_NAME}, ${DATES} at ${VENUE} in ${CITY}.</p>
<p>Connect your Discord account and confirm your spot in the portal${deadline}.</p>
${button(portal, "RSVP in the portal")}`),
      };
    }
    case "rejected":
      return {
        subject: `Your ${HACK_NAME} application`,
        html: layout(ctx.firstName, `<p>Thank you for applying to ${HACK_NAME}. Unfortunately, we couldn't offer you a spot this year.</p>
<p>We'd love to see you apply again. Join our mailing list to hear when applications open.</p>
${button(`${SITE_URL}/#mailing-list`, "Join the mailing list")}`),
      };
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
        html: layout(ctx.firstName, `<p>Thanks for letting us know you can't make it. Your spot at ${HACK_NAME} has been released.</p>
<p>We're sorry to miss you this time and hope to see you at a future event.</p>`),
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
