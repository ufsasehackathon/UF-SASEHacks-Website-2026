import pg from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { RESET_SQL } from "../setup/schema";
import type { TestEnv } from "../setup/env";

/**
 * Local stack details. Set as JSON in process.env.TEST_ENV by tests/setup/each-file.ts (Vitest)
 * and playwright.config.ts, so these helpers work in both runners.
 */
export function env(): TestEnv {
  const raw = process.env.TEST_ENV;
  if (!raw) throw new Error("TEST_ENV isn't set: run through `npm run test:db` or `npm run test:e2e`");
  return JSON.parse(raw);
}

let pool: pg.Pool | null = null;

/** Direct SQL as the `postgres` role, like the SQL editor: table owner (no RLS) and no JWT (no guards) */
export async function sql<T extends pg.QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = []) {
  pool ??= new pg.Pool({ connectionString: env().dbUrl, max: 2 });
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function closeDb() {
  await pool?.end();
  pool = null;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Service-role client: bypasses RLS, and auth.uid() is null so the guards don't apply */
export function serviceClient(): SupabaseClient {
  return createClient(env().apiUrl, env().serviceRoleKey, noSession);
}

/** Signed-out visitor */
export function anonClient(): SupabaseClient {
  return createClient(env().apiUrl, env().anonKey, noSession);
}

/** A fresh anon-key client that will hold one user's session */
export function newUserClient(): SupabaseClient {
  return createClient(env().apiUrl, env().anonKey, noSession);
}

/** Wipe app data (runs before each test file; also callable inside a file) */
export async function resetDb() {
  await sql(RESET_SQL);
}

/** PostgREST error code for "insufficient privilege": guard triggers and RLS insert/with-check violations */
export const DENIED = "42501";
