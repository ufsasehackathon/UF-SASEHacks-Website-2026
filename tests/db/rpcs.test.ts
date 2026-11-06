import { beforeEach, describe, expect, it } from "vitest";
import { DENIED, anonClient, resetDb, serviceClient, sql } from "../helpers/db";
import {
  accept,
  createUser,
  getProfile,
  getRegistration,
  linkDiscord,
  setApplicationsClose,
  setRegistration,
  type TestUser,
} from "../helpers/users";
import { REQUIRED_CONSENTS } from "../helpers/fixtures";
import type { RegistrationStatus } from "@/lib/validation";

const HOUR = 3600_000;

describe("submit_application", () => {
  let hacker: TestUser;
  beforeEach(async () => {
    hacker = await createUser();
  });

  it("moves a complete draft to pending and stamps submitted_at", async () => {
    await setRegistration(hacker.id);
    const { error } = await hacker.client.rpc("submit_application");
    expect(error).toBeNull();
    const reg = await getRegistration(hacker.id);
    expect(reg?.status).toBe("pending");
    expect(reg?.submitted_at).toBeInstanceOf(Date);
  });

  it("doesn't need the optional consents", async () => {
    await setRegistration(hacker.id, { can_photograph: false, share_resume_with_companies: false, mlh_communications: false });
    expect((await hacker.client.rpc("submit_application")).error).toBeNull();
  });

  it.each(REQUIRED_CONSENTS)("requires %s", async consent => {
    await setRegistration(hacker.id, { [consent]: false });
    const { error } = await hacker.client.rpc("submit_application");
    expect(error?.message).toMatch(/required agreements/);
    expect((await getRegistration(hacker.id))?.status).toBe("draft");
  });

  it("treats a null consent as not given", async () => {
    await setRegistration(hacker.id, { code_of_conduct: null });
    expect((await hacker.client.rpc("submit_application")).error?.message).toMatch(/required agreements/);
  });

  it("requires a resume", async () => {
    await setRegistration(hacker.id, { resume_url: null });
    expect((await hacker.client.rpc("submit_application")).error?.message).toMatch(/resume is required/);
  });

  it("refuses after settings.applications_close", async () => {
    await setRegistration(hacker.id);
    await setApplicationsClose(new Date(Date.now() - 1000));
    try {
      expect((await hacker.client.rpc("submit_application")).error?.message).toMatch(/closed/);
      expect((await getRegistration(hacker.id))?.status).toBe("draft");
    } finally {
      await setApplicationsClose(new Date("2027-02-01T23:59:00-05:00"));
    }
  });

  it.each(["pending", "accepted", "confirmed", "declined", "waitlist", "rejected"] as const)("refuses when already %s", async status => {
    await setRegistration(hacker.id, { status, submitted_at: "2026-10-01T00:00:00Z" });
    expect((await hacker.client.rpc("submit_application")).error?.message).toMatch(/already submitted/);
    expect((await getRegistration(hacker.id))?.status).toBe(status);
  });

  it("refuses without a registration", async () => {
    expect((await hacker.client.rpc("submit_application")).error?.message).toMatch(/No application/);
  });

  it("can't be called by anon", async () => {
    expect((await anonClient().rpc("submit_application")).error).not.toBeNull();
  });

  it("only submits the caller's own application", async () => {
    const other = await createUser();
    await setRegistration(other.id);
    await setRegistration(hacker.id);
    await hacker.client.rpc("submit_application");
    expect((await getRegistration(other.id))?.status).toBe("draft");
  });
});

