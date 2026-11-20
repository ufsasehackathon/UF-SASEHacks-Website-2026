import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createUser, dashboardLink, latestEmailText, uniqueEmail } from "./support";

/** Request a magic link from /login (no ?next=) and follow it */
async function magicLinkLogin(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with Email" }).click();
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Send Magic Link" }).click();
  await expect(page.getByText("Magic link sent!")).toBeVisible();

  const text = await latestEmailText(email);
  const link = text.match(/https?:\/\/[^\s"'<>)\]]+verify[^\s"'<>)\]]+/)?.[0]?.replace(/&amp;/g, "&");
  expect(link, `no verify link in:\n${text}`).toBeTruthy();
  await page.goto(link!);
}

test("magic link login lands on the portal", async ({ page }) => {
  await magicLinkLogin(page, uniqueEmail("magic"));
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText("Apply to SASEHacks")).toBeVisible();
  await expect(dashboardLink(page)).toHaveAttribute("href", "/portal");
});

test("magic link login sends staff to their dashboard, not the portal", async ({ page }) => {
  const staff = await createUser({ role: "staff" });
  await magicLinkLogin(page, staff.email);
  await expect(page).toHaveURL(/\/staff\/applications$/);
});

test("signed-out visit to /portal goes to login without a next (the callback picks the dashboard by role)", async ({ page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/login$/);
});

for (const path of ["/staff", "/judge"]) {
  test(`signed-out visit to ${path} goes to login and remembers where`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/\//g, "%2F")}$`));
  });
}

test("the auth callback won't redirect off-site", async ({ page, baseURL }) => {
  await page.goto("/auth/callback?next=//example.com/phish");
  expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
});
