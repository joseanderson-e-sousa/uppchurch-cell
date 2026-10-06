begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  role text not null check (role in ('pastor', 'lider')),
  created_at timestamptz not null default now(),
  unique (id, role)
);

create table public.cells (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  location text,
  weekday smallint check (weekday between 0 and 6),
  meeting_time time,
  leader_id uuid not null unique,
  -- Composite FK guarantees that only a leader profile can lead a cell.
  leader_role text not null default 'lider' check (leader_role = 'lider'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (leader_id, leader_role) references public.profiles(id, role) on delete restrict
);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(id) on delete restrict,
  meeting_date date not null,
  participants integer not null check (participants >= 0),
  visitors integer not null check (visitors >= 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (cell_id, meeting_date)
);
create index weekly_reports_meeting_date_idx on public.weekly_reports(meeting_date);
create index weekly_reports_created_by_idx on public.weekly_reports(created_by);

-- SECURITY DEFINER avoids recursive policies on profiles. No user-supplied ID.
create function public.is_pastor() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'pastor');
$$;
revoke all on function public.is_pastor() from public, anon;
grant execute on function public.is_pastor() to authenticated;

alter table public.profiles enable row level security;
alter table public.cells enable row level security;
alter table public.weekly_reports enable row level security;

revoke all on public.profiles, public.cells, public.weekly_reports from anon, authenticated;
grant select on public.profiles, public.cells, public.weekly_reports to authenticated;
grant insert (cell_id, meeting_date, participants, visitors, created_by) on public.weekly_reports to authenticated;

create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_pastor()));
create policy cells_read on public.cells for select to authenticated
using (leader_id = (select auth.uid()) or (select public.is_pastor()));
create policy reports_read on public.weekly_reports for select to authenticated
using (
  (select public.is_pastor()) or exists (
    select 1 from public.cells c where c.id = cell_id and c.leader_id = (select auth.uid())
  )
);
create policy reports_insert on public.weekly_reports for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'lider')
  and exists (select 1 from public.cells c where c.id = cell_id and c.leader_id = (select auth.uid()) and c.active)
);
-- No public profile creation, role changes, edits or deletes through the API.
commit;
