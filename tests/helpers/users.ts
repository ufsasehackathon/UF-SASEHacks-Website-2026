import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { newUserClient, serviceClient, sql } from "./db";
import { allConsents } from "./fixtures";
import type { Role } from "@/lib/roles";
import type { RegistrationStatus } from "@/lib/validation";

export type TestUser = {
  id: string;
  email: string;
  password: string;
  /** anon-key client signed in as this user (real JWT, so RLS and guards apply) */
  client: SupabaseClient;
};

export function uniqueEmail(prefix = "user") {
  return `${prefix}-${randomUUID().slice(0, 8)}@test.sasehacks.local`;
}

/**
 * Create an auth user and sign them in. By default also creates their profile (like ensureRows),
 * and a user_roles row for owner/staff/judge (like the SQL snippet in schema.sql).
 */
export async function createUser(
  opts: { role?: Role; email?: string; profile?: boolean; firstName?: string } = {}
): Promise<TestUser> {
  const { role = "hacker", profile = true } = opts;
  const email = opts.email ?? uniqueEmail(role);
  const password = `pw-${randomUUID()}`;

  const admin = serviceClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  const id = data.user.id;

  if (profile || role !== "hacker") {
    await sql(`insert into public.profiles (id, email, first_name) values ($1, $2, $3)`, [id, email, opts.firstName ?? "Test"]);
  }
  if (role !== "hacker") {
    await sql(`insert into public.user_roles (user_id, role) values ($1, $2)`, [id, role]);
  }

  const client = newUserClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);

  return { id, email, password, client };
}

type RegistrationFields = {
  status: RegistrationStatus;
  editing_locked: boolean;
  resume_url: string | null;
  responses: Record<string, string>;
  submitted_at: string | null;
  accepted_at: string | null;
  rsvp_deadline: string | null;
  last_emailed_status: string | null;
  review_score: number | null;
  notes: string | null;
} & Record<string, unknown>;

/**
 * Create or overwrite a registration as the SQL editor would (no guards).
 * Default: a draft with every consent and a resume path, i.e. ready to submit.
 */
export async function setRegistration(userId: string, fields: Partial<RegistrationFields> = {}) {
  const row = {
    user_id: userId,
    status: "draft",
    ...allConsents(),
    resume_url: `${userId}/resume.pdf`,
    ...fields,
  };
  const { error } = await serviceClient().from("registrations").upsert(row, { onConflict: "user_id" });
  if (error) throw new Error(`setRegistration failed: ${error.message}`);
}

export async function getRegistration(userId: string) {
  const rows = await sql(`select * from public.registrations where user_id = $1`, [userId]);
  return rows[0] as Record<string, unknown> | undefined;
}

export async function getProfile(userId: string) {
  const rows = await sql(`select * from public.profiles where id = $1`, [userId]);
  return rows[0] as Record<string, unknown> | undefined;
}

/**
 * Pretend the user linked Discord. Real Discord OAuth can't run in tests; rsvp() and
 * sync_discord_profile() only read auth.identities, so this is what they see after a real link.
 */
export async function linkDiscord(userId: string, username = "testhacker") {
  const discordId = String(Math.floor(Math.random() * 1e17));
  await sql(
    `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
     values ($1, $2, $3::jsonb, 'discord', now(), now(), now())`,
    [discordId, userId, JSON.stringify({ sub: discordId, provider_id: discordId, name: username, full_name: username })]
  );
  return { discordId, username };
}

/** Accept a hacker the way an owner does today in the SQL editor */
export async function accept(userId: string, deadline: Date | null = new Date(Date.now() + 7 * 86400_000)) {
  await setRegistration(userId, {
    status: "accepted",
    submitted_at: new Date().toISOString(),
    accepted_at: new Date().toISOString(),
    rsvp_deadline: deadline?.toISOString() ?? null,
  });
}

export async function setApplicationsClose(when: Date) {
  await sql(`update public.settings set applications_close = $1`, [when.toISOString()]);
}