describe("rsvp", () => {
  let hacker: TestUser;
  beforeEach(async () => {
    hacker = await createUser();
  });

  it("confirms an accepted hacker with Discord linked", async () => {
    await accept(hacker.id);
    await linkDiscord(hacker.id);
    const { data, error } = await hacker.client.rpc("rsvp", { p_attending: true });
    expect(error).toBeNull();
    expect(data).toBe("confirmed");
    const reg = await getRegistration(hacker.id);
    expect(reg?.status).toBe("confirmed");
    expect(reg?.rsvp_at).toBeInstanceOf(Date);
  });

  it("won't confirm without Discord", async () => {
    await accept(hacker.id);
    const { error } = await hacker.client.rpc("rsvp", { p_attending: true });
    expect(error?.message).toMatch(/Discord/);
    expect((await getRegistration(hacker.id))?.status).toBe("accepted");
  });

  it("doesn't count a non-Discord identity", async () => {
    await accept(hacker.id);
    // createUser already gave them an email identity
    expect((await hacker.client.rpc("rsvp", { p_attending: true })).error?.message).toMatch(/Discord/);
  });

  it("lets an accepted hacker decline without Discord", async () => {
    await accept(hacker.id);
    const { data, error } = await hacker.client.rpc("rsvp", { p_attending: false });
    expect(error).toBeNull();
    expect(data).toBe("declined");
  });

  it.each([true, false])("refuses after the RSVP deadline (attending=%s)", async attending => {
    await accept(hacker.id, new Date(Date.now() - HOUR));
    await linkDiscord(hacker.id);
    expect((await hacker.client.rpc("rsvp", { p_attending: attending })).error?.message).toMatch(/deadline has passed/);
    expect((await getRegistration(hacker.id))?.status).toBe("accepted");
  });

  it("allows RSVP when no deadline is set", async () => {
    await accept(hacker.id, null);
    await linkDiscord(hacker.id);
    expect((await hacker.client.rpc("rsvp", { p_attending: true })).data).toBe("confirmed");
  });

  it("lets a confirmed hacker drop out", async () => {
    await setRegistration(hacker.id, { status: "confirmed", rsvp_deadline: new Date(Date.now() - HOUR).toISOString() });
    const { data } = await hacker.client.rpc("rsvp", { p_attending: false });
    expect(data).toBe("declined");
  });

  it("confirming twice is an error, not a no-op", async () => {
    await setRegistration(hacker.id, { status: "confirmed" });
    expect((await hacker.client.rpc("rsvp", { p_attending: true })).error?.message).toMatch(/Nothing to RSVP/);
  });

  it.each(["draft", "pending", "declined", "waitlist", "rejected"] as RegistrationStatus[])("refuses from %s", async status => {
    await setRegistration(hacker.id, { status });
    await linkDiscord(hacker.id);
    for (const attending of [true, false]) {
      expect((await hacker.client.rpc("rsvp", { p_attending: attending })).error?.message).toMatch(/Nothing to RSVP/);
    }
    expect((await getRegistration(hacker.id))?.status).toBe(status);
  });

  it("refuses without a registration", async () => {
    expect((await hacker.client.rpc("rsvp", { p_attending: true })).error?.message).toMatch(/No application/);
  });

  it("can't be called by anon", async () => {
    expect((await anonClient().rpc("rsvp", { p_attending: true })).error).not.toBeNull();
  });
});

describe("sync_discord_profile", () => {
  it("returns null and changes nothing without a Discord identity", async () => {
    const hacker = await createUser();
    const { data, error } = await hacker.client.rpc("sync_discord_profile");
    expect(error).toBeNull();
    expect(data).toBeNull();
    expect((await getProfile(hacker.id))?.discord_id).toBeNull();
  });

  it("copies the linked Discord account onto the profile", async () => {
    const hacker = await createUser();
    const { discordId } = await linkDiscord(hacker.id, "gator_dev");
    const { data } = await hacker.client.rpc("sync_discord_profile");
    expect(data).toBe("gator_dev");
    expect(await getProfile(hacker.id)).toMatchObject({ discord_id: discordId, discord_username: "gator_dev" });
  });

  it("works even when the registration is locked", async () => {
    const hacker = await createUser();
    await setRegistration(hacker.id, { editing_locked: true });
    await linkDiscord(hacker.id, "locked_user");
    const { error } = await hacker.client.rpc("sync_discord_profile");
    expect(error).toBeNull();
    expect((await getProfile(hacker.id))?.discord_username).toBe("locked_user");
  });

  it("is idempotent", async () => {
    const hacker = await createUser();
    await linkDiscord(hacker.id, "again");
    await hacker.client.rpc("sync_discord_profile");
    const { data, error } = await hacker.client.rpc("sync_discord_profile");
    expect(error).toBeNull();
    expect(data).toBe("again");
  });
});

