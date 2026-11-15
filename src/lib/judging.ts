export type Assignment = { judgeId: string; projectId: string };

/**
 * Plan judge assignments so each project has `perProject` judges (default 3, capped at the
 * number of judges), spreading work evenly. Existing assignments are kept as they are, so
 * re-running never reshuffles anyone's list: only the new rows are returned.
 * `projectIds` should be in table-number order. Existing rows for people who aren't in
 * `judgeIds` still count as a judge on that project but not toward anyone's load.
 */
export function planAssignments(input: {
  projectIds: string[];
  judgeIds: string[];
  existing: Assignment[];
  perProject?: number;
}): Assignment[] {
  const { projectIds, judgeIds, existing } = input;
  const target = Math.min(input.perProject ?? 3, judgeIds.length);

  const load = new Map(judgeIds.map(j => [j, 0]));
  const onProject = new Map<string, Set<string>>();
  for (const { judgeId, projectId } of existing) {
    if (load.has(judgeId)) load.set(judgeId, load.get(judgeId)! + 1);
    if (!onProject.has(projectId)) onProject.set(projectId, new Set());
    onProject.get(projectId)!.add(judgeId);
  }

  const planned: Assignment[] = [];
  for (const projectId of projectIds) {
    const have = onProject.get(projectId) ?? new Set<string>();
    while (have.size < target) {
      let best: string | null = null;
      for (const j of judgeIds) {
        if (have.has(j)) continue;
        // Ties go to the earlier judge in judgeIds.
        if (best === null || load.get(j)! < load.get(best)!) best = j;
      }
      if (best === null) break;
      planned.push({ judgeId: best, projectId });
      have.add(best);
      load.set(best, load.get(best)! + 1);
    }
  }
  return planned;
}

/** Table numbers for `count` new projects, continuing after `currentMax` (1, 2, … when null). */
export function nextTableNumbers(currentMax: number | null, count: number): number[] {
  const start = (currentMax ?? 0) + 1;
  return Array.from({ length: count }, (_, i) => start + i);
}
