import { beforeAll, describe, expect, it } from "vitest";
import { anonClient } from "../helpers/db";
import { createUser, type TestUser } from "../helpers/users";
import { pdfBytes } from "../helpers/fixtures";

// Storage policies on the private `resumes` bucket.

let hacker: TestUser, other: TestUser, staff: TestUser, owner: TestUser;

const upload = (user: TestUser | null, path: string) =>
  (user?.client ?? anonClient()).storage.from("resumes").upload(path, pdfBytes(), { contentType: "application/pdf", upsert: true });

const signedUrl = (user: TestUser, path: string) => user.client.storage.from("resumes").createSignedUrl(path, 60);

beforeAll(async () => {
  [hacker, other, staff, owner] = await Promise.all([
    createUser(),
    createUser(),
    createUser({ role: "staff" }),
    createUser({ role: "owner" }),
  ]);
});

describe("uploads", () => {
  it("a hacker can upload their own resume and overwrite it", async () => {
    expect((await upload(hacker, `${hacker.id}/resume.pdf`)).error).toBeNull();
    expect((await upload(hacker, `${hacker.id}/resume.pdf`)).error).toBeNull();
  });

  it("a hacker can't upload into someone else's folder", async () => {
    expect((await upload(hacker, `${other.id}/resume.pdf`)).error).not.toBeNull();
  });

  it("a hacker can't upload a non-.pdf name", async () => {
    expect((await upload(hacker, `${hacker.id}/resume.html`)).error).not.toBeNull();
    expect((await upload(hacker, `${hacker.id}/resume.pdf.exe`)).error).not.toBeNull();
  });

  it("a hacker can't upload at the bucket root", async () => {
    expect((await upload(hacker, `resume.pdf`)).error).not.toBeNull();
  });

  it("anon can't upload", async () => {
    expect((await upload(null, `${hacker.id}/resume.pdf`)).error).not.toBeNull();
  });

  it("staff and owners can't upload into a hacker's folder", async () => {
    expect((await upload(staff, `${other.id}/resume.pdf`)).error).not.toBeNull();
    expect((await upload(owner, `${other.id}/resume.pdf`)).error).not.toBeNull();
  });
});

describe("reads", () => {
  beforeAll(async () => {
    const { error } = await upload(other, `${other.id}/resume.pdf`);
    if (error) throw error;
  });

  it("a hacker can get a signed URL for their own resume", async () => {
    await upload(hacker, `${hacker.id}/resume.pdf`);
    const { data, error } = await signedUrl(hacker, `${hacker.id}/resume.pdf`);
    expect(error).toBeNull();
    const res = await fetch(data!.signedUrl);
    expect(res.status).toBe(200);
    expect(new TextDecoder().decode(await res.arrayBuffer())).toMatch(/^%PDF-/);
  });

  it("a hacker can't read someone else's resume", async () => {
    expect((await signedUrl(hacker, `${other.id}/resume.pdf`)).error).not.toBeNull();
    expect((await hacker.client.storage.from("resumes").download(`${other.id}/resume.pdf`)).error).not.toBeNull();
  });

  it("a hacker can't list other people's folders", async () => {
    const { data } = await hacker.client.storage.from("resumes").list(other.id);
    expect(data ?? []).toEqual([]);
  });

  it("staff can't read resumes", async () => {
    expect((await signedUrl(staff, `${other.id}/resume.pdf`)).error).not.toBeNull();
  });

  it("an owner can read any resume", async () => {
    const { error } = await signedUrl(owner, `${other.id}/resume.pdf`);
    expect(error).toBeNull();
  });

  it("the bucket isn't public", async () => {
    const { data } = anonClient().storage.from("resumes").getPublicUrl(`${other.id}/resume.pdf`);
    expect((await fetch(data.publicUrl)).ok).toBe(false);
  });
});