describe("mark_own_status_emailed", () => {
  it("records the status when it matches the current one", async () => {
    const hacker = await createUser();
    await setRegistration(hacker.id, { status: "pending" });
    expect((await hacker.client.rpc("mark_own_status_emailed", { p_status: "pending" })).error).toBeNull();
    expect((await getRegistration(hacker.id))?.last_emailed_status).toBe("pending");
  });

  it("ignores a status that doesn't match", async () => {
    const hacker = await createUser();
    await setRegistration(hacker.id, { status: "pending" });
    await hacker.client.rpc("mark_own_status_emailed", { p_status: "accepted" });
    expect((await getRegistration(hacker.id))?.last_emailed_status).toBeNull();
  });

  it("only touches the caller's row", async () => {
    const hacker = await createUser();
    const other = await createUser();
    await setRegistration(hacker.id, { status: "pending" });
    await setRegistration(other.id, { status: "pending" });
    await hacker.client.rpc("mark_own_status_emailed", { p_status: "pending" });
    expect((await getRegistration(other.id))?.last_emailed_status).toBeNull();
  });
});

describe("keep_alive", () => {
  it("returns the mailing list size to anon without exposing emails", async () => {
    await resetDb();
    await sql(`insert into public.mailing_list (email) values ('a@example.com'), ('b@example.com')`);
    const { data, error } = await anonClient().rpc("keep_alive");
    expect(error).toBeNull();
    expect(Number(data)).toBe(2);
  });
});

describe("role helpers", () => {
  it("report each role", async () => {
    const users = {
      hacker: await createUser(),
      judge: await createUser({ role: "judge" }),
      staff: await createUser({ role: "staff" }),
      owner: await createUser({ role: "owner" }),
    };
    const svc = serviceClient();
    const expected = {
      hacker: { user_role: "hacker", is_owner: false, is_staff: false, is_judge: false, is_admin: false },
      judge: { user_role: "judge", is_owner: false, is_staff: false, is_judge: true, is_admin: false },
      staff: { user_role: "staff", is_owner: false, is_staff: true, is_judge: false, is_admin: false },
      owner: { user_role: "owner", is_owner: true, is_staff: true, is_judge: false, is_admin: true },
    };
    for (const [role, user] of Object.entries(users)) {
      for (const fn of ["user_role", "is_owner", "is_staff", "is_judge", "is_admin"] as const) {
        const { data } = await svc.rpc(fn, { p_uid: user.id });
        expect(data, `${fn}(${role})`).toBe(expected[role as keyof typeof expected][fn]);
      }
    }
  });

  it("treats an unknown user as a hacker", async () => {
    const { data } = await serviceClient().rpc("user_role", { p_uid: "00000000-0000-0000-0000-000000000000" });
    expect(data).toBe("hacker");
  });
});

