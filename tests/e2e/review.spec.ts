import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createUser, getRegistration, setRegistration, signIn, sql } from "./support";

// Sequential: the owner test counts every queued decision, so this file's tests can't overlap.
// (No other spec queues decisions.) Actual sending is covered by the action tests: e2e has no Resend key.
test.describe.configure({ mode: "default" });

/** A hacker with a submitted (pending) application and a recognizable name/school */
async function pendingHacker(name: string, school = "University of Florida") {
  const user = await createUser({ firstName: name });
  await sql(`update public.profiles set full_name = $2, school = $3 where id = $1`, [user.id, name, school]);
  await setRegistration(user.id, { status: "pending", submitted_at: new Date().toISOString() });
  return user;
}

async function queued(userIds: string[]) {
  const rows = await sql<{ user_id: string; decision: string }>(
    `select user_id, decision from public.pending_decisions where user_id = any($1::uuid[])`,
    [userIds]
  );
  return Object.fromEntries(rows.map(r => [r.user_id, r.decision]));
}

const row = (page: Page, name: string) => page.getByTestId("applicant-row").filter({ hasText: name });

test("staff accept and reject; the hacker still sees \"Application received\"", async ({ page, context, browser, baseURL }) => {
  const tag = randomUUID().slice(0, 6);
  const nameA = `Ana ${tag}`;
  const nameB = `Ben ${tag}`;
  const a = await pendingHacker(nameA);
  const b = await pendingHacker(nameB);
  const staff = await createUser({ role: "staff" });
  await signIn(context, staff, baseURL!);

  await page.goto("/staff/applications");
  await page.getByLabel("Search applicants").fill(tag);
  await expect(row(page, nameA)).toBeVisible();
  await expect(row(page, nameB)).toBeVisible();

  // Accept A (no confirmation); it leaves the default Pending view
  await row(page, nameA).getByRole("button", { name: "Accept", exact: true }).click();
  await expect(row(page, nameA)).toHaveCount(0);

  // Reject B: the confirm names them
  let message = "";
  page.once("dialog", d => {
    message = d.message();
    void d.accept();
  });
  await row(page, nameB).getByRole("button", { name: "Reject", exact: true }).click();
  await expect(row(page, nameB)).toHaveCount(0);
  expect(message).toBe(`Reject 1 applicant? ${nameB}\n\nThey won't be told until an owner sends decisions.`);

  await page.getByLabel("Show").selectOption("all");
  await expect(row(page, nameA)).toContainText("Accepted · not sent");
  await expect(row(page, nameB)).toContainText("Rejected · not sent");
  expect(await queued([a.id, b.id])).toEqual({ [a.id]: "accepted", [b.id]: "rejected" });

  // Undo A, then accept again
  await row(page, nameA).getByRole("button", { name: "Undo" }).click();
  await expect(row(page, nameA)).toContainText("Pending");
  expect(await queued([a.id])).toEqual({});
  await row(page, nameA).getByRole("button", { name: "Accept", exact: true }).click();
  await expect(row(page, nameA)).toContainText("Accepted · not sent");

  // Unsent: nothing changed for the hacker
  expect((await getRegistration(a.id))?.status).toBe("pending");
  const hackerContext = await browser.newContext();
  await signIn(hackerContext, a, baseURL!);
  const hackerPage = await hackerContext.newPage();
  await hackerPage.goto("/portal");
  await expect(hackerPage.getByRole("heading", { name: "Application received" })).toBeVisible();
  await hackerContext.close();
});

test("bulk select-all accepts only visible rows", async ({ page, context, baseURL }) => {
  const tag = randomUUID().slice(0, 6);
  const one = await pendingHacker(`Cam ${tag}`, "UCF");
  const two = await pendingHacker(`Dee ${tag}`, "FSU");
  const three = await pendingHacker(`Eli ${tag}`, "USF");
  const staff = await createUser({ role: "staff" });
  await signIn(context, staff, baseURL!);

  await page.goto("/staff/applications");
  await page.getByLabel("Search applicants").fill(`Dee ${tag}`);
  await expect(page.getByTestId("applicant-row")).toHaveCount(1);

  await page.getByLabel("Select all").check();
  await expect(page.getByText("1 selected")).toBeVisible();
  await page.getByRole("button", { name: "Accept 1" }).click();
  await expect(page.getByTestId("applicant-row")).toHaveCount(0);

  expect(await queued([one.id, two.id, three.id])).toEqual({ [two.id]: "accepted" });
});

test("owner sees the Send decisions bar; staff don't", async ({ page, context, browser, baseURL }) => {
  await sql(`delete from public.pending_decisions`);
  const hacker = await pendingHacker(`Fay ${randomUUID().slice(0, 6)}`);
  await sql(`insert into public.pending_decisions (user_id, decision) values ($1, 'accepted')`, [hacker.id]);

  const owner = await createUser({ role: "owner" });
  await signIn(context, owner, baseURL!);
  await page.goto("/staff/applications");
  await expect(page.getByText("1 accepted, 0 rejected")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send decisions" })).toBeEnabled();

  const staffContext = await browser.newContext();
  await signIn(staffContext, await createUser({ role: "staff" }), baseURL!);
  const staffPage = await staffContext.newPage();
  await staffPage.goto("/staff/applications");
  await expect(staffPage.getByRole("searchbox", { name: "Search applicants" })).toBeVisible();
  await expect(staffPage.getByRole("button", { name: "Send decisions" })).toHaveCount(0);
  await staffContext.close();
});
