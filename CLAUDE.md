# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Registration and information website for UF SASE Hacks, a hackathon. Next.js 15 (App Router) + TypeScript, Supabase (Postgres/Auth/Storage), Tailwind CSS 4, Google Docs (FAQ content, via public export), Resend (transactional email).

The application/acceptance design is in `docs/superpowers/specs/2026-10-29-applications-acceptance-design.md`.

## Rule: keep WIP.md current

`WIP.md` (repo root) tracks in-progress work and next steps. **After every code change, update `WIP.md` in the same change:**
- Check off finished items.
- Add new follow-ups, known gaps, or setup steps the change introduced.
- Remove items that no longer apply.

Commit it together with the code it describes.

## Rule: keep CLAUDE.md current

**After every code change, also update this file if the change affects anything documented here**, in the same commit as the code. That includes:
- architecture, data model, schema/RPCs/guards
- routes and flows
- env vars, constants/flags
- conventions, commands, roadmap

Fix or remove anything the change made out of date. Nothing here should describe code that no longer exists.

## Commands

```bash
npm run dev      # start dev server (Turbopack), http://localhost:3000
npm run build    # production build (Turbopack)
npm run start    # run a production build
npm run lint     # eslint (flat config extending next/core-web-vitals, next/typescript)

npm run test:unit   # Vitest unit tests, no database (runs anywhere)
npm run db:start    # start local Supabase in Docker (npx supabase start); db:stop to stop it
npm run test:db     # Vitest DB + server action tests against local Supabase
npm run test:e2e    # Playwright browser tests (starts its own next dev servers on 3100/3101)
npm test            # unit + DB/action tests
npm run test:coverage
```

**Rule: don't run `npm run build` while `npm run dev` is running.** Both write to `.next/`, so a build overwrites the dev server's files and it starts throwing `ENOENT ... _buildManifest.js.tmp...` errors. Check first (`pgrep -fl "next dev"`). If a dev server is up, verify with `npm run lint` and `npx tsc --noEmit` instead, or ask before building. To recover: stop the dev server, `rm -rf .next`, then `npm run dev`.

### Testing

Four layers, all in `tests/`. CI (`.github/workflows/test.yml`) runs them on every PR and on pushes to `dev`/`main`: a `static` job (lint, `tsc`, unit tests) then an `integration` job (local Supabase in Docker, DB/action tests, Playwright). CI needs no secrets.

- `tests/unit/` — pure logic in `src/lib/` (validation, FAQ parser, email templates/sending with mocked `fetch`, `saveResume` with a fake client, `safeNextPath`, flags/deadline, search helpers, check-in state/search filter).
- `tests/db/` — guards, RLS per table × role, storage policies, every RPC. Each test signs in real users with JWTs (anon key), so RLS and guards apply.
- `tests/actions/` — server actions called directly, with `@/lib/supabase/server`, `next/cache` and `next/navigation` mocked (`tests/helpers/next.ts`; `actAs(user)` picks the caller). `session.test.ts` covers `requireRole` the same way. Resend is mocked by `mockResend()` (also in `tests/helpers/next.ts`), which routes `api.resend.com` calls to a `vi.fn`.
- `tests/e2e/` — Playwright against two `next dev` servers: port 3100 with both flags on, 3101 with both off (`flags-off.spec.ts`). They build into `.next-e2e*` (`NEXT_DIST_DIR`, read by `next.config.ts`) so they don't clobber `npm run dev`. Sessions are injected as Supabase auth cookies (`signIn` in `tests/e2e/support.ts`); one test does the real magic link via Mailpit.

How the test database works:
- Local Supabase is configured by `supabase/config.toml` (tests only: manual identity linking on, email confirmations off, high auth rate limits, site URL `localhost:3100`). There are no `supabase/migrations`; the test setup (`tests/setup/schema.ts`) applies `supabase/schema.sql` itself, so the tests always run the real schema file.
- Connection details come from `supabase status -o env` (`tests/setup/env.ts`), never from `.env`/`.env.local`, and the setup refuses non-localhost URLs. Tests truncate tables, so they must never point at the hosted project.
- App data is wiped before each test file (`RESET_SQL`). Tests make users with unique emails via `createUser({ role })` in `tests/helpers/users.ts`.
- Real Discord OAuth can't run in tests: `linkDiscord(userId)` inserts an `auth.identities` row, which is all `rsvp()` and `sync_discord_profile()` read. Tests that need an already-decided applicant set it with `accept()`/`setRegistration()` through the service role, like the SQL editor; the review UI itself is covered by `tests/e2e/review.spec.ts`.
- E2E servers get explicit empty `RESEND_API_KEY`/`GOOGLE_FAQ_DOC_ID` and local Supabase keys. Next only fills env keys that aren't already set, so the real values in `.env` never load.

