import { beforeEach, describe, expect, it } from "vitest";
import { DENIED, resetDb, sql } from "../helpers/db";
import { accept, createUser, getRegistration, linkDiscord, setRegistration, type TestUser } from "../helpers/users";
import { REQUIRED_CONSENTS } from "../helpers/fixtures";
import type { RegistrationStatus } from "@/lib/validation";

// Event-day check-in: the on-site waitlist RPCs (staff add people who show up without a
// confirmed spot, then admit or remove them) and the event capacity setting.

let hacker: TestUser, staff: TestUser, owner: TestUser;

beforeEach(async () => {
  await resetDb();
  [hacker, staff, owner] = await Promise.all([
    createUser(),
    createUser({ role: "staff" }),
    createUser({ role: "owner" }),
  ]);
});

const checkIns = (id: string) =>
  sql(`select a.checked_in_by from public.attendance a join public.events e on e.id = a.event_id
       where a.user_id = $1 and e.event_name = 'Check-in'`, [id]);

const queuedDecision = (id: string) => sql(`select 1 from public.pending_decisions where user_id = $1`, [id]);

const addToWaitlist = (caller: TestUser, userId: string) =>
  caller.client.rpc("add_to_waitlist", { p_user_id: userId });

describe("add_to_waitlist", () => {
  it("waitlists an accepted no-RSVP with Discord and consents", async () => {
    await accept(hacker.id);
    await linkDiscord(hacker.id);
    const { error } = await addToWaitlist(staff, hacker.id);
    expect(error).toBeNull();
    const reg = await getRegistration(hacker.id);
    expect(reg?.status).toBe("waitlist");
    expect(reg?.waitlisted_at).toBeInstanceOf(Date);
  });

  it("works for a walk-in draft with consents", async () => {
    await setRegistration(hacker.id, { status: "draft" });
    await linkDiscord(hacker.id);
    const { error } = await addToWaitlist(staff, hacker.id);
    expect(error).toBeNull();
    const reg = await getRegistration(hacker.id);
    expect(reg?.status).toBe("waitlist");
    expect(reg?.waitlisted_at).toBeInstanceOf(Date);
  });

  it.each(["pending", "declined", "rejected"] as RegistrationStatus[])("works for %s", async status => {
    await setRegistration(hacker.id, { status, submitted_at: new Date().toISOString() });
    await linkDiscord(hacker.id);
    const { error } = await addToWaitlist(staff, hacker.id);
    expect(error).toBeNull();
    expect((await getRegistration(hacker.id))?.status).toBe("waitlist");
  });

  it("drops an unsent decision", async () => {
    await setRegistration(hacker.id, { status: "pending", submitted_at: new Date().toISOString() });
    await linkDiscord(hacker.id);
    const queued = await staff.client.rpc("set_decisions", { p_user_ids: [hacker.id], p_decision: "accepted" });
    expect(queued.data).toBe(1);
    expect(await queuedDecision(hacker.id)).toHaveLength(1);

    const { error } = await addToWaitlist(staff, hacker.id);
    expect(error).toBeNull();
    expect(await queuedDecision(hacker.id)).toEqual([]);
    expect((await getRegistration(hacker.id))?.status).toBe("waitlist");
  });

  it("refuses without Discord", async () => {
    await accept(hacker.id);
    const { error } = await addToWaitlist(staff, hacker.id);
    expect(error?.message).toMatch(/Link Discord first/);
    expect((await getRegistration(hacker.id))?.status).toBe("accepted");
  });

  it.each(REQUIRED_CONSENTS)("refuses without consents (%s)", async consent => {
    await setRegistration(hacker.id, { status: "accepted", [consent]: false });
    await linkDiscord(hacker.id);
    const { error } = await addToWaitlist(staff, hacker.id);
    expect(error?.message).toMatch(/Agreements not accepted/);
    expect((await getRegistration(hacker.id))?.status).toBe("accepted");
  });

  it("refuses with no registration", async () => {
    await linkDiscord(hacker.id);
    const { error } = await addToWaitlist(staff, hacker.id);
    expect(error?.message).toMatch(/No application or walk-in agreements found/);
    expect(await getRegistration(hacker.id)).toBeUndefined();
  });

  it("refuses confirmed", async () => {
    await setRegistration(hacker.id, { status: "confirmed" });
    await linkDiscord(hacker.id);
    const { error } = await addToWaitlist(staff, hacker.id);
    expect(error?.message).toMatch(/Already confirmed/);
    expect((await getRegistration(hacker.id))?.status).toBe("confirmed");
  });

  it("refuses already waitlisted", async () => {
    await accept(hacker.id);
    await linkDiscord(hacker.id);
    await addToWaitlist(staff, hacker.id);
    const first = (await getRegistration(hacker.id))?.waitlisted_at as Date;

    const { error } = await addToWaitlist(staff, hacker.id);
    expect(error?.message).toMatch(/Already on the waitlist/);
    // keeps their place in line
    expect(((await getRegistration(hacker.id))?.waitlisted_at as Date).toISOString()).toBe(first.toISOString());
  });

  it("hackers get 42501", async () => {
    await accept(hacker.id);
    await linkDiscord(hacker.id);
    const { error } = await addToWaitlist(hacker, hacker.id);
    expect(error?.code).toBe(DENIED);
    const reg = await getRegistration(hacker.id);
    expect(reg?.status).toBe("accepted");
    expect(reg?.waitlisted_at).toBeNull();
  });
});

