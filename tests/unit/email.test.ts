import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmailBatch, statusEmail, type OutgoingEmail } from "@/lib/email";
import { registrationStatuses } from "@/lib/validation";

describe("statusEmail", () => {
  it.each(["pending", "confirmed", "declined"])("has a template for %s", status => {
    const email = statusEmail(status, { firstName: "Ada" });
    expect(email?.subject).toBeTruthy();
    expect(email?.html).toContain("Hi Ada,");
  });

  it.each(registrationStatuses.filter(s => !["pending", "confirmed", "declined"].includes(s)))(
    "returns null for %s (no hacker-triggered email)",
    status => {
      expect(statusEmail(status, { firstName: "Ada" })).toBeNull();
    }
  );

  it("returns null for an unknown status", () => {
    expect(statusEmail("nonsense", { firstName: null })).toBeNull();
  });

  it("greets generically when there's no first name", () => {
    expect(statusEmail("pending", { firstName: null })?.html).toContain("Hi there,");
    expect(statusEmail("pending", { firstName: "" })?.html).toContain("Hi there,");
  });

  it("escapes HTML in the first name", () => {
    const html = statusEmail("pending", { firstName: `<script>"x"&'y'</script>` })!.html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("Hi &lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;,");
  });
});

describe("sendEmailBatch", () => {
  const fetchMock = vi.fn();
  const email: OutgoingEmail = { to: "ada@example.com", subject: "Hi", html: "<p>Hi</p>" };

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "SASEHacks <team@sasehacks.com>");
    vi.stubEnv("EMAIL_REPLY_TO", "");
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is a no-op for an empty batch", async () => {
    expect(await sendEmailBatch([])).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["RESEND_API_KEY", "EMAIL_FROM"])("fails without calling Resend when %s is missing", async name => {
    vi.stubEnv(name, "");
    const result = await sendEmailBatch([email]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses more than 100 emails", async () => {
    const result = await sendEmailBatch(Array.from({ length: 101 }, () => email));
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the batch to Resend", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await sendEmailBatch([email, { ...email, to: "b@example.com" }])).toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails/batch");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body);
    expect(body).toEqual([
      { from: "SASEHacks <team@sasehacks.com>", to: ["ada@example.com"], subject: "Hi", html: "<p>Hi</p>" },
      { from: "SASEHacks <team@sasehacks.com>", to: ["b@example.com"], subject: "Hi", html: "<p>Hi</p>" },
    ]);
  });

  it("adds reply_to when EMAIL_REPLY_TO is set", async () => {
    vi.stubEnv("EMAIL_REPLY_TO", "organizers@sasehacks.com");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await sendEmailBatch([email]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0].reply_to).toBe("organizers@sasehacks.com");
  });

  it("reports a Resend HTTP error", async () => {
    fetchMock.mockResolvedValue(new Response("bad", { status: 422 }));
    expect(await sendEmailBatch([email])).toEqual({ ok: false, error: "Resend error 422" });
  });
});
