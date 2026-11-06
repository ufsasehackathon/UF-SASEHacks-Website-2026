import { execSync } from "node:child_process";

/** Connection details for the local Supabase stack (`supabase start`) */
export type TestEnv = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
  mailpitUrl: string;
};

function isLocal(url: string) {
  const host = new URL(url).hostname;
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

/**
 * Read the local stack's URLs and keys from `supabase status -o env`.
 * Never reads .env.local: the tests wipe tables, so they must never point at the real project.
 */
export function loadTestEnv(): TestEnv {
  let out: string;
  try {
    out = execSync("npx --no-install supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    throw new Error(
      "Local Supabase isn't running. Start it with `npx supabase start` (needs Docker), " +
        "or let CI run these tests.\n" + String((e as { stderr?: string }).stderr ?? e)
    );
  }

  const vars = Object.fromEntries(
    out
      .split("\n")
      .map(line => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map(m => [m[1], m[2]])
  );

  const env: TestEnv = {
    apiUrl: vars.API_URL,
    anonKey: vars.ANON_KEY,
    serviceRoleKey: vars.SERVICE_ROLE_KEY,
    dbUrl: vars.DB_URL,
    mailpitUrl: vars.MAILPIT_URL ?? vars.INBUCKET_URL ?? "http://127.0.0.1:54324",
  };

  for (const [k, v] of Object.entries(env)) {
    if (!v) throw new Error(`supabase status didn't report ${k}. Output:\n${out}`);
  }
  if (!isLocal(env.apiUrl) || !isLocal(env.dbUrl)) {
    throw new Error(`Refusing to run tests against a non-local Supabase (${env.apiUrl})`);
  }
  return env;
}
