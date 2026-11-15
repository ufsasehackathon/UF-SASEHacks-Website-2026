"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { OWNER_ROLES, STAFF_ROLES } from "@/lib/roles";
import { profileSearchFilter, type CheckinPerson } from "@/lib/checkin";
import { hasRequiredConsents, registrationFlagsSchema, type RegistrationStatus } from "@/lib/validation";

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  discord_id: string | null;
  discord_username: string | null;
};

type RegistrationRow = {
  user_id: string;
  status: RegistrationStatus;
  waitlisted_at: string | null;
} & Record<string, unknown>;

const PROFILE_COLUMNS = "id, full_name, first_name, last_name, email, discord_id, discord_username";
const REGISTRATION_COLUMNS = ["user_id", "status", "waitlisted_at", ...Object.keys(registrationFlagsSchema.shape)].join(", ");

/** PostgREST embeds a one-to-one relation as an object, but types it loosely */
function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/** Main-event ('Check-in') check-in times for these users */
async function checkInTimes(supabase: SupabaseClient, userIds: string[]) {
  const times = new Map<string, string>();
  if (userIds.length === 0) return { times };

  const { data: event, error: eventError } = await supabase.from("events").select("id").eq("event_name", "Check-in").maybeSingle();
  if (eventError) return { times, error: eventError.message };
  if (!event) return { times };

  const { data, error } = await supabase
    .from("attendance")
    .select("user_id, created_at")
    .eq("event_id", event.id)
    .in("user_id", userIds);
  if (error) return { times, error: error.message };
  for (const row of data ?? []) times.set(row.user_id, row.created_at);
  return { times };
}

function toPerson(p: ProfileRow, reg: RegistrationRow | null, checkedInAt: string | null): CheckinPerson {
  return {
    userId: p.id,
    name: p.full_name?.trim() || [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || "(no name)",
    email: p.email ?? "",
    discordUsername: p.discord_username,
    hasDiscord: p.discord_id !== null,
    hasConsents: hasRequiredConsents(reg),
    status: reg?.status ?? null,
    checkedInAt,
    waitlistedAt: reg?.waitlisted_at ?? null,
  };
}

/** Staff/owner: up to 25 people whose name, email or Discord username matches `query`. A read, so no revalidate. */
export async function searchPeople(query: string): Promise<{ ok: boolean; error?: string; people: CheckinPerson[] }> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return { ...auth, people: [] };

  const filter = profileSearchFilter(query);
  if (!filter) return { ok: true, people: [] };

  const { data, error } = await auth.supabase
    .from("profiles")
    .select(`${PROFILE_COLUMNS}, registrations(${REGISTRATION_COLUMNS})`)
    .or(filter)
    .order("first_name", { ascending: true })
    .limit(25);
  if (error) return { ok: false, error: error.message, people: [] };

  const rows = (data ?? []) as unknown as (ProfileRow & { registrations: RegistrationRow | RegistrationRow[] | null })[];
  const { times, error: timesError } = await checkInTimes(auth.supabase, rows.map(r => r.id));
  if (timesError) return { ok: false, error: timesError, people: [] };

  return { ok: true, people: rows.map(r => toPerson(r, one(r.registrations), times.get(r.id) ?? null)) };
}

/** Run a staff RPC that takes a user id, passing its error message through */
async function staffRpc(fn: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.rpc(fn, { p_user_id: userId });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/staff/checkin");
  return { ok: true };
}

/** Staff/owner: check a confirmed hacker into the main event */
export async function checkIn(userId: string): Promise<{ ok: boolean; error?: string }> {
  return staffRpc("staff_check_in", userId);
}

/** Staff/owner: undo a main-event check-in */
export async function undoCheckIn(userId: string): Promise<{ ok: boolean; error?: string }> {
  return staffRpc("staff_undo_check_in", userId);
}

/** Staff/owner: put someone on the on-site waitlist (needs Discord and the agreements) */
export async function addToWaitlist(userId: string): Promise<{ ok: boolean; error?: string }> {
  return staffRpc("add_to_waitlist", userId);
}

/** Staff/owner: admit someone from the waitlist (confirms and checks them in) */
export async function admitFromWaitlist(userId: string): Promise<{ ok: boolean; error?: string }> {
  return staffRpc("admit_from_waitlist", userId);
}

/** Staff/owner: take someone off the waitlist without admitting them (declined) */
export async function removeFromWaitlist(userId: string): Promise<{ ok: boolean; error?: string }> {
  return staffRpc("remove_from_waitlist", userId);
}

/** Owner: set the event capacity shown on the check-in counter (null clears it) */
export async function setCapacity(capacity: number | null): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireRole(OWNER_ROLES);
  if (!auth.ok) return auth;
  if (capacity !== null && !(Number.isInteger(capacity) && capacity > 0)) {
    return { ok: false, error: "Capacity must be a positive whole number" };
  }

  const { error } = await auth.supabase.from("settings").update({ capacity }).eq("id", true);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/staff/checkin");
  return { ok: true };
}

/**
 * Staff/owner: main-event check-in count, capacity, and the on-site waitlist in the order people
 * were added. Read by the page while rendering, so it doesn't revalidate. Empty for anyone else.
 * `error` is the first query that failed (each failure is logged); the other fields then hold
 * whatever did load, so the page must show the error rather than trust the numbers.
 */
export async function getCheckinSummary(): Promise<{
  checkedIn: number;
  capacity: number | null;
  waitlist: CheckinPerson[];
  error?: string;
}> {
  const auth = await requireRole(STAFF_ROLES);
  if (!auth.ok) return { checkedIn: 0, capacity: null, waitlist: [] };
  const { supabase } = auth;

  const errors: string[] = [];
  const fail = (what: string, message: string | undefined) => {
    if (!message) return;
    console.error(`getCheckinSummary: loading ${what} failed:`, message);
    errors.push(message);
  };

  const [event, settings, waitlist] = await Promise.all([
    supabase.from("events").select("id").eq("event_name", "Check-in").maybeSingle(),
    supabase.from("settings").select("capacity").maybeSingle(),
    supabase
      .from("registrations")
      .select(`${REGISTRATION_COLUMNS}, profiles(${PROFILE_COLUMNS})`)
      .eq("status", "waitlist")
      .order("waitlisted_at", { ascending: true, nullsFirst: false }),
  ]);
  fail("the Check-in event", event.error?.message);
  fail("settings", settings.error?.message);
  fail("the waitlist", waitlist.error?.message);

  let checkedIn = 0;
  if (event.data) {
    const { count, error } = await supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.data.id);
    fail("check-ins", error?.message);
    checkedIn = count ?? 0;
  }

  const regs = (waitlist.data ?? []) as unknown as (RegistrationRow & { profiles: ProfileRow | ProfileRow[] | null })[];
  const { times, error: timesError } = await checkInTimes(supabase, regs.map(r => r.user_id));
  fail("waitlist check-ins", timesError);
  const people = regs.flatMap(r => {
    const profile = one(r.profiles);
    return profile ? [toPerson(profile, r, times.get(r.user_id) ?? null)] : [];
  });

  const summary = { checkedIn, capacity: (settings.data?.capacity as number | null) ?? null, waitlist: people };
  return errors.length > 0 ? { ...summary, error: errors[0] } : summary;
}
