"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.email().max(320);

export async function joinMailingList(rawEmail: string) {
  const parsed = emailSchema.safeParse(rawEmail.trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: "Please enter a valid email address." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("mailing_list").insert({ email: parsed.data });

  // 23505 = unique violation: already subscribed, treat as success
  if (error && error.code !== "23505") {
    console.error("joinMailingList error:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  return { ok: true };
}
