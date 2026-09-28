-- ==========================================================================
--  Trevor & Marijomich — Supabase schema
--  Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New
--  query, paste, Run).
--
--  It creates three tables and the access rules the site needs:
--    invitations  one row per personal invitation link
--    wishes       the message wall
--    rsvps        the replies
--    admins       the email addresses allowed to manage everything
--
--  SECURITY MODEL
--  The website only ever holds the *anon* key, which is designed to be
--  public. These rules are what keep the admin area safe:
--    • anyone may read invitations, so a guest's name can be looked up
--      from their link (read-only, no guest names are listed in the UI)
--    • anyone may post a wish or an RSVP, because there is no server
--    • only signed-in admins may read replies, edit links or delete wishes
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Admin list
-- --------------------------------------------------------------------------
create table if not exists public.admins (
  email     text primary key,
  created_at timestamptz not null default now()
);

-- Add yourself here, then create the same email as a Supabase user under
-- Authentication -> Users -> "Add user". That is the account you use on
-- the /admin page.
insert into public.admins (email) values ('YOUR-EMAIL-HERE')
on conflict (email) do nothing;

-- --------------------------------------------------------------------------
-- 2. Invitations
-- --------------------------------------------------------------------------
create table if not exists public.invitations (
  id         uuid primary key default gen_random_uuid(),
  token      text not null unique,
  name       text not null,
  seats      integer not null default 2 check (seats between 1 and 20),
  note       text default '',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 3. Wishes
-- --------------------------------------------------------------------------
create table if not exists public.wishes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  message     text not null,
  token       text,
  is_approved boolean not null default true,
  created_at  timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 4. RSVPs
-- --------------------------------------------------------------------------
create table if not exists public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  attendance text not null check (attendance in ('Yes', 'No')),
  pax        integer not null default 0,
  dietary    text,
  message    text,
  token      text,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 5. Helper: is the signed-in user an admin?
-- --------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- --------------------------------------------------------------------------
-- 6. Row level security
-- --------------------------------------------------------------------------
alter table public.admins      enable row level security;
alter table public.invitations enable row level security;
alter table public.wishes      enable row level security;
alter table public.rsvps       enable row level security;

-- admins: you can only ever read your own row
drop policy if exists "admins read own" on public.admins;
create policy "admins read own"
  on public.admins for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- invitations: readable by anyone (needed to resolve /invite/<token>),
-- writable only by admins
drop policy if exists "invitations public read" on public.invitations;
create policy "invitations public read"
  on public.invitations for select
  using (true);

drop policy if exists "invitations admin insert" on public.invitations;
create policy "invitations admin insert"
  on public.invitations for insert
  with check (public.is_admin());

drop policy if exists "invitations admin update" on public.invitations;
create policy "invitations admin update"
  on public.invitations for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "invitations admin delete" on public.invitations;
create policy "invitations admin delete"
  on public.invitations for delete
  using (public.is_admin());

-- wishes: everyone can read and post, only admins can delete
drop policy if exists "wishes public read" on public.wishes;
create policy "wishes public read"
  on public.wishes for select
  using (true);

drop policy if exists "wishes public insert" on public.wishes;
create policy "wishes public insert"
  on public.wishes for insert
  with check (true);

drop policy if exists "wishes admin update" on public.wishes;
create policy "wishes admin update"
  on public.wishes for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "wishes admin delete" on public.wishes;
create policy "wishes admin delete"
  on public.wishes for delete
  using (public.is_admin());

-- rsvps: guests can post, but replies are private to admins
drop policy if exists "rsvps public insert" on public.rsvps;
create policy "rsvps public insert"
  on public.rsvps for insert
  with check (true);

drop policy if exists "rsvps admin read" on public.rsvps;
create policy "rsvps admin read"
  on public.rsvps for select
  using (public.is_admin());

drop policy if exists "rsvps admin delete" on public.rsvps;
create policy "rsvps admin delete"
  on public.rsvps for delete
  using (public.is_admin());

-- --------------------------------------------------------------------------
-- 7. Handy views
-- --------------------------------------------------------------------------
create or replace view public.rsvp_summary
with (security_invoker = true) as
select
  count(*) filter (where attendance = 'Yes')  as attending,
  count(*) filter (where attendance = 'No')   as declined,
  coalesce(sum(pax) filter (where attendance = 'Yes'), 0) as total_pax
from public.rsvps;

grant select on public.rsvp_summary to authenticated;
