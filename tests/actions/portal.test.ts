import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RedirectError, actAs, revalidatePath } from "../helpers/next";
import { serviceClient, sql } from "../helpers/db";
import {
  accept,
  createUser,
  getProfile,
  getRegistration,
  linkDiscord,
  setRegistration,
  type TestUser,
} from "../helpers/users";
import { consentForm, fileForm, profileForm, withConsents } from "../helpers/forms";
import { pdfFile } from "../helpers/fixtures";
import { APPLICATION_QUESTIONS } from "@/lib/validation";

vi.mock("@/lib/supabase/server", async () => (await import("../helpers/next")).nextMocks.server);
vi.mock("next/cache", async () => (await import("../helpers/next")).nextMocks.cache);
vi.mock("next/navigation", async () => (await import("../helpers/next")).nextMocks.navigation);

const portal = await import("@/app/portal/actions");
const resume = await import("@/app/portal/resume/actions");

const QUESTION = APPLICATION_QUESTIONS[0].id;

function answersForm(answer: string) {
  const fd = new FormData();
  for (const q of APPLICATION_QUESTIONS) fd.set(q.id, q.id === QUESTION ? answer : "An answer");
  return fd;
}

/** Route Resend calls to a mock; everything else (Supabase) goes to the real network */
function mockResend(response: () => Response = () => new Response("{}", { status: 200 })) {
  const realFetch = globalThis.fetch;
  const resend = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => response());
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).startsWith("https://api.resend.com") ? resend(String(input), init!) : realFetch(input, init)
  );
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "SASEHacks <team@sasehacks.com>");
  return resend;
}

