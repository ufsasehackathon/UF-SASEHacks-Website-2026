# Staff, Owner & Judge Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `/staff` and `/judge` pages with application review (accept/reject + owner-released decision emails), day-of check-in with an on-site waitlist (including walk-ins), Devpost CSV import with automatic judge assignment, a judge project list, and owner role management.

**Architecture:** Every state change staff make goes through new `security definer` RPCs in `supabase/schema.sql` (staff are non-admin for all guards), wrapped by colocated `"use server"` actions that re-check the role. Unsent decisions live in a new `pending_decisions` table hackers can't read, so the portal can't leak them. Pure logic (state derivation, CSV parsing, judge balancing, search filters) lives in `src/lib/` with unit tests; UI is server pages under `/staff/*` with small client components.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres RLS/RPC, Storage), Tailwind 4, Resend batch API via `fetch`, `papaparse` (re-added), Vitest (unit + integration against local Supabase), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-staff-judge-dashboards-design.md`

## Global Constraints

- Follow `CLAUDE.md`. Every server action re-checks the caller's role and returns `{ ok: boolean, error?: string, ... }` (never throws), then `revalidatePath`s the affected route.
- `"use server"` files export only async functions and types.
- `supabase/schema.sql` must stay safe to re-run (`if not exists`, `drop policy if exists`, `create or replace`, guarded `alter`s). Every new RPC: `security definer`, `set search_path = public`, `revoke all ... from public; grant execute ... to authenticated;`.
- Hacker-facing or staff-facing RPCs that write guarded `registrations` columns wrap the update in `perform set_config('sasehacks.bypass_guard', 'on', true)` / `'off'`.
- Staff stay "non-admin" (`is_admin` = owner). Never widen a guard to staff; add an RPC.
- Each task's commit updates `WIP.md` and, when it changes anything `CLAUDE.md` documents (schema, RPCs, routes, constants, flows), `CLAUDE.md` too. Task 15 does a final consistency sweep.
- DB/action/e2e tests need Docker (`npm run db:start`). Without Docker, run `npm run test:unit`, `npm run lint`, `npx tsc --noEmit`, and leave the integration run to CI. Never run `npm run build` while `npm run dev` is running.
- Placeholders (confirm with organizers, keep in `src/lib/constants.ts`): `RSVP_WINDOW_DAYS = 7`, `EVENT_START = "2027-02-26T08:00:00-05:00"`, `EVENT_END = "2027-02-28T18:00:00-05:00"`.
- UI matches the existing look: `PageShell`, `font-[family-name:var(--font-body)]`/`--font-heading`, `#560700` / `#FFE4B3` palette, white rounded cards. Confirmations use `window.confirm` (as `RsvpButtons` does).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A decision changed between email and apply.** Staff flip Accept→Reject while an owner's send is in flight: the portal must end up matching the email that was actually sent. `apply_decisions` applies the decision passed in (the one emailed), not the current row. Test in Task 1.
2. **Applicant with no profile email.** `sendDecisions` must skip them (leave them unsent, count them as `noEmail`), not fail the whole batch. Test in Task 6.
3. **A sent decision for someone no longer `pending`.** If an owner changed a status in SQL after a decision was queued, `apply_decisions` must skip that row and still delete the stale queue entry. Test in Task 1.
4. **Search text with PostgREST filter syntax** (`O'Brien`, `a,b`, `(x)`, `%`). `profileSearchFilter` must strip it so `.or()` never errors. Tests in Task 8.
5. **Devpost CSV quirks:** UTF-8 BOM before the first header, quoted fields with commas/newlines, CRLF line endings, `Project Status` values like "Draft". Tests in Task 11.

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `supabase/schema.sql` | decisions table/RPCs, waitlist RPCs, capacity, staff RLS, table_number int | 1–3 |
| `tests/setup/schema.ts` (`RESET_SQL`) | reset `settings.capacity` | 2 |
| `tests/db/decisions.test.ts`, `tests/db/checkin.test.ts`, `tests/db/judging.test.ts` | DB tests per area | 1–3 |
| `src/lib/constants.ts` | `RSVP_WINDOW_DAYS`, `EVENT_START/END`, `walkInsOpen`, `rsvpDeadlineFrom` | 4 |
| `src/lib/email.ts` | `accepted` / `rejected` templates | 4 |
| `src/lib/session.ts` | `requireRole` | 5 |
| `src/app/staff/layout.tsx`, `src/components/staff/StaffTabs.tsx` | shell + tabs | 5 |
| `src/lib/applications.ts` | `ApplicantRow`, `applicantState`, filters | 7 |
| `src/app/staff/applications/{page.tsx,actions.ts}`, `src/components/staff/{ApplicationsTable,SendDecisionsBar}.tsx` | review | 6–7 |
| `src/lib/checkin.ts` | `CheckinPerson`, `checkinState`, `profileSearchFilter` | 8 |
| `src/app/staff/checkin/{page.tsx,actions.ts}`, `src/components/staff/{CheckinSearch,WaitlistTable,CapacityEditor}.tsx` | check-in | 8–9 |
| `src/components/portal/{ConnectDiscordButton,WalkInCard}.tsx`, `src/app/portal/{page.tsx,actions.ts}` | walk-ins | 10 |
| `src/lib/devpost.ts`, `src/lib/judging.ts` | CSV parse, assignment planning | 11 |
| `src/app/staff/judging/{page.tsx,actions.ts}`, `src/components/staff/{ProjectImport,ProjectsTable}.tsx`, `src/app/judge/page.tsx` | judging | 12–13 |
| `src/app/staff/people/{page.tsx,actions.ts}`, `src/components/staff/RoleManager.tsx` | roles | 14 |

---

### Task 1: Decisions schema

**Files:**
- Modify: `supabase/schema.sql` (new table after `settings`; RPCs after `rsvp`; RLS block; storage policy block)
- Test: `tests/db/decisions.test.ts`

**Interfaces:**
- Produces (SQL):
  - table `public.pending_decisions (user_id uuid primary key references public.registrations(user_id) on delete cascade, decision text not null check (decision in ('accepted','rejected')), decided_by uuid references auth.users(id) on delete set null, decided_at timestamptz not null default now())`, RLS enabled, one policy `pending_decisions_staff_select` (`for select to authenticated using (public.is_staff(auth.uid()))`), no write policies.
  - `set_decisions(p_user_ids uuid[], p_decision text) returns integer`: `is_staff` else `42501` "Only staff can make decisions"; `p_decision` must be `accepted`/`rejected` else raise "Unknown decision"; upserts (`decided_by = auth.uid()`, `decided_at = now()`) only for ids whose registration `status = 'pending'`; returns rows affected.
  - `clear_decisions(p_user_ids uuid[]) returns integer`: `is_staff`; deletes those rows; returns count.
  - `apply_decisions(p_items jsonb, p_rsvp_deadline timestamptz) returns uuid[]`: `is_owner` else `42501` "Only owners can send decisions". `p_items` is `[{"user_id": uuid, "decision": "accepted"|"rejected"}]`. For each item whose registration is still `pending`: `status := decision`, `last_emailed_status := decision`, `reviewed_by := pending_decisions.decided_by` (null if the row is gone), and for `accepted` also `accepted_at := now()`, `rsvp_deadline := p_rsvp_deadline`. Deletes the `pending_decisions` row for **every** item (applied or skipped). Returns ids applied.
  - storage policy `resumes_staff_read`: `for select to authenticated using (bucket_id = 'resumes' and public.is_staff(auth.uid()))`.

