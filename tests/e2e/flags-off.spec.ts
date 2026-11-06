import { expect, test } from "@playwright/test";
import { createUser, getRegistration, signIn } from "./support";

// Runs against the server started with NEXT_PUBLIC_LOGIN_ENABLED / REGISTRATIONS_ENABLED off
// (production before launch).

test("no Login link on the home page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Login" })).toHaveCount(0);
});

test("the portal says applications are closed", async ({ page, context, baseURL }) => {
  const user = await createUser();
  await signIn(context, user, baseURL!);
  await page.goto("/portal");
  await expect(page.getByText("Applications are closed")).toBeVisible();
  await expect(page.getByRole("link", { name: "Join the mailing list for next year" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Apply", exact: true })).toHaveCount(0);
});

test("the application form is disabled and doesn't start an application", async ({ page, context, baseURL }) => {
  const user = await createUser();
  await signIn(context, user, baseURL!);
  await page.goto("/portal/onboarding");
  await expect(page.getByText("Applications Closed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Application" })).toBeDisabled();
  expect(await getRegistration(user.id)).toBeUndefined();
});
