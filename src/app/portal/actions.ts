"use server";

import { revalidatePath } from "next/cache";
import { profileSchema, registrationFlagsSchema, responsesSchema, APPLICATION_QUESTIONS } from "@/lib/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveResume } from "@/lib/resume";
import { statusEmail, sendEmailBatch } from "@/lib/email";
import { registrationsOpen } from "@/lib/constants";

export async function ensureRows() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "not_authenticated" };

  // profiles
  const { data: prof } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!prof) {
    await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      full_name: "",
      first_name: "",
      last_name: "",
      school: "",
      major: "",
      dietary: [],
      accessibility: "",
      country: "",
    });
  }

  // registrations
  const { data: reg } = await supabase
    .from("registrations")
    .select("user_id")
    .eq("user_id", user.id)
    .single();

  if (!reg) {
    await supabase.from("registrations").insert({ user_id: user.id });
  }

  // Copy a linked Discord account onto the profile (covers both Discord login and linking later)
  await supabase.rpc("sync_discord_profile");

  return { ok: true };
}

export async function upsertProfile(_: unknown, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const firstName = String(formData.get("first_name") ?? "");
  const lastName = String(formData.get("last_name") ?? "");

  // Helper for optional enum fields - returns undefined if empty
  const optionalString = (val: FormDataEntryValue | null) => {
    const str = String(val ?? "");
    return str === "" ? undefined : str;
  };

  const values = {
    first_name: firstName,
    last_name: lastName,
    email: String(formData.get("email") ?? ""),
    phone_number: String(formData.get("phone_number") ?? ""),
    age: String(formData.get("age") ?? "18"),

    school: String(formData.get("school") ?? ""),
    major: String(formData.get("major") ?? ""),
    grad_year: String(formData.get("grad_year") ?? "2026"),
    level_of_study: String(formData.get("level_of_study") ?? "undergraduate-3-plus-year"),

    engineering_skill: String(formData.get("engineering_skill") ?? "3"),
    hackathon_experience: String(formData.get("hackathon_experience") ?? "0"),

    address_line1: String(formData.get("address_line1") ?? ""),
    address_line2: String(formData.get("address_line2") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    zip_code: String(formData.get("zip_code") ?? ""),
    country: String(formData.get("country") ?? ""),

    linkedin_url: String(formData.get("linkedin_url") ?? ""),

    tshirt: optionalString(formData.get("tshirt")),
    dietary: Array.from(formData.getAll("dietary")).map(String),
    accessibility: String(formData.get("accessibility") ?? ""),

    gender: optionalString(formData.get("gender")),
    race: Array.from(formData.getAll("race")).map(String),
  };

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") || "Validation failed" };
  }

  // Compute full_name from first_name + last_name for backwards compatibility
  const fullName = `${firstName} ${lastName}`.trim();

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      ...parsed.data,
      full_name: fullName,
    }, { onConflict: "id" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal/profile");
  revalidatePath("/portal");
  return { ok: true };
}

export async function saveRegistrationFlags(_: unknown, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const values = {
    accuracy_agreement: formData.get("accuracy_agreement") === "on",
    terms_and_conditions: formData.get("terms_and_conditions") === "on",
    code_of_conduct: formData.get("code_of_conduct") === "on",
    can_photograph: formData.get("can_photograph") === "on",
    share_resume_with_companies: formData.get("share_resume_with_companies") === "on",
    mlh_code_of_conduct: formData.get("mlh_code_of_conduct") === "on",
    mlh_data_sharing: formData.get("mlh_data_sharing") === "on",
    mlh_communications: formData.get("mlh_communications") === "on",
  };
  const parsed = registrationFlagsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "You must accept all required agreements" };
  }

  // Editing locking based on RLS
  const { error } = await supabase
    .from("registrations")
    .update(parsed.data)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal");
  return { ok: true };
}

/** Combined action to save both profile and consents */
export async function upsertProfileAndConsents(_: unknown, formData: FormData) {
  // First update profile
  const profileResult = await upsertProfile(_, formData);
  if (!profileResult.ok) {
    return profileResult;
  }

  // Then update consents
  const consentsResult = await saveRegistrationFlags(_, formData);
  if (!consentsResult.ok) {
    return consentsResult;
  }

  return { ok: true };
}

export async function uploadResumeOnboarding(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const result = await saveResume(supabase, user.id, formData);
  if (!result.ok) return result;

  revalidatePath("/portal/resume");
  revalidatePath("/portal");
  return { ok: true };
}

/** Save free-response answers (APPLICATION_QUESTIONS) into registrations.responses */
export async function saveResponses(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const values = Object.fromEntries(
    APPLICATION_QUESTIONS.map(q => [q.id, String(formData.get(q.id) ?? "")])
  );
  const parsed = responsesSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Please check your answers" };
  }

  // Merge so answers to questions that were since removed from the form are kept
  const { data: reg } = await supabase
    .from("registrations")
    .select("responses")
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("registrations")
    .update({ responses: { ...(reg?.responses ?? {}), ...parsed.data } })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Email the caller about their current status (application received / RSVP) and mark it sent.
 * Failures are logged, not surfaced: the admin email queue will retry anything unsent.
 */
async function emailOwnStatus(userId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: reg }, { data: profile }] = await Promise.all([
    supabase.from("registrations").select("status, rsvp_deadline, last_emailed_status").eq("user_id", userId).single(),
    supabase.from("profiles").select("email, first_name").eq("id", userId).single(),
  ]);
  if (!reg || !profile?.email || reg.last_emailed_status === reg.status) return;

  const msg = statusEmail(reg.status, {
    firstName: profile.first_name,
    rsvpDeadline: reg.rsvp_deadline,
    previousEmailedStatus: reg.last_emailed_status,
  });
  if (!msg) return;

  const sent = await sendEmailBatch([{ to: profile.email, ...msg }]);
  if (!sent.ok) {
    console.error("emailOwnStatus failed:", sent.error);
    return;
  }
  await supabase.rpc("mark_own_status_emailed", { p_status: reg.status });
}

/** draft -> pending. Re-checks the deadline here and in the DB (submit_application). */
export async function submitApplication() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  if (!registrationsOpen()) return { ok: false, error: "Applications are closed" };

  const { error } = await supabase.rpc("submit_application");
  if (error) return { ok: false, error: error.message };

  await emailOwnStatus(user.id);

  revalidatePath("/portal");
  return { ok: true };
}

/** Accepted hacker confirms (needs Discord linked) or declines; confirmed hacker can drop out */
export async function rsvp(attending: boolean) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase.rpc("rsvp", { p_attending: attending });
  if (error) return { ok: false, error: error.message };

  await emailOwnStatus(user.id);

  revalidatePath("/portal");
  return { ok: true };
}
