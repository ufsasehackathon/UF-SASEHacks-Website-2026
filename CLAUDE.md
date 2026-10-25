# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Registration and information website for UF SASE Hacks, a hackathon. Next.js 15 (App Router) + TypeScript, Supabase (Postgres/Auth/Storage), Tailwind CSS 4, Notion API (for FAQ content).

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
```

The full database schema (tables, functions, triggers, RLS, storage bucket + policies, indexes) is in `supabase/schema.sql`. It is applied by hand in the Supabase SQL editor (no migration tooling) and is written to be safe to re-run. Keep it in sync with any DB change you make in the dashboard. The bottom of the file has commented-out snippets for granting admin and testing the guards.

## Architecture

### Auth & session refresh

`middleware.ts` runs on every request except `_next/static`, `_next/image`, `favicon.ico`, and `api/faq`, and calls `supabase.auth.getUser()` purely to refresh the session cookie. Actual route protection is NOT done in middleware — it's done per-layout:

- `src/app/portal/layout.tsx` — redirects to `/login` if unauthenticated.
- `src/app/admin/layout.tsx` — redirects to `/login` if unauthenticated, then calls the `is_admin(p_uid)` Postgres RPC and redirects to `/portal` if the caller isn't an admin.

Every admin server action in `src/app/admin/actions.ts` re-checks `is_admin` itself (defense in depth) — don't assume the layout check is sufficient when adding new admin actions/routes.

### Data model (source of truth: `supabase/schema.sql`)

Tables (all in `public`, all with RLS enabled):
- `profiles` — keyed by `id` → `auth.users(id)` (cascade). Personal/demographic info: `full_name`, `first_name`, `last_name`, `email` (unique), `phone_number`, `date_of_birth`, `age`, `school`, `major`, `grad_year`, `level_of_study`, `engineering_skill`, `hackathon_experience`, `linkedin_url`, address (`address_line1/2`, `city`, `state`, `zip_code`, `country`), `tshirt`, `dietary text[]`, `accessibility`, `gender`, `race text[]`, `created_at`/`updated_at`.
- `registrations` — keyed by `user_id` → `profiles(id)` (cascade). `status` (text, default `pending`; app uses `pending`/`confirmed`/`waitlist`/`rejected` — no DB check constraint), `editing_locked`, admin-only `notes`, consent flags (`accuracy_agreement`, `terms_and_conditions`, `code_of_conduct`, `can_photograph`, `share_resume_with_companies`, `mlh_code_of_conduct`, `mlh_data_sharing`, `mlh_communications`), resume fields (`resume_url`, `resume_updated_at`), timestamps.
- `user_roles` — `(user_id, role)` composite PK; `role` is constrained to `'admin'` or `'sponsor'`. Users can read their own roles; only admins can write. `sponsor` is defined but not used by the app yet.
- `events` — `event_name` (unique), `self_checkin_open`, `checkin_code` (random, embedded in a QR for self check-in). A `Check-in` event (main event check-in) is seeded. Admin-only.
- `attendance` — one row per `(user_id, event_id)` (unique) = "this person attended this event"; `checked_in_by` defaults to `auth.uid()`. Users can read their own rows; admins have full access.
- `mailing_list` — `email` (unique on `lower(email)`), `created_at`. Filled from the hero's `MailingListForm` (`src/components/MailingListForm.tsx`) via `joinMailingList` in `src/app/actions.ts` (no account needed; duplicate signups are treated as success). RLS: anyone (`anon`/`authenticated`) can insert, only admins can read/modify.

`events`/`attendance`/`self_check_in` exist in the DB but are **not used by the app code yet**. They are the backend for the planned check-in features (see Roadmap).

Functions (RPCs):
- `is_admin(p_uid)` — `security definer`, checks `user_roles` for `admin`. Used by the admin layout/actions and by every RLS policy.
- `self_check_in(p_code)` — lets an authenticated user check themselves into an event whose `self_checkin_open` is true and whose `checkin_code` matches. Requires `registrations.status = 'confirmed'`. Idempotent. Returns the event name. Attendees have no direct insert access to `attendance`, so this is the only path for them.
- `keep_alive()` — `security definer`, callable by `anon`. Returns `count(*)` of `mailing_list` (never the emails). Called every 3 days by `.github/workflows/supabase-keepalive.yml` so the free-tier project doesn't pause.

DB-enforced guards (triggers). These apply only to non-admin callers with a JWT. The SQL editor and service role (`auth.uid()` null) bypass them:
- Non-admins can't change `registrations.status`, `editing_locked`, `notes`, or `user_id` (raises `42501`).
- Registrations inserted by non-admins are forced to `pending`/unlocked/no notes. This forces values rather than raising, so `ensureRows()` keeps working.
- Profile updates raise `42501` when the user's registration has `editing_locked = true`. RLS also blocks owner updates to a locked registration.
- `updated_at` is auto-touched on `profiles` and `registrations`.

So the app-side checks are not the only line of defense, but don't rely on the DB alone either — keep the server-action checks.

Resumes are stored in the private `resumes` Supabase Storage bucket at the fixed path `{user_id}/resume.pdf` (always this exact filename — uploads use `upsert: true` to overwrite). Storage policies only let a user write `.pdf` files under their own `{user_id}/` prefix, and only the owner or an admin can read them. Signed URLs are generated on demand (short-lived, 300s for single admin view, 3600s for bulk export) rather than using public URLs. General images (landing page assets) are served locally from `public/images/`, referenced via `getPublicImageUrl()` in `src/lib/images.ts`.

`ensureRows()` in `src/app/portal/actions.ts` lazily creates a user's `profiles`/`registrations` rows on first portal visit if they don't already exist (rather than doing it at signup time).

### Server actions pattern

Mutations live in colocated `actions.ts` files (`src/app/admin/actions.ts`, `src/app/portal/actions.ts`, `src/app/portal/resume/actions.ts`) marked `"use server"`. Each action independently re-fetches the authenticated user via `createSupabaseServerClient()` and re-checks authorization — there is no shared middleware-level guard for mutations. Actions return `{ ok: boolean, error?: string, ... }` rather than throwing, and call `revalidatePath(...)` on the affected route(s) after a successful mutation instead of relying on client-side refresh.

Two Supabase client constructors exist and are not interchangeable:
- `src/lib/supabase/server.ts` (`createSupabaseServerClient`) — for server components/actions, cookie-based, async.
- `src/lib/supabase/client.ts` (`createSupabaseBrowserClient`) — for client components (`"use client"`).

### Validation

`src/lib/validation.ts` is the single source of truth for profile/registration form shape: Zod schemas (`profileSchema`, `registrationFlagsSchema`) plus the option lists + human-readable label maps (t-shirt sizes, dietary, gender, race, major, level of study, etc.) that both the forms and the admin table rely on. When adding a new profile field, it typically needs to be threaded through: the schema in `validation.ts`, the form component in `src/components/forms/`, the `upsertProfile` field mapping in `src/app/portal/actions.ts`, and the `AdminRow` type + query in `src/app/admin/actions.ts`.

### Landing page sections

`src/app/page.tsx` composes independent section components from `src/components/sections/` (Hero, About, Tracks, Schedule, Sponsors, Partners, Teams, FAQ). Each section is intentionally kept in its own file so multiple people can work on different sections without merge conflicts — follow that convention when touching the landing page rather than inlining sections back into `page.tsx`.

### FAQ via Notion

`src/lib/notion.ts` queries a Notion database (filtered to `published = true`, sorted by an `order` number property) and maps rows to `{ id, question, answer, order }`, converting Notion rich-text links to markdown. Exposed to the client via `src/app/api/faq/route.ts` (excluded from the auth-refresh middleware matcher) and rendered by `src/components/FaqList.tsx`. Failures are swallowed (returns `[]` with a console error), so a missing/misconfigured Notion DB degrades gracefully rather than breaking the page.

### Feature flag

`REGISTRATIONS_OPEN` in `src/lib/constants.ts` gates whether registration is open; other event constants (dates, city, Discord/Devpost/hacker-guide links) live in the same file.

## Roadmap / WIP

Planned modules that do not exist yet. Treat these as intended direction, not implemented features — check the code before assuming any of this is built.

### Hacker dashboard (extends `/portal`)

- Profile view/edit, including resume upload (reuse existing `portal/profile` and `portal/resume` pages)
- Event schedule in a calendar-style view
- Open ideas (not yet decided):
  - Registration/acceptance status + check-in status
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
