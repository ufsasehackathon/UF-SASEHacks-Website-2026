import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, mockResend, revalidatePath } from "../helpers/next";
import { serviceClient, sql } from "../helpers/db";
import { createUser, getRegistration, setRegistration, uniqueEmail, type TestUser } from "../helpers/users";
import { pdfFile } from "../helpers/fixtures";

vi.mock("@/lib/supabase/server", async () => (await import("../helpers/next")).nextMocks.server);
vi.mock("next/cache", async () => (await import("../helpers/next")).nextMocks.cache);
vi.mock("next/navigation", async () => (await import("../helpers/next")).nextMocks.navigation);

const apps = await import("@/app/staff/applications/actions");

const DAY = 86400_000;

beforeEach(() => {
  revalidatePath.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  actAs(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function pendingApplicant(firstName = "Test") {
  const user = await createUser({ firstName });
  await setRegistration(user.id, { status: "pending", submitted_at: new Date().toISOString() });
  return user;
}

async function queued(userId: string) {
  const rows = await sql(`select decision from public.pending_decisions where user_id = $1`, [userId]);
  return rows[0]?.decision as string | undefined;
}

/** Queue a decision the way set_decisions does, without going through the API */
async function queue(userId: string, decision: "accepted" | "rejected", by: string | null = null) {
  await sql(`insert into public.pending_decisions (user_id, decision, decided_by) values ($1, $2, $3)`, [userId, decision, by]);
}

/**
 * Many pending applicants with queued decisions, straight in SQL (signing up 100+ real users is
 * slow, and sendDecisions only reads profiles, registrations and the queue). Returns their ids.
 */
async function queueMany(n: number, decision: "accepted" | "rejected") {
  const ids = Array.from({ length: n }, () => randomUUID());
  for (const id of ids) {
    const email = uniqueEmail("bulk");
    await sql(`insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')`, [id, email]);
    await sql(`insert into public.profiles (id, email, first_name) values ($1, $2, 'Bulk')`, [id, email]);
    await sql(`insert into public.registrations (user_id, status, submitted_at) values ($1, 'pending', now())`, [id]);
    await queue(id, decision);
  }
  return ids;
}

async function queueCount() {
  const [{ count }] = await sql(`select count(*)::int as count from public.pending_decisions`);
  return count as number;
}

function sentEmails(resend: ReturnType<typeof mockResend>, call = 0) {
  return JSON.parse(resend.mock.calls[call][1].body as string) as { to: string[]; subject: string; html: string }[];
}

describe("setDecisions", () => {
  it("staff queue accepts; registrations stay pending", async () => {
    const [a, b] = [await pendingApplicant(), await pendingApplicant()];
    actAs(await createUser({ role: "staff" }));
    expect(await apps.setDecisions([a.id, b.id], "accepted")).toEqual({ ok: true, count: 2 });
    expect(await queued(a.id)).toBe("accepted");
    expect(await queued(b.id)).toBe("accepted");
    expect((await getRegistration(a.id))?.status).toBe("pending");
    expect((await getRegistration(b.id))?.status).toBe("pending");
    expect(revalidatePath).toHaveBeenCalledWith("/staff/applications");
  });

  it('a hacker gets "Not allowed"', async () => {
    const a = await pendingApplicant();
    actAs(await createUser());
    expect(await apps.setDecisions([a.id], "accepted")).toEqual({ ok: false, error: "Not allowed" });
    expect(await queued(a.id)).toBeUndefined();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('signed out gets "Not authenticated"', async () => {
    const a = await pendingApplicant();
    actAs(null);
    expect(await apps.setDecisions([a.id], "rejected")).toEqual({ ok: false, error: "Not authenticated" });
    expect(await queued(a.id)).toBeUndefined();
  });
});

describe("clearDecisions", () => {
  it("undoes a queued decision", async () => {
    const a = await pendingApplicant();
    actAs(await createUser({ role: "staff" }));
    await apps.setDecisions([a.id], "rejected");
    revalidatePath.mockClear();
    expect(await apps.clearDecisions([a.id])).toEqual({ ok: true, count: 1 });
    expect(await queued(a.id)).toBeUndefined();
    expect((await getRegistration(a.id))?.status).toBe("pending");
    expect(revalidatePath).toHaveBeenCalledWith("/staff/applications");
  });
});

describe("getResumeUrl", () => {
  it('staff get a signed URL; hackers get "Not allowed"', async () => {
    const a = await pendingApplicant();
    const { error } = await serviceClient().storage.from("resumes").upload(`${a.id}/resume.pdf`, pdfFile(), { upsert: true });
    expect(error).toBeNull();

    actAs(await createUser({ role: "staff" }));
    const res = await apps.getResumeUrl(a.id);
    expect(res.ok).toBe(true);
    expect(res.url).toBeTruthy();
    expect((await fetch(res.url!)).status).toBe(200);

    actAs(await createUser());
    expect(await apps.getResumeUrl(a.id)).toEqual({ ok: false, error: "Not allowed" });
  });
});

describe("sendDecisions", () => {
  let owner: TestUser;
  beforeEach(async () => {
    // sendDecisions sends the whole queue, so start each test with it empty
    await sql(`delete from public.pending_decisions`);
    owner = await createUser({ role: "owner" });
  });

  it('staff get "Not allowed"', async () => {
    const a = await pendingApplicant();
    await queue(a.id, "accepted");
    const resend = mockResend();
    actAs(await createUser({ role: "staff" }));
    expect(await apps.sendDecisions()).toEqual({ ok: false, error: "Not allowed", sent: 0, failed: 0, noEmail: 0, stale: 0 });
    expect(resend).not.toHaveBeenCalled();
    expect((await getRegistration(a.id))?.status).toBe("pending");
    expect(await queued(a.id)).toBe("accepted");
  });

  it("emails each decision once and applies them", async () => {
    const staff = await createUser({ role: "staff" });
    const [ada, bob, cy] = [await pendingApplicant("Ada"), await pendingApplicant("Bob"), await pendingApplicant("Cy")];
    await queue(ada.id, "accepted", staff.id);
    await queue(bob.id, "accepted", staff.id);
    await queue(cy.id, "rejected", staff.id);
    const resend = mockResend();
    actAs(owner);

    expect(await apps.sendDecisions()).toEqual({ ok: true, sent: 3, failed: 0, noEmail: 0, stale: 0 });

    expect(resend).toHaveBeenCalledTimes(1);
    const emails = sentEmails(resend);
    expect(emails).toHaveLength(3);
    const byTo = new Map(emails.map(e => [e.to[0], e]));
    expect(byTo.get(ada.email)?.subject).toMatch(/You're in!/);
    expect(byTo.get(ada.email)?.html).toContain("Hi Ada,");
    expect(byTo.get(bob.email)?.subject).toMatch(/You're in!/);
    expect(byTo.get(cy.email)?.subject).toMatch(/Your .* application/);
    expect(byTo.get(cy.email)?.html).toContain("couldn't offer you a spot");

    for (const u of [ada, bob]) {
      const reg = await getRegistration(u.id);
      expect(reg).toMatchObject({ status: "accepted", last_emailed_status: "accepted", reviewed_by: staff.id });
      expect(reg?.accepted_at).toBeTruthy();
      expect(Math.abs(new Date(reg!.rsvp_deadline as string).getTime() - (Date.now() + 7 * DAY))).toBeLessThan(60_000);
    }
    expect(await getRegistration(cy.id)).toMatchObject({ status: "rejected", last_emailed_status: "rejected", rsvp_deadline: null });
    expect(await queueCount()).toBe(0);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/applications");
    expect(revalidatePath).toHaveBeenCalledWith("/portal");
  });

  it("splits more than 100 into batches", async () => {
    const ids = await queueMany(101, "accepted");
    const resend = mockResend();
    actAs(owner);

    expect(await apps.sendDecisions()).toEqual({ ok: true, sent: 101, failed: 0, noEmail: 0, stale: 0 });
    expect(resend).toHaveBeenCalledTimes(2);
    expect(sentEmails(resend, 0)).toHaveLength(100);
    expect(sentEmails(resend, 1)).toHaveLength(1);
    const [{ count }] = await sql(`select count(*)::int as count from public.registrations where user_id = any($1) and status = 'accepted'`, [ids]);
    expect(count).toBe(101);
    expect(await queueCount()).toBe(0);
  });

  it("a failed batch stays queued and stops later batches", async () => {
    const ids = await queueMany(101, "rejected");
    const resend = mockResend(() => new Response("down", { status: 500 }));
    actAs(owner);

    const result = await apps.sendDecisions();
    expect(result).toMatchObject({ ok: false, sent: 0, failed: 100, noEmail: 0, stale: 0 });
    expect(result.error).toBeTruthy();
    expect(resend).toHaveBeenCalledTimes(1);
    const [{ count }] = await sql(`select count(*)::int as count from public.registrations where user_id = any($1) and status = 'pending'`, [ids]);
    expect(count).toBe(101);
    expect(await queueCount()).toBe(101);
  });

  it("skips applicants without an email", async () => {
    const [ada, bob] = [await pendingApplicant("Ada"), await pendingApplicant("Bob")];
    await sql(`update public.profiles set email = '' where id = $1`, [bob.id]);
    await queue(ada.id, "accepted");
    await queue(bob.id, "accepted");
    const resend = mockResend();
    actAs(owner);

    expect(await apps.sendDecisions()).toEqual({ ok: true, sent: 1, failed: 0, noEmail: 1, stale: 0 });
    expect(sentEmails(resend).map(e => e.to[0])).toEqual([ada.email]);
    expect((await getRegistration(ada.id))?.status).toBe("accepted");
    expect((await getRegistration(bob.id))?.status).toBe("pending");
    expect(await queued(bob.id)).toBe("accepted");
  });

  it("skips and clears a queued decision whose applicant is no longer pending", async () => {
    const [ada, bob] = [await pendingApplicant("Ada"), await pendingApplicant("Bob")];
    await queue(ada.id, "accepted");
    await queue(bob.id, "accepted");
    // An owner decided Bob in the SQL editor while his queued decision was waiting
    await sql(`update public.registrations set status = 'rejected' where user_id = $1`, [bob.id]);
    const resend = mockResend();
    actAs(owner);

    expect(await apps.sendDecisions()).toEqual({ ok: true, sent: 1, failed: 0, noEmail: 0, stale: 1 });
    expect(resend).toHaveBeenCalledTimes(1);
    expect(sentEmails(resend).map(e => e.to[0])).toEqual([ada.email]);
    expect((await getRegistration(bob.id))?.status).toBe("rejected");
    expect(await queued(bob.id)).toBeUndefined();
    expect((await getRegistration(ada.id))?.status).toBe("accepted");
  });

  it("without Resend configured, nothing changes", async () => {
    const a = await pendingApplicant();
    await queue(a.id, "accepted");
    const resend = mockResend();
    vi.stubEnv("RESEND_API_KEY", "");
    actAs(owner);

    expect(await apps.sendDecisions()).toEqual({ ok: false, error: "Email is not configured", sent: 0, failed: 0, noEmail: 0, stale: 0 });
    expect(resend).not.toHaveBeenCalled();
    expect((await getRegistration(a.id))?.status).toBe("pending");
    expect(await queued(a.id)).toBe("accepted");
  });

  it("nothing queued → ok with zeros, no Resend call", async () => {
    const resend = mockResend();
    actAs(owner);
    expect(await apps.sendDecisions()).toEqual({ ok: true, sent: 0, failed: 0, noEmail: 0, stale: 0 });
    expect(resend).not.toHaveBeenCalled();
  });
});
