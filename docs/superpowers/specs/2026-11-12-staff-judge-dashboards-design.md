# Staff, Owner & Judge Dashboards — Design

Date: 2026-11-12. Builds on `2026-10-29-applications-acceptance-design.md` (the hacker side, which is built).
Architecture/conventions: `CLAUDE.md`. Mockups from the design conversation: `.superpowers/brainstorm/` (not committed).

## Why

The hacker flow works end to end up to `pending`. After that, every decision is a hand-written SQL update, no decision email exists, nobody can be checked in through the site, and judges have nothing to look at. This design fills those gaps with the smallest dashboards that run the event:

1. Owners **and** staff review applications (accept/reject).
2. Decisions stay invisible to applicants until an owner sends them.
3. Staff check people in on event day, with an on-site waitlist for no-shows' spots.
4. Staff import projects from Devpost's submissions CSV and spread them across judges; judges see their list.
5. Owners manage roles.

Context that shaped it: the applicant pool is small and the organizers don't expect to reject many people, so review is a quick pass, not a scoring exercise. Resend is on the paid tier during decisions, so there's no daily email cap to design around.

## Goals

- Accept/reject applicants from one table, individually or in bulk.
- Owners release decisions in one click: emails go out and portals update together.
- Day-of check-in by name search, with a first-come waitlist (no-RSVPs and walk-ins) that staff fill up to capacity after check-in.
- Devpost CSV import, automatic table numbers, automatic judge assignment (≥3 judges per project), manual fixes for both.
- Judges see table number, title and Devpost link for their assigned projects.
- Owners give people roles without SQL.

## Non-goals

- Review scores, reviewer notes, or a one-applicant-at-a-time review view (the columns `review_score`/`notes` stay in the DB, unused).
- Putting applicants on the waitlist during review. Review is accept or reject only; `waitlist` is used only on event day.
- Judge scoring, rubric, comments, results (`judge_scores` stays unused). Judging itself happens outside the site.
- Workshop events / QR self check-in, stats pages, run-of-show, team management.
- RSVP-expiry automation (accepted people who never RSVP just show up as "accepted, never RSVP'd" at check-in).

## Anti-goals (would make this a failure even if it works)

- **An applicant learning their decision before the owner sends it**, through the portal or any other way.
- A rejection made by one stray click.
- An email going out without the portal matching it, or vice versa.
- Someone admitted from the waitlist without an account, linked Discord and accepted agreements.
- Re-running import/assignment reshuffling a judge's list mid-judging.

## Constraints

- Every rule in `CLAUDE.md` applies: server actions re-check the caller's role; DB guards/RLS are the second line; `schema.sql` stays re-runnable; tests are added for every new RPC/guard/action; `WIP.md` and `CLAUDE.md` updated in the same change.
- Staff are "non-admin" for every existing guard (`is_admin` = owner). Anything staff must write goes through `security definer` RPCs that check `is_staff`, using the `sasehacks.bypass_guard` pattern for guarded columns — not by widening the guards.
- Devpost has no public API; projects come from the organizer-downloaded submissions CSV.

---

## 1. Dashboard structure

`/staff` becomes a tabbed dashboard (owners and staff; the layout check already exists). Routes:

| Route | Who | Content |
|---|---|---|
| `/staff` | owner, staff | redirects to `/staff/applications` |
| `/staff/applications` | owner, staff | review table; owners also see the Send decisions bar |
| `/staff/checkin` | owner, staff | search + check-in, waitlist view, counter; owners can edit capacity |
| `/staff/judging` | owner, staff | Devpost import, table numbers, judge assignments |
| `/staff/people` | owner only (page redirects staff to `/staff/applications`) | role management |
| `/judge` | judge, owner | assigned projects |

Tab bar shows "People" only to owners. Page title stays "Owner Dashboard"/"Staff Dashboard" by role.

## 2. Application review (`/staff/applications`)