- [ ] **Step 1: Write the failing tests** in `tests/db/decisions.test.ts` (pattern: `tests/db/rpcs.test.ts`; users via `createUser({ role })`, rows via `setRegistration`):
  - `set_decisions › staff and owners can queue accept/reject for pending applicants` → returns 2, `pending_decisions` has both with `decided_by = staff.id`, registrations still `pending`.
  - `set_decisions › skips applicants who aren't pending` (draft, accepted) → returns 0, no rows.
  - `set_decisions › re-deciding overwrites the decision` (accept then reject → one row, `rejected`).
  - `set_decisions › hackers and judges get 42501` (`error.code === DENIED`).
  - `set_decisions › rejects unknown decision` (`"waitlist"` → error matching /Unknown decision/).
  - `clear_decisions › removes queued rows; staff only`.
  - `pending_decisions RLS › a hacker can't read their own queued decision` (`hacker.client.from("pending_decisions").select()` → `[]`), staff/owner can.
  - `pending_decisions RLS › nobody can insert directly` (staff insert → `DENIED`).
  - `apply_decisions › owner applies accept: status accepted, accepted_at set, rsvp_deadline = passed value, last_emailed_status accepted, reviewed_by = decider, queue row gone`.
  - `apply_decisions › applies reject without accepted_at/rsvp_deadline`.
  - `apply_decisions › applies the decision passed in, not the queued one` (queue `rejected`, apply `[{decision:"accepted"}]` → status `accepted`). *(Review Focus 1)*
  - `apply_decisions › skips a registration that is no longer pending but deletes its queue row` (queue accept, then `setRegistration(status:"confirmed")`, apply → returns `[]`, status unchanged, queue row gone). *(Review Focus 3)*
  - `apply_decisions › staff get 42501`.
  - `resumes storage › staff can read any resume` (extend the pattern in `tests/db/storage.test.ts`; owner upload, staff `download` succeeds, judge fails).

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:db -- tests/db/decisions.test.ts`
  Expected: FAIL (`relation "public.pending_decisions" does not exist` / function not found).

- [ ] **Step 3: Implement the SQL** listed under Interfaces in `supabase/schema.sql`. Keep `notify pgrst, 'reload schema'` at the end of the file working (it already exists). Add a commented snippet at the bottom: "See queued decisions: `select * from public.pending_decisions;`".

- [ ] **Step 4: Run to verify pass**
  Run: `npm run test:db -- tests/db/decisions.test.ts tests/db/storage.test.ts tests/db/rls.test.ts`
  Expected: PASS.

- [ ] **Step 5: Update docs and commit.** `CLAUDE.md`: add `pending_decisions` to the data model, the three RPCs to the RPC list, staff resume read to the resumes paragraph; lifecycle table: `accepted`/`rejected` are now "set by owner's Send decisions (`apply_decisions`)". `WIP.md`: note the decisions DB is in.
  ```bash
  git add supabase/schema.sql tests/db/decisions.test.ts tests/db/storage.test.ts CLAUDE.md WIP.md
  git commit -m "feat(db): queue review decisions in pending_decisions until an owner sends them"
  ```

---

### Task 2: Check-in & waitlist schema

**Files:**
- Modify: `supabase/schema.sql`, `tests/setup/schema.ts` (`RESET_SQL`: add `capacity = null` to the `update public.settings` line)
- Test: `tests/db/checkin.test.ts`

**Interfaces:**
- Produces (SQL):
  - `registrations.waitlisted_at timestamptz` (added with `add column if not exists`), included in `guard_registration_admin_cols`'s protected list and set to null in `guard_registration_insert`.
  - `settings.capacity integer check (capacity is null or capacity > 0)` (nullable, default null).
  - `add_to_waitlist(p_user_id uuid) returns void`: `is_staff` else `42501`. Errors (exact text, the UI shows them): no registration → "No application or walk-in agreements found"; no `auth.identities` row with provider `discord` → "Link Discord first"; missing any of `accuracy_agreement, terms_and_conditions, code_of_conduct, mlh_code_of_conduct, mlh_data_sharing` → "Agreements not accepted"; status `confirmed` → "Already confirmed"; status `waitlist` → "Already on the waitlist". Otherwise `status = 'waitlist'`, `waitlisted_at = now()`, and deletes any `pending_decisions` row.
  - `admit_from_waitlist(p_user_id uuid) returns void`: `is_staff`; status must be `waitlist` else "Not on the waitlist"; sets `status = 'confirmed'`, then inserts the `Check-in` attendance row exactly like `staff_check_in` (`on conflict do nothing`).
  - `remove_from_waitlist(p_user_id uuid) returns void`: `is_staff`; status must be `waitlist`; sets `status = 'declined'`, `waitlisted_at = null`.

- [ ] **Step 1: Write the failing tests** in `tests/db/checkin.test.ts`:
  - `add_to_waitlist › waitlists an accepted no-RSVP with Discord and consents` (status `waitlist`, `waitlisted_at` set).
  - `add_to_waitlist › works for a walk-in draft with consents` (`setRegistration(id, {status:"draft"})` + `linkDiscord`).
  - `add_to_waitlist › works for pending, declined and rejected` (`it.each`).
  - `add_to_waitlist › drops an unsent decision` (queue via `set_decisions`, then waitlist → `pending_decisions` empty).
  - `add_to_waitlist › refuses without Discord` (/Link Discord first/), `› refuses without consents` (`it.each(REQUIRED_CONSENTS)` → /Agreements not accepted/), `› refuses with no registration`, `› refuses confirmed`, `› refuses already waitlisted`.
  - `add_to_waitlist › hackers get 42501`.
  - `admit_from_waitlist › confirms and checks in in one call` (status `confirmed`, one `attendance` row on the `Check-in` event with `checked_in_by = staff.id`).
  - `admit_from_waitlist › refuses someone not waitlisted`.
  - `remove_from_waitlist › sets declined and clears waitlisted_at`.
  - `guards › a hacker can't set waitlisted_at` (update own row → `DENIED`).
  - `settings › owner can set capacity; staff can't; capacity must be > 0` (staff update matches 0 rows; owner `capacity: 0` → check violation).

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:db -- tests/db/checkin.test.ts`
  Expected: FAIL (function not found / column missing).

- [ ] **Step 3: Implement the SQL** under Interfaces. Use the `sasehacks.bypass_guard` pattern around the registration updates.

- [ ] **Step 4: Run to verify pass**
  Run: `npm run test:db -- tests/db/checkin.test.ts tests/db/guards.test.ts tests/db/rpcs.test.ts`
  Expected: PASS.

- [ ] **Step 5: Update docs and commit.** `CLAUDE.md`: new column, `settings.capacity`, three RPCs, lifecycle row for `waitlist` = "on-site waitlist, set by staff on event day (`add_to_waitlist`)", guard list. `WIP.md`.
  ```bash
  git add supabase/schema.sql tests/setup/schema.ts tests/db/checkin.test.ts CLAUDE.md WIP.md
  git commit -m "feat(db): on-site waitlist RPCs and event capacity setting"
  ```

---

### Task 3: Judging schema

**Files:**
- Modify: `supabase/schema.sql`
- Test: `tests/db/judging.test.ts`

**Interfaces:**
- Produces (SQL):
  - policies `projects_staff_all` and `judge_assignments_staff_all`: `for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()))` (the existing owner policies can stay).
  - `projects.table_number` type `integer`. Re-runnable conversion inside a `do $$ ... $$` block that only runs when `information_schema.columns.data_type = 'text'`: `alter column table_number type integer using nullif(regexp_replace(table_number, '\D', '', 'g'), '')::integer`.
  - `set_user_role`: after the role write, `if p_role <> 'judge' then delete from public.judge_assignments where judge_id = p_user_id; end if;`.

- [ ] **Step 1: Write the failing tests** in `tests/db/judging.test.ts`:
  - `projects › staff can insert, update table_number, delete` (as `staff.client`).
  - `judge_assignments › staff can insert and delete assignments`.
  - `projects › a hacker can't insert` (`DENIED`).
  - `projects › table_number is an integer` (insert `{ table_number: 7 }`, read back `7` as a number).
  - `judges › still see only their assigned projects` (existing behavior, now with staff-created rows).
  - `set_user_role › removing the judge role deletes that judge's assignments` (owner sets judge → hacker; `judge_assignments` for them empty). And `› judge → judge keeps assignments`.

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:db -- tests/db/judging.test.ts`
  Expected: FAIL (staff insert denied; table_number is a string).

- [ ] **Step 3: Implement the SQL** under Interfaces. Update the commented "Assign a project to a judge" snippet at the bottom of `schema.sql` to say the Judging tab does this now.

- [ ] **Step 4: Run to verify pass**
  Run: `npm run test:db -- tests/db/judging.test.ts tests/db/rls.test.ts tests/db/rpcs.test.ts`
  Expected: PASS.

- [ ] **Step 5: Update docs and commit** (`CLAUDE.md` data model for `projects`/`judge_assignments`, `set_user_role` behavior; `WIP.md`).
  ```bash
  git add supabase/schema.sql tests/db/judging.test.ts CLAUDE.md WIP.md
  git commit -m "feat(db): staff manage projects and judge assignments; integer table numbers"
  ```

---

### Task 4: Constants and decision emails

**Files:**
- Modify: `src/lib/constants.ts`, `src/lib/email.ts`
- Test: `tests/unit/constants.test.ts`, `tests/unit/email.test.ts`

**Interfaces:**
- Produces:
  - `export const RSVP_WINDOW_DAYS = 7;` `export const EVENT_START = "2027-02-26T08:00:00-05:00";` `export const EVENT_END = "2027-02-28T18:00:00-05:00";` (all under the existing PLACEHOLDERS comment)
  - `export function walkInsOpen(now: number = Date.now()): boolean` — `Date.parse(EVENT_START) <= now && now <= Date.parse(EVENT_END)`. Not gated on `REGISTRATIONS_ENABLED`.
  - `export function rsvpDeadlineFrom(sentAt: Date): Date` — `sentAt + RSVP_WINDOW_DAYS days`.
  - `StatusEmailContext` becomes `{ firstName: string | null; rsvpDeadline?: string | null }` (ISO string).
  - `statusEmail("accepted", ctx)` and `statusEmail("rejected", ctx)` return `{ subject, html }`.

- [ ] **Step 1: Write the failing tests**
  - `constants.test.ts`: `walkInsOpen › false before EVENT_START, true at EVENT_START and inside, false after EVENT_END` (pass `now` explicitly); `rsvpDeadlineFrom › adds RSVP_WINDOW_DAYS days`.
  - `email.test.ts`: `statusEmail("accepted") › subject mentions the hackathon and the body has the formatted deadline and a /portal link` (deadline `"2027-02-10T23:59:00-05:00"` → html contains `"February 10, 2027"` and `${SITE_URL}/portal`); `› accepted without a deadline still renders` (no "undefined" in html); `statusEmail("rejected") › links the mailing list` (html contains `${SITE_URL}/#mailing-list`); `› escapes the first name` (existing pattern); `statusEmail("waitlist") › still returns null`.

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:unit -- tests/unit/constants.test.ts tests/unit/email.test.ts`
  Expected: FAIL (exports missing / null templates).

- [ ] **Step 3: Implement.** Copy (draft; organizers review it, already a WIP item):
  - accepted — subject `` `You're in! RSVP for ${HACK_NAME}` ``; body: congratulations, `${DATES}` at `${VENUE}` in `${CITY}`; "Connect your Discord account and confirm your spot in the portal by **{deadline}**, or it will go to someone else." (deadline line omitted when null; format with the portal's `fmt` style: `toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "long", timeStyle: "short" }) + " ET"`); `button(portal, "RSVP in the portal")`.
  - rejected — subject `` `Your ${HACK_NAME} application` ``; body: thank you for applying, we couldn't offer you a spot this year, we'd love to see you apply again; `button(`${SITE_URL}/#mailing-list`, "Join the mailing list")`.
  - Update the `statusEmail` doc comment (decision emails now exist; waitlist still has none).

