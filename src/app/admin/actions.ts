"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RSVP_WINDOW_DAYS, EMAIL_DAILY_CAP } from "@/lib/constants";
import { registrationStatuses, type RegistrationStatus } from "@/lib/validation";
import { EMAILED_STATUSES, statusEmail, sendEmailBatch, emailConfigured, type OutgoingEmail } from "@/lib/email";

/** Statuses an admin can set directly from the table */
export type AdminSettableStatus = Exclude<RegistrationStatus, "draft">;

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not authenticated" } as const;

  const { data: isAdmin } = await supabase.rpc("is_admin", { p_uid: user.id });
  if (!isAdmin) return { supabase, user: null, error: "Not admin" } as const;

  return { supabase, user, error: null } as const;
}

export type AdminRow = {
  user_id: string;
  status: string;
  editing_locked: boolean;
  resume_updated_at: string | null;
  submitted_at: string | null;
  rsvp_deadline: string | null;
  review_score: number | null;
  last_emailed_status: string | null;
  profiles: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone_number: string | null;
    date_of_birth: string | null;
    age: string | null;
    linkedin_url: string | null;
    school: string | null;
    major: string | null;
    grad_year: string | null;
    level_of_study: string | null;
    engineering_skill: string | null;
    hackathon_experience: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
    country: string | null;
    tshirt: string | null;
    gender: string | null;
    race: string[] | null;
    discord_username: string | null;
  } | null;
};

