"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { OWNER_ROLES, STAFF_ROLES } from "@/lib/roles";
import { rsvpDeadlineFrom } from "@/lib/constants";
import { sendEmailBatch, statusEmail, type OutgoingEmail } from "@/lib/email";

type Decision = "accepted" | "rejected";

/** Staff/owner: queue a decision for pending applicants (sent later by an owner). */
export async function setDecisions(
  userIds: string[],
  decision: Decision
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return auth;

  const { data, error } = await auth.supabase.rpc("set_decisions", { p_user_ids: userIds, p_decision: decision });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/staff/applications");
  return { ok: true, count: data as number };
}

/** Staff/owner: undo queued (unsent) decisions. */
export async function clearDecisions(userIds: string[]): Promise<{ ok: boolean; error?: string; count?: number }> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return auth;

  const { data, error } = await auth.supabase.rpc("clear_decisions", { p_user_ids: userIds });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/staff/applications");
  return { ok: true, count: data as number };
}

/** Staff/owner: a 60-second signed link to an applicant's resume. */
export async function getResumeUrl(userId: string): Promise<{ ok: boolean; error?: string; url?: string }> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return auth;

  const { data, error } = await auth.supabase.storage.from("resumes").createSignedUrl(`${userId}/resume.pdf`, 60);
  if (error || !data?.signedUrl) return { ok: false, error: "Resume not found" };

  revalidatePath("/staff/applications");
  return { ok: true, url: data.signedUrl };
}

type SendResult = { ok: boolean; error?: string; sent: number; failed: number; noEmail: number; stale: number };

const BATCH = 100;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Owner only: email every queued decision, then apply it. Each batch of up to 100 is emailed
 * first and only applied (apply_decisions) if Resend accepted it, so nobody's status changes
 * without the email going out. A failed batch stays queued and stops the run. Applicants with
 * no email on their profile are skipped and stay queued. Queued decisions for applicants who
 * are no longer 'pending' (decided some other way meanwhile) aren't emailed: they're cleared
 * from the queue and counted as `stale`.
 */
export async function sendDecisions(): Promise<SendResult> {
  const result: SendResult = { ok: true, sent: 0, failed: 0, noEmail: 0, stale: 0 };

  const auth = await requireRole(OWNER_ROLES);
  if (!auth.ok) return { ...result, ok: false, error: auth.error };
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return { ...result, ok: false, error: "Email is not configured" };
  }
  const { supabase } = auth;

  const { data: queue, error: queueError } = await supabase
    .from("pending_decisions")
    .select("user_id, decision")
    .order("decided_at", { ascending: true });
  if (queueError) return { ...result, ok: false, error: queueError.message };
  const rows = (queue ?? []) as { user_id: string; decision: Decision }[];
  if (!rows.length) return result;

  // Profiles and current statuses by id, looked up in chunks to keep the request URL short
  const profiles = new Map<string, { email: string | null; first_name: string | null }>();
  const statuses = new Map<string, string>();
  for (const ids of chunks(rows.map(r => r.user_id), BATCH)) {
    const { data, error } = await supabase.from("profiles").select("id, email, first_name").in("id", ids);
    if (error) return { ...result, ok: false, error: error.message };
    for (const p of data ?? []) profiles.set(p.id, { email: p.email, first_name: p.first_name });

    const { data: regs, error: regError } = await supabase.from("registrations").select("user_id, status").in("user_id", ids);
    if (regError) return { ...result, ok: false, error: regError.message };
    for (const r of regs ?? []) statuses.set(r.user_id, r.status);
  }

  // apply_decisions would skip these after the email went out, so don't email them at all
  const stale = rows.filter(r => statuses.get(r.user_id) !== "pending").map(r => r.user_id);
  if (stale.length) {
    const { error } = await supabase.rpc("clear_decisions", { p_user_ids: stale });
    if (error) return { ...result, ok: false, error: error.message };
    result.stale = stale.length;
  }

  const pending = rows.filter(r => statuses.get(r.user_id) === "pending");
  const sendable = pending.filter(r => profiles.get(r.user_id)?.email?.trim());
  result.noEmail = pending.length - sendable.length;

  for (const chunk of chunks(sendable, BATCH)) {
    const deadline = rsvpDeadlineFrom(new Date());
    const emails: OutgoingEmail[] = chunk.map(r => {
      const profile = profiles.get(r.user_id)!;
      const content = statusEmail(r.decision, { firstName: profile.first_name || null, rsvpDeadline: deadline.toISOString() })!;
      return { to: profile.email!.trim(), ...content };
    });

    const send = await sendEmailBatch(emails);
    if (!send.ok) {
      result.failed += chunk.length;
      result.error = send.error;
      break;
    }

    const { data: applied, error } = await supabase.rpc("apply_decisions", {
      p_items: chunk.map(({ user_id, decision }) => ({ user_id, decision })),
      p_rsvp_deadline: deadline.toISOString(),
    });
    if (error) {
      console.error("apply_decisions failed after emails were sent:", error.message);
      result.failed += chunk.length;
      result.error = `Emails were sent but the decisions weren't saved: ${error.message}`;
      break;
    }
    const appliedIds = new Set((applied ?? []) as string[]);
    result.sent += appliedIds.size;
    const missing = chunk.filter(r => !appliedIds.has(r.user_id)).map(r => r.user_id);
    if (missing.length) {
      // Their status changed between loading the queue and applying, after the email went out
      console.error("Decisions emailed but not applied (no longer pending):", missing);
      result.failed += missing.length;
      result.error = `${missing.length} emailed decision(s) weren't applied because the applicant was no longer pending`;
    }
  }

  result.ok = result.failed === 0;
  revalidatePath("/staff/applications");
  revalidatePath("/portal");
  return result;
}
