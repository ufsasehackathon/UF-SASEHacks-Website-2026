# SASEHacks 2027 — Applications, Login, Portal & Acceptance Plan

## Context
Most of the registration system from the last cycle is already built: magic-link plus Google/GitHub login, an onboarding form, PDF resume storage, and an admin table with bulk status changes. It's switched off right now (`LOGIN_ENABLED`/`REGISTRATIONS_OPEN = false` in `src/lib/constants.ts`). The organizers have decided how acceptance should work:
- **Organizers review** applications and accept, waitlist or reject them.
- **Accepted hackers must RSVP** (confirm or decline) by a deadline. Spots that go unconfirmed are given to the waitlist.
- **Automatic email** goes out when someone's status changes.

The current system is missing several pieces this flow needs:
- There's no "submitted" state. `pending` is set the moment `ensureRows()` creates the row.
- "Accepted" and "confirmed attending" are the same value, `confirmed`.
- There's no RSVP step and no deadline.
- No emails are sent.
- There's no review score.

This plan fills those gaps and reuses everything that already works.

---

## 1. Login: Discord first, email link as backup
Everyone has to be in the Discord anyway. Discord becomes the main identity, but applicants and organizers without Discord aren't locked out.

**Login page** (`src/components/auth/SignInForm.tsx`)
- "Continue with Discord" is the main button (`signInWithOAuth({ provider: "discord" })`).
- Remove the Google and GitHub buttons.
- Keep the magic-link email option as a smaller secondary choice, for applicants without Discord and for organizers, judges and sponsors.
- Supabase dashboard: enable the Discord provider. That needs a Discord app with client ID/secret and the redirect URI `https://<project>.supabase.co/auth/v1/callback`. Disable Google and GitHub.

**Discord is required when hackers RSVP**
- Confirming attendance requires a linked Discord identity.
- If the hacker signed in by email, the Accepted card shows "Connect Discord" first. This calls `supabase.auth.linkIdentity({ provider: "discord" })` and needs manual linking turned on in the Supabase Auth settings.
- Once it's linked, the Confirm button is enabled.
- The `rsvp(true)` RPC checks for a `discord` identity in `auth.identities` for `auth.uid()`. Confirming without one fails.

**Storing the Discord account**
- New `profiles` columns: `discord_id text unique` and `discord_username text`.
- Filled from the Discord identity data after login or linking: the auth callback reads the identity and updates the profile.
- `discord_id` is protected the same way as the other admin-controlled fields: users can only get it by linking a Discord account.
- Show the Discord username in the admin table and detail page.
- Future, out of scope: a bot gives confirmed hackers a "Hacker" role using `discord_id`.

**Email for notifications**
- All status emails go to `profiles.email`, which the hacker can edit on the form.
- It defaults to the auth email, which for Discord sign-ins is the Discord account's email.

**Other**
- Set `LOGIN_ENABLED = true` when applications open.
- **Fix:** the callback redirects to any `next` value. Only allow same-site paths: `next` must start with `/` and not `//`. Otherwise fall back to `/portal`.
- **Fix:** the portal currently treats an empty profile as "redirect home" when registrations are closed. Change that so a logged-in user always lands on `/portal` and sees a "Applications are closed" state. Accepted hackers still need access after the deadline.
- **Supabase dashboard:** set the Site URL and redirect URLs for `sasehacks.com`, and customize the magic-link email template.

## 2. Application lifecycle (data model)
All changes go in `supabase/schema.sql` and must be re-runnable.

**Status values.** Add a CHECK constraint on `registrations.status`:

| status | meaning | set by |
|---|---|---|
| `draft` (new default) | started, not submitted | row creation |
| `pending` | submitted, awaiting review | hacker submits (RPC) |
| `accepted` | offered a spot | admin |
| `confirmed` | accepted and RSVP'd yes | hacker RSVP (RPC) or admin |
| `declined` | accepted and RSVP'd no, or missed the deadline | hacker RSVP / admin / expiry |
| `waitlist` | waitlisted | admin |
| `rejected` | rejected | admin |

`confirmed` keeps its meaning of "attending", so `self_check_in` (which requires `confirmed`) doesn't change.

**Migration:** none needed. Last year's registrations were already deleted, so the table starts empty.

**New columns on `registrations`:**
- `submitted_at timestamptz`
- `accepted_at timestamptz`
- `rsvp_deadline timestamptz`, set to `accepted_at + RSVP_WINDOW` when accepted
- `rsvp_at timestamptz`
- `review_score smallint` (1–5, admin only)
- `reviewed_by uuid`
- `last_emailed_status text`, used to avoid sending duplicate emails
- `responses jsonb not null default '{}'`, holding free-response answers keyed by question id (see §3)

**Guard trigger:** extend the existing non-admin guard so a non-admin can't write the new admin fields (`review_score`, `reviewed_by`, `accepted_at`, `rsvp_deadline`, `last_emailed_status`).

