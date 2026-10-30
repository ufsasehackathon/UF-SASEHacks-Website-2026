# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Registration and information website for UF SASE Hacks, a hackathon. Next.js 15 (App Router) + TypeScript, Supabase (Postgres/Auth/Storage), Tailwind CSS 4, Notion API (for FAQ content), Resend (transactional email).

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
```

There is no test suite configured in this repo.

### Environment variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NOTION_API_KEY=
NOTION_DB_ID=
RESEND_API_KEY=
EMAIL_FROM=          # e.g. "SASEHacks <team@sasehacks.com>", on a domain verified in Resend
EMAIL_REPLY_TO=      # an inbox organizers read
```

Without `RESEND_API_KEY`/`EMAIL_FROM`, emails are skipped (logged) and stay queued; nothing else breaks.

The full database schema (tables, functions, triggers, RLS, storage bucket + policies, indexes) is in `supabase/schema.sql`. It is applied by hand in the Supabase SQL editor (no migration tooling) and is written to be safe to re-run. Keep it in sync with any DB change you make in the dashboard. The bottom of the file has commented-out snippets for granting admin and testing the guards.

## Architecture

### Auth & session refresh

Login is Discord-first: `SignInForm` offers "Continue with Discord" (Supabase OAuth) plus a secondary email magic link (for applicants without Discord, and organizers/judges/sponsors). Google/GitHub were removed. Discord is required later, at RSVP: an accepted hacker who signed in by email links Discord from the portal via `supabase.auth.linkIdentity` (requires manual identity linking enabled in Supabase Auth settings). `ensureRows()` calls the `sync_discord_profile()` RPC on every portal visit to copy the linked identity onto `profiles.discord_id`/`discord_username`. `/auth/callback` only redirects to same-site `next` paths.

Supabase dashboard config (not in code): Discord provider enabled, Site URL/redirect URLs, and Resend as custom SMTP so magic-link emails aren't limited by Supabase's built-in mailer (these count against the Resend quota).

`middleware.ts` runs on every request except `_next/static`, `_next/image`, `favicon.ico`, and `api/faq`, and calls `supabase.auth.getUser()` purely to refresh the session cookie. Actual route protection is NOT done in middleware — it's done per-layout:

- `src/app/portal/layout.tsx` — redirects to `/login` if unauthenticated.
- `src/app/admin/layout.tsx` — redirects to `/login` if unauthenticated, then calls the `is_admin(p_uid)` Postgres RPC and redirects to `/portal` if the caller isn't an admin.

Every admin server action in `src/app/admin/actions.ts` re-checks `is_admin` itself (defense in depth) — don't assume the layout check is sufficient when adding new admin actions/routes.

### Data model (source of truth: `supabase/schema.sql`)