- [ ] **Step 4: Run to verify pass**
  Run: `npm run test:unit`
  Expected: PASS.

- [ ] **Step 5: Update docs and commit** (`CLAUDE.md` Email section + constants list; `WIP.md` placeholders `RSVP_WINDOW_DAYS`, `EVENT_START/END`).
  ```bash
  git add src/lib/constants.ts src/lib/email.ts tests/unit/constants.test.ts tests/unit/email.test.ts CLAUDE.md WIP.md
  git commit -m "feat: decision email templates, RSVP window and event-window constants"
  ```

---

### Task 5: Staff shell, tabs and `requireRole`

**Files:**
- Modify: `src/lib/session.ts`, `src/app/staff/layout.tsx`, `src/app/staff/page.tsx`
- Create: `src/components/staff/StaffTabs.tsx`, `src/app/staff/applications/page.tsx`, `src/app/staff/checkin/page.tsx`, `src/app/staff/judging/page.tsx`, `src/app/staff/people/page.tsx` (each a one-line "Coming next" placeholder; replaced in later tasks)
- Test: `tests/e2e/roles.spec.ts`

**Interfaces:**
- Produces:
  - `requireRole(allowed: readonly Role[]): Promise<{ ok: true; supabase: SupabaseClient; user: User; role: Role } | { ok: false; error: string }>` in `src/lib/session.ts`. Errors: `"Not authenticated"`, `"Not allowed"`. Every later staff action starts with it.
  - `export const STAFF_ROLES = ["owner", "staff"] as const;` and `export const OWNER_ROLES = ["owner"] as const;` in `src/lib/roles.ts`.
  - `StaffTabs({ isOwner }: { isOwner: boolean })` client component: links Applications `/staff/applications`, Check-in `/staff/checkin`, Judging `/staff/judging`, and (owner only) People `/staff/people`; active tab from `usePathname()`.
  - `layout.tsx` renders `<PageShell title={role === "owner" ? "Owner Dashboard" : "Staff Dashboard"}>` with `<StaffTabs>` above `children` (keep the existing role guard).
  - `/staff` → `redirect("/staff/applications")`. `/staff/people` redirects non-owners to `/staff/applications`.