When you change the schema, an RPC, a guard or an action, add or update the matching tests. Without Docker locally, run `npm run test:unit`, lint and `tsc`, and let CI run the rest.

### Environment variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GOOGLE_FAQ_DOC_ID=   # ID from docs.google.com/document/d/<ID>/edit; doc must be "Anyone with the link can view"
RESEND_API_KEY=
EMAIL_FROM=          # e.g. "SASEHacks <team@sasehacks.com>", on a domain verified in Resend
EMAIL_REPLY_TO=      # an inbox organizers read
NEXT_PUBLIC_LOGIN_ENABLED=          # "true" shows login; anything else hides it
NEXT_PUBLIC_REGISTRATIONS_ENABLED=  # "true" opens applications (until APPLICATIONS_CLOSE)
```

The two `NEXT_PUBLIC_*_ENABLED` flags are set per environment: on in local `.env` and Vercel Preview (`dev`), off in Production until launch. They're inlined at build time, so redeploy after changing them in Vercel.

Without `RESEND_API_KEY`/`EMAIL_FROM`, emails are skipped (logged) and stay queued; nothing else breaks.

The full database schema (tables, functions, triggers, RLS, storage bucket + policies, indexes) is in `supabase/schema.sql`. It is applied by hand in the Supabase SQL editor (no migration tooling) and is written to be safe to re-run. The test suite also applies it to the local test database on every run (see Testing). Keep it in sync with any DB change you make in the dashboard. The bottom of the file has commented-out snippets for giving someone a role, assigning judges to projects, and testing the guards.

## Architecture

### Auth & session refresh

Login is Discord-first: `SignInForm` offers "Continue with Discord" (Supabase OAuth) plus a secondary email magic link (for applicants without Discord, and organizers/judges/sponsors). Google/GitHub were removed. Discord is required later, at RSVP: an accepted hacker who signed in by email links Discord from the portal via `supabase.auth.linkIdentity` (requires manual identity linking enabled in Supabase Auth settings). `ensureRows()` calls the `sync_discord_profile()` RPC on every portal visit to copy the linked identity onto `profiles.discord_id`/`discord_username`. `/auth/callback` only redirects to same-site `next` paths (`safeNextPath` in `src/lib/safeNext.ts`).

Supabase dashboard config (not in code): Discord provider enabled, Site URL/redirect URLs, and Resend as custom SMTP so magic-link emails aren't limited by Supabase's built-in mailer (these count against the Resend quota).

`middleware.ts` runs on every request except `_next/static`, `_next/image`, `favicon.ico`, and `api/faq`, and calls `supabase.auth.getUser()` purely to refresh the session cookie. Actual route protection is NOT done in middleware — it's done per-layout:

- `src/app/portal/layout.tsx` — redirects to `/login` if unauthenticated.
- `src/app/staff/layout.tsx` — owner or staff, else `/portal`. `/staff/people` also redirects non-owners to `/staff/applications`.
- `src/app/judge/layout.tsx` — judge or owner, else `/portal`.

Every server action must re-check the caller's role itself (defense in depth): staff/owner actions start with `requireRole(STAFF_ROLES)` or `requireRole(OWNER_ROLES)` from `src/lib/session.ts` and return its `error` on `ok: false`. Don't assume the layout check is sufficient when adding new actions/routes.

### Roles

Four roles: **owner** (`/staff` dashboard, including sending decisions), **staff** (`/staff` dashboard; reviews applications), **judge** (`/judge` dashboard), **hacker** (no `user_roles` row; the default, gets `/portal`). One role per user. `/staff` is a tabbed shell whose Applications tab is built and other tabs are still placeholders, and `/judge` is a placeholder (see below); the DB side (RPCs, RLS, judging tables) is in place for them.
- `src/lib/roles.ts` — constants only (`roles`, `ROLE_HOME`: owner/staff → `/staff`, judge → `/judge`, hacker → `/portal`; `STAFF_ROLES` = owner + staff, `OWNER_ROLES` = owner), safe for client components.
- `src/lib/session.ts` — server-only: `getCurrentRole()` (user + role via the `user_role` RPC) and `requireRole(allowed)`, which returns `{ ok: true, supabase, user, role }` or `{ ok: false, error: "Not authenticated" | "Not allowed" }`.
- The header has a single "Dashboard" link (outlined, like Login/Sign Out) to `ROLE_HOME[role]`.
- There's no role UI yet: roles are set with the SQL snippet at the bottom of `schema.sql`. The `set_user_role` RPC (owner-only, protects the last owner) exists for a future UI. Someone must sign in once (so they have a `profiles` row) before they can be given a role.

### Data model (source of truth: `supabase/schema.sql`)

Tables (all in `public`, all with RLS enabled):
- `profiles` — keyed by `id` → `auth.users(id)` (cascade). Personal/demographic info: `full_name`, `first_name`, `last_name`, `email` (unique; where status emails go, editable on the form), `phone_number`, `date_of_birth`, `age`, `school`, `major`, `grad_year`, `level_of_study`, `engineering_skill`, `hackathon_experience`, `linkedin_url`, `country`, `tshirt`, `dietary text[]`, `accessibility`, `gender`, `race text[]`, `discord_id` (unique)/`discord_username` (set only by `sync_discord_profile`), `created_at`/`updated_at`.
- `registrations` — keyed by `user_id` → `profiles(id)` (cascade). `status` (check-constrained, default `draft`, see lifecycle below), `editing_locked`, admin-only `notes`/`review_score` (1–5)/`reviewed_by`, lifecycle timestamps (`submitted_at`, `accepted_at`, `rsvp_deadline`, `rsvp_at`, `waitlisted_at` = when staff added them to the on-site waitlist, orders the line), `last_emailed_status` (email queue marker), `responses jsonb` (free-response answers keyed by question id), consent flags (`accuracy_agreement`, `terms_and_conditions`, `code_of_conduct`, `can_photograph`, `share_resume_with_companies`, `mlh_code_of_conduct`, `mlh_data_sharing`, `mlh_communications`), resume fields (`resume_url`, `resume_updated_at`), timestamps.
- `settings` — single row (`id = true`). `applications_close`, enforced by `submit_application()`. Keep it in sync with `APPLICATIONS_CLOSE` in `src/lib/constants.ts`. `capacity integer` (null = not set; check `capacity > 0`), the event capacity for the day-of check-in counter. Readable by signed-in users, writable by admins (owners).
- `user_roles` — `(user_id, role)` PK plus a unique index on `user_id` (one role per user); `role` is constrained to `'owner'`, `'staff'` or `'judge'` (no row = hacker). Re-running `schema.sql` migrates old `admin` rows to `owner` and deletes `sponsor` rows. Users can read their own row, staff and owners can read all; there are no write policies (writes go through `set_user_role` or the SQL editor).
- `events` — `event_name` (unique), `self_checkin_open`, `checkin_code` (random, embedded in a QR for self check-in). A `Check-in` event (main event check-in) is seeded. Owners have full access; staff can read.
- `attendance` — one row per `(user_id, event_id)` (unique) = "this person attended this event"; `checked_in_by` defaults to `auth.uid()`. Users can read their own rows; staff can read all; owners have full access. Staff check-in writes go through `staff_check_in` and `admit_from_waitlist` (called by the check-in actions in `src/app/staff/checkin/actions.ts`).
- `projects` — `title`, `devpost_url` (unique, the import upsert key), `track`, `table_number integer` (re-running `schema.sql` converts an old text column once, keeping only its digits), `description`, `team`. No app code yet. Owners and staff have full access (`projects_owner_all`, `projects_staff_all`); judges can read only projects assigned to them.
- `judge_assignments` — `(judge_id, project_id)` PK. **No UI yet**; assign with the SQL snippet at the bottom of `schema.sql`. Owners and staff have full access (`judge_assignments_owner_all`, `judge_assignments_staff_all`), judges read their own. `set_user_role` deletes a user's assignments when they stop being a judge.
- `judge_scores` — `(judge_id, project_id)` PK, `scores jsonb` keyed by criterion id (no app code yet), `comments`, `updated_at`. Judges read/write only their own sheets for assigned projects; owners full access.
- `mailing_list` — `email` (unique on `lower(email)`), `created_at`. Filled from the hero's `MailingListForm` (`src/components/MailingListForm.tsx`) via `joinMailingList` in `src/app/actions.ts` (no account needed; duplicate signups are treated as success). RLS: anyone (`anon`/`authenticated`) can insert, only admins can read/modify.
- `pending_decisions` — `user_id` PK → `registrations(user_id)` (cascade), `decision` (`accepted`/`rejected`), `decided_by` → `auth.users` (set null), `decided_at`. Review decisions staff have made that an owner hasn't sent yet: `registrations.status` stays `pending` until `apply_decisions` runs, so the portal can't show a decision before its email goes out. RLS: staff/owners read; hackers and judges see nothing; no write policies (writes only via `set_decisions`/`clear_decisions`/`apply_decisions`).

#### Application lifecycle (`registrations.status`)

| status | meaning | set by |
|---|---|---|
| `draft` | clicked Apply, not submitted ("Started, not submitted") | `ensureRows({ withRegistration: true })` on `/portal/onboarding` (insert guard forces it) |
| `pending` | submitted, awaiting review (always has `submitted_at`; `schema.sql` resets `pending` rows without one, left over from the old `pending` default, to `draft`) | `submit_application()` RPC |
| `accepted` | offered a spot, must RSVP by `rsvp_deadline` | owner's Send decisions (`apply_decisions`) |
| `confirmed` | RSVP'd yes (attending) | `rsvp(true)` RPC (needs a linked Discord identity), staff admitting from the waitlist (`admit_from_waitlist`), or owner |
| `declined` | RSVP'd no, dropped out, RSVP expired, or removed from the on-site waitlist | `rsvp(false)` / `remove_from_waitlist` / owner |
| `waitlist` | on-site waitlist, set by staff on event day (`add_to_waitlist`) | staff (`add_to_waitlist`) |
| `rejected` | rejected | owner's Send decisions (`apply_decisions`) |

`confirmed` means attending, which is what `self_check_in` requires. Accept/reject decisions are queued in `pending_decisions` (`set_decisions`) and only reach `registrations.status` when an owner sends them (`apply_decisions`). Staff/owners queue them on the Applications tab (see "Application review" below); the server actions are in `src/app/staff/applications/actions.ts` (see Email below). Review only accepts/rejects; `waitlist` is the event-day waitlist (`add_to_waitlist`). Status labels and the ordered list live in `src/lib/validation.ts` (`registrationStatuses`, `registrationStatusLabels`).

#### Email (`src/lib/email.ts`)

Sent through Resend's batch HTTP API with `fetch` (no SDK). `statusEmail(status, { firstName, rsvpDeadline? })` holds the templates. Hacker-triggered (application received, RSVP confirm/decline) are sent immediately by `emailOwnStatus` in `src/app/portal/actions.ts`, then marked via the `mark_own_status_emailed` RPC. A failed send is logged and not retried; `last_emailed_status` stays behind, so a future queue can find it. Decision templates exist for `accepted` (includes the RSVP deadline, an ISO `rsvpDeadline` formatted like the portal's, in ET, when given) and `rejected` (links `/#mailing-list`); waitlist has no email. Decision emails are sent by the owner-only `sendDecisions` action in `src/app/staff/applications/actions.ts`: it loads the whole `pending_decisions` queue with each applicant's current status, clears (via `clear_decisions`, without emailing, counted as `stale`) queued rows whose applicant is no longer `pending`, skips (leaves queued, counts as `noEmail`) applicants with no profile email, then per batch of up to 100 emails the batch with an RSVP deadline of `rsvpDeadlineFrom(now)` and, only if Resend accepted it, calls `apply_decisions` with exactly those items and that deadline. A failed batch stays queued and stops later batches. If `apply_decisions` returns fewer ids than it was given (status changed after the email went out), the missing ones are logged and counted in `failed`, so `ok` is false. It refuses ("Email is not configured") and changes nothing without `RESEND_API_KEY`/`EMAIL_FROM`. Returns `{ ok, error?, sent, failed, noEmail, stale }`.

