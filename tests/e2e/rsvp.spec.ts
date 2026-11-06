import { expect, test } from "@playwright/test";
import { accept, createUser, getRegistration, linkDiscord, signIn } from "./support";

test("accepted hacker connects Discord, confirms, then drops out", async ({ page, context, baseURL }) => {
  const user = await createUser();
  await accept(user.id);
  await signIn(context, user, baseURL!);

  await page.goto("/portal");
  await expect(page.getByText("You're in!")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Discord" })).toBeVisible();
  await expect(page.getByRole("button", { name: "I'm coming!" })).toBeDisabled();

  // Real Discord OAuth can't run here; link the identity directly, then the portal syncs it
  await linkDiscord(user.id, "gator_hacker");
  await page.reload();
  await expect(page.getByText("✓ Connected as gator_hacker")).toBeVisible();

  await page.getByRole("button", { name: "I'm coming!" }).click();
  await expect(page.getByText("See you there!")).toBeVisible();
  expect((await getRegistration(user.id))?.status).toBe("confirmed");

  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "I can't make it anymore" }).click();
  await expect(page.getByText("Spot released")).toBeVisible();
  expect((await getRegistration(user.id))?.status).toBe("declined");
});

test("cancelling the drop-out dialog keeps the spot", async ({ page, context, baseURL }) => {
  const user = await createUser();
  await accept(user.id);
  await linkDiscord(user.id);
  await signIn(context, user, baseURL!);
  await page.goto("/portal");
  await page.getByRole("button", { name: "I'm coming!" }).click();
  await expect(page.getByText("See you there!")).toBeVisible();

  page.once("dialog", d => d.dismiss());
  await page.getByRole("button", { name: "I can't make it anymore" }).click();
  await expect(page.getByText("See you there!")).toBeVisible();
  expect((await getRegistration(user.id))?.status).toBe("confirmed");
});

test("declining without Discord works", async ({ page, context, baseURL }) => {
  const user = await createUser();
  await accept(user.id);
  await signIn(context, user, baseURL!);
  await page.goto("/portal");
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "I can't make it", exact: true }).click();
  await expect(page.getByText("Spot released")).toBeVisible();
});

test("an overdue RSVP hides the buttons", async ({ page, context, baseURL }) => {
  const user = await createUser();
  await accept(user.id, new Date(Date.now() - 3600_000));
  await signIn(context, user, baseURL!);
  await page.goto("/portal");
  await expect(page.getByText("RSVP deadline passed")).toBeVisible();
  await expect(page.getByRole("button", { name: "I'm coming!" })).toHaveCount(0);
});
