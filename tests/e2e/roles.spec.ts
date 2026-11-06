import { expect, test } from "@playwright/test";
import { createUser, signIn } from "./support";
import type { Role } from "@/lib/roles";
import { ROLE_HOME } from "@/lib/roles";

// Layout guards and the header's Dashboard link, per role.
const cases: { role: Role; allowed: string[]; blocked: string[]; title?: string }[] = [
  { role: "hacker", allowed: ["/portal"], blocked: ["/staff", "/judge"] },
  { role: "judge", allowed: ["/judge", "/portal"], blocked: ["/staff"], title: "Judge Dashboard" },
  { role: "staff", allowed: ["/staff", "/portal"], blocked: ["/judge"], title: "Staff Dashboard" },
  { role: "owner", allowed: ["/staff", "/judge", "/portal"], blocked: [], title: "Owner Dashboard" },
];

for (const { role, allowed, blocked, title } of cases) {
  test(`${role}: dashboard link, allowed and blocked pages`, async ({ page, context, baseURL }) => {
    const user = await createUser({ role });
    await signIn(context, user, baseURL!);

    await page.goto("/");
    const dashboard = page.getByRole("link", { name: "Dashboard" }).first();
    await expect(dashboard).toHaveAttribute("href", ROLE_HOME[role]);
    await dashboard.click();
    await expect(page).toHaveURL(new RegExp(`${ROLE_HOME[role]}$`));
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
