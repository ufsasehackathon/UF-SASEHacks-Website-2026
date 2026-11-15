import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, revalidatePath } from "../helpers/next";
import { sql } from "../helpers/db";
import { createUser, getRegistration, linkDiscord, setRegistration, type TestUser } from "../helpers/users";

vi.mock("@/lib/supabase/server", async () => (await import("../helpers/next")).nextMocks.server);
vi.mock("next/cache", async () => (await import("../helpers/next")).nextMocks.cache);
vi.mock("next/navigation", async () => (await import("../helpers/next")).nextMocks.navigation);

const checkin = await import("@/app/staff/checkin/actions");

let staff: TestUser;

beforeEach(async () => {
  revalidatePath.mockClear();
  staff = await createUser({ role: "staff" });
});

afterEach(() => {
  actAs(null);
  vi.restoreAllMocks();
});

/** A short random tag so searches only match this test's people */
const tag = () => randomUUID().replace(/-/g, "").slice(0, 8);

/** Link Discord and copy it onto the profile (what a portal visit does) */
async function withDiscord(user: TestUser, username: string) {
  await linkDiscord(user.id, username);
  const { error } = await user.client.rpc("sync_discord_profile");
  expect(error).toBeNull();
}

async function checkedIn(userId: string) {
  const rows = await sql(
    `select a.created_at from public.attendance a join public.events e on e.id = a.event_id
     where a.user_id = $1 and e.event_name = 'Check-in'`,
    [userId]
  );
  return rows.length > 0;
}

