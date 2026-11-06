import { expect, test } from "@playwright/test";
import { dashboardLink, latestEmailText, uniqueEmail } from "./support";

test("magic link login lands on the portal", async ({ page }) => {
  const email = uniqueEmail("magic");
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with Email" }).click();
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Send Magic Link" }).click();
  await expect(page.getByText("Magic link sent!")).toBeVisible();

  const text = await latestEmailText(email);
  const link = text.match(/https?:\/\/[^\s"'<>)\]]+verify[^\s"'<>)\]]+/)?.[0]?.replace(/&amp;/g, "&");
  expect(link, `no verify link in:\n${text}`).toBeTruthy();

  await page.goto(link!);
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByText("Apply to SASEHacks")).toBeVisible();
  await expect(dashboardLink(page)).toHaveAttribute("href", "/portal");
});

for (const path of ["/portal", "/staff", "/judge"]) {
  test(`signed-out visit to ${path} goes to login and remembers where`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/\//g, "%2F")}$`));
  });
}

test("the auth callback won't redirect off-site", async ({ page, baseURL }) => {
  await page.goto("/auth/callback?next=//example.com/phish");
  expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
});