describe("set_user_role", () => {
  let owner: TestUser, target: TestUser;
  beforeEach(async () => {
    await resetDb();
    owner = await createUser({ role: "owner" });
    target = await createUser();
  });

  const roleOf = async (id: string) => (await serviceClient().rpc("user_role", { p_uid: id })).data;

  it.each(["hacker", "judge", "staff"] as const)("is refused for a %s", async role => {
    const caller = await createUser({ role });
    const { error } = await caller.client.rpc("set_user_role", { p_user_id: target.id, p_role: "owner" });
    expect(error?.code).toBe(DENIED);
    expect(await roleOf(target.id)).toBe("hacker");
  });

  it("a staff member can't promote themselves", async () => {
    const staff = await createUser({ role: "staff" });
    expect((await staff.client.rpc("set_user_role", { p_user_id: staff.id, p_role: "owner" })).error?.code).toBe(DENIED);
  });

  it.each(["judge", "staff", "owner"] as const)("lets an owner make someone %s", async role => {
    expect((await owner.client.rpc("set_user_role", { p_user_id: target.id, p_role: role })).error).toBeNull();
    expect(await roleOf(target.id)).toBe(role);
  });

  it("replaces an existing role (one role per user)", async () => {
    await owner.client.rpc("set_user_role", { p_user_id: target.id, p_role: "judge" });
    await owner.client.rpc("set_user_role", { p_user_id: target.id, p_role: "staff" });
    expect(await sql(`select role from public.user_roles where user_id = $1`, [target.id])).toEqual([{ role: "staff" }]);
  });

  it("'hacker' removes the role", async () => {
    await owner.client.rpc("set_user_role", { p_user_id: target.id, p_role: "staff" });
    await owner.client.rpc("set_user_role", { p_user_id: target.id, p_role: "hacker" });
    expect(await sql(`select 1 from public.user_roles where user_id = $1`, [target.id])).toEqual([]);
  });

  it("rejects an unknown role", async () => {
    expect((await owner.client.rpc("set_user_role", { p_user_id: target.id, p_role: "admin" })).error?.message).toMatch(/Unknown role/);
  });

  it("rejects a user without a profile", async () => {
    const ghost = await createUser({ profile: false });
    expect((await owner.client.rpc("set_user_role", { p_user_id: ghost.id, p_role: "staff" })).error?.message).toMatch(/not found/);
  });

  it("won't remove the last owner", async () => {
    for (const role of ["staff", "judge", "hacker"]) {
      const { error } = await owner.client.rpc("set_user_role", { p_user_id: owner.id, p_role: role });
      expect(error?.message).toMatch(/last owner/);
    }
    expect(await roleOf(owner.id)).toBe("owner");
  });

  it("can demote an owner when another owner remains", async () => {
    const second = await createUser({ role: "owner" });
    expect((await owner.client.rpc("set_user_role", { p_user_id: second.id, p_role: "staff" })).error).toBeNull();
    expect(await roleOf(second.id)).toBe("staff");
  });

  it("re-setting the last owner to owner is fine", async () => {
    expect((await owner.client.rpc("set_user_role", { p_user_id: owner.id, p_role: "owner" })).error).toBeNull();
  });
});

describe("staff check-in", () => {
  let staff: TestUser, hacker: TestUser;
  beforeEach(async () => {
    staff = await createUser({ role: "staff" });
    hacker = await createUser();
  });

  const checkIns = (id: string) =>
    sql(`select a.checked_in_by from public.attendance a join public.events e on e.id = a.event_id
         where a.user_id = $1 and e.event_name = 'Check-in'`, [id]);

  it("checks in a confirmed hacker, once", async () => {
    await setRegistration(hacker.id, { status: "confirmed" });
    expect((await staff.client.rpc("staff_check_in", { p_user_id: hacker.id })).error).toBeNull();
    expect((await staff.client.rpc("staff_check_in", { p_user_id: hacker.id })).error).toBeNull();
    expect(await checkIns(hacker.id)).toEqual([{ checked_in_by: staff.id }]);
  });

  it.each(["draft", "pending", "accepted", "declined", "waitlist", "rejected"] as RegistrationStatus[])("refuses a %s hacker", async status => {
    await setRegistration(hacker.id, { status });
    expect((await staff.client.rpc("staff_check_in", { p_user_id: hacker.id })).error?.message).toMatch(/not confirmed/);
    expect(await checkIns(hacker.id)).toEqual([]);
  });

  it("refuses someone without a registration", async () => {
    expect((await staff.client.rpc("staff_check_in", { p_user_id: hacker.id })).error?.message).toMatch(/not confirmed/);
  });

  it("lets an owner check people in", async () => {
    const owner = await createUser({ role: "owner" });
    await setRegistration(hacker.id, { status: "confirmed" });
    expect((await owner.client.rpc("staff_check_in", { p_user_id: hacker.id })).error).toBeNull();
  });

  it.each(["hacker", "judge"] as const)("is refused for a %s (including checking themselves in)", async role => {
    const caller = role === "hacker" ? hacker : await createUser({ role });
    await setRegistration(caller.id, { status: "confirmed" });
    expect((await caller.client.rpc("staff_check_in", { p_user_id: caller.id })).error?.code).toBe(DENIED);
    expect((await caller.client.rpc("staff_undo_check_in", { p_user_id: caller.id })).error?.code).toBe(DENIED);
  });

  it("undo removes the check-in", async () => {
    await setRegistration(hacker.id, { status: "confirmed" });
    await staff.client.rpc("staff_check_in", { p_user_id: hacker.id });
    expect((await staff.client.rpc("staff_undo_check_in", { p_user_id: hacker.id })).error).toBeNull();
    expect(await checkIns(hacker.id)).toEqual([]);
  });

  it("undo only touches the main Check-in event", async () => {
    await setRegistration(hacker.id, { status: "confirmed" });
    const [{ id: workshop }] = await sql<{ id: string }>(`insert into public.events (event_name) values ('Workshop A') returning id`);
    await sql(`insert into public.attendance (user_id, event_id) values ($1, $2)`, [hacker.id, workshop]);
    await staff.client.rpc("staff_undo_check_in", { p_user_id: hacker.id });
    expect(await sql(`select 1 from public.attendance where user_id = $1 and event_id = $2`, [hacker.id, workshop])).toHaveLength(1);
  });
});

