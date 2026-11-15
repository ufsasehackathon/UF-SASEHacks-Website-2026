import { expect, test } from "@playwright/test";
import { createUser, signIn, sql } from "./support";
import type { Role } from "@/lib/roles";
import { ROLE_HOME } from "@/lib/roles";

// Layout guards and the header's Dashboard link, per role.
// landing: where the Dashboard link ends up (/staff redirects to its first tab).
const cases: { role: Role; landing: RegExp; allowed: string[]; blocked: string[]; title?: string }[] = [
  { role: "hacker", landing: /\/portal$/, allowed: ["/portal"], blocked: ["/staff", "/judge"] },
  { role: "judge", landing: /\/judge$/, allowed: ["/judge", "/portal"], blocked: ["/staff"], title: "Judge Dashboard" },
  { role: "staff", landing: /\/staff\/applications$/, allowed: ["/staff/applications", "/portal"], blocked: ["/judge"], title: "Staff Dashboard" },
  { role: "owner", landing: /\/staff\/applications$/, allowed: ["/staff/applications", "/staff/people", "/judge", "/portal"], blocked: [], title: "Owner Dashboard" },
];

// judging.spec waits until the only judges are its own (assignment spreads over every judge),
// so don't leave this file's judge behind
const created: string[] = [];
test.afterEach(async () => {
  if (created.length) await sql(`delete from public.user_roles where role = 'judge' and user_id = any($1)`, [created.splice(0)]);
});

for (const { role, landing, allowed, blocked, title } of cases) {
  test(`${role}: dashboard link, allowed and blocked pages`, async ({ page, context, baseURL }) => {
    const user = await createUser({ role });
    created.push(user.id);
    await signIn(context, user, baseURL!);

    await page.goto("/");
    const dashboard = page.getByRole("link", { name: "Dashboard" }).first();
    await expect(dashboard).toHaveAttribute("href", ROLE_HOME[role]);
    await dashboard.click();
    await expect(page).toHaveURL(landing);
    if (title) await expect(page.getByRole("heading", { name: title })).toBeVisible();

    for (const p of allowed) {
      await page.goto(p);
      await expect(page).toHaveURL(new RegExp(`${p}$`));
    }
    for (const p of blocked) {
      await page.goto(p);
      await expect(page).toHaveURL(/\/portal$/);
    }
  });
}

test.describe("staff", () => {
  test("People tab is hidden and /staff/people redirects to /staff/applications", async ({ page, context, baseURL }) => {
    const user = await createUser({ role: "staff" });
    await signIn(context, user, baseURL!);

    await page.goto("/staff/applications");
    await expect(page.getByRole("link", { name: "Applications" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Check-in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Judging" })).toBeVisible();
    await expect(page.getByRole("link", { name: "People" })).toHaveCount(0);

    await page.goto("/staff/people");
    await expect(page).toHaveURL(/\/staff\/applications$/);
  });
});

test.describe("owner", () => {
  test("People tab is visible", async ({ page, context, baseURL }) => {
    const user = await createUser({ role: "owner" });
    await signIn(context, user, baseURL!);

    await page.goto("/staff/applications");
    const people = page.getByRole("link", { name: "People" });
    await expect(people).toBeVisible();
    await people.click();
    await expect(page).toHaveURL(/\/staff\/people$/);
    await expect(page.getByRole("link", { name: "People" })).toHaveAttribute("aria-current", "page");
  });
});
