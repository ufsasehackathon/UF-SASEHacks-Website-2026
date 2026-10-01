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

Database schema/RLS setup is not committed here — it lives in the Supabase project directly (tables: `profiles`, `registrations`; storage bucket: `resumes`, `images`).

## Architecture

### Auth & session refresh

`middleware.ts` runs on every request except `_next/static`, `_next/image`, `favicon.ico`, and `api/faq`, and calls `supabase.auth.getUser()` purely to refresh the session cookie. Actual route protection is NOT done in middleware — it's done per-layout:

- `src/app/portal/layout.tsx` — redirects to `/login` if unauthenticated.
- `src/app/admin/layout.tsx` — redirects to `/login` if unauthenticated, then calls the `is_admin(p_uid)` Postgres RPC and redirects to `/portal` if the caller isn't an admin.

Every admin server action in `src/app/admin/actions.ts` re-checks `is_admin` itself (defense in depth) — don't assume the layout check is sufficient when adding new admin actions/routes.

### Data model (as used by the app, not formally documented elsewhere)

Two main tables joined by user id:
- `profiles` — personal/demographic info (name, contact, school, major, demographics, address, t-shirt, dietary, etc.), keyed by `id` = Supabase auth user id.
- `registrations` — hackathon-specific state keyed by `user_id`: `status` (`pending`/`confirmed`/`waitlist`/`rejected`), `editing_locked`, consent flags (`accuracy_agreement`, `terms_and_conditions`, `code_of_conduct`, `can_photograph`, `share_resume_with_companies`, `mlh_code_of_conduct`, `mlh_data_sharing`, `mlh_communications`), and resume fields (`resume_url`, `resume_updated_at`).

Resumes are stored in the `resumes` Supabase Storage bucket at the fixed path `{user_id}/resume.pdf` (always this exact filename — uploads use `upsert: true` to overwrite). Signed URLs are generated on demand (short-lived, 300s for single admin view, 3600s for bulk export) rather than using public URLs. General images (landing page assets) are in the public `images` bucket, accessed via `getPublicImageUrl()` in `src/lib/supabase/storage.ts`.

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
