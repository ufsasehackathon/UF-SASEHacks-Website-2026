import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { accept, createUser, getRegistration, linkDiscord, setRegistration, signIn, sql } from "./support";

// Sequential: the counter and the waitlist are global (every check-in, the capacity setting), so
// this file's tests can't overlap. No other spec checks people in. application.spec leaves
// `waitlist` rows without `waitlisted_at` (sorted last), so waitlist counts are matched loosely.
test.describe.configure({ mode: "default" });

test.beforeEach(async () => {
  await sql(`delete from public.attendance where event_id = (select id from public.events where event_name = 'Check-in')`);
  await sql(`update public.settings set capacity = null`);
  // Leftovers from an earlier failed run (other specs' waitlist rows have no waitlisted_at)
  await sql(`update public.registrations set status = 'declined', waitlisted_at = null where status = 'waitlist' and waitlisted_at is not null`);
});

/** A hacker with a recognizable name; `discord` also sets the profile's Discord fields like sync_discord_profile does */
async function hacker(name: string, { discord = true } = {}) {
  const user = await createUser({ firstName: name });
  await sql(`update public.profiles set full_name = $2 where id = $1`, [user.id, name]);
  if (discord) {
    const { discordId, username } = await linkDiscord(user.id, `${name.split(" ")[0].toLowerCase()}_dc`);
    await sql(`update public.profiles set discord_id = $2, discord_username = $3 where id = $1`, [user.id, discordId, username]);
  }
  return user;
}

const result = (page: Page, name: string) => page.getByTestId("checkin-result").filter({ hasText: name });
const counter = (page: Page) => page.getByTestId("checkin-counter");
/** Counter text with no capacity set */
const checkedIn = (n: number) => new RegExp(`^${n} checked in · \\d+ on waitlist$`);

async function signInStaff(page: Page, context: Parameters<typeof signIn>[0], baseURL: string, role: "staff" | "owner" = "staff") {
  await signIn(context, await createUser({ role }), baseURL);
  await page.goto("/staff/checkin");
}

test("staff search and check in a confirmed hacker, then undo", async ({ page, context, baseURL }) => {
  const name = `Checky McCheck ${randomUUID().slice(0, 6)}`;
  const user = await hacker(name);
  await setRegistration(user.id, { status: "confirmed", submitted_at: new Date().toISOString() });
  await signInStaff(page, context, baseURL!);

  await expect(counter(page)).toHaveText(checkedIn(0));
  await page.getByLabel("Search people").fill(name);
  await expect(result(page, name)).toContainText("checky_dc");
  await result(page, name).getByRole("button", { name: "Check in" }).click();
  await expect(result(page, name)).toContainText("Checked in");
  await expect(counter(page)).toHaveText(checkedIn(1));

  await result(page, name).getByRole("button", { name: "Undo" }).click();
  await expect(result(page, name).getByRole("button", { name: "Check in" })).toBeVisible();
  await expect(counter(page)).toHaveText(checkedIn(0));
});

test("accepted no-RSVP goes to the waitlist and gets admitted", async ({ page, context, baseURL }) => {
  const name = `Wally Waits ${randomUUID().slice(0, 6)}`;
  const user = await hacker(name);
  await accept(user.id); // includes every consent
  await signInStaff(page, context, baseURL!);

  await page.getByLabel("Search people").fill(name);
  await result(page, name).getByRole("button", { name: "Add to waitlist" }).click();
  await expect(result(page, name)).toContainText("Waitlist #1");
  await expect(counter(page)).toHaveText(checkedIn(0));

  await page.getByRole("link", { name: /^Waitlist \(\d+\)$/ }).click();
  await expect(page).toHaveURL(/view=waitlist/);
  const row = page.getByTestId("waitlist-row").filter({ hasText: name });
  await expect(row.getByRole("cell").first()).toHaveText("1");
  await row.getByRole("button", { name: "Admit & check in" }).click();
  await expect(row).toHaveCount(0);
  await expect(counter(page)).toHaveText(checkedIn(1));
  expect((await getRegistration(user.id))?.status).toBe("confirmed");
});

test("removing someone from the waitlist asks first", async ({ page, context, baseURL }) => {
  const name = `Rémy Leaves ${randomUUID().slice(0, 6)}`;
  const user = await hacker(name);
  await setRegistration(user.id, { status: "waitlist", waitlisted_at: new Date().toISOString() });
  await signInStaff(page, context, baseURL!);
  await page.goto("/staff/checkin?view=waitlist");

  const row = page.getByTestId("waitlist-row").filter({ hasText: name });
  page.once("dialog", d => void d.dismiss());
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(row).toBeVisible();
  expect((await getRegistration(user.id))?.status).toBe("waitlist");

  page.once("dialog", d => void d.accept());
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(row).toHaveCount(0);
  expect((await getRegistration(user.id))?.status).toBe("declined");
});

test('no Discord shows "Link Discord first"', async ({ page, context, baseURL }) => {
  const name = `Nodi Scord ${randomUUID().slice(0, 6)}`;
  const user = await hacker(name, { discord: false });
  await accept(user.id);
  await signInStaff(page, context, baseURL!);

  await page.getByLabel("Search people").fill(name);
  await expect(result(page, name)).toContainText("Discord not linked");
  await expect(result(page, name).getByRole("button", { name: "Link Discord first" })).toBeDisabled();
  await expect(result(page, name).getByRole("button", { name: "Add to waitlist" })).toHaveCount(0);
});

test("owner sets capacity; staff see no capacity editor", async ({ page, context, browser, baseURL }) => {
  await signInStaff(page, context, baseURL!, "owner");
  await page.getByLabel("Capacity").fill("150");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(counter(page)).toHaveText(/^0 checked in \/ 150 capacity · \d+ on waitlist · 150 spots open$/);
  expect((await sql<{ capacity: number }>(`select capacity from public.settings`))[0].capacity).toBe(150);

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await signInStaff(staffPage, staffContext, baseURL!);
  await expect(counter(staffPage)).toContainText("/ 150 capacity");
  await expect(staffPage.getByLabel("Capacity")).toHaveCount(0);
  await staffContext.close();
});
