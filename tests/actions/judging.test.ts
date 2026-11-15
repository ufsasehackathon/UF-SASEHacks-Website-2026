import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, revalidatePath } from "../helpers/next";
import { sql } from "../helpers/db";
import { createUser, type TestUser } from "../helpers/users";
import { fileForm } from "../helpers/forms";

vi.mock("@/lib/supabase/server", async () => (await import("../helpers/next")).nextMocks.server);
vi.mock("next/cache", async () => (await import("../helpers/next")).nextMocks.cache);
vi.mock("next/navigation", async () => (await import("../helpers/next")).nextMocks.navigation);

const judging = await import("@/app/staff/judging/actions");

let staff: TestUser;

beforeEach(async () => {
  revalidatePath.mockClear();
  // App data is only wiped per file: start each test with no projects and no judges
  await sql(`truncate public.judge_scores, public.judge_assignments, public.projects cascade`);
  await sql(`delete from public.user_roles where role = 'judge'`);
  staff = await createUser({ role: "staff" });
});

afterEach(() => {
  actAs(null);
  vi.restoreAllMocks();
});

type Row = { title: string; slug: string; status?: string };

/** A Devpost submissions export with these rows, as the upload form sends it */
function csvForm(rows: Row[]) {
  const lines = [
    "Project Title,Submission Url,Project Status",
    ...rows.map(r => `${r.title},https://devpost.com/software/${r.slug},${r.status ?? "Submitted (Gallery/Visible)"}`),
  ];
  return fileForm(new File([lines.join("\n")], "submissions.csv", { type: "text/csv" }), "file");
}

async function projects() {
  return sql<{ id: string; title: string; devpost_url: string; table_number: number | null }>(
    `select id, title, devpost_url, table_number from public.projects order by table_number nulls last, created_at`
  );
}

async function assignments() {
  return sql<{ judge_id: string; project_id: string }>(`select judge_id, project_id from public.judge_assignments`);
}

/** Insert projects with table numbers 1..n directly */
async function seedProjects(n: number, start = 1) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const [row] = await sql<{ id: string }>(
      `insert into public.projects (title, devpost_url, table_number) values ($1, $2, $3) returning id`,
      [`Project ${start + i}`, `https://devpost.com/software/p${start + i}`, start + i]
    );
    ids.push(row.id);
  }
  return ids;
}

function judgeCounts(rows: { judge_id: string }[], judgeIds: string[]) {
  const counts = new Map(judgeIds.map(j => [j, 0]));
  for (const r of rows) if (counts.has(r.judge_id)) counts.set(r.judge_id, counts.get(r.judge_id)! + 1);
  return [...counts.values()];
}