Tables (all in `public`, all with RLS enabled):
- `profiles` — keyed by `id` → `auth.users(id)` (cascade). Personal/demographic info: `full_name`, `first_name`, `last_name`, `email` (unique; where status emails go, editable on the form), `phone_number`, `date_of_birth`, `age`, `school`, `major`, `grad_year`, `level_of_study`, `engineering_skill`, `hackathon_experience`, `linkedin_url`, address (`address_line1/2`, `city`, `state`, `zip_code`, `country`), `tshirt`, `dietary text[]`, `accessibility`, `gender`, `race text[]`, `discord_id` (unique)/`discord_username` (set only by `sync_discord_profile`), `created_at`/`updated_at`.
- `registrations` — keyed by `user_id` → `profiles(id)` (cascade). `status` (check-constrained, default `draft`, see lifecycle below), `editing_locked`, admin-only `notes`/`review_score` (1–5)/`reviewed_by`, lifecycle timestamps (`submitted_at`, `accepted_at`, `rsvp_deadline`, `rsvp_at`), `last_emailed_status` (email queue marker), `responses jsonb` (free-response answers keyed by question id), consent flags (`accuracy_agreement`, `terms_and_conditions`, `code_of_conduct`, `can_photograph`, `share_resume_with_companies`, `mlh_code_of_conduct`, `mlh_data_sharing`, `mlh_communications`), resume fields (`resume_url`, `resume_updated_at`), timestamps.
- `settings` — single row (`id = true`). `applications_close`, enforced by `submit_application()`. Keep it in sync with `APPLICATIONS_CLOSE` in `src/lib/constants.ts`. Readable by signed-in users, writable by admins.
- `user_roles` — `(user_id, role)` composite PK; `role` is constrained to `'admin'` or `'sponsor'`. Users can read their own roles; only admins can write. `sponsor` is defined but not used by the app yet.
- `events` — `event_name` (unique), `self_checkin_open`, `checkin_code` (random, embedded in a QR for self check-in). A `Check-in` event (main event check-in) is seeded. Admin-only.
- `attendance` — one row per `(user_id, event_id)` (unique) = "this person attended this event"; `checked_in_by` defaults to `auth.uid()`. Users can read their own rows; admins have full access.
- `mailing_list` — `email` (unique on `lower(email)`), `created_at`. Filled from the hero's `MailingListForm` (`src/components/MailingListForm.tsx`) via `joinMailingList` in `src/app/actions.ts` (no account needed; duplicate signups are treated as success). RLS: anyone (`anon`/`authenticated`) can insert, only admins can read/modify.

#### Application lifecycle (`registrations.status`)

| status | meaning | set by |
|---|---|---|
| `draft` | row exists, not submitted | `ensureRows()` (insert guard forces it) |
| `pending` | submitted, awaiting review | `submit_application()` RPC |
| `accepted` | offered a spot, must RSVP by `rsvp_deadline` | admin (`setStatus` stamps `accepted_at` + `RSVP_WINDOW_DAYS`) |
| `confirmed` | RSVP'd yes (attending) | `rsvp(true)` RPC (needs a linked Discord identity) or admin |
| `declined` | RSVP'd no, dropped out, or RSVP expired | `rsvp(false)` / admin "Expire overdue RSVPs" |
| `waitlist` | waitlisted | admin; "Promote N" accepts top by score, then submission time |
| `rejected` | rejected | admin |

`confirmed` means attending, which is what `self_check_in` requires. Status labels and the ordered list live in `src/lib/validation.ts` (`registrationStatuses`, `registrationStatusLabels`).

#### Email (`src/lib/email.ts`)

Sent through Resend's batch HTTP API with `fetch` (no SDK). `statusEmail(status, ctx)` holds the template for each status. Two paths:
- Hacker-triggered (application received, RSVP confirm/decline): sent immediately by `emailOwnStatus` in `src/app/portal/actions.ts`, then marked via the `mark_own_status_emailed` RPC.
- Admin decisions are **not** emailed when made. `sendPendingEmails()` (the "Send pending emails" button) emails every row where `status <> last_emailed_status` in an emailed status, at most `EMAIL_DAILY_CAP` per click (Resend free plan = 100/day). Rows are marked only after their batch succeeds, so re-running is safe. A failed immediate send just stays in this queue.

`events`/`attendance`/`self_check_in` exist in the DB but are **not used by the app code yet**. They are the backend for the planned check-in features (see Roadmap).

Functions (RPCs):
- `is_admin(p_uid)` — `security definer`, checks `user_roles` for `admin`. Used by the admin layout/actions and by every RLS policy.
- `self_check_in(p_code)` — lets an authenticated user check themselves into an event whose `self_checkin_open` is true and whose `checkin_code` matches. Requires `registrations.status = 'confirmed'`. Idempotent. Returns the event name. Attendees have no direct insert access to `attendance`, so this is the only path for them.
- `submit_application()` — `draft` → `pending`, sets `submitted_at`. Checks `settings.applications_close`, the required consents and that a resume is on file (resume is required). Profile field validation is app-side.
- `rsvp(p_attending)` — `accepted` → `confirmed`/`declined` before `rsvp_deadline`; `confirmed` → `declined` any time. Confirming requires an `auth.identities` row with provider `discord`. Returns the new status.
- `sync_discord_profile()` — copies the caller's Discord identity onto their profile. Returns the username or null.
- `mark_own_status_emailed(p_status)` — sets the caller's `last_emailed_status` (only if it matches their current status).
- `keep_alive()` — `security definer`, callable by `anon`. Returns `count(*)` of `mailing_list` (never the emails). Called every 3 days by `.github/workflows/supabase-keepalive.yml` so the free-tier project doesn't pause.

