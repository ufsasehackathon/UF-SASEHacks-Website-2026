-- SASEHacks full schema + security hardening.
-- Run in the Supabase SQL editor of the project. Safe to re-run.
-- Then sign up in the app and make yourself admin (snippet at the bottom).
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
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip_code text,
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

-- registrations
create table if not exists public.registrations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'pending',
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

-- user_roles
create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('admin','sponsor'));

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

-- ===========
-- FUNCTIONS
-- ===========
-- admin checker
create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_uid and ur.role = 'admin'
  );
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

-- registrations: non-admins can't change admin-controlled columns
create or replace function public.guard_registration_admin_cols()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    if new.status is distinct from old.status
       or new.editing_locked is distinct from old.editing_locked
       or new.notes is distinct from old.notes
       or new.user_id is distinct from old.user_id then
      raise exception 'Not allowed to change admin-controlled registration fields'
        using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;

-- registrations: rows created by non-admins always start pending/unlocked
-- (forces defaults instead of raising, so the portal's ensureRows keeps working)
create or replace function public.guard_registration_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    new.status := 'pending';
    new.editing_locked := false;
    new.notes := null;
  end if;
  return new;
end
$$;

-- profiles: enforce editing_locked server-side
create or replace function public.guard_profile_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    if exists (
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
before update on public.profiles
for each row
execute function public.guard_profile_locked();

-- ===========
-- RLS ENABLE
-- ===========
alter table public.profiles enable row level security;
alter table public.registrations enable row level security;
alter table public.user_roles enable row level security;

alter table public.events enable row level security;
alter table public.attendance enable row level security;

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

-- =================
-- RLS - USER_ROLES
-- =================
drop policy if exists "user_roles_self_select" on public.user_roles;
create policy "user_roles_self_select"
on public.user_roles
for select
to authenticated
using ( user_id = auth.uid() or public.is_admin(auth.uid()) );

drop policy if exists "user_roles_admin_all" on public.user_roles;
create policy "user_roles_admin_all"
on public.user_roles
for all
to authenticated
using ( public.is_admin(auth.uid()) )
with check ( public.is_admin(auth.uid()) );

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

-- Reload the API schema cache
select pg_notify('pgrst', 'reload schema');

-- ---------------------------------------------------------------------------
-- Not executed automatically
-- ---------------------------------------------------------------------------
-- Make someone admin (UUID from Dashboard > Authentication > Users):
--   insert into public.profiles (id, email, full_name)
--   values ('PASTE_USER_ID', 'PASTE_EMAIL', 'PASTE_NAME') on conflict (id) do nothing;
--   insert into public.user_roles (user_id, role) values ('PASTE_USER_ID', 'admin')
--   on conflict (user_id, role) do nothing;
--   insert into public.registrations (user_id) values ('PASTE_USER_ID') on conflict (user_id) do nothing;
--   select public.is_admin('PASTE_USER_ID');  -- expect true
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
