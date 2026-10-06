begin;

-- Only app_metadata (admin controlled) can activate this trigger. Never trust
-- user_metadata for roles or provisioning. Existing accounts are untouched.
create function public.provision_invited_leader() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  payload jsonb := new.raw_app_meta_data -> 'uppchurch_onboarding';
begin
  if payload is null then return new; end if;
  if TG_OP = 'UPDATE' then
    if old.raw_app_meta_data -> 'uppchurch_onboarding' is not null then return new; end if;
  end if;
  if payload ->> 'version' is distinct from '1' or not exists (
    select 1 from public.profiles
    where id = (payload ->> 'pastor_id')::uuid and role = 'pastor'
  ) then
    raise exception 'Invalid leader onboarding authorization';
  end if;

  insert into public.profiles (id, name, role)
  values (new.id, payload ->> 'name', 'lider');

  insert into public.cells (name, leader_id, location, weekday, meeting_time)
  values (payload ->> 'cell_name', new.id, payload ->> 'location',
    (payload ->> 'weekday')::smallint, (payload ->> 'meeting_time')::time);
  return new;
end;
$$;
revoke all on function public.provision_invited_leader() from public, anon, authenticated;

create trigger uppchurch_provision_invited_leader
after insert or update of raw_app_meta_data on auth.users
for each row execute function public.provision_invited_leader();

-- The application checks this BEFORE creating any Auth account. A missing
-- migration/disabled trigger must never silently create an orphan account.
create function public.leader_onboarding_ready() returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_pastor() and exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'uppchurch_provision_invited_leader'
      and tgenabled in ('O', 'A')
  );
$$;
revoke all on function public.leader_onboarding_ready() from public, anon;
grant execute on function public.leader_onboarding_ready() to authenticated;

-- GoTrue createUser inserts Auth, then updates app_metadata in the SAME
-- transaction. Handle both events to support either ordering. Any constraint
-- or trigger error rolls back all three; no deletion of existing users needed.
-- Existing tables, grants and RLS policies are deliberately unchanged.
commit;
