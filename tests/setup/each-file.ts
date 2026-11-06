import { afterAll, beforeAll, inject } from "vitest";
import { closeDb, resetDb } from "../helpers/db";

// Point app code at the local stack. Set before any test file imports src/ modules.
const env = inject("testEnv");
process.env.TEST_ENV = JSON.stringify(env);
process.env.NEXT_PUBLIC_SUPABASE_URL = env.apiUrl;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.anonKey;
process.env.NEXT_PUBLIC_REGISTRATIONS_ENABLED = "true";
process.env.NEXT_PUBLIC_LOGIN_ENABLED = "true";
// Email is off unless a test turns it on (and mocks fetch)
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;

beforeAll(resetDb);
afterAll(closeDb);