- [ ] **Step 1: Update the e2e test** `tests/e2e/roles.spec.ts`: staff/owner clicking Dashboard lands on `/staff/applications` (change the URL assertion for those roles to `/\/staff\/applications$/`); the heading assertion stays. Add: `staff › People tab is hidden and /staff/people redirects to /staff/applications`; `owner › People tab is visible`.

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:e2e -- tests/e2e/roles.spec.ts`
  Expected: FAIL (no redirect / no tabs).

- [ ] **Step 3: Implement** the files above.

- [ ] **Step 4: Verify**
  Run: `npm run test:e2e -- tests/e2e/roles.spec.ts && npm run lint && npx tsc --noEmit`
  Expected: PASS, no lint/type errors.

- [ ] **Step 5: Update docs and commit** (`CLAUDE.md`: routes, remove "placeholder dashboards" wording for `/staff`, document `requireRole`; `WIP.md`).
  ```bash
  git add src/lib/session.ts src/lib/roles.ts src/app/staff src/components/staff tests/e2e/roles.spec.ts CLAUDE.md WIP.md
  git commit -m "feat(staff): tabbed staff dashboard shell and requireRole helper"
  ```

---

### Task 6: Application review actions

**Files:**
- Create: `src/app/staff/applications/actions.ts`
- Test: `tests/actions/applications.test.ts`

**Interfaces:**
- Consumes: `requireRole`, `STAFF_ROLES`, `OWNER_ROLES` (Task 5); RPCs `set_decisions`, `clear_decisions`, `apply_decisions` (Task 1); `statusEmail`, `sendEmailBatch`, `rsvpDeadlineFrom` (Task 4).
- Produces:
  - `setDecisions(userIds: string[], decision: "accepted" | "rejected"): Promise<{ ok: boolean; error?: string; count?: number }>` (staff/owner)
  - `clearDecisions(userIds: string[]): Promise<{ ok: boolean; error?: string; count?: number }>` (staff/owner)
  - `getResumeUrl(userId: string): Promise<{ ok: boolean; error?: string; url?: string }>` (staff/owner; signed URL for `${userId}/resume.pdf`, 60 s)
  - `sendDecisions(): Promise<{ ok: boolean; error?: string; sent: number; failed: number; noEmail: number }>` (owner only)
  - All revalidate `/staff/applications`; `sendDecisions` also `/portal`.

`sendDecisions` algorithm (the part tests don't fully determine):
1. If `RESEND_API_KEY`/`EMAIL_FROM` are unset, return `{ ok: false, error: "Email is not configured", sent: 0, failed: 0, noEmail: 0 }` and change nothing.
2. Load all `pending_decisions` rows, then their profiles (`email`, `first_name`) by `user_id`.
3. Rows whose profile email is empty: count as `noEmail`, leave queued.
4. Chunk the rest by 100. Per chunk: compute `deadline = rsvpDeadlineFrom(new Date())`, build emails with `statusEmail(decision, { firstName, rsvpDeadline: deadline.toISOString() })`, `sendEmailBatch`. On failure: add the chunk to `failed` and **stop** (later chunks are untouched). On success: `rpc("apply_decisions", { p_items: chunk.map(({user_id, decision}) => ({ user_id, decision })), p_rsvp_deadline: deadline.toISOString() })`; add returned ids' count to `sent`.
5. `ok` is `failed === 0`.

- [ ] **Step 1: Write the failing tests** in `tests/actions/applications.test.ts` (copy the `vi.mock` header and `mockResend` from `tests/actions/portal.test.ts`; move `mockResend` into `tests/helpers/next.ts` as an export and import it in both files):
  - `setDecisions › staff queue accepts; registrations stay pending` (count 2).
  - `setDecisions › a hacker gets "Not allowed"`; `› signed out gets "Not authenticated"`.
  - `clearDecisions › undoes a queued decision`.
  - `getResumeUrl › staff get a signed URL; hackers get "Not allowed"`.
  - `sendDecisions › staff get "Not allowed"`.
  - `sendDecisions › emails each decision once and applies them` (2 accepts, 1 reject → Resend called once with 3 emails, correct `to` and subjects; statuses updated; `rsvp_deadline` ≈ now + 7 days; result `{ ok: true, sent: 3, failed: 0, noEmail: 0 }`).
  - `sendDecisions › splits more than 100 into batches` (101 queued → 2 Resend calls of 100 and 1).
  - `sendDecisions › a failed batch stays queued and stops later batches` (Resend returns 500 → nothing applied, `pending_decisions` unchanged, `{ ok: false, failed: N, sent: 0 }`).
  - `sendDecisions › skips applicants without an email` (one profile `email = ''` → `noEmail: 1`, their row still queued, others sent). *(Review Focus 2)*
  - `sendDecisions › without Resend configured, nothing changes` (`vi.stubEnv("RESEND_API_KEY", "")`).
  - `sendDecisions › nothing queued → ok with zeros, no Resend call`.

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:db -- tests/actions/applications.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/app/staff/applications/actions.ts`.

- [ ] **Step 4: Run to verify pass**
  Run: `npm run test:db -- tests/actions/`
  Expected: PASS.

- [ ] **Step 5: Commit** (`WIP.md`; `CLAUDE.md` server-actions list gains this file).
  ```bash
  git add src/app/staff/applications/actions.ts tests/actions/applications.test.ts tests/actions/portal.test.ts tests/helpers/next.ts CLAUDE.md WIP.md
  git commit -m "feat(staff): review actions and owner Send decisions"
  ```

---

### Task 7: Applications tab UI

**Files:**
- Create: `src/lib/applications.ts`, `src/components/staff/ApplicationsTable.tsx`, `src/components/staff/SendDecisionsBar.tsx`
- Modify: `src/app/staff/applications/page.tsx`
- Test: `tests/unit/applications.test.ts`, `tests/e2e/review.spec.ts`

**Interfaces:**
- Consumes: Task 6 actions; `APPLICATION_QUESTIONS`, `registrationStatusLabels` from `validation.ts`.
- Produces (`src/lib/applications.ts`):
  - `type ApplicantRow = { userId: string; name: string; email: string; school: string; major: string; gradYear: string; levelOfStudy: string; hackathonExperience: string; engineeringSkill: string; linkedinUrl: string | null; hasResume: boolean; responses: Record<string, string>; submittedAt: string | null; status: RegistrationStatus; decision: "accepted" | "rejected" | null }`
  - `type ApplicantState = "pending" | "accepted_unsent" | "rejected_unsent" | "accepted" | "confirmed" | "declined" | "rejected" | "waitlist"`
  - `applicantState(row: ApplicantRow): ApplicantState` — unsent decision wins while `status === "pending"`.
  - `APPLICANT_FILTERS: { value: ApplicantState | "all"; label: string }[]` with labels "Pending", "Accepted · not sent", "Rejected · not sent", "Accepted", "Confirmed", "Declined", "Rejected", "Waitlist", "All".
  - `filterApplicants(rows: ApplicantRow[], filter: ApplicantState | "all", query: string): ApplicantRow[]` — query matches name/email/school, case-insensitive.
  - `unsentCounts(rows: ApplicantRow[]): { accepted: number; rejected: number }`.

