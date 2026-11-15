# Work in Progress: Applications & Acceptance

Branch: `dev`. Design doc: `docs/superpowers/specs/2026-10-29-applications-acceptance-design.md`.
Architecture notes are in `CLAUDE.md`. This file tracks what's left before launch.

## Status

The code is built and `npm run lint` / `npx tsc --noEmit` pass. An automated test suite now covers most of the checklist below (see "Testing" in `CLAUDE.md`). Unit tests pass locally. **The DB, action and browser tests have not run yet:** they need Docker, so their first real run is in CI. Expect a few fixes on that first run.

## 0. Get the test suite green
- [ ] Push this branch and open a PR to `dev` so the `Tests` workflow runs; fix whatever the first `integration` run turns up
  - [x] The two onboarding e2e tests (blank submit, full application) failed on `dev` too: the free-response textarea's native `required` blocked submit (the form is now `noValidate`), and the test filled the wrong textarea and checkbox
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
- [x] **How application review/acceptance should work** (the old `/admin` was removed to be redone; it's in git history at `fa3e197`). Decided and built: staff/owners queue accept/reject on `/staff/applications`, owners send them with "Send decisions". The Resend 100/day limit is still a setup question (section 4)
- [ ] **How to format the owner, staff and judge dashboards.** `/staff` now has its tab layout (Applications, Check-in, Judging, People); `/judge` is still an empty "Coming soon" page (an earlier version with stats, check-in lookup, role management, Devpost import and scoring was removed; it's in git history at `fa3e197`)
- [ ] **How to distribute projects to judges** (manual per judge, N judges per project automatically, by track, rounds?)
- [ ] Judging rubric criteria
- [ ] `APPLICATIONS_CLOSE` (and the same value in `public.settings.applications_close`)
- [ ] `DECISIONS_BY`, `RSVP_WINDOW_DAYS` (7 days) and `EVENT_START`/`EVENT_END` (walk-in window; placeholders in `src/lib/constants.ts`), and event capacity (capacity is `public.settings.capacity`; owners edit it on the Check-in tab)
- [ ] Sending domain: `sasehacks.com` vs `ufsasehacks.com` (`DOMAIN` in constants is used for email links)
- [ ] Final wording of the free-response question(s) (`APPLICATION_QUESTIONS` in `src/lib/validation.ts`)
- [ ] Email copy review (`src/lib/email.ts`), including the new draft accepted/rejected decision emails

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
- No RSVP expiry right now. Hacker-triggered emails that fail aren't retried.
- Decisions DB is in (`feat/staff-judge-dashboards`): `pending_decisions` table, `set_decisions`/`clear_decisions`/`apply_decisions` RPCs, and staff can read resumes (`resumes_staff_read`). Re-run `schema.sql` in each Supabase project to pick them up. The actions and the review UI that use them are in (below).
- Check-in & waitlist DB is in (`feat/staff-judge-dashboards`): `registrations.waitlisted_at`, `settings.capacity`, and `add_to_waitlist`/`admit_from_waitlist`/`remove_from_waitlist` RPCs. Re-run `schema.sql` in each Supabase project. The check-in actions and the Check-in tab that use them are in (below).
- Check-in actions are in (`feat/staff-judge-dashboards`): `src/app/staff/checkin/actions.ts` has `searchPeople` (up to 25 profiles by name/email/Discord username, with registration and `Check-in` attendance), `checkIn`/`undoCheckIn`, `addToWaitlist`/`admitFromWaitlist`/`removeFromWaitlist` (RPC errors passed through as-is), owner-only `setCapacity`, and `getCheckinSummary` (check-in count, capacity, waitlist by time added; for the page, so it doesn't revalidate; returns `error` with the first failed query and logs each failure, so the Check-in tab shows it instead of trusting a 0 count). Helpers (`checkinState`, `profileSearchFilter`) in `src/lib/checkin.ts`. The Check-in tab calls them (below).
  - The search strips `,()%*\"` but not `_`, so an underscore in a query matches any single character.
- Application review actions are in (`feat/staff-judge-dashboards`): `src/app/staff/applications/actions.ts` has `setDecisions`/`clearDecisions`/`getResumeUrl` (staff/owner) and the owner-only `sendDecisions` (emails each queued decision in batches of 100, then applies the batch with `apply_decisions`; a failed batch stays queued and stops the run; applicants with no profile email stay queued; queued decisions for applicants no longer `pending` are cleared without emailing and reported as `stale`). The Applications tab calls them (below).
  - If `apply_decisions` fails after Resend accepted a batch, those emails went out but the decisions stay queued, so the next Send would email them again. The action reports it ("Emails were sent but the decisions weren't saved") and logs it; nothing retries or dedupes.
  - `sendDecisions` loads the queue with one PostgREST select, which returns at most 1000 rows by default; anything past that waits for the next Send.
- Staff dashboard shell is in (`feat/staff-judge-dashboards`): `/staff` redirects to `/staff/applications`, with tabs Applications / Check-in / Judging / People (owner only). Applications and Check-in are built (below); Judging and People are "Coming next." placeholders that later tasks on that branch fill in. `requireRole()` in `src/lib/session.ts` is the role check for the staff actions.
- Applications tab is in (`feat/staff-judge-dashboards`): `/staff/applications` lists submitted applications (filter, search, expandable details, resume link), per-row and bulk Accept/Reject/Undo, and for owners the Send decisions bar. Helpers in `src/lib/applications.ts`.
  - The page loads `registrations` and `pending_decisions` with plain PostgREST selects, so like `sendDecisions` it sees at most 1000 rows each (Supabase's default max rows). Fine at the expected scale; page through them if applications go past that.
- Check-in tab is in (`feat/staff-judge-dashboards`): `/staff/checkin` has the counter (checked in / capacity · on waitlist · spots open, with a warning banner when `getCheckinSummary` reports an error), owner-only capacity editor, debounced search with Check in / Undo / Add to waitlist per person, and the Waitlist view (`?view=waitlist`) with Admit & check in and Remove. Components `CheckinSearch`, `WaitlistTable`, `CapacityEditor` in `src/components/staff/`. Check-in and waitlist times are shown in Eastern time (" ET"). E2E: `tests/e2e/checkin.spec.ts`.
  - The waitlist count and "Waitlist #n" count every `waitlist` row, including ones left from before the on-site meaning (no `waitlisted_at`, sorted last). Clear old `waitlist` rows before event day if any exist.
  - Capacity is a soft number: nothing stops staff admitting past it.
- Portal walk-in card is in (`feat/staff-judge-dashboards`): during the event window (`walkInsOpen()`), anyone not `confirmed`/`waitlist` sees "At the event? Join the waitlist" (connect Discord, accept agreements via `joinWalkIn`, then show the screen to staff). The waitlist status card now explains the on-site waitlist. `joinWalkIn` is covered by action tests; e2e servers run outside the event window, so the card itself has no browser test.
  - Like `saveRegistrationFlags`, `joinWalkIn` returns `ok: true` without saving consents when the registration is locked (RLS matches 0 rows).
- Judging DB is in (`feat/staff-judge-dashboards`): staff have full access to `projects`/`judge_assignments`, `projects.table_number` is an integer (re-running `schema.sql` converts old text values, keeping only digits; non-numeric values become null), and `set_user_role` drops a user's judge assignments when they stop being a judge. Re-run `schema.sql` in each Supabase project. The Judging tab that uses them is a later task on that branch.
- Judging helpers are in (`feat/staff-judge-dashboards`): `parseDevpostCsv` (`src/lib/devpost.ts`, re-adds `papaparse`), `planAssignments` and `nextTableNumbers` (`src/lib/judging.ts`), unit-tested. The actions that use them are in (below); the Judging tab is a later task on that branch.
  - `planAssignments` ignores existing rows for people who are no longer judges (they don't fill a slot or count toward load) and leaves them in place. Changing a role with hand SQL on `user_roles` doesn't run `set_user_role`'s cleanup, so such rows can exist; delete them by hand if they shouldn't show up anywhere.
- Judging actions are in (`feat/staff-judge-dashboards`): `src/app/staff/judging/actions.ts` has `importDevpostCsv` (upsert by `devpost_url`, never touches `table_number`; new projects numbered after the max in CSV order), `assignJudges` (fills every project to 3 judges, only adding rows), `addJudge` (refuses non-judges), `removeJudge`, `setTableNumber` and `deleteProject`, all staff/owner. Action tests in `tests/actions/judging.test.ts`. The Judging tab that calls them is a later task on that branch.
  - `importDevpostCsv` and `assignJudges` load `projects`/`judge_assignments` with plain PostgREST selects (at most 1000 rows each by default). Fine at hackathon scale.
  - Two imports at the same moment could both number new projects from the same max (duplicate table numbers, which the tab will flag) or hit the `devpost_url` unique error on insert.
- Discord bot to give confirmed hackers a role using `profiles.discord_id`: future work.
- Staff can read admin notes/review scores (RLS is row-level). If a staff hacker lookup gets built, consider putting it behind an RPC.
- Unused landing sections `PartnersSections.tsx` and `TeamsSection.tsx` are kept but not rendered on `/`; delete them if they're not coming back.
- Roadmap items (application review, dashboards, schedule view, workshop events + QR self check-in, teams, run-of-show): see CLAUDE.md.
