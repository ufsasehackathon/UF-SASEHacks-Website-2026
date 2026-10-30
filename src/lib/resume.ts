import type { SupabaseClient } from "@supabase/supabase-js";

/** 10 MB */
const MAX_BYTES = 10 * 1024 * 1024;

/** Cheap PDF signature check: first 5 bytes should be "%PDF-" */
function looksLikePdf(bytes: Uint8Array) {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2D    // -
  );
}

/**
 * Validate the "resume" field of formData and store it at {userId}/resume.pdf (overwriting),
 * then record it on the registration. Shared by the onboarding form and the resume page.
 */
export async function saveResume(
  supabase: SupabaseClient,
  userId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const file = formData.get("resume") as File | null;
  if (!file) return { ok: false, error: "No file provided" };

  if (file.size === 0) return { ok: false, error: "Empty file" };
  if (file.size > MAX_BYTES) return { ok: false, error: "File too large (max 10 MB)" };

  const type = file.type?.toLowerCase() || "";
  if (type && type !== "application/pdf") {
    return { ok: false, error: "Only PDF files are allowed" };
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(buf)) {
    return { ok: false, error: "Invalid PDF file (failed signature check)" };
  }

  const path = `${userId}/resume.pdf`;
  const { error: uploadErr } = await supabase.storage.from("resumes").upload(path, buf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { error: updErr } = await supabase
    .from("registrations")
    .update({
      resume_url: path,
      resume_updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}
