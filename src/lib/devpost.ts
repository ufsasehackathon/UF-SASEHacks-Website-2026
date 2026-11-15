import Papa from "papaparse";

export type ImportedProject = {
  title: string;
  devpost_url: string;
  track: string | null;
  description: string | null;
  team: string | null;
};

/** Largest CSV the import accepts. Matches `experimental.serverActions.bodySizeLimit` in next.config.ts. */
export const MAX_CSV_BYTES = 4 * 1024 * 1024;
export const CSV_TOO_LARGE = "CSV is too large (4 MB max)";

const NO_PROJECTS = "No submitted projects found. Is this the Devpost submissions export?";

/** First non-empty value among the named columns (case-insensitive), trimmed; "" when none. */
function pick(row: Record<string, string | undefined>, ...names: string[]) {
  const wanted = names.map(n => n.toLowerCase());
  for (const [key, value] of Object.entries(row)) {
    if (wanted.includes(key.toLowerCase())) {
      const v = (value ?? "").trim();
      if (v) return v;
    }
  }
  return "";
}

function fullName(row: Record<string, string | undefined>, prefix: string) {
  return `${pick(row, `${prefix} First Name`)} ${pick(row, `${prefix} Last Name`)}`.trim();
}

/**
 * Parse Devpost's submissions export (Manage hackathon > Metrics > Export submissions).
 * Drafts are skipped and counted; rows without a title or URL are dropped; for duplicate
 * URLs the first row wins. `rowErrors` counts rows papaparse couldn't read (e.g. an unclosed
 * quote); rows with too few or too many fields are still read, so they don't count.
 */
export function parseDevpostCsv(text: string): {
  projects: ImportedProject[];
  skippedDrafts: number;
  rowErrors: number;
  error?: string;
} {
  const parsed = Papa.parse<Record<string, string | undefined>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.replace(/^\uFEFF/, "").trim(),
  });

  const rowErrors = new Set(
    parsed.errors.filter(e => e.type !== "FieldMismatch" && typeof e.row === "number").map(e => e.row)
  ).size;

  const projects: ImportedProject[] = [];
  const seen = new Set<string>();
  let skippedDrafts = 0;

  for (const row of parsed.data) {
    if (/draft/i.test(pick(row, "Project Status"))) {
      skippedDrafts++;
      continue;
    }

    const title = pick(row, "Project Title", "Title", "Project Name");
    const url = pick(row, "Submission Url", "Submission URL", "Project URL", "Devpost URL");
    if (!title || !url || seen.has(url)) continue;
    seen.add(url);

    const names = [fullName(row, "Submitter")];
    for (let i = 1; i <= 10; i++) names.push(fullName(row, `Team Member ${i}`));

    projects.push({
      title,
      devpost_url: url,
      track: pick(row, "Opt-In Prizes", "Track", "Prizes") || null,
      description: pick(row, "About The Project", "Description", "Elevator Pitch") || null,
      team: names.filter(Boolean).join(", ") || null,
    });
  }

  if (!projects.length) return { projects, skippedDrafts, rowErrors, error: NO_PROJECTS };
  return { projects, skippedDrafts, rowErrors };
}
