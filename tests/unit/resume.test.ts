import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveResume } from "@/lib/resume";
import { pdfBytes, pdfFile } from "../helpers/fixtures";

const USER = "11111111-1111-1111-1111-111111111111";

/** Just enough of a Supabase client for saveResume, recording what it was asked to do */
function fakeClient({ uploadError = null as { message: string } | null, updateError = null as { message: string } | null } = {}) {
  const calls = {
    upload: [] as { bucket: string; path: string; body: Uint8Array; opts: unknown }[],
    update: [] as { table: string; values: Record<string, unknown>; column: string; value: unknown }[],
  };
  const client = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: Uint8Array, opts: unknown) => {
          calls.upload.push({ bucket, path, body, opts });
          return { error: uploadError };
        },
      }),
    },
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: async (column: string, value: unknown) => {
          calls.update.push({ table, values, column, value });
          return { error: updateError };
        },
      }),
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

function form(file?: File) {
  const fd = new FormData();
  if (file) fd.set("resume", file);
  return fd;
}

describe("saveResume", () => {
  it("rejects a missing file", async () => {
    const { client, calls } = fakeClient();
    expect(await saveResume(client, USER, form())).toEqual({ ok: false, error: "No file provided" });
    expect(calls.upload).toHaveLength(0);
  });

  it("rejects an empty file", async () => {
    const { client } = fakeClient();
    expect(await saveResume(client, USER, form(new File([], "r.pdf", { type: "application/pdf" })))).toEqual({ ok: false, error: "Empty file" });
  });

  it("rejects files over 10 MB", async () => {
    const { client, calls } = fakeClient();
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(pdfBytes());
    const result = await saveResume(client, USER, form(new File([big], "r.pdf", { type: "application/pdf" })));
    expect(result).toEqual({ ok: false, error: "File too large (max 10 MB)" });
    expect(calls.upload).toHaveLength(0);
  });

  it("accepts exactly 10 MB", async () => {
    const { client } = fakeClient();
    const max = new Uint8Array(10 * 1024 * 1024);
    max.set(pdfBytes());
    expect((await saveResume(client, USER, form(new File([max], "r.pdf", { type: "application/pdf" })))).ok).toBe(true);
  });

  it("rejects a non-PDF MIME type", async () => {
    const { client } = fakeClient();
    const result = await saveResume(client, USER, form(new File([pdfBytes()], "r.png", { type: "image/png" })));
    expect(result).toEqual({ ok: false, error: "Only PDF files are allowed" });
  });

  it("rejects a .pdf whose bytes aren't a PDF", async () => {
    const { client, calls } = fakeClient();
    const fake = new File([new TextEncoder().encode("<html>not a pdf</html>")], "r.pdf", { type: "application/pdf" });
    expect(await saveResume(client, USER, form(fake))).toEqual({ ok: false, error: "Invalid PDF file (failed signature check)" });
    expect(calls.upload).toHaveLength(0);
  });

  it("rejects a file shorter than the PDF signature", async () => {
    const { client } = fakeClient();
    const tiny = new File([new TextEncoder().encode("%PD")], "r.pdf", { type: "application/pdf" });
    expect((await saveResume(client, USER, form(tiny))).ok).toBe(false);
  });

  it("checks the signature when the browser sends no MIME type", async () => {
    const { client } = fakeClient();
    expect((await saveResume(client, USER, form(pdfFile("r.pdf", "")))).ok).toBe(true);
    const notPdf = new File([new TextEncoder().encode("hello world")], "r.pdf", { type: "" });
    expect((await saveResume(client, USER, form(notPdf))).ok).toBe(false);
  });

  it("uploads to {userId}/resume.pdf with upsert and records it on the registration", async () => {
    const { client, calls } = fakeClient();
    expect(await saveResume(client, USER, form(pdfFile("My Resume (final).pdf")))).toEqual({ ok: true });

    expect(calls.upload).toHaveLength(1);
    expect(calls.upload[0]).toMatchObject({
      bucket: "resumes",
      path: `${USER}/resume.pdf`,
      opts: { contentType: "application/pdf", upsert: true },
    });
    expect(calls.update).toHaveLength(1);
    expect(calls.update[0]).toMatchObject({ table: "registrations", column: "user_id", value: USER });
    expect(calls.update[0].values.resume_url).toBe(`${USER}/resume.pdf`);
    expect(Number.isNaN(Date.parse(String(calls.update[0].values.resume_updated_at)))).toBe(false);
  });

  it("surfaces a storage error and doesn't touch the registration", async () => {
    const { client, calls } = fakeClient({ uploadError: { message: "new row violates row-level security policy" } });
    expect(await saveResume(client, USER, form(pdfFile()))).toEqual({ ok: false, error: "new row violates row-level security policy" });
    expect(calls.update).toHaveLength(0);
  });

  it("surfaces a registration update error", async () => {
    const { client } = fakeClient({ updateError: { message: "locked" } });
    expect(await saveResume(client, USER, form(pdfFile()))).toEqual({ ok: false, error: "locked" });
  });
});
