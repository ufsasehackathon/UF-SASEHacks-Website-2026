# Work in Progress: Applications & Acceptance

Branch: `dev`. Design doc: `docs/superpowers/specs/2026-10-29-applications-acceptance-design.md`.
Architecture notes are in `CLAUDE.md`. This file tracks what's left before launch.

## Status

The code is built and `npm run lint` / `npx tsc --noEmit` pass. An automated test suite now covers most of the checklist below (see "Testing" in `CLAUDE.md`). Unit tests pass locally. **The DB, action and browser tests have not run yet:** they need Docker, so their first real run is in CI. Expect a few fixes on that first run.

## 0. Get the test suite green
- [ ] Push this branch and open a PR to `dev` so the `Tests` workflow runs; fix whatever the first `integration` run turns up
- [ ] GitHub → Settings → Branches: require the `static` and `integration` checks on `main` (and `dev` if wanted)
- [ ] Optional, for running DB/E2E tests locally: install Docker Desktop or OrbStack, then `npm run db:start`
- [ ] Confirm the hosted project's Postgres major version and set `[db] major_version` in `supabase/config.toml` to match (CLI default is 17)

## 1. Set up a test environment
- [ ] Use a separate Supabase project for testing (recommended), or the real one before launch
- [ ] Run `supabase/schema.sql` in the SQL editor
  - Optionally run the commented "one-time cleanup" at the bottom to delete empty drafts created by plain portal visits before this change
  - Re-running it also drops the old shipping-address columns (`address_line1/2`, `city`, `state`, `zip_code`) from `profiles`
  - It also resets never-submitted `pending` rows (`submitted_at` null, from the old `pending` default) to `draft`
- [ ] Make yourself owner (role snippet at the bottom of `schema.sql`; there's no role UI yet). If you were already `admin`, re-running the schema migrates you to `owner`
- [ ] Supabase Auth → Providers: enable **Discord**. Create an app at discord.com/developers and use the redirect `https://<project>.supabase.co/auth/v1/callback`
- [ ] Supabase Auth: enable **manual identity linking** (needed for "Connect Discord")
- [ ] Supabase Auth → URL config: add `http://localhost:3000` and the dev/preview URLs to the redirect allow list
- [x] Login/registration switches are env vars now (`NEXT_PUBLIC_LOGIN_ENABLED`, `NEXT_PUBLIC_REGISTRATIONS_ENABLED`). Both are set to `true` in local `.env`.
- [ ] Vercel: set both to `true` for **Preview** (dev branch) and leave them unset/`false` for **Production**. Redeploy after changing them.

## 2. Test checklist
**Covered by the automated suite** (tick once CI is green): every DB guard (`status`, `review_score`, `discord_id`, `responses` after submit, locked profile, staff as non-admin), RLS for every table and role, resume storage policies, every RPC (`submit_application` deadline/consents/resume, `rsvp` Discord/deadline/statuses, `set_user_role`, check-in), all portal server actions, and in the browser: magic-link login → Dashboard → Apply card, blank-form errors, full application with resume upload, "Continue application" checklist, status cards, RSVP with Discord linked → confirm → drop out, overdue RSVP, locked profile, role-based routing and Dashboard links, flags-off state, signed-out redirects.
- [ ] All of the above green in CI

**Still manual** (can't be automated against the local stack):
- [ ] Real Discord OAuth: Discord-login user can confirm straight away and `discord_username` is set; email user can "Connect Discord" (needs manual identity linking enabled in the hosted project)
- [ ] Magic-link login works through Resend SMTP, and the "application received" / RSVP emails arrive from Resend
- [ ] Account created before the schema update → portal shows Apply, not "Application received" (depends on hosted data)
- [ ] Vercel Preview and Production flag values behave as expected

## 3. Decisions still needed from organizers
- [ ] **How application review/acceptance should work** (the old `/admin` was removed to be redone; it's in git history at `fa3e197`). Includes decision emails and how to handle the Resend 100/day limit
- [ ] **How to format the owner, staff and judge dashboards.** They're empty "Coming soon" pages until this is decided (an earlier version with stats, check-in lookup, role management, Devpost import and scoring was removed; it's in git history at `fa3e197`)
- [ ] **How to distribute projects to judges** (manual per judge, N judges per project automatically, by track, rounds?)
- [ ] Judging rubric criteria
- [ ] `APPLICATIONS_CLOSE` (and the same value in `public.settings.applications_close`)
- [ ] `DECISIONS_BY` (placeholder in `src/lib/constants.ts`), RSVP window and event capacity
- [ ] Sending domain: `sasehacks.com` vs `ufsasehacks.com` (`DOMAIN` in constants is used for email links)
- [ ] Final wording of the free-response question(s) (`APPLICATION_QUESTIONS` in `src/lib/validation.ts`)
- [ ] Email copy review (`src/lib/email.ts`)

## 4. Email / Resend setup
- [ ] Add and verify the sending domain in Resend (SPF, DKIM, DMARC records at the registrar)
- [ ] Set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` in `.env.local` and Vercel
- [ ] Supabase Auth → SMTP: `smtp.resend.com`, port 465, user `resend`, password = API key
- [ ] Plan the decision-day sends: the free plan allows 100/day, which includes magic-link emails. Either upgrade to Pro ($20/mo) for decision weeks or spread sends over several days

## 5. Launch
- [ ] Merge `dev` → `main`
- [ ] Set `NEXT_PUBLIC_LOGIN_ENABLED` and `NEXT_PUBLIC_REGISTRATIONS_ENABLED` to `true` in Vercel **Production**, then redeploy (no code change)
- [ ] Production Supabase: run `schema.sql`, set up providers, SMTP and redirect URLs

## Known gaps / follow-ups
Found while writing the tests (not fixed; the tests check what the DB ends up with rather than locking these in):
- `submit_application()` only checks `resume_url is not null`, and hackers can write `resume_url` directly through the API. Someone could submit without uploading a resume. Fix: guard `resume_url` (only `saveResume`'s path) or check `storage.objects` in the RPC.
- `saveRegistrationFlags` returns `ok: true` when nothing was saved (locked or missing registration: RLS matches 0 rows silently). Same pattern in `saveResume`'s registration update.
- `saveResume` uploads before updating the registration, so a hacker whose editing is locked can still overwrite their resume file.
- `user_role()` / `is_*()` are executable by anyone (including anon), so a caller who knows a user's UUID can learn their role. Low risk; revoke from `anon` if it matters.
- No "Save draft" button. Applicants fill out the form in one go. Adding one needs a looser validation schema.
- No application review UI, decision emails or RSVP expiry right now (see the review decision above). Hacker-triggered emails that fail aren't retried.
- Discord bot to give confirmed hackers a role using `profiles.discord_id`: future work.
- Staff can read admin notes/review scores (RLS is row-level). If a staff hacker lookup gets built, consider putting it behind an RPC.
- Unused landing sections `PartnersSections.tsx` and `TeamsSection.tsx` are kept but not rendered on `/`; delete them if they're not coming back.
- Roadmap items (application review, dashboards, schedule view, workshop events + QR self check-in, teams, run-of-show): see CLAUDE.md.
