import { afterEach, describe, expect, it, vi } from "vitest";
import { actAs } from "../helpers/next";
import { sql } from "../helpers/db";
import { createUser } from "../helpers/users";

vi.mock("@/lib/supabase/server", async () => (await import("../helpers/next")).nextMocks.server);

const { joinMailingList } = await import("@/app/actions");

afterEach(() => actAs(null));

const emails = async () => (await sql<{ email: string }>(`select email from public.mailing_list order by created_at`)).map(r => r.email);

describe("joinMailingList", () => {
  it("stores a trimmed, lowercased email for a signed-out visitor", async () => {
    expect(await joinMailingList("  Fan@Example.COM ")).toEqual({ ok: true });
    expect(await emails()).toContain("fan@example.com");
  });

  it("treats a duplicate as success without adding a row", async () => {
    await joinMailingList("dup@example.com");
    expect(await joinMailingList("DUP@example.com")).toEqual({ ok: true });
    expect((await emails()).filter(e => e === "dup@example.com")).toHaveLength(1);
  });

  it.each(["", "   ", "not-an-email", "a@b", "@example.com"])("rejects %o", async input => {
    expect(await joinMailingList(input)).toEqual({ ok: false, error: "Please enter a valid email address." });
  });

  it("rejects an email over 320 characters", async () => {
    expect((await joinMailingList(`${"x".repeat(320)}@example.com`)).ok).toBe(false);
  });

  it("works for a signed-in user too", async () => {
    actAs(await createUser());
    expect(await joinMailingList("member@example.com")).toEqual({ ok: true });
  });
});
