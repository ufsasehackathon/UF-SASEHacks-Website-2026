import { expect, test } from "@playwright/test";
import { sql } from "./support";

test("home page renders with a Login link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Login" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
});

test("mailing list signup", async ({ page }) => {
  const email = `fan-${Date.now()}@example.com`;
  await page.goto("/");
  await page.getByLabel("Email address").fill(email.toUpperCase());
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByText("Thanks! We'll keep you posted.")).toBeVisible();
  expect(await sql(`select 1 from public.mailing_list where email = $1`, [email])).toHaveLength(1);
});

test("FAQ API degrades to an empty list without a doc", async ({ request }) => {
  const res = await request.get("/api/faq");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual([]);
});
