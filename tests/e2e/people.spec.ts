import { expect, test } from "@playwright/test";
import { createUser, dashboardLink, signIn, sql } from "./support";

// judging.spec waits until the only judges are its own (assignment spreads over every judge),
// so don't leave this file's judge behind
const created: string[] = [];
test.afterEach(async () => {
  if (created.length) await sql(`delete from public.user_roles where role = 'judge' and user_id = any($1)`, [created.splice(0)]);
});

test("owner makes a user a judge and they get the judge dashboard", async ({ page, context, browser, baseURL }) => {
  const hacker = await createUser({ firstName: "Juniper" });
  created.push(hacker.id);
  await signIn(context, await createUser({ role: "owner" }), baseURL!);

  await page.goto("/staff/people");
  await expect(page.getByText("People must sign in once before they appear here.")).toBeVisible();
  const holders = page.getByRole("table", { name: "Current roles" });
  await expect(holders.getByText(hacker.email)).toHaveCount(0);

  await page.getByLabel("Search people").fill(hacker.email);
  const result = page.getByRole("table", { name: "Search results" }).getByTestId("person-row");
  await expect(result).toHaveCount(1);
  await expect(result).toContainText(hacker.email);
  const select = result.getByLabel("Role for Juniper");
  await expect(select).toHaveValue("hacker");
  await select.selectOption({ label: "Judge" });

  // saved: they now show up with the role holders
  const holderRow = holders.getByTestId("person-row").filter({ hasText: hacker.email });
  await expect(holderRow.getByLabel("Role for Juniper")).toHaveValue("judge");
  await expect.poll(async () => (await sql(`select role from public.user_roles where user_id = $1`, [hacker.id]))[0]?.role).toBe("judge");

  // signed in as them, the Dashboard link goes to /judge
  const judgeContext = await browser.newContext();
  await signIn(judgeContext, hacker, baseURL!);
  const judgePage = await judgeContext.newPage();
  await judgePage.goto("/");
  await expect(dashboardLink(judgePage)).toHaveAttribute("href", "/judge");
  await dashboardLink(judgePage).click();
  await expect(judgePage).toHaveURL(/\/judge$/);
  await judgeContext.close();
});