UI behavior (from the spec): default filter Pending; header checkbox selects the currently **visible** rows only; bulk bar "N selected · Accept N · Reject N · Clear"; row actions Accept/Reject (state `pending`), Undo (`*_unsent`), none otherwise; Reject (single or bulk) → `window.confirm(\`Reject ${n} applicant${n===1?"":"s"}? ${names.join(", ")}\n\nThey won't be told until an owner sends decisions.\`)`; row expand shows the detail fields, each `APPLICATION_QUESTIONS` label + answer, LinkedIn, and a "Resume" button that calls `getResumeUrl` and opens the URL in a new tab. `SendDecisionsBar` (owner only, hidden when both counts are 0): "**X accepted, Y rejected** not yet sent" + "Send decisions" → `window.confirm(\`Email ${X} acceptances and ${Y} rejections now?\`)` → `sendDecisions()`; shows "Sent N." plus failures / "N have no email address" when non-zero; button disabled while sending. Page loads `registrations` with `status <> 'draft'` embedded with `profiles(...)`, plus all `pending_decisions`, maps to `ApplicantRow[]`.

- [ ] **Step 1: Write the failing unit tests** `tests/unit/applications.test.ts`: `applicantState` for each status and both unsent decisions; `› a decision on a non-pending row is ignored` (status `accepted` + decision `rejected` → `"accepted"`); `filterApplicants` by state, by query (case-insensitive school match), `"all"`; `unsentCounts`.

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:unit -- tests/unit/applications.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/lib/applications.ts`, then the components and page.

- [ ] **Step 4: Write the e2e test** `tests/e2e/review.spec.ts` (sign in via `signIn`):
  - `staff accept and reject; the hacker still sees "Application received"`: two pending hackers; staff accepts A, rejects B (handle dialog with `page.once("dialog", d => d.accept())`); rows show "Accepted · not sent" / "Rejected · not sent"; Undo on A returns it to Pending; re-accept; sign in as A in a new context → portal heading "Application received".
  - `bulk select-all accepts only visible rows`: three pending, search narrows to one, select-all + Accept 1 → only that one queued.
  - `owner sees the Send decisions bar; staff don't`: with one queued decision, owner sees "1 accepted, 0 rejected"; staff page has no "Send decisions" button. (Actual sending is covered by Task 6; e2e has no Resend key.)

- [ ] **Step 5: Run to verify**
  Run: `npm run test:unit && npm run test:e2e -- tests/e2e/review.spec.ts && npm run lint && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 6: Commit** (`CLAUDE.md`: new "Application review" section replacing the roadmap item; `WIP.md`: tick review decision).
  ```bash
  git add src/lib/applications.ts src/components/staff src/app/staff/applications tests/unit/applications.test.ts tests/e2e/review.spec.ts CLAUDE.md WIP.md
  git commit -m "feat(staff): applications table with bulk accept/reject and Send decisions bar"
  ```

---

### Task 8: Check-in actions and search

**Files:**
- Create: `src/lib/checkin.ts`, `src/app/staff/checkin/actions.ts`
- Test: `tests/unit/checkin.test.ts`, `tests/actions/checkin.test.ts`

**Interfaces:**
- Consumes: `requireRole` (Task 5); RPCs `staff_check_in`, `staff_undo_check_in` (existing), `add_to_waitlist`, `admit_from_waitlist`, `remove_from_waitlist` (Task 2); `hasRequiredConsents` (`validation.ts`).
- Produces (`src/lib/checkin.ts`):
  - `type CheckinPerson = { userId: string; name: string; email: string; discordUsername: string | null; hasDiscord: boolean; hasConsents: boolean; status: RegistrationStatus | null; checkedInAt: string | null; waitlistedAt: string | null }` (`status` null = no registration; `hasDiscord` = `profiles.discord_id` not null)
  - `type CheckinState = "checked_in" | "can_check_in" | "waitlisted" | "needs_discord" | "needs_agreements" | "can_waitlist"`
  - `checkinState(p: CheckinPerson): CheckinState` — order: `checkedInAt` → `checked_in`; `confirmed` → `can_check_in`; `waitlist` → `waitlisted`; no Discord → `needs_discord`; no registration or no consents → `needs_agreements`; else `can_waitlist`.
  - `profileSearchFilter(query: string): string | null` — strips every char in `,()%*\\"` (PostgREST filter syntax and wildcards; apostrophes are kept so "O'Brien" still matches) and collapses whitespace; returns null when fewer than 2 chars remain; otherwise the PostgREST `.or()` string over `first_name`, `last_name`, `full_name`, `email`, `discord_username` with `ilike.%term%`. When the query has a space, also add `and(first_name.ilike.%first%,last_name.ilike.%rest%)`.
- Produces (`src/app/staff/checkin/actions.ts`, staff/owner unless noted; all revalidate `/staff/checkin`):
  - `searchPeople(query: string): Promise<{ ok: boolean; error?: string; people: CheckinPerson[] }>` — up to 25 profiles matching `profileSearchFilter`, joined with their registration and `Check-in` attendance; empty list when the filter is null.
  - `checkIn(userId: string)`, `undoCheckIn(userId: string)`, `addToWaitlist(userId: string)`, `admitFromWaitlist(userId: string)`, `removeFromWaitlist(userId: string)`: each `Promise<{ ok: boolean; error?: string }>`, passing RPC error messages through.
  - `setCapacity(capacity: number | null): Promise<{ ok: boolean; error?: string }>` — owner only; integer > 0 or null else "Capacity must be a positive whole number".
  - `getCheckinSummary(): Promise<{ checkedIn: number; capacity: number | null; waitlist: CheckinPerson[] }>` — used by the page; waitlist ordered by `waitlistedAt` ascending.

- [ ] **Step 1: Write the failing unit tests** `tests/unit/checkin.test.ts`: `checkinState` for every branch (table-driven); `profileSearchFilter › returns null under 2 chars`; `› strips filter syntax` (`"O'Brien, (x)%"` → contains `ilike.%O'Brien x%`, and no `,` or `(` inside any term); `› adds a first+last clause for "Jane Doe"`. *(Review Focus 4)*

- [ ] **Step 2: Write the failing action tests** `tests/actions/checkin.test.ts`: `searchPeople › finds by first name, email and Discord username` and returns the right `status`/`hasDiscord`/`checkedInAt`; `› doesn't error on "O'Brien, (x)"` *(Review Focus 4)*; `› hackers get "Not allowed"`; `checkIn › confirmed hacker checks in; undo removes it`; `addToWaitlist › passes "Link Discord first" through`; `admitFromWaitlist › confirms and checks in`; `setCapacity › owner sets 200; staff get "Not allowed"; 0 is rejected`; `getCheckinSummary › counts check-ins and orders the waitlist by time added`.

