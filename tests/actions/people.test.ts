import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, revalidatePath } from "../helpers/next";
import { sql } from "../helpers/db";
import { createUser, type TestUser } from "../helpers/users";

vi.mock("@/lib/supabase/server", async () => (await import("../helpers/next")).nextMocks.server);
vi.mock("next/cache", async () => (await import("../helpers/next")).nextMocks.cache);
vi.mock("next/navigation", async () => (await import("../helpers/next")).nextMocks.navigation);

const people = await import("@/app/staff/people/actions");

let owner: TestUser;

beforeEach(async () => {
  revalidatePath.mockClear();
  // each test starts with exactly one owner and no other role holders
  await sql(`delete from public.user_roles`);
  owner = await createUser({ role: "owner", firstName: "Olive" });
});

afterEach(() => {
  actAs(null);
  vi.restoreAllMocks();
});

async function roleOf(userId: string) {
  const rows = await sql<{ role: string }>(`select role from public.user_roles where user_id = $1`, [userId]);
  return rows[0]?.role ?? "hacker";
}

describe("setRole", () => {
  it("owner makes someone a judge", async () => {
    const hacker = await createUser();
    actAs(owner);
    expect(await people.setRole(hacker.id, "judge")).toEqual({ ok: true });
    expect(await roleOf(hacker.id)).toBe("judge");
    expect(revalidatePath).toHaveBeenCalledWith("/staff/people");

    // back to hacker removes the row
    expect(await people.setRole(hacker.id, "hacker")).toEqual({ ok: true });
    expect(await roleOf(hacker.id)).toBe("hacker");
  });

  it('staff get "Not allowed"', async () => {
    const staff = await createUser({ role: "staff" });
    const hacker = await createUser();
    actAs(staff);
    expect(await people.setRole(hacker.id, "judge")).toEqual({ ok: false, error: "Not allowed" });
    expect(await roleOf(hacker.id)).toBe("hacker");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("last owner can't demote themselves", async () => {
    actAs(owner);
    const res = await people.setRole(owner.id, "staff");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/last owner/);
    expect(await roleOf(owner.id)).toBe("owner");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("listRoleHolders", () => {
  it("lists owners, staff and judges in order", async () => {
    const judge = await createUser({ role: "judge", firstName: "Adam" });
    const staffB = await createUser({ role: "staff", firstName: "Zoe" });
    const staffA = await createUser({ role: "staff", firstName: "Beth" });
    const owner2 = await createUser({ role: "owner", firstName: "Ann" });
    await createUser({ firstName: "Hacker" });

    actAs(owner);
    const list = await people.listRoleHolders();
    expect(list.map(p => [p.userId, p.role])).toEqual([
      [owner2.id, "owner"],
      [owner.id, "owner"],
      [staffA.id, "staff"],
      [staffB.id, "staff"],
      [judge.id, "judge"],
    ]);
    expect(list[0]).toEqual({ userId: owner2.id, name: "Ann", email: owner2.email, role: "owner" });

    // not for staff
    actAs(await createUser({ role: "staff" }));
    expect(await people.listRoleHolders()).toEqual([]);
  });
});

describe("searchProfilesWithRoles", () => {
  it('finds by email and reports "hacker" for no role', async () => {
    const hacker = await createUser({ firstName: "Hank" });
    const judge = await createUser({ role: "judge", firstName: "Judy" });
    actAs(owner);

    expect(await people.searchProfilesWithRoles(hacker.email)).toEqual({
      ok: true,
      people: [{ userId: hacker.id, name: "Hank", email: hacker.email, role: "hacker" }],
    });
    expect(await people.searchProfilesWithRoles(judge.email)).toEqual({
      ok: true,
      people: [{ userId: judge.id, name: "Judy", email: judge.email, role: "judge" }],
    });
    // under 2 characters: no query
    expect(await people.searchProfilesWithRoles("x")).toEqual({ ok: true, people: [] });
    // a read
    expect(revalidatePath).not.toHaveBeenCalled();

    actAs(await createUser({ role: "staff" }));
    expect(await people.searchProfilesWithRoles(hacker.email)).toEqual({ ok: false, error: "Not allowed", people: [] });
  });
});
