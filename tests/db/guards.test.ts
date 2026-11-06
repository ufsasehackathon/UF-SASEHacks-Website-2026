import { beforeEach, describe, expect, it } from "vitest";
import { DENIED } from "../helpers/db";
import { createUser, getProfile, getRegistration, setRegistration, type TestUser } from "../helpers/users";

// Guard triggers in schema.sql: non-owners with a JWT can't touch admin-controlled columns.

const ADMIN_COLUMNS: [string, unknown][] = [
  ["status", "confirmed"],
  ["editing_locked", true],
  ["notes", "looks great"],
  ["review_score", 5],
  ["submitted_at", "2026-01-01T00:00:00Z"],
  ["accepted_at", "2026-01-01T00:00:00Z"],
  ["rsvp_deadline", "2030-01-01T00:00:00Z"],
  ["rsvp_at", "2026-01-01T00:00:00Z"],
  ["last_emailed_status", "accepted"],
];

describe("registration guard (hacker)", () => {
  let hacker: TestUser;

  beforeEach(async () => {
    hacker = await createUser();
    await setRegistration(hacker.id, { status: "draft" });
  });

  it.each(ADMIN_COLUMNS)("can't change %s", async (column, value) => {
    const before = await getRegistration(hacker.id);
    const { error } = await hacker.client.from("registrations").update({ [column]: value }).eq("user_id", hacker.id);
    expect(error?.code).toBe(DENIED);
    expect(await getRegistration(hacker.id)).toEqual(before);
  });

  it("can't set reviewed_by", async () => {
    const { error } = await hacker.client.from("registrations").update({ reviewed_by: hacker.id }).eq("user_id", hacker.id);
    expect(error?.code).toBe(DENIED);
  });

  it("can't move the registration to another user", async () => {
    const other = await createUser();
    const { error } = await hacker.client.from("registrations").update({ user_id: other.id }).eq("user_id", hacker.id);
    expect(error?.code).toBe(DENIED);
    expect(await getRegistration(hacker.id)).toBeDefined();
  });

  it("can change consents and answers while in draft", async () => {
    const { error } = await hacker.client
      .from("registrations")
      .update({ can_photograph: false, responses: { build_or_learn: "a robot" } })
      .eq("user_id", hacker.id);
    expect(error).toBeNull();
    const reg = await getRegistration(hacker.id);
    expect(reg?.can_photograph).toBe(false);
    expect(reg?.responses).toEqual({ build_or_learn: "a robot" });
  });

  it.each(["pending", "accepted", "confirmed", "waitlist"] as const)("can't change answers once %s", async status => {
    await setRegistration(hacker.id, { status, responses: { build_or_learn: "original" } });
    const { error } = await hacker.client
      .from("registrations")
      .update({ responses: { build_or_learn: "edited" } })
      .eq("user_id", hacker.id);
    expect(error?.code).toBe(DENIED);
    expect((await getRegistration(hacker.id))?.responses).toEqual({ build_or_learn: "original" });
  });

  it("can still update non-guarded fields after submitting (consents) unless locked", async () => {
    await setRegistration(hacker.id, { status: "pending", can_photograph: true });
    const { error } = await hacker.client.from("registrations").update({ can_photograph: false }).eq("user_id", hacker.id);
    expect(error).toBeNull();
    expect((await getRegistration(hacker.id))?.can_photograph).toBe(false);
  });

  it("can't update a locked registration (RLS: no rows match)", async () => {
    await setRegistration(hacker.id, { editing_locked: true, can_photograph: true });
    await hacker.client.from("registrations").update({ can_photograph: false }).eq("user_id", hacker.id);
    expect((await getRegistration(hacker.id))?.can_photograph).toBe(true);
  });

  it("updated_at is touched on update", async () => {
    const before = (await getRegistration(hacker.id))?.updated_at as Date;
    await new Promise(r => setTimeout(r, 20));
    await hacker.client.from("registrations").update({ can_photograph: false }).eq("user_id", hacker.id);
    const after = (await getRegistration(hacker.id))?.updated_at as Date;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });
});

describe("registration insert guard", () => {
  it("forces a hacker's new registration to an unlocked draft with admin fields cleared", async () => {
    const hacker = await createUser();
    const { error } = await hacker.client.from("registrations").insert({
      user_id: hacker.id,
      status: "confirmed",
      editing_locked: true,
      notes: "self-accepted",
      submitted_at: "2026-01-01T00:00:00Z",
      accepted_at: "2026-01-01T00:00:00Z",
      rsvp_deadline: "2030-01-01T00:00:00Z",
      rsvp_at: "2026-01-01T00:00:00Z",
      review_score: 5,
      last_emailed_status: "confirmed",
    });
    expect(error).toBeNull();
    expect(await getRegistration(hacker.id)).toMatchObject({
      status: "draft",
      editing_locked: false,
      notes: null,
      submitted_at: null,
      accepted_at: null,
      rsvp_deadline: null,
      rsvp_at: null,
      review_score: null,
      reviewed_by: null,
      last_emailed_status: null,
    });
  });

  it("doesn't let a hacker create a registration for someone else", async () => {
    const hacker = await createUser();
    const other = await createUser();
    const { error } = await hacker.client.from("registrations").insert({ user_id: other.id });
    expect(error?.code).toBe(DENIED);
    expect(await getRegistration(other.id)).toBeUndefined();
  });

  it("lets an owner insert a registration with any status", async () => {
    const owner = await createUser({ role: "owner" });
    const hacker = await createUser();
    const { error } = await owner.client.from("registrations").insert({ user_id: hacker.id, status: "accepted" });
    expect(error).toBeNull();
    expect((await getRegistration(hacker.id))?.status).toBe("accepted");
  });
});

