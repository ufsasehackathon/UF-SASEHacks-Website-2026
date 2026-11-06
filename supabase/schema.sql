-- SASEHacks full schema + security hardening.
-- Run in the Supabase SQL editor of the project. Safe to re-run.
-- Then sign up in the app and make yourself owner (role snippet at the bottom).
-- Written for a fresh project. If the old standalone check-in tables (hackers, workshop_attendees,
-- or the old attendance with hacker_id) exist, drop them first: they are replaced by `attendance` below.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- =========
-- TABLES
-- =========
-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  phone_number text,
  date_of_birth date,
  school text,
  major text,
  grad_year text,
  level_of_study text,
  engineering_skill text,
  hackathon_experience text,
  country text,
  tshirt text,
  dietary text[],
  accessibility text,
  gender text,
  race text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- added later in the old project
  age text,
  first_name text,
  last_name text,
  linkedin_url text
);
-- Discord account, filled by sync_discord_profile() after a Discord login or link
alter table public.profiles add column if not exists discord_id text;
alter table public.profiles add column if not exists discord_username text;
-- Shipping address was removed from the application
alter table public.profiles drop column if exists address_line1;
alter table public.profiles drop column if exists address_line2;
alter table public.profiles drop column if exists city;
alter table public.profiles drop column if exists state;
alter table public.profiles drop column if exists zip_code;

-- registrations
create table if not exists public.registrations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'draft',
  accuracy_agreement boolean default false,
  terms_and_conditions boolean default false,
  code_of_conduct boolean default false,
  can_photograph boolean default false,
  resume_url text,
  resume_updated_at timestamptz,
  editing_locked boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- added later in the old project
  mlh_code_of_conduct boolean default false,
  mlh_data_sharing boolean default false,
  mlh_communications boolean default false,
  share_resume_with_companies boolean default false
);

-- application lifecycle (draft -> pending -> accepted -> confirmed/declined, or waitlist/rejected)
alter table public.registrations add column if not exists submitted_at timestamptz;
alter table public.registrations add column if not exists accepted_at timestamptz;
alter table public.registrations add column if not exists rsvp_deadline timestamptz;
alter table public.registrations add column if not exists rsvp_at timestamptz;
alter table public.registrations add column if not exists review_score smallint;
alter table public.registrations add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.registrations add column if not exists last_emailed_status text;
-- free-response answers keyed by question id (APPLICATION_QUESTIONS in src/lib/validation.ts)
alter table public.registrations add column if not exists responses jsonb not null default '{}'::jsonb;

alter table public.registrations alter column status set default 'draft';

alter table public.registrations drop constraint if exists registrations_status_check;
alter table public.registrations add constraint registrations_status_check
  check (status in ('draft','pending','accepted','confirmed','declined','waitlist','rejected'));

-- Rows created before the draft status existed defaulted to 'pending' without being
-- submitted. A real submission always sets submitted_at, so these are really drafts.
update public.registrations set status = 'draft'
where status = 'pending' and submitted_at is null;

alter table public.registrations drop constraint if exists registrations_review_score_check;
alter table public.registrations add constraint registrations_review_score_check
  check (review_score is null or review_score between 1 and 5);

-- user_roles
create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Roles: owner (everything), staff (stats, lookup, check-in), judge (scores assigned projects).
-- No row = hacker. One role per user.
alter table public.user_roles drop constraint if exists user_roles_role_check;
update public.user_roles set role = 'owner' where role = 'admin';   -- old name
delete from public.user_roles where role not in ('owner','staff','judge');
-- keep only each user's highest role (owner > staff > judge) before enforcing one per user
delete from public.user_roles a
using public.user_roles b
where a.user_id = b.user_id
  and a.ctid <> b.ctid
  and (
    (case a.role when 'owner' then 1 when 'staff' then 2 else 3 end,  a.ctid)
    > (case b.role when 'owner' then 1 when 'staff' then 2 else 3 end, b.ctid)
  );
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('owner','staff','judge'));
create unique index if not exists idx_user_roles_one_per_user on public.user_roles (user_id);

