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
