import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFaqFromGoogleDoc, parseFaqMarkdown } from "@/lib/googleDocs";

describe("parseFaqMarkdown", () => {
  it("parses Q/A pairs across sections, stopping at Hidden", () => {
    const md = [
      "# General",
      "**Q: What is SASEHacks?**",
      "A: A 36-hour hackathon.",
      "",
      "More info here.",
      "",
      "## Logistics",
      "Q: Where is it?",
      "A: At [Harrell](https://example.com).",
      "* Parking is free",
      "* Bring ID",
      "",
      "Hidden",
      "Q: Draft question?",
      "A: Not ready",
    ].join("\n");

    expect(parseFaqMarkdown(md)).toEqual([
      {
        id: "what-is-sasehacks",
        question: "What is SASEHacks?",
        answer: "A 36-hour hackathon.\n\nMore info here.",
        order: 0,
      },
      {
        id: "where-is-it",
        question: "Where is it?",
        answer: "At [Harrell](https://example.com).\n• Parking is free\n• Bring ID",
        order: 1,
      },
    ]);
  });

  it("returns [] for empty or unrelated input", () => {
    expect(parseFaqMarkdown("")).toEqual([]);
    expect(parseFaqMarkdown("# Title\nJust some text\n")).toEqual([]);
  });

  it("drops a question that has no A: line", () => {
    const md = "Q: Unanswered?\n# Section\nQ: Answered?\nA: Yes";
    expect(parseFaqMarkdown(md).map(i => i.question)).toEqual(["Answered?"]);
  });

  it("joins a question that wraps onto the next line", () => {
    const md = "Q: Is this a very long\nquestion?\nA: Yes";
    expect(parseFaqMarkdown(md)[0].question).toBe("Is this a very long question?");
  });

  it("handles Q:/A: written as list items, CRLF line endings and markdown escapes", () => {
    const md = "* **Q: Is it free?**\r\n* A: Yes\\. It's free\\!\r\n";
    expect(parseFaqMarkdown(md)).toEqual([
      { id: "is-it-free", question: "Is it free?", answer: "Yes. It's free!", order: 0 },
    ]);
  });

  it("is case-insensitive for Q:/A:/Hidden", () => {
    const md = "q: Lower?\na: yes\nHIDDEN\nq: no\na: no";
    expect(parseFaqMarkdown(md)).toHaveLength(1);
  });

  it("gives duplicate questions unique ids", () => {
    const md = "Q: Same?\nA: one\nQ: Same?\nA: two";
    const ids = parseFaqMarkdown(md).map(i => i.id);
    expect(ids[0]).toBe("same");
    expect(new Set(ids).size).toBe(2);
  });

  it("falls back to a non-empty id when the question has no letters or digits", () => {
    expect(parseFaqMarkdown("Q: ???\nA: x")[0].id).toBe("faq");
  });
});

describe("fetchFaqFromGoogleDoc", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns [] without calling fetch when GOOGLE_FAQ_DOC_ID is unset", async () => {
    vi.stubEnv("GOOGLE_FAQ_DOC_ID", "");
    expect(await fetchFaqFromGoogleDoc()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the markdown export and parses it", async () => {
    vi.stubEnv("GOOGLE_FAQ_DOC_ID", "doc123");
    fetchMock.mockResolvedValue(new Response("Q: Hi?\nA: Hello", { headers: { "content-type": "text/markdown" } }));

    const items = await fetchFaqFromGoogleDoc();
    expect(fetchMock.mock.calls[0][0]).toBe("https://docs.google.com/document/d/doc123/export?format=md");
    expect(items).toEqual([{ id: "hi", question: "Hi?", answer: "Hello", order: 0 }]);
  });

  it("returns [] for a private doc (HTML sign-in page)", async () => {
    vi.stubEnv("GOOGLE_FAQ_DOC_ID", "doc123");
    fetchMock.mockResolvedValue(new Response("<html>Sign in</html>", { headers: { "content-type": "text/html; charset=utf-8" } }));
    expect(await fetchFaqFromGoogleDoc()).toEqual([]);
  });

  it("returns [] on an HTTP error", async () => {
    vi.stubEnv("GOOGLE_FAQ_DOC_ID", "doc123");
    fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));
    expect(await fetchFaqFromGoogleDoc()).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    vi.stubEnv("GOOGLE_FAQ_DOC_ID", "doc123");
    fetchMock.mockRejectedValue(new Error("network down"));
    expect(await fetchFaqFromGoogleDoc()).toEqual([]);
  });
});