-- check-in: everyone has an account; an attendance row = "this person did this event"
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  event_name text not null unique,
  -- QR self check-in (workshops etc.): the QR encodes checkin_code; open/close it per event
  self_checkin_open boolean not null default false,
  checkin_code text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz default now()
);
alter table public.events add column if not exists self_checkin_open boolean not null default false;
alter table public.events add column if not exists checkin_code text not null default replace(gen_random_uuid()::text, '-', '');

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  checked_in_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

insert into public.events (event_name) values ('Check-in') on conflict (event_name) do nothing;

-- judging: projects (no app code yet; devpost_url is unique so an import can upsert on it)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  devpost_url text unique,
  track text,
  table_number text,
  description text,
  team text,
  created_at timestamptz not null default now()
);

-- which judge scores which project (no UI yet: distribution is still being decided)
create table if not exists public.judge_assignments (
  judge_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (judge_id, project_id)
);

-- one score sheet per judge per project; scores is jsonb keyed by criterion id (no app code yet)
create table if not exists public.judge_scores (
  judge_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (judge_id, project_id)
);

-- single-row app settings read by the RPCs below. Keep applications_close in sync with
-- APPLICATIONS_CLOSE in src/lib/constants.ts (the app uses that one for display).
create table if not exists public.settings (
  id boolean primary key default true check (id),
  applications_close timestamptz not null default '2027-02-01 23:59:00-05'
);
insert into public.settings (id) values (true) on conflict (id) do nothing;

-- mailing list signups from the landing page (no account required)
create table if not exists public.mailing_list (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 320 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

-- ===========
-- FUNCTIONS
-- ===========
-- role checkers
create or replace function public.user_role(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.user_roles where user_id = p_uid limit 1), 'hacker');
$$;

create or replace function public.is_owner(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = p_uid and role = 'owner');
$$;

-- owners count as staff
create or replace function public.is_staff(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = p_uid and role in ('owner','staff'));
$$;

create or replace function public.is_judge(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = p_uid and role = 'judge');
$$;

-- Legacy name for is_owner: the guards and most RLS policies call it
create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner(p_uid);
$$;

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Security guards. They only restrict callers that have a JWT (auth.uid() is not null) and are
-- not admins. The SQL editor, the service role and other server-side connections have
-- auth.uid() = null and are unaffected.
-- The hacker-facing RPCs (submit_application, rsvp, sync_discord_profile) still run with the
-- caller's JWT, so they set the transaction-local flag sasehacks.bypass_guard to get past them.
create or replace function public.guard_bypassed()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('sasehacks.bypass_guard', true), '') = 'on';
$$;

-- registrations: non-admins can't change admin-controlled columns
create or replace function public.guard_registration_admin_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.guard_bypassed() and not public.is_admin(auth.uid()) then
    if new.status is distinct from old.status
       or new.editing_locked is distinct from old.editing_locked
       or new.notes is distinct from old.notes
       or new.user_id is distinct from old.user_id
       or new.submitted_at is distinct from old.submitted_at
       or new.accepted_at is distinct from old.accepted_at
       or new.rsvp_deadline is distinct from old.rsvp_deadline
       or new.rsvp_at is distinct from old.rsvp_at
       or new.review_score is distinct from old.review_score
       or new.reviewed_by is distinct from old.reviewed_by
       or new.last_emailed_status is distinct from old.last_emailed_status then
      raise exception 'Not allowed to change admin-controlled registration fields'
        using errcode = '42501';
    end if;
    -- free-response answers are final once the application is submitted
    if new.responses is distinct from old.responses and old.status <> 'draft' then
      raise exception 'Application answers can''t be changed after submitting'
        using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;

