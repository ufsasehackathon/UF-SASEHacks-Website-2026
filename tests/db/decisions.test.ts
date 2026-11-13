import { beforeEach, describe, expect, it } from "vitest";
import { DENIED, resetDb, sql } from "../helpers/db";
import { createUser, getRegistration, setRegistration, type TestUser } from "../helpers/users";

// Review decisions are queued in pending_decisions (hidden from hackers) until an owner sends
// them with apply_decisions, which moves them into registrations.status.

let hacker: TestUser, other: TestUser, staff: TestUser, judge: TestUser, owner: TestUser;

beforeEach(async () => {
  await resetDb();
  [hacker, other, staff, judge, owner] = await Promise.all([
    createUser(),
    createUser(),
    createUser({ role: "staff" }),
    createUser({ role: "judge" }),
    createUser({ role: "owner" }),
  ]);
  const submitted = { status: "pending" as const, submitted_at: new Date().toISOString() };
  await setRegistration(hacker.id, submitted);
  await setRegistration(other.id, submitted);
});

async function queued() {
  return sql<{ user_id: string; decision: string; decided_by: string | null; decided_at: Date }>(
    `select * from public.pending_decisions order by user_id`
  );
}

async function queuedFor(userId: string) {
  return (await queued()).find(r => r.user_id === userId);
}

describe("set_decisions", () => {
  it("staff and owners can queue accept/reject for pending applicants", async () => {
    const { data, error } = await staff.client.rpc("set_decisions", {
      p_user_ids: [hacker.id, other.id],
      p_decision: "accepted",
    });
    expect(error).toBeNull();
    expect(data).toBe(2);

    const rows = await queued();
    expect(rows.map(r => r.user_id).sort()).toEqual([hacker.id, other.id].sort());
    for (const row of rows) {
      expect(row).toMatchObject({ decision: "accepted", decided_by: staff.id });
      expect(row.decided_at).toBeInstanceOf(Date);
    }
    // nothing visible to the applicant yet
    expect((await getRegistration(hacker.id))?.status).toBe("pending");
    expect((await getRegistration(other.id))?.status).toBe("pending");

    const byOwner = await owner.client.rpc("set_decisions", { p_user_ids: [other.id], p_decision: "rejected" });
    expect(byOwner.error).toBeNull();
    expect(byOwner.data).toBe(1);
    expect(await queuedFor(other.id)).toMatchObject({ decision: "rejected", decided_by: owner.id });
  });

  it("skips applicants who aren't pending", async () => {
    await setRegistration(hacker.id, { status: "draft", submitted_at: null });
    await setRegistration(other.id, { status: "accepted" });
    const { data, error } = await staff.client.rpc("set_decisions", {
      p_user_ids: [hacker.id, other.id],
      p_decision: "accepted",
    });
    expect(error).toBeNull();
    expect(data).toBe(0);
    expect(await queued()).toEqual([]);
  });

  it("re-deciding overwrites the decision", async () => {
    await staff.client.rpc("set_decisions", { p_user_ids: [hacker.id], p_decision: "accepted" });
    const { data } = await staff.client.rpc("set_decisions", { p_user_ids: [hacker.id], p_decision: "rejected" });
    expect(data).toBe(1);
    const rows = await queued();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: hacker.id, decision: "rejected" });
  });

  it.each(["hacker", "judge"] as const)("%s gets 42501", async role => {
    const user = role === "hacker" ? hacker : judge;
    const { error } = await user.client.rpc("set_decisions", { p_user_ids: [hacker.id], p_decision: "accepted" });
    expect(error?.code).toBe(DENIED);
    expect(await queued()).toEqual([]);
  });

  it("rejects unknown decision", async () => {
    const { error } = await staff.client.rpc("set_decisions", { p_user_ids: [hacker.id], p_decision: "waitlist" });
    expect(error?.message).toMatch(/Unknown decision/);
    expect(await queued()).toEqual([]);
  });
});

describe("clear_decisions", () => {
  it("removes queued rows; staff only", async () => {
    await staff.client.rpc("set_decisions", { p_user_ids: [hacker.id, other.id], p_decision: "accepted" });

    for (const user of [hacker, judge]) {
      const { error } = await user.client.rpc("clear_decisions", { p_user_ids: [hacker.id, other.id] });
      expect(error?.code).toBe(DENIED);
    }
    expect(await queued()).toHaveLength(2);

    const { data, error } = await staff.client.rpc("clear_decisions", { p_user_ids: [hacker.id] });
    expect(error).toBeNull();
    expect(data).toBe(1);
    expect((await queued()).map(r => r.user_id)).toEqual([other.id]);

    const byOwner = await owner.client.rpc("clear_decisions", { p_user_ids: [other.id] });
    expect(byOwner.data).toBe(1);
    expect(await queued()).toEqual([]);
  });
});