Main-event check-in (`staff_check_in`/`staff_undo_check_in`), the on-site waitlist RPCs and `settings.capacity` are used by the server actions in `src/app/staff/checkin/actions.ts` (the Check-in tab UI that calls them is still a placeholder). Workshop events and QR `self_check_in` exist in the DB but are **not used by the app code yet** (see Roadmap).

Functions (RPCs):
- `user_role(p_uid)` — returns `'owner'`/`'staff'`/`'judge'`, or `'hacker'` when there's no row.
- `is_owner(p_uid)`, `is_staff(p_uid)` (owner or staff), `is_judge(p_uid)` — `security definer` role checks used by RLS.
- `is_admin(p_uid)` — **legacy name for `is_owner`**. Kept because the guards and most RLS policies call it; "admin" in the schema means owner.
- `set_user_role(p_user_id, p_role)` — owner-only. `'hacker'` deletes the row. Refuses to remove the last owner. Any role other than `'judge'` also deletes that user's `judge_assignments`.
- `staff_check_in(p_user_id)` / `staff_undo_check_in(p_user_id)` — staff/owner only, on the seeded `Check-in` event. Check-in requires `status = 'confirmed'`; idempotent.
- `add_to_waitlist(p_user_id)` — staff/owner only (`42501`). On-site waitlist for event day: works for any registration (accepted no-RSVP, draft walk-in, pending, declined, rejected) that has a linked Discord identity and the required consents. Errors, in order (exact text, shown in the UI): "No application or walk-in agreements found", "Link Discord first", "Agreements not accepted", "Already confirmed", "Already on the waitlist". Sets `status = 'waitlist'`, `waitlisted_at = now()` and deletes any `pending_decisions` row. The Discord + consents check lives in `waitlist_eligibility_error(p_user_id)` (returns the error text or null; internal, not executable by `anon`/`authenticated`).
- `admit_from_waitlist(p_user_id)` — staff/owner only. "Not on the waitlist" unless `waitlist`, then re-checks eligibility ("Link Discord first" / "Agreements not accepted"), since a waitlist row can lack them (older rows, SQL edits, consents changed after joining). Sets `confirmed` and inserts the `Check-in` attendance row like `staff_check_in` (`checked_in_by` = caller).
- `remove_from_waitlist(p_user_id)` — staff/owner only. "Not on the waitlist" unless `waitlist`. Sets `declined`, `waitlisted_at = null`.
- `self_check_in(p_code)` — lets an authenticated user check themselves into an event whose `self_checkin_open` is true and whose `checkin_code` matches. Requires `registrations.status = 'confirmed'`. Idempotent. Returns the event name. Attendees have no direct insert access to `attendance`, so this is the only path for them.
- `submit_application()` — `draft` → `pending`, sets `submitted_at`. Checks `settings.applications_close`, the required consents and that a resume is on file (resume is required). Profile field validation is app-side.
- `rsvp(p_attending)` — `accepted` → `confirmed`/`declined` before `rsvp_deadline`; `confirmed` → `declined` any time. Confirming requires an `auth.identities` row with provider `discord`. Returns the new status.
- `sync_discord_profile()` — copies the caller's Discord identity onto their profile. Returns the username or null.
- `mark_own_status_emailed(p_status)` — sets the caller's `last_emailed_status` (only if it matches their current status).
- `set_decisions(p_user_ids uuid[], p_decision text)` — staff/owner only (`42501` otherwise). `p_decision` must be `accepted`/`rejected` ("Unknown decision" otherwise). Upserts `pending_decisions` (`decided_by = auth.uid()`) for applicants whose status is `pending`; others are skipped. Returns how many were queued.
- `clear_decisions(p_user_ids uuid[])` — staff/owner only. Deletes those queued decisions; returns the count.
- `apply_decisions(p_items jsonb, p_rsvp_deadline timestamptz)` — owner only (`42501` "Only owners can send decisions"). `p_items` = `[{"user_id", "decision"}]`, i.e. exactly what was emailed: the decision passed in wins over the queued one. For each registration still `pending`: `status`/`last_emailed_status := decision`, `reviewed_by :=` the queued `decided_by` (null if gone), and for `accepted` also `accepted_at := now()`, `rsvp_deadline := p_rsvp_deadline`. Deletes every item's queue row (applied or skipped). Returns the applied ids.
- `keep_alive()` — `security definer`, callable by `anon`. Returns `count(*)` of `mailing_list` (never the emails). Called every 3 days by `.github/workflows/supabase-keepalive.yml` so the free-tier project doesn't pause.

