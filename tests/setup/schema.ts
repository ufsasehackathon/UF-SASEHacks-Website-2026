import { readFileSync } from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import type { TestEnv } from "./env";

/** Wipe app data. Auth users and storage objects are left (unique per test, and inert without a profile). */
export const RESET_SQL = `
  truncate public.mailing_list, public.attendance, public.judge_scores, public.judge_assignments,
           public.projects, public.user_roles, public.registrations, public.profiles cascade;
  update public.settings set applications_close = '2027-02-01 23:59:00-05';
  delete from public.events where event_name <> 'Check-in';
  update public.events set self_checkin_open = false;
`;

/** Apply supabase/schema.sql (idempotent), wipe app data, and wait for the API to see the schema */
export async function prepareDatabase(env: TestEnv) {
  const client = new pg.Client({ connectionString: env.dbUrl });
  await client.connect();
  try {
    await client.query(readFileSync("supabase/schema.sql", "utf8"));
    await client.query(RESET_SQL);
  } finally {
    await client.end();
  }

  // schema.sql ends with a PostgREST schema reload; wait until the API sees the new RPCs
  const anon = createClient(env.apiUrl, env.anonKey, { auth: { persistSession: false } });
  for (let i = 0; ; i++) {
    const { error } = await anon.rpc("keep_alive");
    if (!error) break;
    if (i > 50) throw new Error(`API never picked up the schema: ${error.message}`);
    await new Promise(r => setTimeout(r, 200));
  }
}
