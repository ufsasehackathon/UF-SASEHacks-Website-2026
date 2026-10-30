export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  order: number;
};

// Strip markdown escapes (\. \- \!) and **bold** / *italic* markers from one line
// of Google's markdown export. Links ([text](url)) are left alone.
function cleanLine(line: string): string {
  return line
    .replace(/\\([\\`*_{}\[\]()#+\-.!>~|])/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, "$1$2")
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Parses the FAQ doc top-down: "Q:" starts an item, "A:" starts its answer,
// headings (section titles) end the current item, and a "Hidden" line stops
// parsing so drafts can live below it.
export function parseFaqMarkdown(markdown: string): FaqItem[] {
  const parsed: { question: string; answer: string[] }[] = [];
  let current: { question: string; answer: string[] } | null = null;
  let inAnswer = false;

  const finish = () => {
    if (current && inAnswer) parsed.push(current);
    current = null;
    inAnswer = false;
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const isHeading = /^\s*#{1,6}\s/.test(rawLine);
    const line = cleanLine(rawLine.replace(/^\s*#{1,6}\s+/, ""));

    if (/^hidden$/i.test(line)) break;

    if (isHeading) {
      finish();
      continue;
    }

    // Q:/A: lines may themselves be list items ("* **Q: ...**").
    const content = line.replace(/^(?:[-*+]|\d+[.)])\s+/, "");

    const q = content.match(/^Q:\s*(.*)$/i);
    if (q) {
      finish();
      current = { question: q[1].trim(), answer: [] };
      continue;
    }

    if (!current) continue;

    const a = content.match(/^A:\s*(.*)$/i);
    if (a) {
      inAnswer = true;
      if (a[1]) current.answer.push(a[1]);
      continue;
    }

    if (!inAnswer) {
      // Question wrapped onto another line before its "A:".
      if (line) current.question += ` ${line}`;
      continue;
    }

    const bullet = rawLine.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
    current.answer.push(bullet ? `• ${cleanLine(bullet[1])}` : line);
  }
  finish();

  const seen = new Map<string, number>();
  return parsed
    .filter((item) => item.question)
    .map((item, index) => {
      const slug = slugify(item.question) || "faq";
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);

      // Drop blank lines between bullets, keep one blank line between paragraphs.
      const answer = item.answer
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/^(• .*)\n\n(?=• )/gm, "$1\n")
        .trim();

      return {
        id: count ? `${slug}-${index}` : slug,
        question: item.question,
        answer,
        order: index,
      };
    });
}

export async function fetchFaqFromGoogleDoc(): Promise<FaqItem[]> {
  try {
    const docId = process.env.GOOGLE_FAQ_DOC_ID;
    if (!docId) {
      console.warn("GOOGLE_FAQ_DOC_ID not set, returning empty FAQ");
      return [];
    }

    const res = await fetch(
      `https://docs.google.com/document/d/${docId}/export?format=md`,
      { next: { revalidate: 600 } },
    );

    // A private doc redirects to a Google sign-in page (HTML) instead of failing.
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || contentType.includes("text/html")) {
      console.error(
        `Error fetching FAQ from Google Docs (status ${res.status}). Is the doc shared as "Anyone with the link can view"?`,
      );
      return [];
    }

    return parseFaqMarkdown(await res.text());
  } catch (error) {
    console.error("Error fetching FAQ from Google Docs:", error);
    return [];
  }
}