DB-enforced guards (triggers). These apply only to non-admin callers with a JWT. The SQL editor and service role (`auth.uid()` null) bypass them:
- Non-admins can't change `registrations.status`, `editing_locked`, `notes`, `user_id`, `review_score`, `reviewed_by`, the lifecycle timestamps, `waitlisted_at`, or `last_emailed_status` (raises `42501`). They also can't change `responses` once the row is out of `draft`.
- Registrations inserted by non-admins are forced to `draft`/unlocked with all admin fields null. This forces values rather than raising, so `ensureRows()` keeps working.
- Profile updates raise `42501` when the user's registration has `editing_locked = true`. RLS also blocks owner updates to a locked registration.
- Non-admins can't set `profiles.discord_id`/`discord_username` directly.
- The hacker-facing RPCs above and the staff waitlist RPCs still run with the caller's JWT, so they set the transaction-local GUC `sasehacks.bypass_guard = 'on'` around their own update (checked by `guard_bypassed()`). Use the same pattern for any new hacker- or staff-facing RPC that writes guarded columns.
- `updated_at` is auto-touched on `profiles`, `registrations` and `judge_scores`.
- Staff have **read-only** RLS on `profiles`/`registrations` (including admin notes/scores) and are still "non-admin" for every guard above.

So the app-side checks are not the only line of defense, but don't rely on the DB alone either — keep the server-action checks.