**New `security definer` RPCs.** These are the only ways hackers can change their own status, because the trigger blocks direct writes:
- `submit_application()`: moves `draft` to `pending` and sets `submitted_at`.
  - Requires: before the application deadline, and all required consents are true.
  - Profile completeness is checked app-side.
- `rsvp(p_attending boolean)`: moves `accepted` to `confirmed` or `declined` and sets `rsvp_at`.
  - Requires `now() <= rsvp_deadline`.
  - After confirming, hackers can still drop out (`confirmed` to `declined`). They can't go back the other way.

**Missed RSVP deadline:**
- An admin action marks overdue `accepted` rows as `declined`.
- It could later run on a schedule. For now it's a button in admin, with no cron.

**Deadlines:**
- `APPLICATIONS_CLOSE` (ISO datetime) and `RSVP_WINDOW_DAYS` go in `src/lib/constants.ts`.
- `REGISTRATIONS_OPEN` becomes "now < APPLICATIONS_CLOSE".
- The DB-side deadline in `submit_application` lives in a single-row `settings` table, or is hard-coded in the function. I'd use the table so organizers can change it in the dashboard.

## 3. Application contents
Keep the current form (`src/components/forms/OnboardingForm.tsx`, schema in `src/lib/validation.ts`). These are the fields MLH requires plus logistics:
- **Identity:** first/last name, email, phone, age.
- **School:** school (MLH list), major, grad year, level of study.
- **Experience:** skill level, hackathon count, LinkedIn.
- **Shipping address:** for swag/MLH.
- **Logistics:** t-shirt, dietary, accessibility.
- **Demographics (optional):** gender, race.
- **Resume:** PDF.
- **Consents:** accuracy, T&C, CoC, photo, resume sharing, the 3 MLH checkboxes.

Changes:
- Split the form into "Save draft" and **"Submit application"**. *(Implementation note: only Submit was built. "Draft" means "has an account but hasn't submitted". A separate Save-draft button would need a looser validation schema and was deferred.)*
  - Submit runs the full validation and checks that a resume is on file. **A resume is required.** Then it calls `submit_application()`.
  - Submit also sends the "application received" email.
- After submission, editing stays open until an admin locks it or the hacker is decided. `editing_locked` already exists.
- **Free-response questions: config-driven, so they're easy to add and remove.**
  - All free-response questions are defined in one list, `APPLICATION_QUESTIONS` in `src/lib/validation.ts`. Each entry has an `id`, `label`, `required`, `maxLength` and an optional `placeholder`.
  - Starting list: one optional question, `{ id: "build_or_learn", label: "What do you want to build or learn at SASEHacks?", required: false, maxLength: 500 }`.
  - Answers are stored in a single `registrations.responses jsonb` column (default `'{}'`), keyed by question `id`. Adding or removing a question is an edit to that one array, with no change to the schema, the actions or the admin table.
  - The form, the Zod validation (built from the list), the admin detail page and the CSV export all loop over `APPLICATION_QUESTIONS`.
  - When a question is removed, its old answers stay in the jsonb column and are simply no longer shown.

## 4. Resume storage (keep as is)
- Private `resumes` bucket, fixed path `{user_id}/resume.pdf`, upsert.
- Checks: PDF signature check, 10 MB max, owner/admin read policies, short-lived signed URLs. Bulk export already exists (`DownloadAllResumes`, `/api/export`).
- **Cleanup:** remove the duplicated upload code. Make `uploadResumeOnboarding` in `src/app/portal/actions.ts` and `uploadResume` in `src/app/portal/resume/actions.ts` share one helper.
- **Sponsor export:** only export resumes where `share_resume_with_companies = true`. Check the current `getAllResumeLinks` and filter if it doesn't already.

## 5. Hacker portal (`/portal`), driven by status
`src/app/portal/page.tsx` renders one main "next step" card based on status, plus the existing secondary cards:

| status | main card |
|---|---|
| `draft` | "Finish your application": progress checklist (profile ✓, resume ✓, consents ✓), deadline countdown, Continue button |
| `pending` | "Application received {date}. Decisions go out by {date}." Edit application link (until locked) |
| `accepted` | "You're in! 🎉" Shows the RSVP deadline. Step 1: **Connect Discord**, skipped if already linked. Step 2: **Confirm** or **Can't make it** |
| `confirmed` | "See you there": dates, venue, Discord/Devpost, hacker guide link, "Can't make it anymore" link |
| `waitlist` | "You're on the waitlist. We'll email you if a spot opens." |
| `declined` / `rejected` | Kind message, plus a link to the mailing list for next year |

Secondary cards stay: Edit Profile, Resume, Community links.

The roadmap items (schedule calendar, QR check-in, teams) are out of scope here. The `confirmed` card is where they'll go later.

## 6. Acceptance system (admin)
Builds on `src/app/admin/actions.ts`, `src/app/admin/page.tsx`, `src/app/admin/[userId]/page.tsx` and `AdminTable`.

