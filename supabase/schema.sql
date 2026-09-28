-- ==========================================================================
--  Trevor & Marijomich — Supabase schema
--  Run this ONCE in the Supabase SQL Editor.
--    Dashboard -> SQL Editor -> New query -> paste everything -> Run
--
--  It creates:
--    invitations  one row per personal invitation link
--    wishes       the message wall
--    rsvps        every reply
--    admins       the email addresses allowed to manage everything
--
--  SECURITY MODEL
--  The website only ever holds the *anon* key, which is designed to be
--  public. These rules are what keep the admin area safe:
--    • anyone may read invitations, so a guest's name can be resolved from
--      their link (read-only — no guest list is shown anywhere in the UI)
--    • anyone may post a wish or a reply, because there is no server
--    • only signed-in admins may read replies, edit links or delete wishes
--
--  Safe to run more than once: every statement is idempotent.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Tables
-- --------------------------------------------------------------------------
create table if not exists public.admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id         uuid primary key default gen_random_uuid(),
  token      text not null unique,
  name       text not null,
  seats      integer not null default 2 check (seats between 1 and 20),
  note       text default '',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.wishes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  message     text not null,
  token       text,
  is_approved boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  attendance text not null check (attendance in ('Yes', 'No')),
  pax        integer not null default 0 check (pax between 0 and 20),
  dietary    text,
  message    text,
  token      text,
  created_at timestamptz not null default now()
);

-- Helpful when you later look at the data by hand
create index if not exists invitations_token_idx on public.invitations (token);
create index if not exists rsvps_created_idx   on public.rsvps (created_at desc);
create index if not exists wishes_created_idx  on public.wishes (created_at desc);

-- --------------------------------------------------------------------------
-- 2. Helper: is the signed-in user an admin?
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
-- 3. Row level security
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

-- invitations: readable by anyone so /invite/<token> can resolve the guest,
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

-- wishes: everyone can read and post, only admins can remove
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

-- rsvps: guests can post, but replies stay private to admins
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
-- 4. Grants
-- --------------------------------------------------------------------------
-- Policies say WHO may touch a row; grants say the role may touch the table
-- at all. Both are needed, otherwise you get
--   "permission denied for table invitations" even with the right policy.
grant usage on schema public to anon, authenticated;

grant select on public.invitations to anon;
grant select, insert, update, delete on public.invitations to authenticated;

grant select, insert on public.wishes to anon, authenticated;
grant update, delete on public.wishes to authenticated;

grant insert on public.rsvps to anon, authenticated;
grant select, delete on public.rsvps to authenticated;

grant select on public.admins to authenticated;

-- --------------------------------------------------------------------------
-- 5. Confirm it worked
-- --------------------------------------------------------------------------
select 'invitations' as table_name, count(*) from public.invitations
union all select 'wishes', count(*) from public.wishes
union all select 'rsvps',   count(*) from public.rsvps
union all select 'admins',  count(*) from public.admins;

-- ==========================================================================
--  NEXT: add yourself as the admin, then create the matching login user.
--  Run these two small statements on their own, in this order.
-- ==========================================================================

-- Step A — put your own email here and run it:
--
--   insert into public.admins (email) values ('you@example.com')
--   on conflict (email) do nothing;

-- Step B — in the dashboard menu (not SQL):
--   Authentication -> Users -> "Add user"
--     Email    : the SAME email you used in Step A
--     Password : a strong password of your choosing
--     Tick "Auto Confirm User" so you can sign in straight away
--
-- That email + password is what you type on /admin.html.