Resumes are required to submit. Upload validation (10 MB, PDF signature check) and storage live in one helper, `saveResume()` in `src/lib/resume.ts`, used by both the onboarding form and `/portal/resume`. They are stored in the private `resumes` Supabase Storage bucket at the fixed path `{user_id}/resume.pdf` (always this exact filename — uploads use `upsert: true` to overwrite). Storage policies only let a user write `.pdf` files under their own `{user_id}/` prefix, and only the resume's owner, staff or owners can read them (staff open resumes while reviewing; judges can't). Hackers download their own resume through a short-lived signed URL rather than a public URL. General images (landing page assets) are served locally from `public/images/`, referenced via `getPublicImageUrl()` in `src/lib/images.ts`.

`ensureRows()` in `src/app/portal/actions.ts` lazily creates a user's `profiles` row on portal visits. The `registrations` row is only created when they start an application (`ensureRows({ withRegistration: true })`, called by `/portal/onboarding` while applications are open), so portal visits, staff and judges don't count as applicants. No registration row = "Not started". `/portal/profile` and `/portal/resume` redirect to `/portal` until a registration exists.

### Hacker portal flow

- The header (`Header.tsx` → `HeaderClient.tsx`) shows a "Dashboard" link to `/portal` for any signed-in user (desktop button + mobile menu).
- `/portal` always renders for a logged-in user (no redirect home). One main card is driven by `registrations.status`: with no registration row it shows time left and an "Apply" link; a draft (they clicked Apply) shows "Continue application" plus a Profile/Agreements/Resume checklist (`isProfileComplete`/`hasRequiredConsents` in `validation.ts`) (or "Applications are closed"); pending shows submission date and `DECISIONS_BY`; accepted shows `RsvpButtons` (Step 1 Connect Discord, Step 2 confirm/decline); confirmed shows event info plus a drop-out link; waitlist/declined/rejected show a message (declined/rejected/closed also link to the hero mailing list, `/#mailing-list`). Edit Profile/Resume cards are hidden while in draft.
- `/portal/profile` edits the profile + consents (`ProfileForm`), read-only once `editing_locked`. Free-response answers are **not** editable after submitting: `saveResponses` only works in `draft`, and the DB guard blocks non-admin changes to `responses` once status leaves `draft`.
- `/portal/onboarding` is the application form. It's only reachable in `draft` (otherwise it redirects to `/portal`). "Submit Application" saves profile → consents → resume (optional if one is already on file) → free-response answers, then calls `submitApplication()`.