**Review**
- The detail page gets a 1–5 score and the existing notes field, with a "Save & next" button to move through pending applications.
- The table gets filters for status and `submitted_at` presence, a sort by score, and a column showing the score.

**Decisions**
- Update `setStatus` to the new statuses (`accepted` replaces the old `confirmed` button).
- Accepting sets `accepted_at` and `rsvp_deadline`.
- Every admin action keeps its `is_admin` re-check.

**Capacity**
- Add `EVENT_CAPACITY` to constants.
- The admin header shows: submitted / accepted / confirmed / declined / waitlist, and "spots left = capacity − (accepted + confirmed)".

**Waitlist**
- "Expire overdue RSVPs" button: moves `accepted` rows past their deadline to `declined`.
- "Promote N from waitlist" button: moves the top N waitlisted rows to `accepted`, ordered by score, then `submitted_at`.
- Both trigger emails.

**Emails** (new `src/lib/email.ts`, Resend, `RESEND_API_KEY` env var)
- Templates: application received, accepted (with RSVP link and deadline), waitlisted, rejected, RSVP confirmed, promoted from waitlist.
- Admin status changes **don't send emails right away**. Decisions get queued and released with a "Send pending emails (N)" button. That button emails every row where `status != last_emailed_status` and then updates `last_emailed_status`. Organizers can fix mistakes before anything goes out, and a run that fails partway can safely be repeated.
- Hacker-triggered emails (received, RSVP confirmation) send immediately.
- Send with Resend's batch endpoint, which takes up to 100 emails per request.
- **Daily cap:**
  - The free plan allows 100 emails/day.
  - The send button sends at most `EMAIL_DAILY_CAP` emails per click. The cap is a constant, default 100.
  - Anything over the cap stays queued, and the button shows "N still queued".
  - Upgrade to Pro for the decision weeks, and raise the cap, so all decisions go out the same day.
- **Sender:**
  - Verify the sending domain in Resend: SPF, DKIM, and optionally DMARC DNS records at the registrar.
  - From: `SASEHacks <team@{domain}>`. Reply-To: the organizers' real inbox.
- **Supabase login emails also go through Resend.**
  - Configure Resend as Supabase's custom SMTP (smtp.resend.com, port 465, username `resend`, password = API key).
  - The built-in Supabase mailer can't handle real sign-up volume.
  - These login emails count toward the same Resend limits.

## Critical files
- `supabase/schema.sql`: constraint, columns, trigger update, `submit_application`, `rsvp`, settings table
- `src/lib/constants.ts`: deadlines, capacity
- `src/lib/validation.ts`, `src/components/forms/OnboardingForm.tsx`: submit step, optional short answer
- `src/app/portal/actions.ts`: `submitApplication`, `rsvp` actions, shared resume helper
- `src/app/portal/page.tsx`: status-driven card
- `src/app/admin/actions.ts`, `src/app/admin/page.tsx`, `src/app/admin/[userId]/page.tsx`, `src/components/admin/AdminTable.tsx`: score, statuses, capacity, waitlist, email send
- `src/lib/email.ts` (new), `src/app/auth/callback/route.ts` (redirect fix)
- `CLAUDE.md`: update the data-model and status docs

## Build order
1. Schema changes and RPCs
2. Submit flow and portal status cards
3. Admin review, score and statuses
4. Email
5. RSVP and waitlist tools
6. Login fixes, then flip the flags

## Open questions for organizers
- Application deadline, RSVP window (7 days?), event capacity.
- Sending domain: `ufsasehacks.com` or `sasehacks.com`? `src/lib/constants.ts` currently says `DOMAIN = "sasehacks.com"`.

Resolved: resume required; last year's rows already deleted; Resend for email; keep the one optional free-response question, config-driven.

## Verification
- `npm run lint` and `npm run build` pass.
- Re-run `schema.sql` in Supabase. Then use the commented test snippets to confirm that a non-admin JWT can't:
  - set status directly
  - call `rsvp` while not `accepted`
  - submit after the deadline
- Manual end-to-end on `npm run dev` with two accounts (one admin):
  1. Sign up and save a draft. The portal shows the draft card.
  2. Submit. Status becomes `pending` and the received email arrives.
  3. As the admin: score, accept, then "Send pending emails". The acceptance email arrives.
  4. As an email-login hacker: Confirm is blocked until Discord is connected. Connect it, and check that `discord_id` and `discord_username` are filled in. Confirm. Status becomes `confirmed`.
  5. As a Discord-login hacker: Confirm works straight away.
  6. Repeat with another applicant: waitlist them, accept someone else with a past `rsvp_deadline`, run "Expire overdue RSVPs" and then "Promote 1". The waitlisted hacker is accepted and emailed.
- Resume: upload a non-PDF (rejected) and a PDF over 10 MB (rejected). The admin signed link opens. The sponsor export leaves out non-consenting hackers.