describe("importDevpostCsv", () => {
  it("creates projects numbered 1..n in CSV order and skips drafts", async () => {
    actAs(staff);
    const res = await judging.importDevpostCsv(
      csvForm([
        { title: "Gator Bot", slug: "gator-bot" },
        { title: "Swamp Map", slug: "swamp-map" },
        { title: "Unfinished", slug: "unfinished", status: "Draft" },
        { title: "Chomp", slug: "chomp" },
      ])
    );
    expect(res).toEqual({ ok: true, created: 3, updated: 0, skippedDrafts: 1 });

    expect((await projects()).map(p => [p.table_number, p.title, p.devpost_url])).toEqual([
      [1, "Gator Bot", "https://devpost.com/software/gator-bot"],
      [2, "Swamp Map", "https://devpost.com/software/swamp-map"],
      [3, "Chomp", "https://devpost.com/software/chomp"],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/judging");
    expect(revalidatePath).toHaveBeenCalledWith("/judge");
  });

  it("re-import updates titles, keeps edited table numbers, numbers new projects after the max", async () => {
    actAs(staff);
    await judging.importDevpostCsv(
      csvForm([
        { title: "Gator Bot", slug: "gator-bot" },
        { title: "Swamp Map", slug: "swamp-map" },
      ])
    );
    const swamp = (await projects()).find(p => p.title === "Swamp Map")!;
    expect(await judging.setTableNumber(swamp.id, 20)).toEqual({ ok: true });

    const res = await judging.importDevpostCsv(
      csvForm([
        { title: "Gator Bot v2", slug: "gator-bot" },
        { title: "Late Entry", slug: "late-entry" },
        { title: "Swamp Map", slug: "swamp-map" },
        { title: "Later Entry", slug: "later-entry" },
      ])
    );
    expect(res).toEqual({ ok: true, created: 2, updated: 2, skippedDrafts: 0 });

    expect((await projects()).map(p => [p.table_number, p.title])).toEqual([
      [1, "Gator Bot v2"],
      [20, "Swamp Map"],
      [21, "Late Entry"],
      [22, "Later Entry"],
    ]);
  });

  it('hackers and judges get "Not allowed"', async () => {
    for (const user of [await createUser(), await createUser({ role: "judge" })]) {
      actAs(user);
      expect(await judging.importDevpostCsv(csvForm([{ title: "Gator Bot", slug: "gator-bot" }]))).toEqual({
        ok: false,
        error: "Not allowed",
      });
    }
    expect(await projects()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects an empty file", async () => {
    actAs(staff);
    const empty = fileForm(new File([], "submissions.csv", { type: "text/csv" }), "file");
    expect(await judging.importDevpostCsv(empty)).toEqual({ ok: false, error: "Choose a CSV file" });
    expect(await judging.importDevpostCsv(new FormData())).toEqual({ ok: false, error: "Choose a CSV file" });
    expect(await projects()).toEqual([]);
  });
});

describe("assignJudges", () => {
  it("gives every project 3 of 4 judges and reports 7–8 per judge", async () => {
    const judges = [];
    for (let i = 0; i < 4; i++) judges.push(await createUser({ role: "judge" }));
    const judgeIds = judges.map(j => j.id);
    const projectIds = await seedProjects(10);

    actAs(staff);
    const res = await judging.assignJudges();
    expect(res).toEqual({ ok: true, added: 30, minPerJudge: 7, maxPerJudge: 8 });

    const rows = await assignments();
    for (const id of projectIds) {
      const on = rows.filter(r => r.project_id === id).map(r => r.judge_id);
      expect(on).toHaveLength(3);
      expect(on.every(j => judgeIds.includes(j))).toBe(true);
    }
    expect(judgeCounts(rows, judgeIds).sort()).toEqual([7, 7, 8, 8]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/judging");
    expect(revalidatePath).toHaveBeenCalledWith("/judge");
  });

  it("second run after a late import only assigns the new project", async () => {
    const judgeIds: string[] = [];
    for (let i = 0; i < 4; i++) judgeIds.push((await createUser({ role: "judge" })).id);
    await seedProjects(10);

    actAs(staff);
    expect((await judging.assignJudges()).ok).toBe(true);
    const before = await assignments();

    const [late] = await seedProjects(1, 11);
    const res = await judging.assignJudges();
    // 7, 7, 8, 8 before; the new project goes to the three least-loaded judges
    expect(res).toEqual({ ok: true, added: 3, minPerJudge: 8, maxPerJudge: 9 });

    const after = await assignments();
    const key = (r: { judge_id: string; project_id: string }) => `${r.judge_id}:${r.project_id}`;
    expect(after.filter(r => r.project_id !== late).map(key).sort()).toEqual(before.map(key).sort());
    expect(after.filter(r => r.project_id === late)).toHaveLength(3);
  });
});

describe("addJudge / removeJudge", () => {
  it("staff move a project between judges", async () => {
    const a = await createUser({ role: "judge" });
    const b = await createUser({ role: "judge" });
    const [project] = await seedProjects(1);
    await sql(`insert into public.judge_assignments (judge_id, project_id) values ($1, $2)`, [a.id, project]);

    actAs(staff);
    expect(await judging.removeJudge(project, a.id)).toEqual({ ok: true });
    expect(await judging.addJudge(project, b.id)).toEqual({ ok: true });
    expect(await assignments()).toEqual([{ judge_id: b.id, project_id: project }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/judging");
    expect(revalidatePath).toHaveBeenCalledWith("/judge");

    // hackers can't
    actAs(await createUser());
    expect(await judging.removeJudge(project, b.id)).toEqual({ ok: false, error: "Not allowed" });
    expect(await assignments()).toHaveLength(1);
  });

  it("addJudge refuses a non-judge", async () => {
    const hacker = await createUser();
    const otherStaff = await createUser({ role: "staff" });
    const [project] = await seedProjects(1);

    actAs(staff);
    for (const user of [hacker, otherStaff]) {
      expect(await judging.addJudge(project, user.id)).toEqual({ ok: false, error: "That person isn't a judge" });
    }
    expect(await assignments()).toEqual([]);
  });
});

describe("setTableNumber", () => {
  it("staff set 12; rejects 0 and 1.5", async () => {
    const [project] = await seedProjects(1);
    actAs(staff);

    expect(await judging.setTableNumber(project, 12)).toEqual({ ok: true });
    expect((await projects())[0].table_number).toBe(12);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/judging");
    expect(revalidatePath).toHaveBeenCalledWith("/judge");

    for (const bad of [0, 1.5, -3]) {
      expect(await judging.setTableNumber(project, bad)).toEqual({
        ok: false,
        error: "Table number must be a positive whole number",
      });
    }
    expect((await projects())[0].table_number).toBe(12);

    expect(await judging.setTableNumber(project, null)).toEqual({ ok: true });
    expect((await projects())[0].table_number).toBeNull();
  });
});

describe("deleteProject", () => {
  it("removes the project and its assignments", async () => {
    const judge = await createUser({ role: "judge" });
    const [gone, kept] = await seedProjects(2);
    await sql(`insert into public.judge_assignments (judge_id, project_id) values ($1, $2), ($1, $3)`, [
      judge.id,
      gone,
      kept,
    ]);

    actAs(staff);
    expect(await judging.deleteProject(gone)).toEqual({ ok: true });
    expect((await projects()).map(p => p.id)).toEqual([kept]);
    expect(await assignments()).toEqual([{ judge_id: judge.id, project_id: kept }]);
    expect(revalidatePath).toHaveBeenCalledWith("/staff/judging");
    expect(revalidatePath).toHaveBeenCalledWith("/judge");
  });
});
