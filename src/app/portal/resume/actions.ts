"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveResume } from "@/lib/resume";

export async function uploadResume(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const result = await saveResume(supabase, user.id, formData);
  if (!result.ok) return result;

  revalidatePath("/portal/resume");
  revalidatePath("/portal");

  redirect("/portal");
}

// Preview resume link
export async function getSignedResumeUrl() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { url: null };

  // Look up the stored path
  const { data: reg } = await supabase
    .from("registrations")
    .select("resume_url")
    .eq("user_id", user.id)
    .single();

  if (!reg?.resume_url) return { url: null };

  const { data, error } = await supabase.storage.from("resumes").createSignedUrl(reg.resume_url, 60); // 60s
  if (error || !data?.signedUrl) return { url: null };

  return { url: data.signedUrl };
}
