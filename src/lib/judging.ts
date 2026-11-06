import { z } from "zod";

/**
 * Judging rubric. To change criteria, edit this list only: scores live in judge_scores.scores
 * (jsonb) keyed by `id`, and the score form, validation and owner results all read from here.
 * Don't reuse an old `id` for a different criterion.
 */
export const JUDGING_CRITERIA = [
  { id: "technicality", label: "Technicality", description: "How technically impressive and well-built is it?" },
  { id: "creativity", label: "Creativity", description: "How original is the idea or approach?" },
  { id: "impact", label: "Impact", description: "How useful is it, and does it solve a real problem?" },
  { id: "presentation", label: "Presentation", description: "How clear and convincing was the demo?" },
] as const satisfies readonly { id: string; label: string; description: string }[];

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export type JudgeScores = Record<string, number>;

export const judgeScoreSchema = z.object({
  scores: z.object(
    Object.fromEntries(
      JUDGING_CRITERIA.map(c => [
        c.id,
        z.number({ message: `Please score ${c.label}` }).int().min(SCORE_MIN).max(SCORE_MAX),
      ])
    )
  ),
  comments: z.string().trim().max(2000, "Please keep comments under 2000 characters").optional().default(""),
});

/** Sum of the current criteria (ignores scores for criteria that were since removed) */
export function totalScore(scores: Record<string, unknown> | null | undefined): number | null {
  if (!scores) return null;
  let total = 0;
  for (const c of JUDGING_CRITERIA) {
    const v = scores[c.id];
    if (typeof v !== "number") return null;
    total += v;
  }
  return total;
}

export const MAX_TOTAL = SCORE_MAX * JUDGING_CRITERIA.length;
