import { beforeAll, describe, expect, it } from "vitest";
import { DENIED, anonClient, sql } from "../helpers/db";
import { createUser, getProfile, getRegistration, setRegistration, type TestUser } from "../helpers/users";

// Row-level security per table and role. A blocked SELECT returns no rows; a blocked
// UPDATE/DELETE matches no rows; a blocked INSERT raises 42501.

let hacker: TestUser, other: TestUser, staff: TestUser, judge: TestUser, owner: TestUser;

beforeAll(async () => {
  [hacker, other, staff, judge, owner] = await Promise.all([
    createUser(),
    createUser(),
    createUser({ role: "staff" }),
    createUser({ role: "judge" }),
    createUser({ role: "owner" }),
  ]);
  await setRegistration(hacker.id, { status: "pending", notes: "secret owner note", review_score: 3 });
  await setRegistration(other.id, { status: "pending" });
});

const ids = (rows: { id?: string; user_id?: string }[] | null) => (rows ?? []).map(r => r.id ?? r.user_id).sort();

describe("profiles", () => {
  it("a hacker reads only their own profile", async () => {
    const { data } = await hacker.client.from("profiles").select("id");
    expect(ids(data)).toEqual([hacker.id]);
  });

  it("a judge reads only their own profile", async () => {
    const { data } = await judge.client.from("profiles").select("id");
    expect(ids(data)).toEqual([judge.id]);
  });

  it.each(["staff", "owner"] as const)("%s reads every profile", async role => {
    const user = role === "staff" ? staff : owner;
    const { data } = await user.client.from("profiles").select("id");
    expect(ids(data)).toEqual([hacker.id, other.id, staff.id, judge.id, owner.id].sort());
  });

  it("anon reads nothing", async () => {
    const { data } = await anonClient().from("profiles").select("id");
    expect(data).toEqual([]);
  });

  it("a hacker can't create a profile for someone else", async () => {
    const stranger = await createUser({ profile: false });
    const { error } = await hacker.client.from("profiles").insert({ id: stranger.id, email: "x@example.com" });
    expect(error?.code).toBe(DENIED);
  });

  it("a hacker can't update someone else's profile", async () => {
    await hacker.client.from("profiles").update({ school: "Pwned" }).eq("id", other.id);
    expect((await getProfile(other.id))?.school).not.toBe("Pwned");
  });

  it("staff can't update profiles", async () => {
    await staff.client.from("profiles").update({ school: "Pwned" }).eq("id", other.id);
    expect((await getProfile(other.id))?.school).not.toBe("Pwned");
  });

  it("nobody but an owner can delete a profile", async () => {
    await hacker.client.from("profiles").delete().eq("id", hacker.id);
    await staff.client.from("profiles").delete().eq("id", other.id);
    expect(await getProfile(hacker.id)).toBeDefined();
    expect(await getProfile(other.id)).toBeDefined();
  });

  it("an owner can update anyone's profile", async () => {
    const { error } = await owner.client.from("profiles").update({ school: "Owner U" }).eq("id", other.id);
    expect(error).toBeNull();
    expect((await getProfile(other.id))?.school).toBe("Owner U");
  });
});

describe("registrations", () => {
  it("a hacker reads only their own registration (including owner notes on it)", async () => {
    const { data } = await hacker.client.from("registrations").select("user_id, notes");
    expect(ids(data)).toEqual([hacker.id]);
  });

  it("a judge reads none", async () => {
    const { data } = await judge.client.from("registrations").select("user_id");
    expect(data).toEqual([]);
  });

  it.each(["staff", "owner"] as const)("%s reads every registration", async role => {
    const user = role === "staff" ? staff : owner;
    const { data } = await user.client.from("registrations").select("user_id");
    expect(ids(data)).toEqual([hacker.id, other.id].sort());
  });

  it("anon reads nothing", async () => {
    const { data } = await anonClient().from("registrations").select("user_id");
    expect(data).toEqual([]);
  });

  it("a hacker can't update someone else's registration", async () => {
    await hacker.client.from("registrations").update({ can_photograph: false }).eq("user_id", other.id);
    expect((await getRegistration(other.id))?.can_photograph).toBe(true);
  });

  it("a hacker can't delete their registration", async () => {
    await hacker.client.from("registrations").delete().eq("user_id", hacker.id);
    expect(await getRegistration(hacker.id)).toBeDefined();
  });
});

