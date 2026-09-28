-- ==========================================================================
--  Supabase check + repair
--  Run this in the SQL Editor. It is safe to run as many times as you like.
--
--  Section A prints what is currently set up.
--  Section B re-applies anything that is missing.
--  Section C prints the result so you can confirm.
-- ==========================================================================


-- --------------------------------------------------------------------------
-- A. What is there right now
-- --------------------------------------------------------------------------
select 'policy' as kind, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select 'grant' as kind,
       table_name,
       grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;


-- --------------------------------------------------------------------------
-- B. Re-apply anything missing (all idempotent)
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

alter table public.admins      enable row level security;
alter table public.invitations enable row level security;
alter table public.wishes      enable row level security;
alter table public.rsvps       enable row level security;

-- admins
drop policy if exists "admins read own" on public.admins;
create policy "admins read own"
  on public.admins for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- invitations
drop policy if exists "invitations public read" on public.invitations;
create policy "invitations public read"
  on public.invitations for select using (true);

drop policy if exists "invitations admin insert" on public.invitations;
create policy "invitations admin insert"
  on public.invitations for insert with check (public.is_admin());

drop policy if exists "invitations admin update" on public.invitations;
create policy "invitations admin update"
  on public.invitations for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "invitations admin delete" on public.invitations;
create policy "invitations admin delete"
  on public.invitations for delete using (public.is_admin());

-- wishes
drop policy if exists "wishes public read" on public.wishes;
create policy "wishes public read"
  on public.wishes for select using (true);

drop policy if exists "wishes public insert" on public.wishes;
create policy "wishes public insert"
  on public.wishes for insert with check (true);

drop policy if exists "wishes admin update" on public.wishes;
create policy "wishes admin update"
  on public.wishes for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "wishes admin delete" on public.wishes;
create policy "wishes admin delete"
  on public.wishes for delete using (public.is_admin());

-- rsvps  <-- the one that was missing
drop policy if exists "rsvps public insert" on public.rsvps;
create policy "rsvps public insert"
  on public.rsvps for insert with check (true);

drop policy if exists "rsvps admin read" on public.rsvps;
create policy "rsvps admin read"
  on public.rsvps for select using (public.is_admin());

drop policy if exists "rsvps admin delete" on public.rsvps;
create policy "rsvps admin delete"
  on public.rsvps for delete using (public.is_admin());

grant usage on schema public to anon, authenticated;

grant select on public.invitations to anon;
grant select, insert, update, delete on public.invitations to authenticated;

grant select, insert on public.wishes to anon, authenticated;
grant update, delete on public.wishes to authenticated;

grant insert on public.rsvps to anon, authenticated;
grant select, delete on public.rsvps to authenticated;

grant select on public.admins to authenticated;


-- --------------------------------------------------------------------------
-- C. Remove the rows created while testing the connection
--    (guests have no delete rights, which is why this has to run here)
-- --------------------------------------------------------------------------
delete from public.wishes where name in ('Guest Probe', 'Probe2', 'ZZ Test Cleanup');
delete from public.rsvps   where name in ('Probe', 'ZZ Test Cleanup');
delete from public.invitations where name = 'ZZ Test Cleanup';


-- --------------------------------------------------------------------------
-- D. Confirm
-- --------------------------------------------------------------------------
select 'rsvps' as table_name, count(*) as rows from public.rsvps
union all select 'wishes', count(*) from public.wishes
union all select 'invitations', count(*) from public.invitations
union all select 'admins', count(*) from public.admins;

-- You want to see all four tables, zero rows, and the
-- "rsvps public insert" policy listed in section A output.
