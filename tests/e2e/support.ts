import { expect, type BrowserContext, type Page } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { env } from "../helpers/db";
import type { TestUser } from "../helpers/users";

export { createUser, setRegistration, getRegistration, linkDiscord, accept, uniqueEmail } from "../helpers/users";
export { sql } from "../helpers/db";

/**
 * Sign a user into the browser by writing the same auth cookies the app's Supabase client would
 * (sb-<ref>-auth-token, possibly chunked). Faster than a magic link; one test covers the real flow.
 */
export async function signIn(context: BrowserContext, user: TestUser, baseURL: string) {
  const jar = new Map<string, string>();
  const supabase = createServerClient(env().apiUrl, env().anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: cookies => cookies.forEach(c => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  // Cookies are written from the auth state change callback
  await expect.poll(() => jar.size).toBeGreaterThan(0);

  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: baseURL, sameSite: "Lax" as const })));
}

/** Newest email Mailpit (local Supabase's mail catcher) received for this address */
export async function latestEmailText(to: string): Promise<string> {
  const base = env().mailpitUrl;
  let id: string | undefined;
  await expect
    .poll(async () => {
      const res = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
      const body = (await res.json()) as { messages?: { ID: string }[] };
      id = body.messages?.[0]?.ID;
      return id;
    }, { timeout: 20_000 })
    .toBeTruthy();
  const msg = (await (await fetch(`${base}/api/v1/message/${id}`)).json()) as { Text: string; HTML: string };
  return msg.Text || msg.HTML;
}

/** The Dashboard link in the desktop header */
export const dashboardLink = (page: Page) => page.getByRole("link", { name: "Dashboard" }).first();
