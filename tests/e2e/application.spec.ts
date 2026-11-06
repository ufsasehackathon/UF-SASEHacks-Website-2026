import { expect, test } from "@playwright/test";
import path from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { createUser, getRegistration, setRegistration, signIn, sql } from "./support";

test.describe.configure({ mode: "parallel" });

function resumeFile(dir: string) {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "resume.pdf");
  writeFileSync(file, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  return file;
}

test("a new hacker sees Apply and 'Not started'", async ({ page, context, baseURL }) => {
  const user = await createUser({ profile: false });
  await signIn(context, user, baseURL!);
  await page.goto("/portal");
  await expect(page.getByText("Apply to SASEHacks")).toBeVisible();
  await expect(page.getByText("Status: Not started")).toBeVisible();
  await expect(page.getByRole("link", { name: "Apply", exact: true })).toBeVisible();
  expect(await getRegistration(user.id)).toBeUndefined();
});

test("profile and resume pages need a started application", async ({ page, context, baseURL }) => {
  const user = await createUser();
  await signIn(context, user, baseURL!);
  for (const p of ["/portal/profile", "/portal/resume"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/portal$/);
  }
});

test("submitting a blank application shows field errors and saves nothing", async ({ page, context, baseURL }) => {
  const user = await createUser({ profile: false });
  await signIn(context, user, baseURL!);
  await page.goto("/portal/onboarding");
  await expect(page.getByLabel("Email *")).toHaveValue(user.email);
  await page.getByRole("button", { name: "Submit Application" }).click();

  for (const msg of [
    "Please enter your first name",
    "Please select your age",
    "Please select your graduation year",
    "Please select your level of study",
    "Please select your skill level",
    "Please select how many hackathons you've attended",
  ]) {
    await expect(page.getByText(msg)).toBeVisible();
  }
  expect((await getRegistration(user.id))?.status).toBe("draft");
});

test("full application: fill, upload, submit", async ({ page, context, baseURL }, testInfo) => {
  const user = await createUser({ profile: false });
  await signIn(context, user, baseURL!);
  await page.goto("/portal");
  await page.getByRole("link", { name: "Apply", exact: true }).click();
  await expect(page).toHaveURL(/\/portal\/onboarding$/);

  await page.getByLabel("First Name *").fill("Ada");
  await page.getByLabel("Last Name *").fill("Lovelace");
  await page.getByLabel("Phone Number *").fill("3525551234");
  await page.getByLabel("Age *").selectOption("20");
  await page.getByLabel("LinkedIn URL *").fill("https://www.linkedin.com/in/ada");

  await page.getByPlaceholder("Start typing your school name...").fill("University of Flor");
  await page.getByRole("button", { name: "University of Florida", exact: true }).click();
  await page.getByLabel("Graduation Year *").selectOption("2027");
  await page.getByLabel("Level of Study *").selectOption({ index: 1 });
  await page.getByLabel("Engineering Skill Level *").selectOption({ index: 1 });
  await page.getByLabel("Hackathon Experience *").selectOption({ index: 1 });

  await page.getByPlaceholder("Start typing your country...").fill("United St");
  await page.getByRole("button", { name: "United States", exact: true }).click();

  await page.locator('input[type="file"]').setInputFiles(resumeFile(testInfo.outputPath()));
  await page.locator("textarea").first().fill("A robot that sorts recycling.");

  for (const consent of ["MLH Code of Conduct *", "MLH Data Sharing *", "Accuracy Agreement *", "Terms and Conditions *", "Code of Conduct *"]) {
    await page.getByLabel(consent, { exact: false }).first().check();
  }

  await page.getByRole("button", { name: "Submit Application" }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText("Application received")).toBeVisible();

  const reg = await getRegistration(user.id);
  expect(reg).toMatchObject({ status: "pending", resume_url: `${user.id}/resume.pdf` });
  expect(reg?.responses).toMatchObject({ build_or_learn: "A robot that sorts recycling." });
  const [profile] = await sql(`select first_name, school, country, full_name from public.profiles where id = $1`, [user.id]);
  expect(profile).toEqual({ first_name: "Ada", school: "University of Florida", country: "United States", full_name: "Ada Lovelace" });

  // The form is gone once submitted
  await page.goto("/portal/onboarding");
  await expect(page).toHaveURL(/\/portal$/);
});

test("a submit that failed partway shows 'Continue application' and the checklist", async ({ page, context, baseURL }) => {
  const user = await createUser();
  await setRegistration(user.id, { resume_url: null, accuracy_agreement: false });
  await signIn(context, user, baseURL!);
  await page.goto("/portal");
  await expect(page.getByText("Finish your application")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue application" })).toBeVisible();
  await expect(page.getByText("○ Profile")).toBeVisible();
  await expect(page.getByText("○ Agreements")).toBeVisible();
  await expect(page.getByText("○ Resume")).toBeVisible();
});

test("a locked profile is read-only", async ({ page, context, baseURL }) => {
  const user = await createUser();
  await setRegistration(user.id, { status: "pending", editing_locked: true });
  await signIn(context, user, baseURL!);
  await page.goto("/portal/profile");
  await expect(page.getByText("Editing is locked")).toBeVisible();
  await expect(page.getByLabel("First Name *")).toBeDisabled();
});

for (const [status, title] of [
  ["pending", "Application received"],
  ["waitlist", "You're on the waitlist"],
  ["rejected", "Thank you for applying"],
  ["declined", "Spot released"],
] as const) {
  test(`portal card for ${status}`, async ({ page, context, baseURL }) => {
    const user = await createUser();
    await setRegistration(user.id, { status, submitted_at: new Date().toISOString() });
    await signIn(context, user, baseURL!);
    await page.goto("/portal");
    await expect(page.getByText(title)).toBeVisible();
    const mailingList = page.getByRole("link", { name: "Join the mailing list for next year" });
    if (status === "declined" || status === "rejected") await expect(mailingList).toHaveAttribute("href", "/#mailing-list");
    else await expect(mailingList).toHaveCount(0);
  });
}