DB-enforced guards (triggers). These apply only to non-admin callers with a JWT. The SQL editor and service role (`auth.uid()` null) bypass them:
- Non-admins can't change `registrations.status`, `editing_locked`, `notes`, `user_id`, `review_score`, `reviewed_by`, the lifecycle timestamps, or `last_emailed_status` (raises `42501`).
- Registrations inserted by non-admins are forced to `draft`/unlocked with all admin fields null. This forces values rather than raising, so `ensureRows()` keeps working.
- Profile updates raise `42501` when the user's registration has `editing_locked = true`. RLS also blocks owner updates to a locked registration.
- Non-admins can't set `profiles.discord_id`/`discord_username` directly.
- The hacker-facing RPCs above still run with the caller's JWT, so they set the transaction-local GUC `sasehacks.bypass_guard = 'on'` around their own update (checked by `guard_bypassed()`). Use the same pattern for any new hacker-facing RPC that writes guarded columns.
- `updated_at` is auto-touched on `profiles` and `registrations`.

So the app-side checks are not the only line of defense, but don't rely on the DB alone either — keep the server-action checks.

Resumes are required to submit. Upload validation (10 MB, PDF signature check) and storage live in one helper, `saveResume()` in `src/lib/resume.ts`, used by both the onboarding form and `/portal/resume`. They are stored in the private `resumes` Supabase Storage bucket at the fixed path `{user_id}/resume.pdf` (always this exact filename — uploads use `upsert: true` to overwrite). Storage policies only let a user write `.pdf` files under their own `{user_id}/` prefix, and only the owner or an admin can read them. Signed URLs are generated on demand (short-lived, 300s for single admin view, 3600s for bulk export) rather than using public URLs. General images (landing page assets) are served locally from `public/images/`, referenced via `getPublicImageUrl()` in `src/lib/images.ts`.

`ensureRows()` in `src/app/portal/actions.ts` lazily creates a user's `profiles`/`registrations` rows on first portal visit if they don't already exist (rather than doing it at signup time).

### Hacker portal flow

- `/portal` always renders for a logged-in user (no redirect home). One main card is driven by `registrations.status`: a draft gets a "Continue application" link (or "Applications are closed"); pending shows submission date and `DECISIONS_BY`; accepted shows `RsvpButtons` (Step 1 Connect Discord, Step 2 confirm/decline); confirmed shows event info plus a drop-out link; waitlist/declined/rejected show a message. Edit Profile/Resume cards are hidden while in draft.
- `/portal/onboarding` is the application form. It's only reachable in `draft` (otherwise it redirects to `/portal`). "Submit Application" saves profile → consents → resume (optional if one is already on file) → free-response answers, then calls `submitApplication()`.

### Admin review flow

- `/admin` shows counts per status (from `fetchStatusCounts`, independent of filters), spots left (`EVENT_CAPACITY − accepted − confirmed`), and `DecisionTools` (expire overdue RSVPs, promote N from waitlist, send pending emails). The table filters by status, sorts by newest/submission order/score, and bulk-sets Accept/Waitlist/Reject.
- `/admin/[userId]` has `ReviewForm`: 1–5 score, notes, "Save & next unreviewed" (oldest pending with no score), and accept/waitlist/reject buttons. It also shows free-response answers, Discord, and lifecycle timestamps.

### Server actions pattern