describe("pending_decisions RLS", () => {
  beforeEach(async () => {
    await staff.client.rpc("set_decisions", { p_user_ids: [hacker.id], p_decision: "rejected" });
  });

  it("a hacker can't read their own queued decision", async () => {
    const { data } = await hacker.client.from("pending_decisions").select();
    expect(data).toEqual([]);
    const asJudge = await judge.client.from("pending_decisions").select();
    expect(asJudge.data).toEqual([]);
  });

  it.each(["staff", "owner"] as const)("%s can read queued decisions", async role => {
    const user = role === "staff" ? staff : owner;
    const { data, error } = await user.client.from("pending_decisions").select("user_id, decision");
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: hacker.id, decision: "rejected" }]);
  });

  it("nobody can insert directly", async () => {
    const { error } = await staff.client.from("pending_decisions").insert({ user_id: other.id, decision: "accepted" });
    expect(error?.code).toBe(DENIED);
    const asHacker = await hacker.client.from("pending_decisions").insert({ user_id: hacker.id, decision: "accepted" });
    expect(asHacker.error).not.toBeNull();
    expect(await queuedFor(other.id)).toBeUndefined();
  });
});

describe("apply_decisions", () => {
  const deadline = new Date(Date.now() + 7 * 86400_000).toISOString();

  it("owner applies accept: status, accepted_at, rsvp_deadline, last_emailed_status, reviewed_by; queue row gone", async () => {
    await staff.client.rpc("set_decisions", { p_user_ids: [hacker.id], p_decision: "accepted" });
    const { data, error } = await owner.client.rpc("apply_decisions", {
      p_items: [{ user_id: hacker.id, decision: "accepted" }],
      p_rsvp_deadline: deadline,
    });
    expect(error).toBeNull();
    expect(data).toEqual([hacker.id]);

    const reg = await getRegistration(hacker.id);
    expect(reg).toMatchObject({ status: "accepted", last_emailed_status: "accepted", reviewed_by: staff.id });
    expect(reg?.accepted_at).toBeInstanceOf(Date);
    expect((reg?.rsvp_deadline as Date).toISOString()).toBe(deadline);
    expect(await queued()).toEqual([]);
  });

  it("applies reject without accepted_at/rsvp_deadline", async () => {
    await staff.client.rpc("set_decisions", { p_user_ids: [hacker.id], p_decision: "rejected" });
    const { data, error } = await owner.client.rpc("apply_decisions", {
      p_items: [{ user_id: hacker.id, decision: "rejected" }],
      p_rsvp_deadline: deadline,
    });
    expect(error).toBeNull();
    expect(data).toEqual([hacker.id]);

    const reg = await getRegistration(hacker.id);
    expect(reg).toMatchObject({
      status: "rejected",
      last_emailed_status: "rejected",
      reviewed_by: staff.id,
      accepted_at: null,
      rsvp_deadline: null,
    });
    expect(await queued()).toEqual([]);
  });

  it("applies the decision passed in, not the queued one", async () => {
    // Review Focus 1: the email that went out said "accepted"; staff flipped the queue meanwhile
    await staff.client.rpc("set_decisions", { p_user_ids: [hacker.id], p_decision: "rejected" });
    const { data } = await owner.client.rpc("apply_decisions", {
      p_items: [{ user_id: hacker.id, decision: "accepted" }],
      p_rsvp_deadline: deadline,
    });
    expect(data).toEqual([hacker.id]);
    expect((await getRegistration(hacker.id))?.status).toBe("accepted");
    expect(await queued()).toEqual([]);
  });

  it("skips a registration that is no longer pending but deletes its queue row", async () => {
    // Review Focus 3: an owner changed the status in SQL after the decision was queued
    await staff.client.rpc("set_decisions", { p_user_ids: [hacker.id], p_decision: "accepted" });
    await setRegistration(hacker.id, { status: "confirmed" });
    const { data, error } = await owner.client.rpc("apply_decisions", {
      p_items: [{ user_id: hacker.id, decision: "accepted" }],
      p_rsvp_deadline: deadline,
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const reg = await getRegistration(hacker.id);
    expect(reg?.status).toBe("confirmed");
    expect(reg?.last_emailed_status).toBeNull();
    expect(await queued()).toEqual([]);
  });

  it("sets reviewed_by to null when the queue row is already gone", async () => {
    const { data } = await owner.client.rpc("apply_decisions", {
      p_items: [{ user_id: hacker.id, decision: "accepted" }],
      p_rsvp_deadline: deadline,
    });
    expect(data).toEqual([hacker.id]);
    expect(await getRegistration(hacker.id)).toMatchObject({ status: "accepted", reviewed_by: null });
  });

  it("staff get 42501", async () => {
    await staff.client.rpc("set_decisions", { p_user_ids: [hacker.id], p_decision: "accepted" });
    const { error } = await staff.client.rpc("apply_decisions", {
      p_items: [{ user_id: hacker.id, decision: "accepted" }],
      p_rsvp_deadline: deadline,
    });
    expect(error?.code).toBe(DENIED);
    expect((await getRegistration(hacker.id))?.status).toBe("pending");
    expect(await queued()).toHaveLength(1);
  });
});