describe("settings", () => {
  it("anon can't read settings", async () => {
    const { data } = await anonClient().from("settings").select("*");
    expect(data).toEqual([]);
  });

  it("signed-in users can read settings", async () => {
    const { data } = await hacker.client.from("settings").select("applications_close");
    expect(data).toHaveLength(1);
  });

  it("a hacker and staff can't change the deadline", async () => {
    const before = (await sql(`select applications_close from public.settings`))[0];
    await hacker.client.from("settings").update({ applications_close: "2099-01-01T00:00:00Z" }).eq("id", true);
    await staff.client.from("settings").update({ applications_close: "2099-01-01T00:00:00Z" }).eq("id", true);
    expect((await sql(`select applications_close from public.settings`))[0]).toEqual(before);
  });

  it("an owner can change the deadline", async () => {
    const { error } = await owner.client.from("settings").update({ applications_close: "2027-03-01T00:00:00Z" }).eq("id", true);
    expect(error).toBeNull();
    const [row] = await sql<{ applications_close: Date }>(`select applications_close from public.settings`);
    expect(row.applications_close.toISOString()).toBe("2027-03-01T00:00:00.000Z");
  });
});

describe("user_roles", () => {
  it("a hacker sees no roles (they have none)", async () => {
    const { data } = await hacker.client.from("user_roles").select("user_id");
    expect(data).toEqual([]);
  });

  it("a judge sees only their own role", async () => {
    const { data } = await judge.client.from("user_roles").select("user_id, role");
    expect(data).toEqual([{ user_id: judge.id, role: "judge" }]);
  });

  it.each(["staff", "owner"] as const)("%s sees every role", async role => {
    const user = role === "staff" ? staff : owner;
    const { data } = await user.client.from("user_roles").select("user_id");
    expect(ids(data)).toEqual([staff.id, judge.id, owner.id].sort());
  });

  it.each(["hacker", "staff", "owner"] as const)("%s can't write user_roles directly (only via set_user_role)", async role => {
    const user = { hacker, staff, owner }[role];
    const { error } = await user.client.from("user_roles").insert({ user_id: user.id, role: "owner" });
    expect(error?.code).toBe(DENIED);
  });

  it("a judge can't promote themselves by updating their row", async () => {
    await judge.client.from("user_roles").update({ role: "owner" }).eq("user_id", judge.id);
    const [row] = await sql(`select role from public.user_roles where user_id = $1`, [judge.id]);
    expect(row.role).toBe("judge");
  });

  it("allows one role per user", async () => {
    await expect(sql(`insert into public.user_roles (user_id, role) values ($1, 'staff')`, [judge.id])).rejects.toThrow(/duplicate key/);
  });

  it("only accepts owner/staff/judge", async () => {
    await expect(sql(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [hacker.id])).rejects.toThrow(/user_roles_role_check/);
  });
});

describe("events and attendance", () => {
  let checkInEvent: string;

  beforeAll(async () => {
    [{ id: checkInEvent }] = await sql<{ id: string }>(`select id from public.events where event_name = 'Check-in'`);
    await sql(`insert into public.attendance (user_id, event_id) values ($1, $2), ($3, $2)`, [hacker.id, checkInEvent, other.id]);
  });

  it("hackers and judges can't see events (or their check-in codes)", async () => {
    expect((await hacker.client.from("events").select("id")).data).toEqual([]);
    expect((await judge.client.from("events").select("id")).data).toEqual([]);
  });

  it("staff can read events but not change them", async () => {
    const { data } = await staff.client.from("events").select("event_name, checkin_code");
    expect(data?.map(e => e.event_name)).toContain("Check-in");
    await staff.client.from("events").update({ self_checkin_open: true }).eq("id", checkInEvent);
    const [row] = await sql(`select self_checkin_open from public.events where id = $1`, [checkInEvent]);
    expect(row.self_checkin_open).toBe(false);
    const { error } = await staff.client.from("events").insert({ event_name: "Staff workshop" });
    expect(error?.code).toBe(DENIED);
  });

  it("an owner can create events", async () => {
    const { error } = await owner.client.from("events").insert({ event_name: "Intro to React" });
    expect(error).toBeNull();
  });

  it("a hacker sees only their own attendance", async () => {
    const { data } = await hacker.client.from("attendance").select("user_id");
    expect(ids(data)).toEqual([hacker.id]);
  });

  it("a hacker can't insert attendance directly", async () => {
    const { error } = await other.client.from("attendance").insert({ user_id: other.id, event_id: checkInEvent });
    expect(error?.code).toBe(DENIED);
  });

  it("a hacker can't delete their attendance", async () => {
    await hacker.client.from("attendance").delete().eq("user_id", hacker.id);
    expect(await sql(`select 1 from public.attendance where user_id = $1`, [hacker.id])).toHaveLength(1);
  });

  it("staff read all attendance but can't write it directly", async () => {
    const { data } = await staff.client.from("attendance").select("user_id");
    expect(ids(data)).toEqual([hacker.id, other.id].sort());
    await staff.client.from("attendance").delete().eq("user_id", hacker.id);
    expect(await sql(`select 1 from public.attendance where user_id = $1`, [hacker.id])).toHaveLength(1);
  });
});