- [ ] **Step 3: Run to verify failure**
  Run: `npm run test:unit -- tests/unit/checkin.test.ts; npm run test:db -- tests/actions/checkin.test.ts`
  Expected: FAIL (modules not found).

- [ ] **Step 4: Implement** both files.

- [ ] **Step 5: Run to verify pass**
  Run: `npm run test:unit && npm run test:db -- tests/actions/checkin.test.ts`
  Expected: PASS.

- [ ] **Step 6: Commit** (`WIP.md`).
  ```bash
  git add src/lib/checkin.ts src/app/staff/checkin/actions.ts tests/unit/checkin.test.ts tests/actions/checkin.test.ts WIP.md
  git commit -m "feat(staff): check-in search, waitlist and capacity actions"
  ```

---

### Task 9: Check-in tab UI

**Files:**
- Create: `src/components/staff/CheckinSearch.tsx`, `src/components/staff/WaitlistTable.tsx`, `src/components/staff/CapacityEditor.tsx`
- Modify: `src/app/staff/checkin/page.tsx`
- Test: `tests/e2e/checkin.spec.ts`

**Interfaces:**
- Consumes: everything Task 8 produces.

UI behavior: counter line "**{checkedIn}** checked in / **{capacity}** capacity · **{n}** on waitlist · **{capacity − checkedIn}** spots open" (only "checked in" + waitlist when capacity is null; "spots open" never negative); owners see `CapacityEditor` (number input + Save). Sub-views via `?view=waitlist` ("Search" | "Waitlist (n)"). `CheckinSearch`: input debounced ~250 ms → `searchPeople`; each result shows name, email, Discord username or "Discord not linked", and per `checkinState`: `can_check_in` → "Check in"; `checked_in` → "Checked in {time}" + "Undo"; `waitlisted` → "Waitlist #{position}" (position from the summary list); `can_waitlist` → "Add to waitlist"; `needs_discord` → "Link Discord first" (disabled); `needs_agreements` → "Agreements not accepted" (disabled). After any action, re-run the search and `router.refresh()`. `WaitlistTable`: rows #, name, added time, "Admit & check in", and a small "Remove" (with `window.confirm`). Errors from actions show inline under the row.

- [ ] **Step 1: Write the e2e test** `tests/e2e/checkin.spec.ts`:
  - `staff search and check in a confirmed hacker, then undo`: confirmed hacker "Checky McCheck"; type "Checky"; click Check in → "Checked in"; counter shows 1; Undo → button returns.
  - `accepted no-RSVP goes to the waitlist and gets admitted`: accepted + `linkDiscord` + consents; Add to waitlist → "Waitlist #1"; open Waitlist view; Admit & check in → row gone, counter 1 checked in.
  - `no Discord shows "Link Discord first"`.
  - `owner sets capacity`: owner enters 150 → counter shows "/ 150 capacity"; staff see no capacity editor.

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:e2e -- tests/e2e/checkin.spec.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** the components and page.

- [ ] **Step 4: Verify**
  Run: `npm run test:e2e -- tests/e2e/checkin.spec.ts && npm run lint && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 5: Commit** (`CLAUDE.md`: "Day-of check-in" section; remove the staff-dashboard roadmap check-in item; `WIP.md`).
  ```bash
  git add src/components/staff src/app/staff/checkin tests/e2e/checkin.spec.ts CLAUDE.md WIP.md
  git commit -m "feat(staff): check-in tab with search, waitlist view and capacity counter"
  ```

---

### Task 10: Walk-in waitlist card in the portal

**Files:**
- Create: `src/components/portal/ConnectDiscordButton.tsx`, `src/components/portal/WalkInCard.tsx`
- Modify: `src/components/portal/RsvpButtons.tsx` (use `ConnectDiscordButton`), `src/app/portal/actions.ts` (add `joinWalkIn`), `src/app/portal/page.tsx`
- Test: `tests/actions/portal.test.ts`

**Interfaces:**
- Consumes: `walkInsOpen` (Task 4), `ensureRows`, `registrationFlagsSchema`.
- Produces:
  - `ConnectDiscordButton()` client component: the existing `connectDiscord` logic from `RsvpButtons` (link identity, redirect back to `/portal`), same button styling, own error line. `RsvpButtons` renders it instead of its inline copy.
  - `joinWalkIn(formData: FormData): Promise<{ ok: boolean; error?: string }>` in `src/app/portal/actions.ts`: signed in, else "Not authenticated"; `walkInsOpen()` else "Walk-ins aren't open"; `ensureRows({ withRegistration: true })`; if `first_name`/`last_name` fields are present, require both non-empty ("Enter your first and last name") and update the profile's `first_name`, `last_name`, `full_name` only where currently empty; then parse the consent checkboxes with `registrationFlagsSchema` (same field names as `saveRegistrationFlags`; extract a shared `consentsFromForm(formData)` helper in the same file and use it in both) and update the registration. Revalidates `/portal`.
  - `WalkInCard({ discordUsername, hasConsents, needsName }: { discordUsername: string | null; hasConsents: boolean; needsName: boolean })` client component: title "At the event? Join the waitlist"; Step 1 Connect Discord (✓ when linked); Step 2 agreements form (first/last name inputs only when `needsName`; the five required + three optional consent checkboxes with the same labels as `ProfileForm`) → `joinWalkIn` (✓ "Agreements accepted" when `hasConsents`); Step 3, when both done: "You're ready. Show this screen to a staff member at check-in."
  - Portal: `const walkIn = walkInsOpen() && status !== "confirmed" && status !== "waitlist";` When true, the status card renders `WalkInCard` instead of the normal status body/buttons (title from the card). `needsName` = profile has no `first_name` or no `last_name`. Waitlist copy becomes title "You're on the waitlist", body "Stay nearby: once check-in closes, staff will call names from the waitlist in order."

- [ ] **Step 1: Write the failing action tests** in `tests/actions/portal.test.ts`, mocking the window: `vi.mock("@/lib/constants", async orig => ({ ...(await orig()), walkInsOpen: () => walkInsOpenFlag }))` with a module-level `let walkInsOpenFlag = true`:
  - `joinWalkIn › creates a draft registration with consents for a user with none`.
  - `joinWalkIn › saves names only when the profile has none` (profile with first_name "Test" keeps it).
  - `joinWalkIn › requires both names when the fields are sent`.
  - `joinWalkIn › rejects missing required consents`.
  - `joinWalkIn › works for a rejected applicant (consents already true, no names sent)`.
  - `joinWalkIn › refuses outside the event window` (`walkInsOpenFlag = false` → "Walk-ins aren't open").
  - `saveRegistrationFlags › still works` (existing tests pass after the `consentsFromForm` refactor).

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:db -- tests/actions/portal.test.ts`
  Expected: FAIL (`joinWalkIn` not exported).

- [ ] **Step 3: Implement** the action, components and portal changes.

