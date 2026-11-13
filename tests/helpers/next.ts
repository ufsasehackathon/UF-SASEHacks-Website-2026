import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient } from "./db";
import type { TestUser } from "./users";

// Server actions call createSupabaseServerClient() (cookies) and Next's cache/navigation APIs.
// Test files that import actions call mockNext() at the top; actAs() picks whose JWT they run with.

let current: SupabaseClient | null = null;

/** Run subsequent server actions as this user (null = signed out) */
export function actAs(user: TestUser | null) {
  current = user?.client ?? null;
}

export class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

export const revalidatePath = vi.fn();

export const nextMocks = {
  server: { createSupabaseServerClient: async () => current ?? anonClient() },
  cache: { revalidatePath, revalidateTag: vi.fn() },
  navigation: {
    redirect: (url: string) => {
      throw new RedirectError(url);
    },
  },
};

/** Route Resend calls to a mock; everything else (Supabase) goes to the real network */
export function mockResend(response: () => Response = () => new Response("{}", { status: 200 })) {
  const realFetch = globalThis.fetch;
  const resend = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => response());
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).startsWith("https://api.resend.com") ? resend(String(input), init!) : realFetch(input, init)
  );
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "SASEHacks <team@sasehacks.com>");
  return resend;
}