describe("staff and judges are non-admins for the guards", () => {
  it.each(["staff", "judge"] as const)("%s can't change their own registration status", async role => {
    const user = await createUser({ role });
    await setRegistration(user.id);
    const { error } = await user.client.from("registrations").update({ status: "confirmed" }).eq("user_id", user.id);
    expect(error?.code).toBe(DENIED);
  });

  it("staff can't change another hacker's registration (no update policy)", async () => {
    const staff = await createUser({ role: "staff" });
    const hacker = await createUser();
    await setRegistration(hacker.id, { status: "pending" });
    await staff.client.from("registrations").update({ status: "accepted" }).eq("user_id", hacker.id);
    expect((await getRegistration(hacker.id))?.status).toBe("pending");
  });
});

describe("owner bypasses the guards", () => {
  it("can set status, score and notes on any registration", async () => {
    const owner = await createUser({ role: "owner" });
    const hacker = await createUser();
    await setRegistration(hacker.id, { status: "pending", responses: { build_or_learn: "x" } });
    const { error } = await owner.client
      .from("registrations")
      .update({ status: "accepted", review_score: 4, notes: "good", reviewed_by: owner.id, responses: { build_or_learn: "fixed typo" } })
      .eq("user_id", hacker.id);
    expect(error).toBeNull();
    expect(await getRegistration(hacker.id)).toMatchObject({ status: "accepted", review_score: 4, notes: "good", reviewed_by: owner.id });
  });

  it("is still bound by the review_score check constraint", async () => {
    const owner = await createUser({ role: "owner" });
    const hacker = await createUser();
    await setRegistration(hacker.id);
    const { error } = await owner.client.from("registrations").update({ review_score: 6 }).eq("user_id", hacker.id);
    expect(error?.code).toBe("23514");
  });

  it("is still bound by the status check constraint", async () => {
    const owner = await createUser({ role: "owner" });
    const hacker = await createUser();
    await setRegistration(hacker.id);
    const { error } = await owner.client.from("registrations").update({ status: "maybe" }).eq("user_id", hacker.id);
    expect(error?.code).toBe("23514");
  });
});

describe("profile guard", () => {
  it("a hacker can edit their own profile while unlocked", async () => {
    const hacker = await createUser();
    await setRegistration(hacker.id);
    const { error } = await hacker.client.from("profiles").update({ school: "UF" }).eq("id", hacker.id);
    expect(error).toBeNull();
    expect((await getProfile(hacker.id))?.school).toBe("UF");
  });

  it("a hacker without a registration can edit their profile", async () => {
    const hacker = await createUser();
    const { error } = await hacker.client.from("profiles").update({ school: "UF" }).eq("id", hacker.id);
    expect(error).toBeNull();
  });

  it("blocks profile edits once the registration is locked", async () => {
    const hacker = await createUser();
    await setRegistration(hacker.id, { editing_locked: true });
    const { error } = await hacker.client.from("profiles").update({ school: "Hacked U" }).eq("id", hacker.id);
    expect(error?.code).toBe(DENIED);
    expect((await getProfile(hacker.id))?.school).not.toBe("Hacked U");
  });

  it("an owner can edit a locked profile", async () => {
    const owner = await createUser({ role: "owner" });
    const hacker = await createUser();
    await setRegistration(hacker.id, { editing_locked: true });
    const { error } = await owner.client.from("profiles").update({ school: "Fixed U" }).eq("id", hacker.id);
    expect(error).toBeNull();
    expect((await getProfile(hacker.id))?.school).toBe("Fixed U");
  });

  it.each(["discord_id", "discord_username"])("a hacker can't set %s directly", async column => {
    const hacker = await createUser();
    const { error } = await hacker.client.from("profiles").update({ [column]: "123" }).eq("id", hacker.id);
    expect(error?.code).toBe(DENIED);
    expect((await getProfile(hacker.id))?.[column]).toBeNull();
  });

  it("a hacker can't create their profile with Discord fields filled in", async () => {
    const hacker = await createUser({ profile: false });
    const { error } = await hacker.client.from("profiles").insert({ id: hacker.id, email: hacker.email, discord_id: "123" });
    expect(error?.code).toBe(DENIED);
  });
});