### Owner / staff / judge dashboards

`/staff` (owner + staff): `src/app/staff/layout.tsx` renders `PageShell` (`src/components/PageShell.tsx`) titled "Owner Dashboard" or "Staff Dashboard" by role, with `StaffTabs` (`src/components/staff/StaffTabs.tsx`, client; active tab from `usePathname()`) above the page. Tabs: Applications `/staff/applications`, Check-in `/staff/checkin`, Judging `/staff/judging`, and People `/staff/people` (owner only; the page redirects non-owners to `/staff/applications`). `/staff` itself redirects to `/staff/applications`, so the header's "Dashboard" link lands there. The Applications tab is built (see "Application review" below); Check-in, Judging and People are "Coming next." placeholders for now.

### Application review (`/staff/applications`)

`src/app/staff/applications/page.tsx` (server) loads every registration with `status <> 'draft'` embedded with its `profiles(...)` row, plus all `pending_decisions`, and maps them to `ApplicantRow[]` (major/level of study as labels from `validation.ts`). Pure helpers in `src/lib/applications.ts` (unit-tested): `applicantState(row)` (an unsent decision only counts while `status = 'pending'`, giving `accepted_unsent`/`rejected_unsent`), `APPLICANT_FILTERS` (Pending, Accepted · not sent, Rejected · not sent, Accepted, Confirmed, Declined, Rejected, Waitlist, All), `filterApplicants(rows, filter, query)` (query matches name/email/school, case-insensitive) and `unsentCounts(rows)`.
- `ApplicationsTable` (`src/components/staff/`, client): filter (default Pending) + search, columns checkbox/name/school/grad year/submitted/state/actions. Only `pending` rows have checkboxes; the header checkbox selects the visible ones. Bulk bar "N selected · Accept N · Reject N · Clear" (Clear only deselects). Row actions: Accept/Reject for Pending, Undo (`clearDecisions`) for unsent decisions, none once sent. Reject (single or bulk) asks `window.confirm` naming the applicants. Clicking a name expands the details (email, major, level, grad year, hackathon experience, skill, each `APPLICATION_QUESTIONS` answer, LinkedIn as a link only when it's http(s), and a Resume button that opens a `getResumeUrl` signed link in a new tab).
- `SendDecisionsBar` (client, owners only, hidden when nothing is queued): "**X accepted, Y rejected** not yet sent" + "Send decisions" (`window.confirm`, then `sendDecisions()`; disabled while sending). Shows "Sent N." plus failed / no-email / no-longer-pending counts and any error.

`/judge` (judge + owner) is still an empty "Coming soon" page using `PageShell`. Its layout enforces the role check. Keep these pages lean: add features only once they're designed.

### Server actions pattern

Mutations live in colocated `actions.ts` files (`src/app/actions.ts`, `src/app/portal/actions.ts`, `src/app/portal/resume/actions.ts`, `src/app/staff/applications/actions.ts`, `src/app/staff/checkin/actions.ts`) marked `"use server"` (these files may only export async functions and types). Each action independently re-fetches the authenticated user via `createSupabaseServerClient()` (staff actions do it through `requireRole(STAFF_ROLES)` / `requireRole(OWNER_ROLES)`) and re-checks authorization — there is no shared middleware-level guard for mutations. Actions return `{ ok: boolean, error?: string, ... }` rather than throwing, and call `revalidatePath(...)` on the affected route(s) after a successful mutation instead of relying on client-side refresh.

Two Supabase client constructors exist and are not interchangeable:
- `src/lib/supabase/server.ts` (`createSupabaseServerClient`) — for server components/actions, cookie-based, async.
- `src/lib/supabase/client.ts` (`createSupabaseBrowserClient`) — for client components (`"use client"`).

### Validation

`src/lib/validation.ts` is the single source of truth for profile/registration form shape: Zod schemas (`profileSchema`, `registrationFlagsSchema`, `responsesSchema`) plus the option lists + human-readable label maps (t-shirt sizes, dietary, gender, race, major, level of study, etc.) that the forms rely on. When adding a new profile field, it typically needs to be threaded through: the schema in `validation.ts`, the form component in `src/components/forms/`, and the `upsertProfile` field mapping in `src/app/portal/actions.ts`.

Form selects start blank when the answer isn't known (only `email` is prefilled, from the auth email): the page components pass `ProfileFormDefaults` (enum fields may be `""`), so a required select fails validation until the applicant picks something. Don't add guessed defaults back.

**Free-response questions are different and much cheaper to change:** edit only the `APPLICATION_QUESTIONS` array (`id`, `label`, `placeholder?`, `required`, `maxLength`). Answers go in `registrations.responses` keyed by `id`. The onboarding form and `responsesSchema` loop over the array, so no schema/action changes are needed. Removing a question hides old answers but keeps them (`saveResponses` merges). Never reuse an old `id` for a different question.

### Landing page sections

`src/app/page.tsx` composes independent section components from `src/components/sections/` (Hero, About, Tracks, Schedule, Sponsors, Partners, Teams, FAQ). Each section is intentionally kept in its own file so multiple people can work on different sections without merge conflicts — follow that convention when touching the landing page rather than inlining sections back into `page.tsx`.

### FAQ via Google Docs

`src/lib/googleDocs.ts` fetches the FAQ Google Doc's public Markdown export (`/export?format=md`, no API key; the doc must be shared as "Anyone with the link can view") and parses it top-down into `{ id, question, answer, order }`: a `Q:` line starts an item, `A:` starts its answer (following paragraphs/bullets are included), any heading (section titles like "General" — these must use a Heading paragraph style) ends the current item, and a line reading `Hidden` stops parsing so drafts can sit below it. Links come through as markdown. `src/app/page.tsx` fetches it server-side (revalidate 600s) and renders `FaqSection`; it's also exposed via `src/app/api/faq/route.ts` (excluded from the auth-refresh middleware matcher). Failures are swallowed (returns `[]` with a console error), so a missing/private doc degrades gracefully rather than breaking the page.

### Feature flags & event constants

All in `src/lib/constants.ts`:
- `REGISTRATIONS_ENABLED` / `LOGIN_ENABLED`: master switches read from `NEXT_PUBLIC_REGISTRATIONS_ENABLED` / `NEXT_PUBLIC_LOGIN_ENABLED` (true only when the value is exactly `"true"`). Toggle them per environment, not in code.
- `registrationsOpen()` = `REGISTRATIONS_ENABLED && now < APPLICATIONS_CLOSE`. It's a function, not a constant, so the deadline takes effect without a redeploy. The DB enforces the deadline separately via `settings.applications_close`.
- `APPLICATIONS_CLOSE`, `DECISIONS_BY`, `RSVP_WINDOW_DAYS` (7), `EVENT_START`/`EVENT_END` are **placeholders** to confirm with organizers.
- `rsvpDeadlineFrom(sentAt)` = `sentAt + RSVP_WINDOW_DAYS` days (the RSVP deadline for a decision sent then).
- `walkInsOpen(now?)` = `EVENT_START <= now <= EVENT_END` (inclusive; not gated on `REGISTRATIONS_ENABLED`): when walk-ins can join the on-site waitlist.
- Event info (dates, venue, city, `SITE_URL`, Discord/Devpost links) is also here.

## Roadmap / WIP

Planned modules that do not exist yet. Treat these as intended direction, not implemented features — check the code before assuming any of this is built.

### Hacker dashboard (extends `/portal`)

- Profile view/edit, including resume upload (reuse existing `portal/profile` and `portal/resume` pages)
- Event schedule in a calendar-style view
- Built: status-driven home card with application, RSVP and Discord linking (see "Hacker portal flow")
- Open ideas (not yet decided):
  - Check-in status
  - Event-day info: venue, wifi, parking, hacker guide, Discord/Devpost links (from `src/lib/constants.ts`)
  - Team management (create/join team, list teammates)
  - Announcements feed
  - QR self check-in for workshops/events (backend ready: `self_check_in(p_code)` RPC + `events.checkin_code`)
  - Show the hacker their own check-ins (`attendance` is readable by its owner)
  - Project submission status / link to Devpost

### Judging

- DB is ready (`projects`, `judge_assignments`, `judge_scores` + RLS); `/judge` is a placeholder.
- To build: project import (Devpost CSV), judge view of assigned projects + rubric scoring, owner results.
- **Open question / WIP:** how projects get distributed to judges (manual per judge, auto-distribute N judges per project, by track, number of rounds), and the rubric.

### Staff dashboard

- `/staff` is a tabbed shell (Applications, Check-in, Judging, owner-only People); Applications is built, the other tab pages are placeholders. Check-in server actions are in `src/app/staff/checkin/actions.ts` (`searchPeople`, `checkIn`/`undoCheckIn`, `addToWaitlist`/`admitFromWaitlist`/`removeFromWaitlist`, owner-only `setCapacity`, `getCheckinSummary`), with pure helpers (`CheckinPerson`, `checkinState`, `profileSearchFilter` for the PostgREST `.or()` profile search) in `src/lib/checkin.ts`. DB is ready for check-in (`staff_check_in`/`staff_undo_check_in`), the on-site waitlist (`add_to_waitlist`/`admit_from_waitlist`/`remove_from_waitlist`), event capacity (`settings.capacity`) and role changes (`set_user_role`).
- To build (format still being decided): stats, hacker lookup + check-in, owner role management, workshop events + open/close QR self check-in via `events`, a full list of all hackers for staff, run-of-show schedule (internal staff timeline).
