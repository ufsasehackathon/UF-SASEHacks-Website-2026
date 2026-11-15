import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createUser, signIn, sql } from "./support";
import type { TestUser } from "../helpers/users";

// Sequential: projects are global (the import numbers tables after the current max), so this
// file's tests can't overlap. No other spec touches projects.
test.describe.configure({ mode: "default" });

test.beforeEach(async () => {
  await sql(`delete from public.projects`); // assignments go with them
});

// "Assign judges" spreads work over every judge, so judges never outlive their test (roles.spec
// does the same with its judge)
const judgeIds: string[] = [];
test.afterEach(async () => {
  if (judgeIds.length) await sql(`delete from public.user_roles where role = 'judge' and user_id = any($1)`, [judgeIds.splice(0)]);
});

/** A judge with a recognizable name */
async function judge(name: string) {
  const user = await createUser({ role: "judge" });
  judgeIds.push(user.id);
  await sql(`update public.profiles set full_name = $2 where id = $1`, [user.id, name]);
  return user;
}

const judgeCount = async () => (await sql<{ n: number }>(`select count(*)::int as n from public.user_roles where role = 'judge'`))[0].n;

const projectRow = (page: Page, title: string) => page.getByTestId("project-row").filter({ hasText: title });

async function judgePage(browser: Browser, user: TestUser, baseURL: string) {
  const context = await browser.newContext();
  await signIn(context, user, baseURL);
  const page = await context.newPage();
  await page.goto("/judge");
  return page;
}

async function signInStaff(page: Page, context: Parameters<typeof signIn>[0], baseURL: string) {
  await signIn(context, await createUser({ role: "staff" }), baseURL);
  await page.goto("/staff/judging");
}

test("staff import the CSV, assign judges, judges see their projects", async ({ page, context, browser, baseURL }) => {
  const suffix = randomUUID().slice(0, 6);
  const judges = [await judge(`Ada ${suffix}`), await judge(`Ben ${suffix}`), await judge(`Cy ${suffix}`)];
  await signInStaff(page, context, baseURL!);

  await page.getByLabel("Devpost CSV").setInputFiles("tests/fixtures/devpost-submissions.csv");
  await page.getByRole("button", { name: "Import CSV" }).click();
  await expect(page.getByText("Imported 3 new, 0 updated, 1 drafts skipped.")).toBeVisible();
  await expect(page.getByTestId("project-row")).toHaveCount(3);
  await expect(projectRow(page, "Half Baked")).toHaveCount(0);

  // Another spec's judge (roles.spec) may exist for a few seconds; retry until only these three were assigned
  await expect(async () => {
    await sql(`delete from public.judge_assignments`);
    await expect.poll(judgeCount, { timeout: 30_000 }).toBe(3);
    await page.reload();
    await page.getByRole("button", { name: "Assign judges" }).click();
    await expect(page.getByText("Added 9 assignments. Each judge has 3 projects.")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  for (const title of ["Gator Grub", "Swamp Sense", "Turlington Tunes"]) {
    await expect(projectRow(page, title).getByTestId("judge-chip")).toHaveCount(3);
  }

  const jp = await judgePage(browser, judges[0], baseURL!);
  await expect(jp.getByRole("heading", { name: "Judge Dashboard" })).toBeVisible();
  const items = jp.getByTestId("judge-project");
  await expect(items).toHaveCount(3);
  const expected = [
    ["1", "Gator Grub", "https://devpost.com/software/gator-grub"],
    ["2", "Swamp Sense", "https://devpost.com/software/swamp-sense"],
    ["3", "Turlington Tunes", "https://devpost.com/software/turlington-tunes"],
  ];
  for (const [i, [table, title, url]] of expected.entries()) {
    const item = items.nth(i);
    await expect(item.getByRole("cell").first()).toHaveText(table);
    await expect(item).toContainText(title);
    const link = item.getByRole("link", { name: "Open on Devpost" });
    await expect(link).toHaveAttribute("href", url);
    await expect(link).toHaveAttribute("target", "_blank");
  }
  await jp.context().close();
});

test("staff edit a table number and move a judge", async ({ page, context, browser, baseURL }) => {
  const name = `Dee ${randomUUID().slice(0, 6)}`;
  const ada = await judge(name);
  const [gator, swamp] = await sql<{ id: string }>(
    `insert into public.projects (title, devpost_url, table_number) values
       ('Gator Grub', 'https://devpost.com/software/gator-grub', 1),
       ('Swamp Sense', 'https://devpost.com/software/swamp-sense', 2),
       ('Turlington Tunes', 'https://devpost.com/software/turlington-tunes', 3)
     returning id`
  );
  await sql(`insert into public.judge_assignments (judge_id, project_id) values ($1, $2), ($1, $3)`, [ada.id, gator.id, swamp.id]);
  await signInStaff(page, context, baseURL!);

  // Table 2 -> 9 moves Swamp Sense to the end
  const table = page.getByLabel("Table number for Swamp Sense");
  await table.fill("9");
  await table.press("Enter");
  await expect(page.getByTestId("project-row").last()).toContainText("Swamp Sense");
  await expect(page.getByLabel("Table number for Swamp Sense")).toHaveValue("9");
  expect((await sql<{ table_number: number }>(`select table_number from public.projects where id = $1`, [swamp.id]))[0].table_number).toBe(9);

  // Take the judge off Gator Grub
  const gatorRow = projectRow(page, "Gator Grub");
  await gatorRow.getByRole("button", { name: `Remove ${name}` }).click();
  await expect(gatorRow.getByTestId("judge-chip")).toHaveCount(0);

  const jp = await judgePage(browser, ada, baseURL!);
  const items = jp.getByTestId("judge-project");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Swamp Sense");
  await expect(items.first().getByRole("cell").first()).toHaveText("9");

  // ...and put them back
  await gatorRow.getByLabel("Add judge to Gator Grub").selectOption({ label: name });
  await expect(gatorRow.getByTestId("judge-chip")).toHaveText([new RegExp(name)]);

  await jp.reload();
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Gator Grub");
  await expect(items.nth(0).getByRole("cell").first()).toHaveText("1");
  await expect(items.nth(1)).toContainText("Swamp Sense");
  await jp.context().close();
});

test("judge with no assignments sees the empty state", async ({ page, context, baseURL }) => {
  await signIn(context, await judge(`Eve ${randomUUID().slice(0, 6)}`), baseURL!);
  await page.goto("/judge");
  await expect(page.getByRole("heading", { name: "Judge Dashboard" })).toBeVisible();
  await expect(page.getByText("No projects assigned yet.")).toBeVisible();
  await expect(page.getByTestId("judge-project")).toHaveCount(0);
});
