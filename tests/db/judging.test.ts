import { beforeEach, describe, expect, it } from "vitest";
import { DENIED, resetDb, sql } from "../helpers/db";
import { createUser, type TestUser } from "../helpers/users";

// Judging setup: staff manage projects and judge assignments (the Judging tab), table numbers
// are integers, and losing the judge role drops that judge's assignments.

let hacker: TestUser, staff: TestUser, owner: TestUser, judge: TestUser;

beforeEach(async () => {
  await resetDb();
  [hacker, staff, owner, judge] = await Promise.all([
    createUser(),
    createUser({ role: "staff" }),
    createUser({ role: "owner" }),
    createUser({ role: "judge" }),
  ]);
});

const assignmentsOf = (judgeId: string) =>
  sql(`select project_id from public.judge_assignments where judge_id = $1`, [judgeId]);

async function sqlProject(title: string) {
  const [row] = await sql(`insert into public.projects (title) values ($1) returning id`, [title]);
  return row.id as string;
}

async function staffProject(title: string) {
  const { data, error } = await staff.client.from("projects").insert({ title }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

describe("projects", () => {
  it("staff can insert, update table_number, delete", async () => {
    const insert = await staff.client.from("projects").insert({ title: "Gator Bot" }).select("id").single();
    expect(insert.error).toBeNull();
    const id = insert.data!.id as string;

    const update = await staff.client.from("projects").update({ table_number: 12 }).eq("id", id).select("table_number");
    expect(update.error).toBeNull();
    expect(update.data).toEqual([{ table_number: 12 }]);

    const del = await staff.client.from("projects").delete().eq("id", id).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
    expect(await sql(`select 1 from public.projects where id = $1`, [id])).toEqual([]);
  });

  it("a hacker can't insert", async () => {
    const { error } = await hacker.client.from("projects").insert({ title: "Mine" });
    expect(error?.code).toBe(DENIED);
    expect(await sql(`select 1 from public.projects`)).toEqual([]);
  });

  it("table_number is an integer", async () => {
    const { data, error } = await staff.client
      .from("projects")
      .insert({ title: "Numbered", table_number: 7 })
      .select("table_number")
      .single();
    expect(error).toBeNull();
    expect(data!.table_number).toBe(7);
    const [col] = await sql(
      `select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'projects' and column_name = 'table_number'`
    );
    expect(col).toEqual({ data_type: "integer" });
  });
});

describe("judge_assignments", () => {
  it("staff can insert and delete assignments", async () => {
    const projectId = await staffProject("Assign me");
    const insert = await staff.client.from("judge_assignments").insert({ judge_id: judge.id, project_id: projectId });
    expect(insert.error).toBeNull();
    expect(await assignmentsOf(judge.id)).toEqual([{ project_id: projectId }]);

    const del = await staff.client
      .from("judge_assignments")
      .delete()
      .eq("judge_id", judge.id)
      .eq("project_id", projectId)
      .select("project_id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
    expect(await assignmentsOf(judge.id)).toEqual([]);
  });
});

describe("judges", () => {
  it("still see only their assigned projects", async () => {
    const assigned = await staffProject("Assigned");
    await staffProject("Unassigned");
    const { error } = await staff.client.from("judge_assignments").insert({ judge_id: judge.id, project_id: assigned });
    expect(error).toBeNull();

    const { data } = await judge.client.from("projects").select("id");
    expect(data).toEqual([{ id: assigned }]);
  });
});

describe("set_user_role", () => {
  it("removing the judge role deletes that judge's assignments", async () => {
    const projectId = await sqlProject("Judged");
    await sql(`insert into public.judge_assignments (judge_id, project_id) values ($1, $2)`, [judge.id, projectId]);

    const { error } = await owner.client.rpc("set_user_role", { p_user_id: judge.id, p_role: "hacker" });
    expect(error).toBeNull();
    expect(await assignmentsOf(judge.id)).toEqual([]);
  });

  it("judge → judge keeps assignments", async () => {
    const projectId = await sqlProject("Judged");
    await sql(`insert into public.judge_assignments (judge_id, project_id) values ($1, $2)`, [judge.id, projectId]);

    const { error } = await owner.client.rpc("set_user_role", { p_user_id: judge.id, p_role: "judge" });
    expect(error).toBeNull();
    expect(await assignmentsOf(judge.id)).toEqual([{ project_id: projectId }]);
  });
});