describe("admit_from_waitlist", () => {
  it("confirms and checks in in one call", async () => {
    await accept(hacker.id);
    await linkDiscord(hacker.id);
    expect((await addToWaitlist(staff, hacker.id)).error).toBeNull();

    const { error } = await staff.client.rpc("admit_from_waitlist", { p_user_id: hacker.id });
    expect(error).toBeNull();
    expect((await getRegistration(hacker.id))?.status).toBe("confirmed");
    expect(await checkIns(hacker.id)).toEqual([{ checked_in_by: staff.id }]);
  });

  it("refuses someone not waitlisted", async () => {
    await accept(hacker.id);
    await linkDiscord(hacker.id);
    const { error } = await staff.client.rpc("admit_from_waitlist", { p_user_id: hacker.id });
    expect(error?.message).toMatch(/Not on the waitlist/);
    expect((await getRegistration(hacker.id))?.status).toBe("accepted");
    expect(await checkIns(hacker.id)).toEqual([]);
  });
});

describe("remove_from_waitlist", () => {
  it("sets declined and clears waitlisted_at", async () => {
    await accept(hacker.id);
    await linkDiscord(hacker.id);
    expect((await addToWaitlist(staff, hacker.id)).error).toBeNull();

    const { error } = await staff.client.rpc("remove_from_waitlist", { p_user_id: hacker.id });
    expect(error).toBeNull();
    const reg = await getRegistration(hacker.id);
    expect(reg?.status).toBe("declined");
    expect(reg?.waitlisted_at).toBeNull();
    expect(await checkIns(hacker.id)).toEqual([]);
  });
});

describe("guards", () => {
  it("a hacker can't set waitlisted_at", async () => {
    await setRegistration(hacker.id, { status: "draft" });
    const { error } = await hacker.client
      .from("registrations")
      .update({ waitlisted_at: new Date().toISOString() })
      .eq("user_id", hacker.id);
    expect(error?.code).toBe(DENIED);
    expect((await getRegistration(hacker.id))?.waitlisted_at).toBeNull();
  });
});

describe("settings", () => {
  const capacity = async () => (await sql<{ capacity: number | null }>(`select capacity from public.settings`))[0].capacity;

  it("owner can set capacity; staff can't; capacity must be > 0", async () => {
    expect(await capacity()).toBeNull();

    const asStaff = await staff.client.from("settings").update({ capacity: 150 }).eq("id", true).select();
    expect(asStaff.data ?? []).toEqual([]);
    expect(await capacity()).toBeNull();

    const asOwner = await owner.client.from("settings").update({ capacity: 200 }).eq("id", true);
    expect(asOwner.error).toBeNull();
    expect(await capacity()).toBe(200);

    const zero = await owner.client.from("settings").update({ capacity: 0 }).eq("id", true);
    expect(zero.error?.code).toBe("23514"); // check_violation
    expect(await capacity()).toBe(200);
  });
});