- [ ] **Step 4: Verify**
  Run: `npm run test:db -- tests/actions/portal.test.ts && npm run test:e2e -- tests/e2e/rsvp.spec.ts tests/e2e/application.spec.ts && npm run lint && npx tsc --noEmit`
  Expected: PASS (RSVP flow still works with the extracted button).

- [ ] **Step 5: Commit** (`CLAUDE.md`: hacker portal flow gains the walk-in card and new waitlist meaning; `WIP.md`).
  ```bash
  git add src/components/portal src/app/portal tests/actions/portal.test.ts CLAUDE.md WIP.md
  git commit -m "feat(portal): walk-in waitlist card during the event"
  ```

---

### Task 11: Devpost CSV parsing and judge assignment planning

**Files:**
- Create: `src/lib/devpost.ts`, `src/lib/judging.ts`
- Modify: `package.json` (`npm install papaparse && npm install -D @types/papaparse`)
- Test: `tests/unit/devpost.test.ts`, `tests/unit/judging.test.ts`

**Interfaces:**
- Produces:
  - `type ImportedProject = { title: string; devpost_url: string; track: string | null; description: string | null; team: string | null }`
  - `parseDevpostCsv(text: string): { projects: ImportedProject[]; skippedDrafts: number; error?: string }` — `Papa.parse` with `header: true, skipEmptyLines: true`; headers trimmed and BOM-stripped; column lookup case-insensitive with the old importer's alternates (title: "Project Title"/"Title"/"Project Name"; url: "Submission Url"/"Submission URL"/"Project URL"/"Devpost URL"; status: "Project Status"; track: "Opt-In Prizes"/"Track"/"Prizes"; description: "About The Project"/"Description"/"Elevator Pitch"; team: "Submitter First/Last Name" + "Team Member N First/Last Name", N = 1..10, joined ", "). Rows with status matching `/draft/i` count as `skippedDrafts`; rows missing title or url are dropped. Duplicate urls in one file: keep the first. When nothing usable: `error: "No submitted projects found. Is this the Devpost submissions export?"`.
  - `planAssignments(input: { projectIds: string[]; judgeIds: string[]; existing: { judgeId: string; projectId: string }[]; perProject?: number }): { judgeId: string; projectId: string }[]` — returns only **new** rows. `projectIds` are in table-number order.
  - `nextTableNumbers(currentMax: number | null, count: number): number[]` — `[max+1, …]`, starting at 1 when null.

  `planAssignments` algorithm:
  ```
  target = min(perProject ?? 3, judgeIds.length)
  load[j] = number of existing rows for judge j (judges not in judgeIds are ignored)
  for project in projectIds:
    have = judges already on project (from existing)
    while have.size < target:
      pick j in judgeIds, not in have, minimizing (load[j], index of j in judgeIds)
      add (j, project); have.add(j); load[j]++
  ```

- [ ] **Step 1: Write the failing tests**
  - `devpost.test.ts` (inline CSV strings): `› reads title, url, track, description and team`; `› skips drafts and counts them`; `› handles a BOM, CRLF and quoted commas/newlines` *(Review Focus 5)*; `› matches headers case-insensitively and with alternates`; `› drops rows without a url`; `› keeps the first of duplicate urls`; `› returns the "Is this the Devpost submissions export?" error for an unrelated CSV`.
  - `judging.test.ts`: `› 10 projects, 4 judges: every project gets 3 judges, loads are 7 or 8`; `› 2 judges: every project gets both`; `› no judges: nothing`; `› keeps existing assignments and never duplicates a judge on a project`; `› re-run after everything is full returns []`; `› only fills new projects after a late import and keeps loads balanced`; `› ignores existing rows for people who are no longer judges when counting load`; `nextTableNumbers › continues from the max / starts at 1`.

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:unit -- tests/unit/devpost.test.ts tests/unit/judging.test.ts`
  Expected: FAIL (modules not found).

- [ ] **Step 3: Implement** both modules.

- [ ] **Step 4: Run to verify pass**
  Run: `npm run test:unit`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add package.json package-lock.json src/lib/devpost.ts src/lib/judging.ts tests/unit/devpost.test.ts tests/unit/judging.test.ts WIP.md
  git commit -m "feat(judging): Devpost CSV parser and balanced judge assignment planner"
  ```

---

### Task 12: Judging actions

**Files:**
- Create: `src/app/staff/judging/actions.ts`
- Test: `tests/actions/judging.test.ts`

**Interfaces:**
- Consumes: `requireRole` (Task 5), `parseDevpostCsv`, `planAssignments`, `nextTableNumbers` (Task 11), staff RLS (Task 3).
- Produces (staff/owner; all revalidate `/staff/judging` and `/judge`):
  - `importDevpostCsv(formData: FormData): Promise<{ ok: boolean; error?: string; created?: number; updated?: number; skippedDrafts?: number }>` — field `file`; "Choose a CSV file" when missing/empty; "CSV is too large (10 MB max)" over 10 MB. Existing projects (by `devpost_url`) get `title`/`track`/`description`/`team` updated, never `table_number`; new ones are inserted with `nextTableNumbers(max(table_number), n)` in CSV order.
  - `assignJudges(): Promise<{ ok: boolean; error?: string; added?: number; minPerJudge?: number; maxPerJudge?: number }>` — judges = `user_roles.role = 'judge'`; projects ordered by `table_number` (nulls last), then `created_at`; inserts `planAssignments` output; min/max are each judge's total after the run.
  - `addJudge(projectId: string, judgeId: string)`, `removeJudge(projectId: string, judgeId: string)`, `setTableNumber(projectId: string, tableNumber: number | null)` (positive integer or null, else "Table number must be a positive whole number"), `deleteProject(projectId: string)`: each `Promise<{ ok: boolean; error?: string }>`. `addJudge` refuses a user who isn't a judge ("That person isn't a judge").

- [ ] **Step 1: Write the failing tests** `tests/actions/judging.test.ts` (build the CSV with a small helper that creates a `File` in a `FormData`, like `fileForm` in `tests/helpers/forms.ts`):
  - `importDevpostCsv › creates projects numbered 1..n in CSV order and skips drafts`.
  - `importDevpostCsv › re-import updates titles, keeps edited table numbers, numbers new projects after the max`.
  - `importDevpostCsv › hackers and judges get "Not allowed"`; `› rejects an empty file`.
  - `assignJudges › gives every project 3 of 4 judges and reports 7–8 per judge` (10 projects).
  - `assignJudges › second run after a late import only assigns the new project`.
  - `addJudge / removeJudge › staff move a project between judges`; `› addJudge refuses a non-judge`.
  - `setTableNumber › staff set 12; rejects 0 and 1.5`.
  - `deleteProject › removes the project and its assignments`.

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:db -- tests/actions/judging.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/app/staff/judging/actions.ts`.

- [ ] **Step 4: Run to verify pass**
  Run: `npm run test:db -- tests/actions/judging.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit** (`WIP.md`).
  ```bash
  git add src/app/staff/judging/actions.ts tests/actions/judging.test.ts WIP.md
  git commit -m "feat(judging): CSV import, judge assignment and manual edit actions"
  ```