// Fetch rows for the admin table with optional filters
export async function fetchAdminRows({
  q,
  status,
  sort,
}: { q?: string; status?: string; sort?: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Enforce admin
  const { data: isAdmin } = await supabase.rpc("is_admin", { p_uid: user.id });
  if (!isAdmin) return { ok: false, error: "Not admin" };

  let query = supabase
    .from("registrations")
    .select(
      "user_id, status, editing_locked, resume_updated_at, submitted_at, rsvp_deadline, review_score, last_emailed_status, profiles(*)"
    );

  if (sort === "score") {
    query = query.order("review_score", { ascending: false, nullsFirst: false }).order("submitted_at", { ascending: true });
  } else if (sort === "submitted") {
    query = query.order("submitted_at", { ascending: true, nullsFirst: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (status) query = query.eq("status", status);

  // Simple "q" matches name or email
  if (q) {
    query = query.or(
      `profiles.full_name.ilike.%${q}%,profiles.email.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  return { ok: true, rows: (data ?? []) as unknown as AdminRow[] };
}

/**
 * Single or bulk status update. Accepting stamps accepted_at and a fresh RSVP deadline.
 * Doesn't email: decisions queue up for sendPendingEmails so mistakes can be fixed first.
 */
export async function setStatus(userIds: string[], status: AdminSettableStatus) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  if (!userIds.length) return { ok: false, error: "No users selected" };
  // runtime check: server actions can be called with anything
  if (!registrationStatuses.includes(status) || (status as string) === "draft") return { ok: false, error: "Invalid status" };

  const update: Record<string, unknown> = { status };
  if (status === "accepted") {
    const now = new Date();
    update.accepted_at = now.toISOString();
    update.rsvp_deadline = new Date(now.getTime() + RSVP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    update.rsvp_at = null;
  }

  const { error } = await supabase
    .from("registrations")
    .update(update)
    .in("user_id", userIds);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

/** Save a reviewer's 1-5 score and notes for one applicant */
export async function saveReview(userId: string, score: number | null, notes: string) {
  const { supabase, user, error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  if (score !== null && !(Number.isInteger(score) && score >= 1 && score <= 5)) {
    return { ok: false, error: "Score must be 1-5" };
  }

  const { error } = await supabase
    .from("registrations")
    .update({ review_score: score, notes: notes.trim() || null, reviewed_by: user.id })
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath(`/admin/${userId}`);
  return { ok: true };
}

/** Next submitted-but-unreviewed applicant after `afterUserId`, oldest submission first */
export async function nextUnreviewed(afterUserId: string) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const { data, error } = await supabase
    .from("registrations")
    .select("user_id")
    .eq("status", "pending")
    .is("review_score", null)
    .neq("user_id", afterUserId)
    .order("submitted_at", { ascending: true })
    .limit(1);

  if (error) return { ok: false, error: error.message };
  return { ok: true, userId: data?.[0]?.user_id ?? null };
}

/** Count of every status, for the stats header (independent of the table filters) */
export async function fetchStatusCounts() {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const { data, error } = await supabase.from("registrations").select("status, last_emailed_status");
  if (error) return { ok: false, error: error.message };

  const counts = Object.fromEntries(registrationStatuses.map(st => [st, 0])) as Record<RegistrationStatus, number>;
  let unsentEmails = 0;
  for (const r of data ?? []) {
    if (r.status in counts) counts[r.status as RegistrationStatus]++;
    if (EMAILED_STATUSES.includes(r.status as RegistrationStatus) && r.status !== r.last_emailed_status) unsentEmails++;
  }
  return { ok: true, counts, total: data?.length ?? 0, unsentEmails };
}

/** accepted rows whose RSVP deadline has passed -> declined */
export async function expireOverdueRsvps() {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const { data, error } = await supabase
    .from("registrations")
    .update({ status: "declined" })
    .eq("status", "accepted")
    .lt("rsvp_deadline", new Date().toISOString())
    .select("user_id");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true, count: data?.length ?? 0 };
}

/** Accept the top `n` waitlisted applicants (highest score, then earliest submission) */
export async function promoteFromWaitlist(n: number) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  if (!Number.isInteger(n) || n < 1) return { ok: false, error: "Enter how many to promote" };

  const { data, error } = await supabase
    .from("registrations")
    .select("user_id")
    .eq("status", "waitlist")
    .order("review_score", { ascending: false, nullsFirst: false })
    .order("submitted_at", { ascending: true })
    .limit(n);

  if (error) return { ok: false, error: error.message };
  const ids = (data ?? []).map(r => r.user_id);
  if (!ids.length) return { ok: true, count: 0 };

  const res = await setStatus(ids, "accepted");
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, count: ids.length };
}

/**
 * Email everyone whose status changed since we last emailed them, up to EMAIL_DAILY_CAP per
 * call (Resend free plan: 100/day). Safe to re-run: rows are marked only after their batch sends.
 */
export async function sendPendingEmails() {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };
  if (!emailConfigured()) return { ok: false, error: "Email is not configured (set RESEND_API_KEY and EMAIL_FROM)" };

  const { data, error } = await supabase
    .from("registrations")
    .select("user_id, status, rsvp_deadline, last_emailed_status, profiles(email, first_name)")
    .in("status", EMAILED_STATUSES)
    .order("updated_at", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const queue = (data ?? []).filter(r => r.status !== r.last_emailed_status);
  const batch = queue.slice(0, EMAIL_DAILY_CAP);

  let sent = 0;
  let skipped = 0;
  for (let i = 0; i < batch.length; i += 100) {
    const chunk = batch.slice(i, i + 100);
    const emails: OutgoingEmail[] = [];
    const ids: { user_id: string; status: string }[] = [];

    for (const r of chunk) {
      const profile = r.profiles as unknown as { email: string | null; first_name: string | null } | null;
      const msg = statusEmail(r.status, {
        firstName: profile?.first_name ?? null,
        rsvpDeadline: r.rsvp_deadline,
        previousEmailedStatus: r.last_emailed_status,
      });
      if (!msg || !profile?.email) { skipped++; continue; }
      emails.push({ to: profile.email, ...msg });
      ids.push({ user_id: r.user_id, status: r.status });
    }

    const res = await sendEmailBatch(emails);
    if (!res.ok) return { ok: false, error: res.error, sent, remaining: queue.length - sent };

    // Mark each row with the status we just emailed about (one update per status)
    for (const st of new Set(ids.map(x => x.status))) {
      await supabase
        .from("registrations")
        .update({ last_emailed_status: st })
        .in("user_id", ids.filter(x => x.status === st).map(x => x.user_id))
        .eq("status", st);
    }
    sent += emails.length;
  }

  revalidatePath("/admin");
  return { ok: true, sent, skipped, remaining: queue.length - sent - skipped };
}

/** Toggle lock (single or bulk) */
export async function setEditingLock(userIds: string[], locked: boolean) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: isAdmin } = await supabase.rpc("is_admin", { p_uid: user.id });
  if (!isAdmin) return { ok: false, error: "Not admin" };

  if (!userIds.length) return { ok: false, error: "No users selected" };

  const { error } = await supabase
    .from("registrations")
    .update({ editing_locked: locked })
    .in("user_id", userIds);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

/** Generate short-lived signed resume URLs for selected users */
export async function getSignedResumeLinks(userIds: string[]) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: isAdmin } = await supabase.rpc("is_admin", { p_uid: user.id });
  if (!isAdmin) return { ok: false, error: "Not admin" };

  const results: { user_id: string; url: string | null }[] = [];

  for (const uid of userIds) {
    const path = `${uid}/resume.pdf`;
    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      results.push({ user_id: uid, url: null });
    } else {
      results.push({ user_id: uid, url: data.signedUrl });
    }
  }

  return { ok: true, links: results };
}

/** Delete profiles (also deletes associated registrations and resumes via cascade) */
export async function deleteProfiles(userIds: string[]) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: isAdmin } = await supabase.rpc("is_admin", { p_uid: user.id });
  if (!isAdmin) return { ok: false, error: "Not admin" };

  if (!userIds.length) return { ok: false, error: "No users selected" };

  // Delete resumes from storage first
  for (const uid of userIds) {
    const path = `${uid}/resume.pdf`;
    // Ignore errors if file doesn't exist
    await supabase.storage.from("resumes").remove([path]);
  }

  // Delete registrations (profiles will cascade delete if configured, or delete manually)
  const { error: regError } = await supabase
    .from("registrations")
    .delete()
    .in("user_id", userIds);

  if (regError) return { ok: false, error: regError.message };

  // Delete profiles
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .in("id", userIds);

  if (profileError) return { ok: false, error: profileError.message };

  revalidatePath("/admin");
  return { ok: true };
}

/** Get all resume URLs for download */
export async function getAllResumeLinks() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: isAdmin } = await supabase.rpc("is_admin", { p_uid: user.id });
  if (!isAdmin) return { ok: false, error: "Not admin" };

  // Get all users who have uploaded resumes
  const { data: registrations, error } = await supabase
    .from("registrations")
    .select("user_id, profiles(full_name, email)")
    .eq('share_resume_with_companies', true)
    .not("resume_url", "is", null);

  if (error) return { ok: false, error: error.message };

  const results: { user_id: string; name: string | null; email: string | null; url: string | null }[] = [];

  for (const reg of registrations ?? []) {
    const path = `${reg.user_id}/resume.pdf`;
    const { data, error: urlError } = await supabase.storage.from("resumes").createSignedUrl(path, 3600); // 1 hour

    const profile = reg.profiles as unknown as { full_name: string | null; email: string | null } | null;

    if (urlError || !data?.signedUrl) {
      results.push({
        user_id: reg.user_id,
        name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        url: null
      });
    } else {
      results.push({
        user_id: reg.user_id,
        name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        url: data.signedUrl
      });
    }
  }

  return { ok: true, links: results };
}