describe("self_check_in", () => {
  let hacker: TestUser;
  let code: string;

  beforeEach(async () => {
    hacker = await createUser();
    code = `code-${Math.random().toString(36).slice(2)}`;
    await sql(`insert into public.events (event_name, self_checkin_open, checkin_code) values ($1, true, $2)`, [`Workshop ${code}`, code]);
  });

  const attended = (id: string) =>
    sql(`select a.checked_in_by from public.attendance a join public.events e on e.id = a.event_id where a.user_id = $1 and e.checkin_code = $2`, [id, code]);

  it("checks a confirmed hacker in and returns the event name, once", async () => {
    await setRegistration(hacker.id, { status: "confirmed" });
    const { data, error } = await hacker.client.rpc("self_check_in", { p_code: code });
    expect(error).toBeNull();
    expect(data).toBe(`Workshop ${code}`);
    await hacker.client.rpc("self_check_in", { p_code: code });
    expect(await attended(hacker.id)).toEqual([{ checked_in_by: hacker.id }]);
  });

  it("rejects a wrong code", async () => {
    await setRegistration(hacker.id, { status: "confirmed" });
    expect((await hacker.client.rpc("self_check_in", { p_code: "nope" })).error?.message).toMatch(/Invalid or closed/);
  });

  it("rejects a closed event", async () => {
    await setRegistration(hacker.id, { status: "confirmed" });
    await sql(`update public.events set self_checkin_open = false where checkin_code = $1`, [code]);
    expect((await hacker.client.rpc("self_check_in", { p_code: code })).error?.message).toMatch(/Invalid or closed/);
  });

  it("rejects the main Check-in event while self check-in is closed", async () => {
    await setRegistration(hacker.id, { status: "confirmed" });
    const [{ checkin_code }] = await sql<{ checkin_code: string }>(`select checkin_code from public.events where event_name = 'Check-in'`);
    expect((await hacker.client.rpc("self_check_in", { p_code: checkin_code })).error?.message).toMatch(/Invalid or closed/);
  });

  it.each(["draft", "pending", "accepted", "declined"] as RegistrationStatus[])("rejects a %s hacker", async status => {
    await setRegistration(hacker.id, { status });
    expect((await hacker.client.rpc("self_check_in", { p_code: code })).error?.message).toMatch(/not confirmed/);
    expect(await attended(hacker.id)).toEqual([]);
  });

  it("can't be called by anon", async () => {
    expect((await anonClient().rpc("self_check_in", { p_code: code })).error).not.toBeNull();
  });
});