Mutations live in colocated `actions.ts` files (`src/app/admin/actions.ts`, `src/app/portal/actions.ts`, `src/app/portal/resume/actions.ts`) marked `"use server"`. Each action independently re-fetches the authenticated user via `createSupabaseServerClient()` and re-checks authorization — there is no shared middleware-level guard for mutations. Actions return `{ ok: boolean, error?: string, ... }` rather than throwing, and call `revalidatePath(...)` on the affected route(s) after a successful mutation instead of relying on client-side refresh.

Two Supabase client constructors exist and are not interchangeable:
- `src/lib/supabase/server.ts` (`createSupabaseServerClient`) — for server components/actions, cookie-based, async.
- `src/lib/supabase/client.ts` (`createSupabaseBrowserClient`) — for client components (`"use client"`).

### Validation

`src/lib/validation.ts` is the single source of truth for profile/registration form shape: Zod schemas (`profileSchema`, `registrationFlagsSchema`, `responsesSchema`) plus the option lists + human-readable label maps (t-shirt sizes, dietary, gender, race, major, level of study, etc.) that both the forms and the admin table rely on. When adding a new profile field, it typically needs to be threaded through: the schema in `validation.ts`, the form component in `src/components/forms/`, the `upsertProfile` field mapping in `src/app/portal/actions.ts`, and the `AdminRow` type + query in `src/app/admin/actions.ts`.

**Free-response questions are different and much cheaper to change:** edit only the `APPLICATION_QUESTIONS` array (`id`, `label`, `placeholder?`, `required`, `maxLength`). Answers go in `registrations.responses` keyed by `id`. The onboarding form, `responsesSchema`, admin detail page and CSV export all loop over the array, so no schema/action/admin changes are needed. Removing a question hides old answers but keeps them (`saveResponses` merges). Never reuse an old `id` for a different question.

### Landing page sections

`src/app/page.tsx` composes independent section components from `src/components/sections/` (Hero, About, Tracks, Schedule, Sponsors, Partners, Teams, FAQ). Each section is intentionally kept in its own file so multiple people can work on different sections without merge conflicts — follow that convention when touching the landing page rather than inlining sections back into `page.tsx`.

### FAQ via Notion

`src/lib/notion.ts` queries a Notion database (filtered to `published = true`, sorted by an `order` number property) and maps rows to `{ id, question, answer, order }`, converting Notion rich-text links to markdown. Exposed to the client via `src/app/api/faq/route.ts` (excluded from the auth-refresh middleware matcher) and rendered by `src/components/FaqList.tsx`. Failures are swallowed (returns `[]` with a console error), so a missing/misconfigured Notion DB degrades gracefully rather than breaking the page.

### Feature flags & event constants

All in `src/lib/constants.ts`:
- `REGISTRATIONS_ENABLED` / `LOGIN_ENABLED`: master switches, both false until launch.
- `registrationsOpen()` = `REGISTRATIONS_ENABLED && now < APPLICATIONS_CLOSE`. It's a function, not a constant, so the deadline takes effect without a redeploy. The DB enforces the deadline separately via `settings.applications_close`.
- `APPLICATIONS_CLOSE`, `DECISIONS_BY`, `RSVP_WINDOW_DAYS`, `EVENT_CAPACITY` are **placeholders** to confirm with organizers.
- `EMAIL_DAILY_CAP` is 100 for the Resend free plan. Raise it if you upgrade.
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

### Judging dashboard

- View judging criteria
- List of projects assigned to the judge
- Input/submit scores per project
- **Open question:** judging format is not finalized (number of rounds, how projects are assigned, per-track vs. overall). Get this from organizers before designing the data model.

### Staff dashboard

- Check hackers in (backend ready: insert into `attendance` for the seeded `Check-in` event; manage workshop events + open/close self check-in via `events`)
- Look up a hacker by email or name → shows all of their profile/registration info
- List of all hackers
- Run-of-show schedule (internal staff timeline)
- **Open question:** how this relates to the existing `/admin` area (separate role vs. extending admin) — `user_roles.role` is currently constrained to `admin`/`sponsor`, and the `events`/`attendance` RLS only lets admins in, so a `staff` role means updating the check constraint and those policies.