describe("searchPeople", () => {
  it("finds by first name, email and Discord username", async () => {
    const t = tag();
    const hacker = await createUser({ firstName: `Zelda${t}` });
    await setRegistration(hacker.id, { status: "confirmed" });
    await withDiscord(hacker, `gator${t}`);
    actAs(staff);
    expect(await checkin.checkIn(hacker.id)).toEqual({ ok: true });

    const other = await createUser({ firstName: `Other${t}` });

    for (const query of [`zelda${t}`, hacker.email, `gator${t}`]) {
      const res = await checkin.searchPeople(query);
      expect(res.ok).toBe(true);
      expect(res.people.map(p => p.userId)).toEqual([hacker.id]);
      const [p] = res.people;
      expect(p.status).toBe("confirmed");
      expect(p.hasDiscord).toBe(true);
      expect(p.discordUsername).toBe(`gator${t}`);
      expect(p.hasConsents).toBe(true);
      expect(p.email).toBe(hacker.email);
      expect(p.name).toContain(`Zelda${t}`);
      expect(p.checkedInAt).toBeTruthy();
      expect(p.waitlistedAt).toBeNull();
    }

    // someone with no registration, Discord or check-in
    const res = await checkin.searchPeople(`other${t}`);
    expect(res.people).toEqual([
      expect.objectContaining({ userId: other.id, status: null, hasDiscord: false, hasConsents: false, checkedInAt: null }),
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/checkin");
  });

  it('doesn\'t error on "O\'Brien, (x)"', async () => {
    actAs(staff);
    expect(await checkin.searchPeople("O'Brien, (x)")).toEqual({ ok: true, people: [] });
    expect(await checkin.searchPeople("x")).toEqual({ ok: true, people: [] });

    // the apostrophe survives, and "first last" matches first_name + last_name
    const t = tag();
    const obrien = await createUser({ firstName: "O'Brien" });
    await sql(`update public.profiles set last_name = $2 where id = $1`, [obrien.id, `Last${t}`]);
    const res = await checkin.searchPeople(`O'Brien, (last${t})`);
    expect(res).toEqual({ ok: true, people: [expect.objectContaining({ userId: obrien.id })] });
  });

  it('hackers get "Not allowed"', async () => {
    actAs(await createUser());
    expect(await checkin.searchPeople("Test")).toEqual({ ok: false, error: "Not allowed", people: [] });
  });
});

describe("checkIn", () => {
  it("confirmed hacker checks in; undo removes it", async () => {
    const hacker = await createUser();
    await setRegistration(hacker.id, { status: "confirmed" });
    actAs(staff);

    expect(await checkin.checkIn(hacker.id)).toEqual({ ok: true });
    expect(await checkedIn(hacker.id)).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/checkin");

    expect(await checkin.undoCheckIn(hacker.id)).toEqual({ ok: true });
    expect(await checkedIn(hacker.id)).toBe(false);
  });

  it("passes the RPC error through for someone not confirmed; hackers get \"Not allowed\"", async () => {
    const hacker = await createUser();
    await setRegistration(hacker.id, { status: "pending" });
    actAs(staff);
    expect(await checkin.checkIn(hacker.id)).toEqual({ ok: false, error: "This hacker is not confirmed" });

    actAs(hacker);
    expect(await checkin.checkIn(hacker.id)).toEqual({ ok: false, error: "Not allowed" });
    expect(await checkedIn(hacker.id)).toBe(false);
  });
});

describe("addToWaitlist", () => {
  it('passes "Link Discord first" through', async () => {
    const hacker = await createUser();
    await setRegistration(hacker.id, { status: "pending" });
    actAs(staff);
    expect(await checkin.addToWaitlist(hacker.id)).toEqual({ ok: false, error: "Link Discord first" });
    expect((await getRegistration(hacker.id))?.status).toBe("pending");
  });
});

describe("admitFromWaitlist", () => {
  it("confirms and checks in", async () => {
    const hacker = await createUser();
    await setRegistration(hacker.id, { status: "pending" });
    await linkDiscord(hacker.id);
    actAs(staff);
    expect(await checkin.addToWaitlist(hacker.id)).toEqual({ ok: true });
    expect((await getRegistration(hacker.id))?.status).toBe("waitlist");

    expect(await checkin.admitFromWaitlist(hacker.id)).toEqual({ ok: true });
    expect((await getRegistration(hacker.id))?.status).toBe("confirmed");
    expect(await checkedIn(hacker.id)).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/checkin");
  });
});

describe("setCapacity", () => {
  async function capacity() {
    const [row] = await sql(`select capacity from public.settings`);
    return row.capacity as number | null;
  }

  afterEach(async () => {
    await sql(`update public.settings set capacity = null`);
  });

  it('owner sets 200; staff get "Not allowed"; 0 is rejected', async () => {
    actAs(await createUser({ role: "owner" }));
    expect(await checkin.setCapacity(200)).toEqual({ ok: true });
    expect(await capacity()).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/checkin");

    for (const bad of [0, -5, 1.5, Number.NaN]) {
      expect(await checkin.setCapacity(bad)).toEqual({ ok: false, error: "Capacity must be a positive whole number" });
    }
    expect(await capacity()).toBe(200);

    expect(await checkin.setCapacity(null)).toEqual({ ok: true });
    expect(await capacity()).toBeNull();

    actAs(staff);
    expect(await checkin.setCapacity(150)).toEqual({ ok: false, error: "Not allowed" });
    expect(await capacity()).toBeNull();
  });
});

describe("getCheckinSummary", () => {
  beforeEach(async () => {
    // other tests in this file leave check-ins and waitlist rows behind
    await sql(`delete from public.attendance`);
    await sql(`update public.registrations set status = 'declined' where status = 'waitlist'`);
  });

  it("counts check-ins and orders the waitlist by time added", async () => {
    const [a, b] = [await createUser(), await createUser()];
    for (const u of [a, b]) await setRegistration(u.id, { status: "confirmed" });

    const [first, second] = [await createUser({ firstName: "First" }), await createUser({ firstName: "Second" })];
    // created in the opposite order to the time they were added
    await setRegistration(second.id, { status: "waitlist", waitlisted_at: new Date(Date.now() - 60_000).toISOString() });
    await setRegistration(first.id, { status: "waitlist", waitlisted_at: new Date(Date.now() - 120_000).toISOString() });
    await sql(`update public.settings set capacity = 300`);

    actAs(staff);
    for (const u of [a, b]) expect(await checkin.checkIn(u.id)).toEqual({ ok: true });

    const summary = await checkin.getCheckinSummary();
    expect(summary.checkedIn).toBe(2);
    expect(summary.capacity).toBe(300);
    expect(summary.waitlist.map(p => p.userId)).toEqual([first.id, second.id]);
    expect(summary.waitlist[0]).toEqual(
      expect.objectContaining({ name: expect.stringContaining("First"), status: "waitlist", hasConsents: true, checkedInAt: null })
    );
    expect(summary.waitlist[0].waitlistedAt).toBeTruthy();

    await sql(`update public.settings set capacity = null`);
  });

  it("hackers get an empty summary", async () => {
    actAs(await createUser());
    expect(await checkin.getCheckinSummary()).toEqual({ checkedIn: 0, capacity: null, waitlist: [] });
  });
});