-- registrations: rows created by non-admins always start as an unlocked draft
-- (forces defaults instead of raising, so the portal's ensureRows keeps working)
create or replace function public.guard_registration_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    new.status := 'draft';
    new.editing_locked := false;
    new.notes := null;
    new.submitted_at := null;
    new.accepted_at := null;
    new.rsvp_deadline := null;
    new.rsvp_at := null;
    new.review_score := null;
    new.reviewed_by := null;
    new.last_emailed_status := null;
  end if;
  return new;
end
$$;

-- profiles: enforce editing_locked server-side; Discord fields only change via sync_discord_profile
create or replace function public.guard_profile_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.guard_bypassed() and not public.is_admin(auth.uid()) then
    if (tg_op = 'INSERT' and (new.discord_id is not null or new.discord_username is not null))
       or (tg_op = 'UPDATE' and (new.discord_id is distinct from old.discord_id
                                 or new.discord_username is distinct from old.discord_username)) then
      raise exception 'Discord account can only be set by linking Discord'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and exists (
      select 1 from public.registrations r
      where r.user_id = old.id and r.editing_locked
    ) then
      raise exception 'Editing is locked for this application'
        using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;

-- QR self check-in. Attendees have no insert access to `attendance`; they call this instead.
-- The code comes from the QR shown at the event. Returns the event name.
create or replace function public.self_check_in(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_event
  from public.events
  where self_checkin_open and checkin_code = p_code;
  if not found then
    raise exception 'Invalid or closed check-in code';
  end if;

  if not exists (
    select 1 from public.registrations r
    where r.user_id = v_uid and r.status = 'confirmed'
  ) then
    raise exception 'Your registration is not confirmed';
  end if;

  insert into public.attendance (user_id, event_id, checked_in_by)
  values (v_uid, v_event.id, v_uid)
  on conflict (user_id, event_id) do nothing;

  return v_event.event_name;
end
$$;

revoke all on function public.self_check_in(text) from public;
grant execute on function public.self_check_in(text) to authenticated;

-- Owners set anyone's role. 'hacker' removes the role. The last owner can't be removed.
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner(auth.uid()) then
    raise exception 'Only owners can change roles' using errcode = '42501';
  end if;
  if p_role not in ('owner','staff','judge','hacker') then
    raise exception 'Unknown role: %', p_role;
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found';
  end if;
  if p_role <> 'owner' and public.is_owner(p_user_id)
     and (select count(*) from public.user_roles where role = 'owner') <= 1 then
    raise exception 'Can''t remove the last owner';
  end if;

  if p_role = 'hacker' then
    delete from public.user_roles where user_id = p_user_id;
  else
    insert into public.user_roles (user_id, role) values (p_user_id, p_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
end
$$;

revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- Staff check a confirmed hacker into the main event ('Check-in'). Idempotent.
create or replace function public.staff_check_in(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event uuid;
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'Only staff can check people in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.registrations where user_id = p_user_id and status = 'confirmed'
  ) then
    raise exception 'This hacker is not confirmed';
  end if;

  select id into v_event from public.events where event_name = 'Check-in';
  insert into public.attendance (user_id, event_id, checked_in_by)
  values (p_user_id, v_event, auth.uid())
  on conflict (user_id, event_id) do nothing;
end
$$;

create or replace function public.staff_undo_check_in(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'Only staff can undo check-ins' using errcode = '42501';
  end if;
  delete from public.attendance
  where user_id = p_user_id
    and event_id = (select id from public.events where event_name = 'Check-in');
end
$$;

revoke all on function public.staff_check_in(uuid) from public;
grant execute on function public.staff_check_in(uuid) to authenticated;
revoke all on function public.staff_undo_check_in(uuid) from public;
grant execute on function public.staff_undo_check_in(uuid) to authenticated;

-- Submit the caller's application: draft -> pending. Checks the deadline, the required
-- consents and that a resume is on file. Profile completeness is validated app-side.
create or replace function public.submit_application()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reg public.registrations;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_reg from public.registrations where user_id = v_uid for update;
  if not found then
    raise exception 'No application found';
  end if;
  if v_reg.status <> 'draft' then
    raise exception 'Application already submitted';
  end if;
  if now() > (select applications_close from public.settings where id) then
    raise exception 'Applications are closed';
  end if;
  if not (coalesce(v_reg.accuracy_agreement, false) and coalesce(v_reg.terms_and_conditions, false)
          and coalesce(v_reg.code_of_conduct, false) and coalesce(v_reg.mlh_code_of_conduct, false)
          and coalesce(v_reg.mlh_data_sharing, false)) then
    raise exception 'All required agreements must be accepted';
  end if;
  if v_reg.resume_url is null then
    raise exception 'A resume is required';
  end if;

  perform set_config('sasehacks.bypass_guard', 'on', true);
  update public.registrations
  set status = 'pending', submitted_at = now()
  where user_id = v_uid;
  perform set_config('sasehacks.bypass_guard', 'off', true);
end
$$;

revoke all on function public.submit_application() from public;
grant execute on function public.submit_application() to authenticated;

-- RSVP for an accepted hacker. accepted -> confirmed/declined before rsvp_deadline;
-- confirmed -> declined any time (dropping out). Confirming requires a linked Discord account.
-- Returns the new status.
create or replace function public.rsvp(p_attending boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reg public.registrations;
  v_new text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_reg from public.registrations where user_id = v_uid for update;
  if not found then
    raise exception 'No application found';
  end if;

  if v_reg.status = 'accepted' then
    if v_reg.rsvp_deadline is not null and now() > v_reg.rsvp_deadline then
      raise exception 'The RSVP deadline has passed';
    end if;
    if p_attending and not exists (
      select 1 from auth.identities i where i.user_id = v_uid and i.provider = 'discord'
    ) then
      raise exception 'Connect your Discord account before confirming';
    end if;
    v_new := case when p_attending then 'confirmed' else 'declined' end;
  elsif v_reg.status = 'confirmed' and not p_attending then
    v_new := 'declined';
  else
    raise exception 'Nothing to RSVP for';
  end if;

  perform set_config('sasehacks.bypass_guard', 'on', true);
  update public.registrations
  set status = v_new, rsvp_at = now()
  where user_id = v_uid;
  perform set_config('sasehacks.bypass_guard', 'off', true);

  return v_new;
end
$$;

revoke all on function public.rsvp(boolean) from public;
grant execute on function public.rsvp(boolean) to authenticated;

-- Copy the caller's linked Discord identity (if any) onto their profile.
-- Returns the Discord username, or null when no Discord account is linked.
create or replace function public.sync_discord_profile()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id text;
  v_username text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select i.provider_id,
         coalesce(i.identity_data->>'name', i.identity_data->>'full_name',
                  i.identity_data->'custom_claims'->>'global_name')
    into v_id, v_username
  from auth.identities i
  where i.user_id = v_uid and i.provider = 'discord'
  order by i.created_at desc
  limit 1;

  if v_id is null then
    return null;
  end if;

  perform set_config('sasehacks.bypass_guard', 'on', true);
  update public.profiles
  set discord_id = v_id, discord_username = v_username
  where id = v_uid
    and (discord_id is distinct from v_id or discord_username is distinct from v_username);
  perform set_config('sasehacks.bypass_guard', 'off', true);

  return v_username;
end
$$;

revoke all on function public.sync_discord_profile() from public;
grant execute on function public.sync_discord_profile() to authenticated;

-- After the app emails a hacker about their own status change (application received, RSVP),
-- record it so a future decision-email queue doesn't send it again. Worst case a user
-- can only suppress their own email.
create or replace function public.mark_own_status_emailed(p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  perform set_config('sasehacks.bypass_guard', 'on', true);
  update public.registrations
  set last_emailed_status = p_status
  where user_id = auth.uid() and status = p_status;
  perform set_config('sasehacks.bypass_guard', 'off', true);
end
$$;

revoke all on function public.mark_own_status_emailed(text) from public;
grant execute on function public.mark_own_status_emailed(text) to authenticated;

-- keep-alive ping for the GitHub Actions cron (.github/workflows/supabase-keepalive.yml).
-- Does a real read of mailing_list without exposing any emails to anon: returns only the row count.
create or replace function public.keep_alive()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*) from public.mailing_list;
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;

-- ===========
-- TRIGGERS
-- ===========
drop trigger if exists trg_touch_profiles on public.profiles;
create trigger trg_touch_profiles
before update on public.profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_touch_registrations on public.registrations;
create trigger trg_touch_registrations
before update on public.registrations
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_guard_registration_admin_cols on public.registrations;
create trigger trg_guard_registration_admin_cols
before update on public.registrations
for each row
execute function public.guard_registration_admin_cols();

drop trigger if exists trg_guard_registration_insert on public.registrations;
create trigger trg_guard_registration_insert
before insert on public.registrations
for each row
execute function public.guard_registration_insert();

drop trigger if exists trg_guard_profile_locked on public.profiles;
create trigger trg_guard_profile_locked
before insert or update on public.profiles
for each row
execute function public.guard_profile_locked();

drop trigger if exists trg_judge_scores_touch on public.judge_scores;
create trigger trg_judge_scores_touch
before update on public.judge_scores
for each row
execute function public.touch_updated_at();

-- ===========
-- RLS ENABLE
-- ===========
alter table public.profiles enable row level security;
alter table public.registrations enable row level security;
alter table public.user_roles enable row level security;

alter table public.events enable row level security;
alter table public.attendance enable row level security;
alter table public.mailing_list enable row level security;
alter table public.settings enable row level security;
alter table public.projects enable row level security;
alter table public.judge_assignments enable row level security;
alter table public.judge_scores enable row level security;

-- ================
-- RLS - PROFILES
-- ================
drop policy if exists "profiles_owner_select" on public.profiles;
create policy "profiles_owner_select"
on public.profiles
for select
to authenticated
using ( id = auth.uid() );

drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert"
on public.profiles
for insert
to authenticated
with check ( id = auth.uid() );

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update"
on public.profiles
for update
to authenticated
using ( id = auth.uid() )
with check ( id = auth.uid() );

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
on public.profiles
as permissive
for all
to authenticated
using ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

-- ====================
-- RLS - REGISTRATIONS
-- ====================
drop policy if exists "registrations_owner_select" on public.registrations;
create policy "registrations_owner_select"
on public.registrations
for select
to authenticated
using ( user_id = auth.uid() );

drop policy if exists "registrations_owner_insert" on public.registrations;
create policy "registrations_owner_insert"
on public.registrations
for insert
to authenticated
with check ( user_id = auth.uid() );

-- owner can update only if NOT locked
drop policy if exists "registrations_owner_update_unlocked" on public.registrations;
create policy "registrations_owner_update_unlocked"
on public.registrations
for update
to authenticated
using ( user_id = auth.uid() and editing_locked = false )
with check ( user_id = auth.uid() and editing_locked = false );

drop policy if exists "registrations_admin_all" on public.registrations;
create policy "registrations_admin_all"
on public.registrations
as permissive
for all
to authenticated
using ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

-- ==========================
-- RLS - STAFF (read-only)
-- ==========================
-- Staff (and owners) can read hacker info for lookup/check-in. They get no write policies,
-- and the guard triggers still treat staff as non-admins.
drop policy if exists "profiles_staff_select" on public.profiles;
create policy "profiles_staff_select"
on public.profiles
for select
to authenticated
using ( public.is_staff(auth.uid()) );

drop policy if exists "registrations_staff_select" on public.registrations;
create policy "registrations_staff_select"
on public.registrations
for select
to authenticated
using ( public.is_staff(auth.uid()) );

-- =================
-- RLS - USER_ROLES
-- =================
drop policy if exists "user_roles_self_select" on public.user_roles;
create policy "user_roles_self_select"
on public.user_roles
for select
to authenticated
using ( user_id = auth.uid() or public.is_staff(auth.uid()) );

-- no write policies: roles change only through set_user_role()
drop policy if exists "user_roles_admin_all" on public.user_roles;

-- ==================
-- RLS - CHECK-IN
-- ==================
drop policy if exists "events_admin_all" on public.events;
create policy "events_admin_all"
on public.events
for all
to authenticated
using ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

drop policy if exists "events_staff_select" on public.events;
create policy "events_staff_select"
on public.events
for select
to authenticated
using ( public.is_staff(auth.uid()) );

drop policy if exists "attendance_staff_select" on public.attendance;
create policy "attendance_staff_select"
on public.attendance
for select
to authenticated
using ( public.is_staff(auth.uid()) );

-- applicants can see their own check-ins
drop policy if exists "attendance_owner_select" on public.attendance;
create policy "attendance_owner_select"
on public.attendance
for select
to authenticated
using ( user_id = auth.uid() );

-- admins (who run check-in) have full access
drop policy if exists "attendance_admin_all" on public.attendance;
create policy "attendance_admin_all"
on public.attendance
for all
to authenticated
using ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

-- ==================
-- RLS - JUDGING
-- ==================
drop policy if exists "projects_owner_all" on public.projects;
create policy "projects_owner_all"
on public.projects
for all
to authenticated
using ( public.is_owner(auth.uid()) )
with check ( public.is_owner(auth.uid()) );

-- judges see only the projects assigned to them
drop policy if exists "projects_judge_select" on public.projects;
create policy "projects_judge_select"
on public.projects
for select
to authenticated
using (
  public.is_judge(auth.uid())
  and exists (
    select 1 from public.judge_assignments ja
    where ja.judge_id = auth.uid() and ja.project_id = projects.id
  )
);

drop policy if exists "judge_assignments_owner_all" on public.judge_assignments;
create policy "judge_assignments_owner_all"
on public.judge_assignments
for all
to authenticated
using ( public.is_owner(auth.uid()) )
with check ( public.is_owner(auth.uid()) );

drop policy if exists "judge_assignments_judge_select" on public.judge_assignments;
create policy "judge_assignments_judge_select"
on public.judge_assignments
for select
to authenticated
using ( judge_id = auth.uid() and public.is_judge(auth.uid()) );

drop policy if exists "judge_scores_owner_all" on public.judge_scores;
create policy "judge_scores_owner_all"
on public.judge_scores
for all
to authenticated
using ( public.is_owner(auth.uid()) )
with check ( public.is_owner(auth.uid()) );

-- judges read/write only their own score sheets, and only for assigned projects
drop policy if exists "judge_scores_judge_all" on public.judge_scores;
create policy "judge_scores_judge_all"
on public.judge_scores
for all
to authenticated
using (
  judge_id = auth.uid()
  and public.is_judge(auth.uid())
  and exists (
    select 1 from public.judge_assignments ja
    where ja.judge_id = auth.uid() and ja.project_id = judge_scores.project_id
  )
)
with check (
  judge_id = auth.uid()
  and public.is_judge(auth.uid())
  and exists (
    select 1 from public.judge_assignments ja
    where ja.judge_id = auth.uid() and ja.project_id = judge_scores.project_id
  )
);

-- ======================
-- RLS - MAILING LIST
-- ======================
-- anyone (signed in or not) can add an email; nobody but admins can read the list
drop policy if exists "mailing_list_public_insert" on public.mailing_list;
create policy "mailing_list_public_insert"
on public.mailing_list
for insert
to anon, authenticated
with check ( true );

drop policy if exists "mailing_list_admin_all" on public.mailing_list;
create policy "mailing_list_admin_all"
on public.mailing_list
for all
to authenticated
using ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

-- ==================
-- RLS - SETTINGS
-- ==================
-- readable by signed-in users (deadlines aren't secret); only admins can change them
drop policy if exists "settings_authenticated_select" on public.settings;
create policy "settings_authenticated_select"
on public.settings
for select
to authenticated
using ( true );

drop policy if exists "settings_admin_all" on public.settings;
create policy "settings_admin_all"
on public.settings
for all
to authenticated
using ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

-- ===========
-- STORAGE RLS
-- ===========
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "resumes_user_read" on storage.objects;
create policy "resumes_user_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resumes'
  and ( name like (auth.uid()::text || '/%') or public.is_admin(auth.uid()) )
);

drop policy if exists "resumes_user_upsert_pdf" on storage.objects;
create policy "resumes_user_upsert_pdf"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'resumes'
  and right(name, 4) = '.pdf'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "resumes_user_update_pdf" on storage.objects;
create policy "resumes_user_update_pdf"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'resumes'
  and name like (auth.uid()::text || '/%')
)
with check (
  bucket_id = 'resumes'
  and right(name, 4) = '.pdf'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "resumes_admin_read_all" on storage.objects;
create policy "resumes_admin_read_all"
on storage.objects
for select
to authenticated
using ( bucket_id = 'resumes' and public.is_admin(auth.uid()) );

-- =========
-- INDEXES
-- =========
create index if not exists idx_profiles_email on public.profiles (lower(email));
create index if not exists idx_registrations_status on public.registrations (status);
create index if not exists idx_user_roles_user on public.user_roles (user_id);
create index if not exists idx_attendance_event on public.attendance (event_id);
create index if not exists idx_judge_assignments_project on public.judge_assignments (project_id);
create index if not exists idx_judge_scores_project on public.judge_scores (project_id);
create unique index if not exists idx_mailing_list_email on public.mailing_list (lower(email));
create unique index if not exists idx_profiles_discord_id on public.profiles (discord_id);

-- Reload the API schema cache
select pg_notify('pgrst', 'reload schema');

-- ---------------------------------------------------------------------------
-- Not executed automatically
-- ---------------------------------------------------------------------------
-- Give someone a role (UUID from Dashboard > Authentication > Users). There's no role UI yet,
-- so this is how owners, staff and judges are set. Use 'owner', 'staff' or 'judge';
-- to make someone a hacker again, delete their user_roles row.
--   insert into public.profiles (id, email, full_name)
--   values ('PASTE_USER_ID', 'PASTE_EMAIL', 'PASTE_NAME') on conflict (id) do nothing;
--   insert into public.user_roles (user_id, role) values ('PASTE_USER_ID', 'owner')
--   on conflict (user_id) do update set role = excluded.role;
--   select public.user_role('PASTE_USER_ID');  -- expect 'owner'
--
-- Optional one-time cleanup: before registrations were created on "Apply", every portal visit
-- (including staff and judges) created a draft. This deletes drafts with nothing saved in them:
--   delete from public.registrations
--   where status = 'draft' and resume_url is null and responses = '{}'::jsonb
--     and not coalesce(accuracy_agreement, false);
--
-- Assign a project to a judge (no UI yet; distribution is still being decided):
--   insert into public.judge_assignments (judge_id, project_id)
--   select 'JUDGE_USER_ID', id from public.projects where title = 'PROJECT_TITLE'
--   on conflict do nothing;
--
-- Test as staff (same JWT setup as below, with a staff user's id):
--   select count(*) from public.profiles;                       -- works
--   update public.registrations set status = 'confirmed';       -- raises 42501
--   select public.set_user_role('SOME_USER_ID', 'staff');       -- raises 42501
--   select public.staff_check_in('NOT_CONFIRMED_USER_ID');      -- raises 'not confirmed'
--
-- Look for tampered rows (existing project):
--   select status, editing_locked, count(*) from public.registrations group by 1, 2;
--
-- Test as an applicant; should raise 42501:
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"APPLICANT_USER_ID"}', true);
--   update public.registrations set status = 'confirmed' where user_id = 'APPLICANT_USER_ID';
--   rollback;
--
-- Same setup, other guards (each should raise):
--   select public.rsvp(true);                 -- while status is not 'accepted'
--   update public.registrations set review_score = 5 where user_id = 'APPLICANT_USER_ID';
--   update public.profiles set discord_id = '123' where id = 'APPLICANT_USER_ID';
--   -- after setting settings.applications_close to the past:
--   select public.submit_application();
--
-- Change the application deadline:
--   update public.settings set applications_close = '2027-02-01 23:59:00-05';
