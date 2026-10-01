-- SM HRMS · Field visit status constraint repair v9
-- Safe/re-runnable. Keeps all existing rows and expands the lifecycle states used by the app.
begin;

do $$
declare
  r record;
begin
  -- Remove only CHECK constraints on field_visits that reference the status column.
  -- This handles legacy databases where the constraint name differs.
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'field_visits'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.field_visits drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.field_visits
  add constraint field_visits_status_check
  check (status in (
    'planned',
    'assigned',
    'accepted',
    'on_the_way',
    'reached',
    'checked_in',
    'meeting',
    'completed',
    'cancelled'
  )) not valid;

-- Validate after adding. Existing legitimate lifecycle rows remain untouched.
alter table public.field_visits validate constraint field_visits_status_check;

commit;
