# Work in Progress: Applications & Acceptance

Branch: `dev`. Design doc: `docs/superpowers/specs/2026-10-29-applications-acceptance-design.md`.
Architecture notes are in `CLAUDE.md`. This file tracks what's left before launch.

## Status

The code is built and `npm run lint` / `npm run build` pass. **None of it has been run against a real Supabase database yet.** The SQL and the end-to-end flow still need testing.

## 1. Set up a test environment
- [ ] Use a separate Supabase project for testing (recommended), or the real one before launch
- [ ] Run `supabase/schema.sql` in the SQL editor
  - Re-running it also drops the old shipping-address columns (`address_line1/2`, `city`, `state`, `zip_code`) from `profiles`
  - It also resets never-submitted `pending` rows (`submitted_at` null, from the old `pending` default) to `draft`
- [ ] Make yourself owner (snippet at the bottom of `schema.sql`). If you were already `admin`, re-running the schema migrates you to `owner`
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

End to end, with two or three accounts, one of them admin:
- [ ] New email-login user → header shows "Dashboard" right after login; portal shows the "Apply to SASEHacks" card
- [ ] Account created before the schema update → portal shows Apply, not "Application received"
- [ ] Submit without a resume, the required agreements, or the short answer → blocked (nothing saved)
- [ ] Submit → status `pending`, and the "application received" email arrives (needs Resend set up)
- [ ] Free-response answer shows on `/admin/[userId]` and in the CSV export
- [ ] Free-response answers can't be changed after submitting (not shown on `/portal/profile`; a direct `update registrations set responses = ...` as a non-admin JWT fails)
- [ ] Brand-new user: draft card says "Apply" (no checklist); the application form has only email prefilled, and submitting with age/grad year/level/skill/hackathons blank shows an error under each
- [ ] Draft whose submit failed partway: card says "Continue application" with the checklist; declined/rejected cards link to the mailing list
- [ ] Admin: score, then "Save & next unreviewed" moves to the next applicant
- [ ] Admin: Accept → table shows "Queued" → "Send pending emails" → acceptance email arrives and the table shows "Yes"
- [ ] Email user: "I'm coming" is disabled until Discord is connected → Connect Discord → username shows → confirm → `confirmed`
- [ ] Discord-login user: confirm works straight away, and `discord_username` appears in admin
- [ ] Confirmed user: "I can't make it anymore" → `declined`
- [ ] Accepted user with a past `rsvp_deadline` (edit it in SQL) → "Expire overdue RSVPs" → `declined`
- [ ] Waitlist someone → "Promote 1" → `accepted`, and their email says "a spot opened up"
- [ ] Resume: non-PDF and >10 MB are rejected; the admin "Resume links" open
- [ ] Sponsor resume export only includes `share_resume_with_companies = true`
- [ ] With `EMAIL_DAILY_CAP` lowered to 1 for the test: Send sends one, the rest stay queued
- [ ] Magic-link login works through Resend SMTP

Roles & dashboards (needs 4 accounts: owner, staff, judge, hacker):
- [ ] Owner: `/staff/roles` → give someone Staff and someone Judge; demoting the last owner is refused
- [ ] Header "Dashboard" goes to `/staff` (owner/staff), `/judge` (judge), `/portal` (hacker); non-hackers also see "Portal"
- [ ] Staff: stats load; lookup finds people by name/email/Discord; "Check in" works only for confirmed hackers, and Undo works
- [ ] Staff: `/admin`, `/staff/roles`, `/staff/judging` redirect away; as a staff JWT in SQL, `update registrations set status = ...` fails
- [ ] Owner: import a Devpost CSV on `/staff/judging` (re-import updates instead of duplicating; drafts skipped); edit a table number
- [ ] Assign a project to the judge with the SQL snippet → judge sees it on `/judge`, scores it, "Save & next" works
- [ ] Judge can't open an unassigned project (`/judge/<id>` 404s)
- [ ] Owner sees the judge's scores and the project's average on `/staff/judging`
- [ ] Hacker: `/staff` and `/judge` redirect to `/portal`

## 3. Decisions still needed from organizers
- [ ] **How to distribute projects to judges** (manual per judge, N judges per project automatically, by track, rounds?). Judge assignment UI is WIP until this is decided
- [ ] Judging rubric wording (`JUDGING_CRITERIA` in `src/lib/judging.ts`)
- [ ] `APPLICATIONS_CLOSE` (and the same value in `public.settings.applications_close`)
- [ ] `DECISIONS_BY`, `RSVP_WINDOW_DAYS`, `EVENT_CAPACITY` (all placeholders in `src/lib/constants.ts`)
- [ ] Sending domain: `sasehacks.com` vs `ufsasehacks.com` (`DOMAIN` in constants is used for email links)
- [ ] Final wording of the free-response question(s) (`APPLICATION_QUESTIONS` in `src/lib/validation.ts`)
- [ ] Email copy review (`src/lib/email.ts`)

## 4. Email / Resend setup
- [ ] Add and verify the sending domain in Resend (SPF, DKIM, DMARC records at the registrar)
- [ ] Set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` in `.env.local` and Vercel
- [ ] Supabase Auth → SMTP: `smtp.resend.com`, port 465, user `resend`, password = API key
- [ ] Plan the decision-day sends: the free plan allows 100/day, which includes magic-link emails. Either upgrade to Pro ($20/mo) for decision weeks and raise `EMAIL_DAILY_CAP`, or spread sends over several days

## 5. Launch
- [ ] Merge `dev` → `main`
- [ ] Set `NEXT_PUBLIC_LOGIN_ENABLED` and `NEXT_PUBLIC_REGISTRATIONS_ENABLED` to `true` in Vercel **Production**, then redeploy (no code change)
- [ ] Production Supabase: run `schema.sql`, set up providers, SMTP and redirect URLs

## Known gaps / follow-ups
- No "Save draft" button. Applicants fill out the form in one go. Adding one needs a looser validation schema.
- RSVP expiry is a manual admin button, not on a schedule (could become a cron like the keep-alive workflow).
- Discord bot to give confirmed hackers a role using `profiles.discord_id`: future work.
- **Judge assignment UI** (WIP, waiting on the distribution decision above). Until then, assign with the SQL snippet in `schema.sql`.
- Judges/staff who visit `/portal` get a draft registration row like anyone else, so they show up in the "Drafts" count.
- Staff can read admin notes/review scores (RLS is row-level). Move lookup behind an RPC if that matters.
- Roadmap items (schedule view, workshop events + QR self check-in, teams, run-of-show, full hacker list for staff): see CLAUDE.md.