---

### Task 13: Judging tab and judge dashboard UI

**Files:**
- Create: `src/components/staff/ProjectImport.tsx`, `src/components/staff/ProjectsTable.tsx`
- Modify: `src/app/staff/judging/page.tsx`, `src/app/judge/page.tsx`
- Test: `tests/e2e/judging.spec.ts`, `tests/fixtures/devpost-submissions.csv` (create; 4 rows incl. 1 draft, headers as in Task 11)

**Interfaces:**
- Consumes: Task 12 actions.

UI behavior: `ProjectImport` — hint "Devpost → Manage hackathon → Metrics → Export submissions (CSV)", file input, "Import CSV" button, result line "Imported N new, M updated, K drafts skipped." `ProjectsTable` — rows sorted by table number: table number (inline number input, saves on blur/Enter; duplicates highlighted with "Duplicate table"), title, "Devpost" link (new tab), judge chips with × (`removeJudge`), "+ judge" select of all judges not on the project (`addJudge`), Delete (`window.confirm`). Above the table: "Assign judges" button → result "Added N assignments. Each judge has {min}–{max} projects." (or "{n} each" when equal); hint when there are no judges: "No judges yet. Give people the Judge role in People (owners)." `/judge` page: `PageShell` "Judge Dashboard", list of assigned projects (table number, title, "Open on Devpost" new-tab link) ordered by table number; empty state "No projects assigned yet."

- [ ] **Step 1: Write the e2e test** `tests/e2e/judging.spec.ts`:
  - `staff import the CSV, assign judges, judges see their projects`: create 3 judges; staff upload fixture → "Imported 3 new, 0 updated, 1 drafts skipped"; Assign judges → every row shows 3 chips; sign in as a judge → `/judge` lists 3 projects with table numbers 1–3 and Devpost links.
  - `staff edit a table number and move a judge`: change table 2 → 9; remove judge A from a project and add them back; the judge's page reflects it.
  - `judge with no assignments sees the empty state`.

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:e2e -- tests/e2e/judging.spec.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** the components and both pages.

- [ ] **Step 4: Verify**
  Run: `npm run test:e2e -- tests/e2e/judging.spec.ts tests/e2e/roles.spec.ts && npm run lint && npx tsc --noEmit`
  Expected: PASS (roles.spec still finds the "Judge Dashboard" heading).

- [ ] **Step 5: Commit** (`CLAUDE.md`: Judging section replaces the roadmap entry; `/judge` no longer a placeholder; `WIP.md`: tick judge distribution decision, note column names to verify against a real export).
  ```bash
  git add src/components/staff src/app/staff/judging src/app/judge tests/e2e/judging.spec.ts tests/fixtures/devpost-submissions.csv CLAUDE.md WIP.md
  git commit -m "feat(judging): judging tab and judge project list"
  ```

---

### Task 14: People tab (roles)

**Files:**
- Create: `src/app/staff/people/actions.ts`, `src/components/staff/RoleManager.tsx`
- Modify: `src/app/staff/people/page.tsx`
- Test: `tests/actions/people.test.ts`, `tests/e2e/people.spec.ts`

**Interfaces:**
- Consumes: `requireRole`, `OWNER_ROLES` (Task 5), `profileSearchFilter` (Task 8), `set_user_role` RPC.
- Produces (owner only; revalidate `/staff/people`):
  - `type PersonWithRole = { userId: string; name: string; email: string; role: Role }`
  - `searchProfilesWithRoles(query: string): Promise<{ ok: boolean; error?: string; people: PersonWithRole[] }>` (≤ 25, via `profileSearchFilter`)
  - `listRoleHolders(): Promise<PersonWithRole[]>` (everyone with a `user_roles` row, sorted owner → staff → judge, then name)
  - `setRole(userId: string, role: Role): Promise<{ ok: boolean; error?: string }>` — passes `set_user_role` errors through (e.g. "Can't remove the last owner").

UI: "People must sign in once before they appear here." Current role holders table (name, email, role `<select>`), then a search box with results in the same row format. Changing a select calls `setRole`; on error the select reverts and shows the message.

- [ ] **Step 1: Write the failing action tests** `tests/actions/people.test.ts`: `setRole › owner makes someone a judge`; `› staff get "Not allowed"`; `› last owner can't demote themselves` (error /last owner/); `listRoleHolders › lists owners, staff and judges in order`; `searchProfilesWithRoles › finds by email and reports "hacker" for no role`.

- [ ] **Step 2: Run to verify failure**
  Run: `npm run test:db -- tests/actions/people.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** actions, component and page.

- [ ] **Step 4: Write and run the e2e test** `tests/e2e/people.spec.ts`: `owner makes a user a judge and they get the judge dashboard` (search by email, set Judge, sign in as them → Dashboard link goes to `/judge`).
  Run: `npm run test:db -- tests/actions/people.test.ts && npm run test:e2e -- tests/e2e/people.spec.ts && npm run lint && npx tsc --noEmit`
  Expected: PASS.

- [ ] **Step 5: Commit** (`CLAUDE.md`: Roles section — roles are set in the People tab, SQL snippet now optional; `WIP.md`: remove "make yourself owner" only if it no longer applies — the first owner still needs SQL, so keep it).
  ```bash
  git add src/app/staff/people src/components/staff/RoleManager.tsx tests/actions/people.test.ts tests/e2e/people.spec.ts CLAUDE.md WIP.md
  git commit -m "feat(staff): owner People tab for role management"
  ```

---

### Task 15: Final docs sweep and full verification

**Files:**
- Modify: `CLAUDE.md`, `WIP.md`, `.gitignore` (add `.superpowers/`), `supabase/schema.sql` (bottom snippets only)

- [ ] **Step 1: Sweep `CLAUDE.md`** against the code: Roles section (no "no role UI"), "Owner / staff / judge dashboards (placeholders)" section replaced by a description of the four tabs and `/judge`; Roadmap: remove Application review, Judging and Staff-dashboard items that are now built, keep the unbuilt ones (stats, workshop events/QR, run-of-show, schedule view, teams); data model, RPC list, lifecycle table, constants list, email section all match. Remove any sentence describing code that no longer exists.

- [ ] **Step 2: Sweep `WIP.md`**: tick "How application review should work", "How to format the dashboards", "How to distribute projects"; add organizer items: confirm `RSVP_WINDOW_DAYS`, `EVENT_START`/`EVENT_END`, set capacity before the event, review accepted/rejected email copy, verify Devpost CSV column names against a real export; known gap: "Send decisions" clicked twice at once by two owners can double-email a batch (button is disabled while sending; no server lock).

- [ ] **Step 3: Full verification**
  Run: `npm run lint && npx tsc --noEmit && npm test && npm run test:e2e`
  Expected: all PASS. (Without Docker: `npm run lint && npx tsc --noEmit && npm run test:unit`, and say the integration layer is left to CI.)

- [ ] **Step 4: Commit**
  ```bash
  git add CLAUDE.md WIP.md .gitignore supabase/schema.sql
  git commit -m "docs: document staff, owner and judge dashboards"
  ```