beforeEach(() => {
  revalidatePath.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  actAs(null);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("signed out", () => {
  const form = () => withConsents(profileForm());

  it.each([
    ["upsertProfile", () => portal.upsertProfile(null, form())],
    ["saveRegistrationFlags", () => portal.saveRegistrationFlags(null, form())],
    ["upsertProfileAndConsents", () => portal.upsertProfileAndConsents(null, form())],
    ["uploadResumeOnboarding", () => portal.uploadResumeOnboarding(fileForm(pdfFile()))],
    ["saveResponses", () => portal.saveResponses(answersForm("hi"))],
    ["submitApplication", () => portal.submitApplication()],
    ["rsvp", () => portal.rsvp(true)],
    ["uploadResume", () => resume.uploadResume(fileForm(pdfFile()))],
  ] as const)("%s returns Not authenticated", async (_, call) => {
    actAs(null);
    expect(await call()).toEqual({ ok: false, error: "Not authenticated" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("ensureRows reports not_authenticated", async () => {
    expect(await portal.ensureRows({ withRegistration: true })).toEqual({ ok: false, reason: "not_authenticated" });
  });

  it("getSignedResumeUrl returns no URL", async () => {
    expect(await resume.getSignedResumeUrl()).toEqual({ url: null });
  });
});

describe("ensureRows", () => {
  let user: TestUser;
  beforeEach(async () => {
    user = await createUser({ profile: false });
    actAs(user);
  });

  it("creates the profile from the auth email, without a registration", async () => {
    expect(await portal.ensureRows()).toEqual({ ok: true });
    expect(await getProfile(user.id)).toMatchObject({ email: user.email, first_name: "", dietary: [] });
    expect(await getRegistration(user.id)).toBeUndefined();
  });

  it("creates a draft registration when starting an application", async () => {
    await portal.ensureRows({ withRegistration: true });
    expect(await getRegistration(user.id)).toMatchObject({ status: "draft", editing_locked: false });
  });

  it("is idempotent and doesn't overwrite saved answers", async () => {
    await portal.ensureRows({ withRegistration: true });
    await sql(`update public.profiles set first_name = 'Ada' where id = $1`, [user.id]);
    await sql(`update public.registrations set status = 'pending' where user_id = $1`, [user.id]);
    expect(await portal.ensureRows({ withRegistration: true })).toEqual({ ok: true });
    expect((await getProfile(user.id))?.first_name).toBe("Ada");
    expect((await getRegistration(user.id))?.status).toBe("pending");
  });

  it("copies a linked Discord account onto the profile", async () => {
    await portal.ensureRows();
    await linkDiscord(user.id, "linked_later");
    await portal.ensureRows();
    expect((await getProfile(user.id))?.discord_username).toBe("linked_later");
  });

  it("doesn't make staff or judges applicants", async () => {
    const staff = await createUser({ role: "staff" });
    actAs(staff);
    await portal.ensureRows();
    expect(await getRegistration(staff.id)).toBeUndefined();
  });
});

describe("upsertProfile", () => {
  let user: TestUser;
  beforeEach(async () => {
    user = await createUser();
    await setRegistration(user.id);
    actAs(user);
  });

  it("saves a valid profile and builds full_name", async () => {
    const result = await portal.upsertProfile(null, profileForm({ first_name: "Grace", last_name: "Hopper", race: ["asian-indian"], dietary: ["vegan", "halal"] }));
    expect(result).toEqual({ ok: true });
    expect(await getProfile(user.id)).toMatchObject({
      first_name: "Grace",
      last_name: "Hopper",
      full_name: "Grace Hopper",
      dietary: ["vegan", "halal"],
      race: ["asian-indian"],
      linkedin_url: "https://www.linkedin.com/in/ada",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/portal");
  });

  it("returns the first validation error and saves nothing", async () => {
    const before = await getProfile(user.id);
    const result = await portal.upsertProfile(null, profileForm({ age: "" }));
    expect(result).toEqual({ ok: false, error: "Please select your age" });
    expect(await getProfile(user.id)).toEqual(before);
  });

  it("rejects an option that isn't in the list (tampered form)", async () => {
    expect((await portal.upsertProfile(null, profileForm({ tshirt: "XXXXL" }))).ok).toBe(false);
  });

  it("fails while the application is locked", async () => {
    await setRegistration(user.id, { editing_locked: true });
    const result = await portal.upsertProfile(null, profileForm({ school: "Locked U" }));
    expect(result.ok).toBe(false);
    expect((await getProfile(user.id))?.school).not.toBe("Locked U");
  });

  it("fails when the email belongs to another profile", async () => {
    const other = await createUser();
    const result = await portal.upsertProfile(null, profileForm({ email: other.email }));
    expect(result.ok).toBe(false);
  });

  it("can't be used to set Discord fields", async () => {
    const fd = profileForm();
    fd.set("discord_id", "999");
    await portal.upsertProfile(null, fd);
    expect((await getProfile(user.id))?.discord_id).toBeNull();
  });
});

describe("saveRegistrationFlags", () => {
  let user: TestUser;
  beforeEach(async () => {
    user = await createUser();
    await setRegistration(user.id, {
      accuracy_agreement: false, terms_and_conditions: false, code_of_conduct: false, can_photograph: false,
      share_resume_with_companies: false, mlh_code_of_conduct: false, mlh_data_sharing: false, mlh_communications: false,
    });
    actAs(user);
  });

  it("saves checked and unchecked boxes", async () => {
    const result = await portal.saveRegistrationFlags(null, consentForm({ can_photograph: false, mlh_communications: false }));
    expect(result).toEqual({ ok: true });
    expect(await getRegistration(user.id)).toMatchObject({
      accuracy_agreement: true,
      code_of_conduct: true,
      mlh_data_sharing: true,
      can_photograph: false,
      mlh_communications: false,
    });
  });

  it("requires every required agreement", async () => {
    const result = await portal.saveRegistrationFlags(null, consentForm({ mlh_data_sharing: false }));
    expect(result).toEqual({ ok: false, error: "You must agree to share your data with MLH" });
    expect((await getRegistration(user.id))?.accuracy_agreement).toBe(false);
  });

  it("only counts the value \"on\" as checked", async () => {
    const fd = consentForm();
    fd.set("accuracy_agreement", "true");
    expect((await portal.saveRegistrationFlags(null, fd)).ok).toBe(false);
  });

  it("doesn't change a locked registration", async () => {
    await setRegistration(user.id, { editing_locked: true, can_photograph: false });
    await portal.saveRegistrationFlags(null, consentForm({ can_photograph: true }));
    expect((await getRegistration(user.id))?.can_photograph).toBe(false);
  });
});

describe("upsertProfileAndConsents", () => {
  let user: TestUser;
  beforeEach(async () => {
    user = await createUser();
    await setRegistration(user.id, { can_photograph: false });
    actAs(user);
  });

  it("saves both", async () => {
    const result = await portal.upsertProfileAndConsents(null, withConsents(profileForm({ school: "Both U" })));
    expect(result).toEqual({ ok: true });
    expect((await getProfile(user.id))?.school).toBe("Both U");
    expect((await getRegistration(user.id))?.can_photograph).toBe(true);
  });

  it("stops before consents when the profile is invalid", async () => {
    const result = await portal.upsertProfileAndConsents(null, withConsents(profileForm({ linkedin_url: "nope" })));
    expect(result.ok).toBe(false);
    expect((await getRegistration(user.id))?.can_photograph).toBe(false);
  });

  it("reports a missing consent after saving the profile", async () => {
    const result = await portal.upsertProfileAndConsents(null, withConsents(profileForm({ school: "Half U" }), { code_of_conduct: false }));
    expect(result).toEqual({ ok: false, error: "You must agree to the code of conduct" });
    expect((await getProfile(user.id))?.school).toBe("Half U");
  });
});

describe("resume actions", () => {
  let user: TestUser;
  beforeEach(async () => {
    user = await createUser();
    await setRegistration(user.id, { resume_url: null });
    actAs(user);
  });

  it("uploadResumeOnboarding stores the PDF and records the path", async () => {
    expect(await portal.uploadResumeOnboarding(fileForm(pdfFile()))).toEqual({ ok: true });
    expect((await getRegistration(user.id))?.resume_url).toBe(`${user.id}/resume.pdf`);
    const { data } = await serviceClient().storage.from("resumes").list(user.id);
    expect(data?.map(f => f.name)).toEqual(["resume.pdf"]);
  });

  it("uploadResumeOnboarding rejects a non-PDF", async () => {
    const fake = new File([new TextEncoder().encode("hello")], "resume.pdf", { type: "application/pdf" });
    expect((await portal.uploadResumeOnboarding(fileForm(fake))).ok).toBe(false);
    expect((await getRegistration(user.id))?.resume_url).toBeNull();
  });

  it("uploadResume redirects to the portal on success", async () => {
    await expect(resume.uploadResume(fileForm(pdfFile()))).rejects.toEqual(new RedirectError("/portal"));
    expect((await getRegistration(user.id))?.resume_url).toBe(`${user.id}/resume.pdf`);
  });

  it("uploadResume returns the error without redirecting", async () => {
    expect(await resume.uploadResume(new FormData())).toEqual({ ok: false, error: "No file provided" });
  });

  it("getSignedResumeUrl returns null without a resume", async () => {
    expect(await resume.getSignedResumeUrl()).toEqual({ url: null });
  });

  it("getSignedResumeUrl returns a working link to the user's own resume", async () => {
    await portal.uploadResumeOnboarding(fileForm(pdfFile()));
    const { url } = await resume.getSignedResumeUrl();
    expect(url).toBeTruthy();
    expect((await fetch(url!)).status).toBe(200);
  });

  it("getSignedResumeUrl can't be pointed at someone else's file", async () => {
    const other = await createUser();
    await setRegistration(other.id);
    actAs(other);
    await portal.uploadResumeOnboarding(fileForm(pdfFile()));
    actAs(user);
    // resume_url isn't a guarded column, so a hacker can point it anywhere; storage RLS still blocks the read
    await sql(`update public.registrations set resume_url = $1 where user_id = $2`, [`${other.id}/resume.pdf`, user.id]);
    expect(await resume.getSignedResumeUrl()).toEqual({ url: null });
  });
});

describe("saveResponses", () => {
  let user: TestUser;
  beforeEach(async () => {
    user = await createUser();
    await setRegistration(user.id, { responses: {} });
    actAs(user);
  });

  it("saves trimmed answers in draft", async () => {
    expect(await portal.saveResponses(answersForm("  build a robot  "))).toEqual({ ok: true });
    expect((await getRegistration(user.id))?.responses).toMatchObject({ [QUESTION]: "build a robot" });
  });

  it("keeps answers to questions that were removed from the form", async () => {
    await setRegistration(user.id, { responses: { retired_question: "old answer" } });
    await portal.saveResponses(answersForm("new"));
    expect((await getRegistration(user.id))?.responses).toMatchObject({ retired_question: "old answer", [QUESTION]: "new" });
  });

  it("ignores fields that aren't questions", async () => {
    const fd = answersForm("x");
    fd.set("status", "accepted");
    await portal.saveResponses(fd);
    expect(await getRegistration(user.id)).toMatchObject({ status: "draft" });
    expect((await getRegistration(user.id))?.responses).not.toHaveProperty("status");
  });

  it("requires required questions", async () => {
    expect(await portal.saveResponses(answersForm("   "))).toEqual({ ok: false, error: "This question is required" });
  });

  it("enforces maxLength", async () => {
    const max = APPLICATION_QUESTIONS[0].maxLength;
    expect((await portal.saveResponses(answersForm("x".repeat(max + 1)))).ok).toBe(false);
    expect((await portal.saveResponses(answersForm("x".repeat(max)))).ok).toBe(true);
  });

  it("refuses after submitting", async () => {
    await setRegistration(user.id, { status: "pending", responses: { [QUESTION]: "final" } });
    expect(await portal.saveResponses(answersForm("changed"))).toEqual({ ok: false, error: "Your answers can't be changed after you submit" });
    expect((await getRegistration(user.id))?.responses).toEqual({ [QUESTION]: "final" });
  });

  it("refuses without a registration", async () => {
    const fresh = await createUser();
    actAs(fresh);
    expect((await portal.saveResponses(answersForm("x"))).ok).toBe(false);
  });
});

describe("submitApplication", () => {
  let user: TestUser;
  beforeEach(async () => {
    user = await createUser({ firstName: "Ada" });
    await setRegistration(user.id);
    actAs(user);
  });

  it("submits and emails 'application received' to the profile email", async () => {
    await sql(`update public.profiles set email = 'ada.contact@example.com' where id = $1`, [user.id]);
    const resend = mockResend();
    expect(await portal.submitApplication()).toEqual({ ok: true });
    expect((await getRegistration(user.id))?.status).toBe("pending");

    expect(resend).toHaveBeenCalledTimes(1);
    const [email] = JSON.parse(resend.mock.calls[0][1].body as string);
    expect(email.to).toEqual(["ada.contact@example.com"]);
    expect(email.subject).toMatch(/We got your/);
    expect(email.html).toContain("Hi Ada,");
    expect((await getRegistration(user.id))?.last_emailed_status).toBe("pending");
    expect(revalidatePath).toHaveBeenCalledWith("/portal");
  });

  it("still succeeds when email isn't configured, leaving it unsent", async () => {
    expect(await portal.submitApplication()).toEqual({ ok: true });
    expect(await getRegistration(user.id)).toMatchObject({ status: "pending", last_emailed_status: null });
  });

  it("still succeeds when Resend fails, leaving it unsent", async () => {
    mockResend(() => new Response("down", { status: 500 }));
    expect(await portal.submitApplication()).toEqual({ ok: true });
    expect(await getRegistration(user.id)).toMatchObject({ status: "pending", last_emailed_status: null });
  });

  it("returns the database's reason when submission is refused", async () => {
    await setRegistration(user.id, { resume_url: null });
    const resend = mockResend();
    const result = await portal.submitApplication();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/resume is required/);
    expect(resend).not.toHaveBeenCalled();
  });

  it("refuses a second submission", async () => {
    await portal.submitApplication();
    expect((await portal.submitApplication()).error).toMatch(/already submitted/);
  });

  it("is blocked before reaching the database when registrations are switched off", async () => {
    vi.stubEnv("NEXT_PUBLIC_REGISTRATIONS_ENABLED", "false");
    vi.resetModules();
    // Fresh module instances, including the mock helper, so sign in again on the new copy
    (await import("../helpers/next")).actAs(user);
    const fresh = await import("@/app/portal/actions");
    expect(await fresh.submitApplication()).toEqual({ ok: false, error: "Applications are closed" });
    expect((await getRegistration(user.id))?.status).toBe("draft");
  });
});

describe("rsvp", () => {
  let user: TestUser;
  beforeEach(async () => {
    user = await createUser({ firstName: "Ada" });
    await accept(user.id);
    actAs(user);
  });

  it("confirms with Discord linked and sends the confirmation email", async () => {
    await linkDiscord(user.id);
    const resend = mockResend();
    expect(await portal.rsvp(true)).toEqual({ ok: true });
    expect((await getRegistration(user.id))).toMatchObject({ status: "confirmed", last_emailed_status: "confirmed" });
    expect(JSON.parse(resend.mock.calls[0][1].body as string)[0].subject).toMatch(/confirmed/);
  });

  it("returns the Discord error when not linked", async () => {
    const result = await portal.rsvp(true);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Discord/);
  });

  it("declines and sends the release email", async () => {
    const resend = mockResend();
    expect(await portal.rsvp(false)).toEqual({ ok: true });
    expect((await getRegistration(user.id))?.status).toBe("declined");
    expect(JSON.parse(resend.mock.calls[0][1].body as string)[0].subject).toMatch(/released/);
  });

  it("drop-out after confirming sends a second (decline) email", async () => {
    await linkDiscord(user.id);
    const resend = mockResend();
    await portal.rsvp(true);
    await portal.rsvp(false);
    expect(resend).toHaveBeenCalledTimes(2);
    expect((await getRegistration(user.id))?.last_emailed_status).toBe("declined");
  });
});
