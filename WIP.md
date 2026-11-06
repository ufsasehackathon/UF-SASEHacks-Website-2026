# Work in Progress: Applications & Acceptance

Branch: `dev`. Design doc: `docs/superpowers/specs/2026-10-29-applications-acceptance-design.md`.
Architecture notes are in `CLAUDE.md`. This file tracks what's left before launch.

## Status

The code is built and `npm run lint` / `npx tsc --noEmit` pass. **None of it has been run against a real Supabase database yet.** The SQL and the end-to-end flow still need testing.

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
Database guards (snippets at the bottom of `schema.sql`, run as a non-admin JWT). Each of these should fail:
- [ ] Setting `status` directly
- [ ] Setting `review_score` directly
- [ ] Setting `profiles.discord_id` directly
- [ ] `rsvp(true)` while not accepted
- [ ] `submit_application()` after `settings.applications_close`

End to end, with two or three accounts (decisions are made in SQL until review is redesigned):
- [ ] New email-login user → header shows "Dashboard" right after login; portal shows the "Apply to SASEHacks" card
- [ ] Account created before the schema update → portal shows Apply, not "Application received"
- [ ] Submit without a resume, the required agreements, or the short answer → blocked (nothing saved)
- [ ] Submit → status `pending`, and the "application received" email arrives (needs Resend set up)
- [ ] Free-response answers can't be changed after submitting (not shown on `/portal/profile`; a direct `update registrations set responses = ...` as a non-admin JWT fails)
- [ ] Brand-new user: portal says "Apply" and status "Not started", and no `registrations` row exists until they open the application form; and the row is `draft`
- [ ] Brand-new user: the application form has only email prefilled, and submitting with age/grad year/level/skill/hackathons blank shows an error under each
- [ ] Draft whose submit failed partway: card says "Continue application" with the checklist; declined/rejected cards link to the mailing list
- [ ] Set someone to `accepted` in SQL (with an `rsvp_deadline`) → portal shows the RSVP card
- [ ] Email user: "I'm coming" is disabled until Discord is connected → Connect Discord → username shows → confirm → `confirmed`
- [ ] Discord-login user: confirm works straight away, and `discord_username` is set on their profile
- [ ] Confirmed user: "I can't make it anymore" → `declined`
- [ ] Accepted user with a past `rsvp_deadline` → confirming is refused
- [ ] Resume: non-PDF and >10 MB are rejected; the hacker can download their own
- [ ] Magic-link login works through Resend SMTP

Roles & dashboards (owner/staff/judge dashboards are placeholders for now; set roles with the SQL snippet in `schema.sql`):
- [ ] Header has one outlined "Dashboard" button: `/staff` (owner/staff, titled by role), `/judge` (judge), `/portal` (hacker)
- [ ] As a staff JWT in SQL, `update registrations set status = ...` fails
- [ ] Hacker: `/staff` and `/judge` redirect to `/portal`

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
- No "Save draft" button. Applicants fill out the form in one go. Adding one needs a looser validation schema.
- No application review UI, decision emails or RSVP expiry right now (see the review decision above). Hacker-triggered emails that fail aren't retried.
- Discord bot to give confirmed hackers a role using `profiles.discord_id`: future work.
- Staff can read admin notes/review scores (RLS is row-level). If a staff hacker lookup gets built, consider putting it behind an RPC.
- Unused landing sections `PartnersSections.tsx` and `TeamsSection.tsx` are kept but not rendered on `/`; delete them if they're not coming back.
- Roadmap items (application review, dashboards, schedule view, workshop events + QR self check-in, teams, run-of-show): see CLAUDE.md.