**Data model: hold unsent decisions in their own table.** New table `pending_decisions (user_id uuid pk → registrations(user_id) on delete cascade, decision text check in ('accepted','rejected'), decided_by uuid → auth.users, decided_at timestamptz default now())`. RLS: staff/owner `select`; no hacker access at all; no write policies (writes only via the RPCs below). While a decision is unsent, `registrations.status` stays `pending`, so the portal (which reads `status`) keeps showing "Application received". Sending moves the decision into `registrations.status` and deletes the row.

Why a separate table and not a `registrations.decision` column: hackers can read their own `registrations` row through RLS, and RLS can't hide a single column, so a column would leak the decision through the API.

**RPCs** (`security definer`, `is_staff` check unless noted):
- `set_decisions(p_user_ids uuid[], p_decision text)` — `p_decision` in `accepted`/`rejected`; only for registrations with `status = 'pending'`; upserts `pending_decisions`. Returns count affected.
- `clear_decisions(p_user_ids uuid[])` — undo; deletes unsent rows.
- Sending is described below (owner only).

**Table**
- Rows: registrations with `status <> 'draft'` (submitted applicants), joined to profile and any `pending_decisions` row.
- Columns: checkbox, name, school, grad year, submitted date, state, actions.
- State/filter values: *Pending* (no decision yet), *Accepted · not sent*, *Rejected · not sent*, *Accepted* / *Confirmed* / *Declined* / *Rejected* (sent; from `status`), *Waitlist*. Default filter: Pending. Search over name, email, school (client-side is fine at this scale; builder's call).
- Row expand shows: email, major, level of study, grad year, hackathon experience, engineering skill, free-response answers (loop `APPLICATION_QUESTIONS`, labels from there), LinkedIn, resume link (signed URL generated on expand/click).
- Row actions: **Accept**, **Reject** (pending, no decision); **Undo** (decision not sent). Sent decisions have no actions.
- Bulk: header select-all (selects the rows currently visible under the filter/search) and per-row checkboxes; a bar "N selected · Accept N · Reject N · Clear" appears when ≥1 selected.
- **Reject (single or bulk) opens a confirm dialog** naming the people ("Reject 3 applicants? Jane Doe, Sam Lee, Priya N. They won't be told until an owner sends decisions."). Accept has no confirmation.

**Resumes**: staff need to open resumes. Add `is_staff` to the `resumes` storage read policy (currently admin-only).

**Send decisions (owners only)**
- Bar at the top of the tab for owners: "**X accepted, Y rejected** not yet sent · [Send decisions]". Hidden from staff; hidden for owners when X+Y = 0. The button asks for one confirmation ("Email X acceptances and Y rejections now?").
- Server action `sendDecisions()` (owner check), in batches of ≤100 (Resend batch limit):
  1. Load unsent decisions with profile email/first name.
  2. Send the batch with `sendEmailBatch`.
  3. On success, call owner-only RPC `apply_decisions(p_user_ids uuid[])`: for each, `status := decision`, `last_emailed_status := decision`; for accepted also `accepted_at := now()`, `rsvp_deadline := now() + RSVP_WINDOW`; delete the `pending_decisions` row. Only applies rows still `pending`.
  4. On a failed batch, stop; those stay unsent (bar still shows them) and the owner can press Send again. Report "Sent N, M failed" in the result.
- Email first, then status, so a failed send never flips a portal without an email. A crash between send and apply could re-send that batch on retry; accepted as low-risk (builder may add Resend idempotency keys).
- `RSVP_WINDOW` (days) lives in `src/lib/constants.ts` as a **placeholder** (default 7) to confirm with organizers; `apply_decisions` takes the deadline as a parameter so the constant stays the single source.
- **Emails** (`statusEmail` in `src/lib/email.ts` gets two new cases):
  - `accepted`: you're in, RSVP by `{deadline}`, connect Discord and confirm in the portal (button to `/portal`).
  - `rejected`: kind no, mailing list link (`/#mailing-list`).
  Copy is draft; organizers review it (already a WIP item).

## 3. Day-of check-in (`/staff/checkin`)

**Counter** at top: `checked in / capacity · N on waitlist · K spots open`. Checked in = attendance rows on the `Check-in` event. Capacity = new `settings.capacity int` (nullable; when null show only "checked in"). Owners get an inline edit for capacity on this tab; new owner-only path via existing `settings_admin_all` RLS.

**Search**: type a name (or email / Discord username); results list every matching person with a profile (any status, including no registration). Each result shows name, email, Discord username (or "Discord not linked"), and a state with its action:

| State | Action |
|---|---|
| Confirmed, not checked in | **Check in** (`staff_check_in`, exists) |
| Checked in (time shown) | **Undo** (`staff_undo_check_in`, exists) |
| On waitlist | "Waitlist #n" (no action here; admit from the waitlist view) |
| Accepted (never RSVP'd), declined, rejected, pending | **Add to waitlist** |
| Walk-in ready (registration exists, not submitted, agreements accepted) | **Add to waitlist** |
| Not eligible yet: no Discord linked, or agreements not accepted | disabled, reason shown ("Link Discord first", "Agreements not accepted") |

Still-pending applicants on event day (never decided, or decided but never sent) are treated like no-RSVPs: waitlist only, and `add_to_waitlist` drops any unsent decision. Owners are expected to send all decisions before the event. *(Design call, not an organizer decision.)*

**Waitlist RPCs** (`is_staff`):
- `add_to_waitlist(p_user_id)` — requires a Discord identity (same check as `rsvp`) and the required consents (`hasRequiredConsents` equivalent: `code_of_conduct`, `mlh_code_of_conduct`, `mlh_data_sharing`, `terms_and_conditions`, `accuracy_agreement`). Refuses if already `confirmed` or already `waitlist`. Sets `status = 'waitlist'`, `waitlisted_at = now()` (new column), clears any `pending_decisions` row.
- `admit_from_waitlist(p_user_id)` — `waitlist` → `confirmed`, then the same insert as `staff_check_in`. One click = admitted and checked in.
- `remove_from_waitlist(p_user_id)` — staff mistake fix: back to the status it came from is overkill; set `status = 'declined'` and clear `waitlisted_at`. (Builder's call on exact target status; must not be `confirmed`.)

**Waitlist view** (sub-tab "Waitlist (n)"): ordered by `waitlisted_at` ascending, showing #, name, added time, and **Admit & check in**. No capacity enforcement in code; staff stop when the counter says full (capacity is a soft number they can see).

**No emails** are sent by any check-in/waitlist action.

**Walk-ins (portal side)**
- New constants `EVENT_START` / `EVENT_END` (ISO, ET) in `constants.ts`; `walkInsOpen()` = now within that window (evaluated per call).
- On `/portal`, when `walkInsOpen()` and the user's status is anything other than `confirmed` or `waitlist` (no registration, draft, pending, accepted, declined, rejected): replace their normal status card with a **"At the event? Join the waitlist"** card, so anyone who signed in by email can link Discord at the door. Applicants who already accepted the agreements skip that step. *(Design call: without it, people who applied by email and never RSVP'd would have no way to link Discord and couldn't be waitlisted.)* Steps: (1) Connect Discord (reuse the RSVP card's linking UI), (2) accept agreements (reuse the consent part of `ProfileForm` / `saveRegistrationFlags`), (3) "You're ready — show this screen to a staff member." Accepting agreements creates the registration via `ensureRows({ withRegistration: true })` (draft) — this must be allowed even though applications are closed.
- The walk-in card collects no profile fields beyond what the account has. Staff search needs a name: if `profiles.full_name`/`first_name` is empty, the card also asks for first and last name (Discord sign-ins may have only a username).
- Portal `waitlist` status copy changes to the on-site meaning: "You're on the waitlist. Stay nearby; staff will call names once check-in closes."

## 4. Judging

**Staff page `/staff/judging`**

*Import (Devpost submissions CSV)*
- Organizer downloads the submissions export from Devpost (Manage hackathon → Metrics → export submissions) and uploads it with a file input + **Import CSV** button. Hint text on the page says where to find it.
- Chosen over scraping the public gallery (decided with the organizer): it works even if the gallery is hidden until winners are announced, has nothing that breaks when Devpost changes its HTML, includes `Project Status` so drafts are skipped, and reuses the old importer (`importDevpostCsv` in `src/app/staff/actions.ts` at commit `fa3e197`; re-add `papaparse`).
- Columns read (matched case-insensitively, with the old importer's alternates): `Project Title` → `title`, `Submission Url` → `devpost_url`, `Project Status` (rows matching /draft/ skipped), and, stored but not shown yet, `Opt-In Prizes` → `track`, `About The Project` → `description`, submitter + `Team Member N First/Last Name` → `team`. Column names come from the old code, not a fresh export: verify against a real export when one exists.
- Upsert on `devpost_url`: existing projects keep their table number and assignments (the import never overwrites `table_number`); new projects get `table_number = max(existing) + 1, +2, …` in CSV row order. Result: "Imported N new, M updated, K drafts skipped." Error if no usable rows ("Is this the Devpost submissions export?"). 4 MB file limit (the server action body limit).
- `projects.table_number` becomes `int` (column is `text` today with no app data; convert in `schema.sql` re-runnably).

*Projects table*: table number (inline editable), title, Devpost link, assigned judges (chips with ×), "+ judge" picker, delete project (with confirm). Duplicate table numbers are allowed but flagged.

*Assign judges* button:
- Judges = everyone with role `judge`. Target per project: `min(3, number of judges)`.
- Only adds assignments to projects that have fewer than the target; never removes or moves existing ones (so re-running after a late import only fills new projects).
- Greedy balancing: for each under-assigned project (in table order), add the judges with the fewest current assignments who aren't already on it.
- Result: "Assigned N projects. Each judge has 7–8."
- Manual edits (add/remove judge on a project) are separate actions; "move" = remove + add.

**DB**: staff need write access to `projects` and `judge_assignments` and read of judges' names. Add staff RLS: `projects` and `judge_assignments` `for all` to `is_staff` (owners are included in `is_staff`). Profiles are already staff-readable; `user_roles` already staff-readable.

**Judge page `/judge`**: list of assigned projects sorted by table number: table number, title, "Open on Devpost" link (new tab). Empty state: "No projects assigned yet." Owners visiting `/judge` see an empty list unless they're assigned (they aren't judges for assignment purposes).

## 5. Roles (`/staff/people`, owner only)

- Top: everyone who currently has a role (name, email, role dropdown).
- Search box over all profiles (name/email); each result has a role dropdown (Owner / Staff / Judge / Hacker). Changing it calls `set_user_role` (exists; owner-only, protects the last owner) and shows its error if refused.
- Hint text: "People must sign in once before they appear here."
- Changing someone from judge to hacker leaves their `judge_assignments` rows; builder's call whether to delete them (recommended: delete, since the judge page won't show them anyway and assignment counts would be skewed).

## 6. Things that change outside the dashboards

- `CLAUDE.md`: data model (new table/columns), RPC list, routes, lifecycle table (`waitlist` = on-site only; decisions go through `pending_decisions`), staff RLS changes, remove "placeholder dashboard" text and roadmap items that are now built.
- `WIP.md`: tick review/dashboard decisions; add the placeholders (`RSVP_WINDOW`, `EVENT_START/END`, capacity) and email copy review.
- Tests (per CLAUDE.md): DB tests for every new RPC and RLS change (staff can now write projects/assignments and read resumes; hackers can't see `pending_decisions`); action tests for send decisions (batching, failure stops and leaves rows unsent), CSV import parsing (unit test against a small fixture CSV with the expected headers, a draft row, and a re-import), assignment balancing (unit test, pure function); e2e for accept → send → hacker sees accepted card, check-in search → check in, walk-in → waitlist → admit, judge sees assigned projects.

## Left to the builder

- Component structure, styling (match existing portal/`PageShell` look), client vs. server filtering.
- Pagination size of tables (probably none needed at this scale).
- Whether undo/remove actions need confirmation (not required).

## Open questions

None. Organizer placeholders still to fill: `RSVP_WINDOW`, `EVENT_START`/`EVENT_END`, capacity, email copy.