describe("judging tables", () => {
  let assigned: string, unassigned: string;
  let judge2: TestUser;

  beforeAll(async () => {
    judge2 = await createUser({ role: "judge" });
    const { data, error } = await owner.client
      .from("projects")
      .insert([{ title: "Assigned", devpost_url: "https://devpost.com/a" }, { title: "Unassigned", devpost_url: "https://devpost.com/b" }])
      .select("id, title");
    if (error) throw error;
    assigned = data.find(p => p.title === "Assigned")!.id;
    unassigned = data.find(p => p.title === "Unassigned")!.id;
    const { error: assignError } = await owner.client.from("judge_assignments").insert([
      { judge_id: judge.id, project_id: assigned },
      { judge_id: judge2.id, project_id: assigned },
    ]);
    if (assignError) throw assignError;
  });

  it("a judge sees only projects assigned to them", async () => {
    const { data } = await judge.client.from("projects").select("id");
    expect(ids(data)).toEqual([assigned]);
  });

  it("a judge sees only their own assignments", async () => {
    const { data } = await judge.client.from("judge_assignments").select("judge_id, project_id");
    expect(data).toEqual([{ judge_id: judge.id, project_id: assigned }]);
  });

  it.each(["hacker", "staff"] as const)("%s sees no projects", async role => {
    const user = role === "hacker" ? hacker : staff;
    expect((await user.client.from("projects").select("id")).data).toEqual([]);
  });

  it("a judge can't create projects or assign themselves", async () => {
    expect((await judge.client.from("projects").insert({ title: "Mine" })).error?.code).toBe(DENIED);
    expect((await judge.client.from("judge_assignments").insert({ judge_id: judge.id, project_id: unassigned })).error?.code).toBe(DENIED);
  });

  it("a judge can score an assigned project and update their sheet", async () => {
    const insert = await judge.client.from("judge_scores").insert({ judge_id: judge.id, project_id: assigned, scores: { impact: 4 } });
    expect(insert.error).toBeNull();
    const update = await judge.client.from("judge_scores").update({ scores: { impact: 5 }, comments: "nice" }).eq("project_id", assigned);
    expect(update.error).toBeNull();
    const [row] = await sql(`select scores, comments from public.judge_scores where judge_id = $1`, [judge.id]);
    expect(row).toEqual({ scores: { impact: 5 }, comments: "nice" });
  });

  it("a judge can't score a project they aren't assigned", async () => {
    const { error } = await judge.client.from("judge_scores").insert({ judge_id: judge.id, project_id: unassigned, scores: {} });
    expect(error?.code).toBe(DENIED);
  });

  it("a judge can't write a sheet as another judge", async () => {
    const { error } = await judge.client.from("judge_scores").insert({ judge_id: judge2.id, project_id: assigned, scores: {} });
    expect(error?.code).toBe(DENIED);
  });

  it("a judge can't read another judge's scores on the same project", async () => {
    await sql(`insert into public.judge_scores (judge_id, project_id, scores) values ($1, $2, '{"impact":1}') on conflict do nothing`, [judge2.id, assigned]);
    const { data } = await judge.client.from("judge_scores").select("judge_id");
    expect((data ?? []).map(r => r.judge_id)).not.toContain(judge2.id);
  });

  it("staff can't read scores; an owner reads all", async () => {
    expect((await staff.client.from("judge_scores").select("judge_id")).data).toEqual([]);
    const { data } = await owner.client.from("judge_scores").select("judge_id");
    expect((data ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("a former judge loses access when their role is removed", async () => {
    await sql(`delete from public.user_roles where user_id = $1`, [judge2.id]);
    expect((await judge2.client.from("projects").select("id")).data).toEqual([]);
    expect((await judge2.client.from("judge_scores").select("judge_id")).data).toEqual([]);
  });
});

describe("mailing_list", () => {
  it("anon can sign up but not read the list", async () => {
    const anon = anonClient();
    expect((await anon.from("mailing_list").insert({ email: "fan@example.com" })).error).toBeNull();
    expect((await anon.from("mailing_list").select("email")).data).toEqual([]);
  });

  it.each(["hacker", "staff"] as const)("%s can't read the list", async role => {
    const user = role === "hacker" ? hacker : staff;
    expect((await user.client.from("mailing_list").select("email")).data).toEqual([]);
  });

  it("an owner can read the list", async () => {
    const { data } = await owner.client.from("mailing_list").select("email");
    expect(data?.map(r => r.email)).toContain("fan@example.com");
  });

  it("rejects a duplicate email regardless of case", async () => {
    const { error } = await anonClient().from("mailing_list").insert({ email: "FAN@example.com" });
    expect(error?.code).toBe("23505");
  });

  it.each(["not-an-email", "a@b", "has space@example.com", `${"x".repeat(320)}@example.com`])("rejects invalid email %s", async email => {
    const { error } = await anonClient().from("mailing_list").insert({ email });
    expect(error?.code).toBe("23514");
  });
});
