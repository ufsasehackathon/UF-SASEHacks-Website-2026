import { describe, expect, it } from "vitest";
import { nextTableNumbers, planAssignments } from "@/lib/judging";

type Row = { judgeId: string; projectId: string };

const projects = (n: number, prefix = "p") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

function loads(rows: Row[], judgeIds: string[]) {
  return Object.fromEntries(judgeIds.map(j => [j, rows.filter(r => r.judgeId === j).length]));
}

function judgesPerProject(rows: Row[], projectIds: string[]) {
  return projectIds.map(p => new Set(rows.filter(r => r.projectId === p).map(r => r.judgeId)).size);
}

function hasNoDuplicates(rows: Row[]) {
  return new Set(rows.map(r => `${r.judgeId}|${r.projectId}`)).size === rows.length;
}

describe("planAssignments", () => {
  it("10 projects, 4 judges: every project gets 3 judges, loads are 7 or 8", () => {
    const projectIds = projects(10);
    const judgeIds = ["j1", "j2", "j3", "j4"];
    const rows = planAssignments({ projectIds, judgeIds, existing: [] });

    expect(rows).toHaveLength(30);
    expect(hasNoDuplicates(rows)).toBe(true);
    expect(judgesPerProject(rows, projectIds)).toEqual(Array(10).fill(3));
    for (const load of Object.values(loads(rows, judgeIds))) expect([7, 8]).toContain(load);
  });

  it("2 judges: every project gets both", () => {
    const projectIds = projects(5);
    const rows = planAssignments({ projectIds, judgeIds: ["a", "b"], existing: [] });

    expect(rows).toHaveLength(10);
    for (const p of projectIds) {
      expect(rows.filter(r => r.projectId === p).map(r => r.judgeId).sort()).toEqual(["a", "b"]);
    }
  });

  it("no judges: nothing", () => {
    expect(planAssignments({ projectIds: projects(4), judgeIds: [], existing: [] })).toEqual([]);
  });

  it("respects perProject", () => {
    const projectIds = projects(4);
    const rows = planAssignments({ projectIds, judgeIds: ["a", "b", "c"], existing: [], perProject: 1 });
    expect(judgesPerProject(rows, projectIds)).toEqual([1, 1, 1, 1]);
  });

  it("keeps existing assignments and never duplicates a judge on a project", () => {
    const projectIds = projects(3);
    const judgeIds = ["a", "b", "c", "d"];
    const existing: Row[] = [
      { judgeId: "a", projectId: "p1" },
      { judgeId: "b", projectId: "p1" },
      { judgeId: "a", projectId: "p2" },
    ];
    const rows = planAssignments({ projectIds, judgeIds, existing });

    // Only new rows come back, and none repeat an existing pair.
    const existingKeys = new Set(existing.map(r => `${r.judgeId}|${r.projectId}`));
    expect(rows.some(r => existingKeys.has(`${r.judgeId}|${r.projectId}`))).toBe(false);
    expect(hasNoDuplicates([...existing, ...rows])).toBe(true);
    expect(judgesPerProject([...existing, ...rows], projectIds)).toEqual([3, 3, 3]);
    expect(rows).toHaveLength(6);
  });

  it("re-run after everything is full returns []", () => {
    const projectIds = projects(10);
    const judgeIds = ["j1", "j2", "j3", "j4"];
    const first = planAssignments({ projectIds, judgeIds, existing: [] });
    expect(planAssignments({ projectIds, judgeIds, existing: first })).toEqual([]);
  });

  it("only fills new projects after a late import and keeps loads balanced", () => {
    const judgeIds = ["j1", "j2", "j3", "j4"];
    const firstBatch = projects(10);
    const first = planAssignments({ projectIds: firstBatch, judgeIds, existing: [] });

    const allProjects = [...firstBatch, ...projects(4, "late")];
    const second = planAssignments({ projectIds: allProjects, judgeIds, existing: first });

    expect(second.every(r => r.projectId.startsWith("late"))).toBe(true);
    expect(second).toHaveLength(12);
    const combined = [...first, ...second];
    expect(hasNoDuplicates(combined)).toBe(true);
    expect(judgesPerProject(combined, allProjects)).toEqual(Array(14).fill(3));
    const counts = Object.values(loads(combined, judgeIds));
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("ignores existing rows for people who are no longer judges when counting load", () => {
    const judgeIds = ["a", "b"];
    // "gone" is no longer a judge; their row on p1 still counts as a judge on p1,
    // but not toward anyone's load.
    const existing: Row[] = [
      { judgeId: "gone", projectId: "p1" },
      { judgeId: "a", projectId: "p9" },
      { judgeId: "gone", projectId: "p9" },
    ];
    const rows = planAssignments({ projectIds: ["p1", "p2"], judgeIds, existing, perProject: 1 });

    // p1 already has one judge (target 1). p2 goes to "b": a has load 1, b has 0.
    expect(rows).toEqual([{ judgeId: "b", projectId: "p2" }]);
  });
});

describe("nextTableNumbers", () => {
  it("continues from the max", () => {
    expect(nextTableNumbers(12, 3)).toEqual([13, 14, 15]);
  });

  it("starts at 1", () => {
    expect(nextTableNumbers(null, 4)).toEqual([1, 2, 3, 4]);
    expect(nextTableNumbers(null, 0)).toEqual([]);
  });
});
