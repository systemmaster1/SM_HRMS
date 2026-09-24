-- =============================================================================
-- SM HRMS · Phase 2 · Phone push notifications
--
-- How it works:
--   1. Every phone / browser that allows notifications registers itself in
--      public.push_devices (Android app = FCM token, browser/PWA = Web Push).
--   2. Whenever ANY row is inserted into public.notifications (task assigned,
--      leave approved, etc. - existing code already does this), a trigger
--      calls the SM HRMS server (/api/hooks/push) through pg_net.
--   3. The server sends the push to all of that user's devices.
--
-- BEFORE RUNNING: replace the two values in section 4 (URL + secret).
-- Run ONCE in Supabase -> SQL Editor. Safe to re-run.
-- =============================================================================

-- pg_net lets the database make HTTP calls (Supabase includes it).
create extension if not exists pg_net with schema extensions;

begin;

-- -----------------------------------------------------------------------------
-- 1) Registered devices
-- -----------------------------------------------------------------------------
create table if not exists public.push_devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  platform     text not null check (platform in ('android', 'web')),
  token        text not null unique,        -- FCM token, or Web Push endpoint URL
  subscription jsonb,                       -- Web Push keys (null for Android)
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_devices_user_idx on public.push_devices(user_id);

alter table public.push_devices enable row level security;

drop policy if exists push_devices_select_own on public.push_devices;
create policy push_devices_select_own on public.push_devices
for select to authenticated using (user_id = auth.uid());

drop policy if exists push_devices_delete_own on public.push_devices;
create policy push_devices_delete_own on public.push_devices
for delete to authenticated using (user_id = auth.uid());
-- Inserts go through register_push_device() below.

-- Register (or move) a device to the signed-in user. If the same phone was
-- used by someone else before, it now belongs to whoever is signed in.
create or replace function public.register_push_device(
  p_platform text,
  p_token text,
  p_subscription jsonb default null,
  p_user_agent text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_platform not in ('android', 'web') then raise exception 'Invalid platform'; end if;
  if coalesce(length(p_token), 0) < 20 then raise exception 'Invalid token'; end if;

  select company_id into v_company from public.profiles where id = auth.uid();
  if v_company is null then raise exception 'No company for this user'; end if;

  insert into public.push_devices (user_id, company_id, platform, token, subscription, user_agent)
  values (auth.uid(), v_company, p_platform, p_token, p_subscription, left(p_user_agent, 300))
  on conflict (token) do update
    set user_id = excluded.user_id,
        company_id = excluded.company_id,
        platform = excluded.platform,
        subscription = excluded.subscription,
        user_agent = excluded.user_agent,
        last_seen_at = now();
end $$;

create or replace function public.unregister_push_device(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_devices where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_device(text, text, jsonb, text) from public, anon;
revoke all on function public.unregister_push_device(text) from public, anon;
grant execute on function public.register_push_device(text, text, jsonb, text) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Track push delivery on each notification
-- -----------------------------------------------------------------------------
alter table public.notifications add column if not exists pushed_at timestamptz;
alter table public.notifications add column if not exists push_result text;

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 3) Private settings (not reachable through the public API)
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.push_config (
  id           int primary key default 1 check (id = 1),
  dispatch_url text not null,
  secret       text not null
);
revoke all on private.push_config from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4) >>> EDIT THESE TWO VALUES <<<
--    dispatch_url : your live site + /api/hooks/push
--    secret       : the SAME value you put in Vercel as PUSH_WEBHOOK_SECRET
-- -----------------------------------------------------------------------------
insert into private.push_config (id, dispatch_url, secret)
values (1, 'https://hrms.systemmaster.in/api/hooks/push', 'PASTE_PUSH_WEBHOOK_SECRET_HERE')
on conflict (id) do update
  set dispatch_url = excluded.dispatch_url,
      secret = excluded.secret;

-- -----------------------------------------------------------------------------
-- 5) Trigger: every new notification -> server sends the push
-- -----------------------------------------------------------------------------
create or replace function public.notifications_send_push() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare
  cfg private.push_config;
begin
  select * into cfg from private.push_config where id = 1;
  if cfg.dispatch_url is null or cfg.secret like 'PASTE_%' then
    return new;
  end if;

  perform net.http_post(
    url := cfg.dispatch_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cfg.secret
    ),
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  -- A push problem must never stop the notification itself from being saved.
  raise warning 'push dispatch failed: %', sqlerrm;
  return new;
end $$;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
after insert on public.notifications
for each row execute function public.notifications_send_push();

-- -----------------------------------------------------------------------------
-- 6) Realtime: the bell icon updates instantly instead of every 60 seconds
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when others then
  raise notice 'Realtime publication not changed: %', sqlerrm;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- CHECKS (run separately after setup):
--   Devices registered:      select platform, count(*) from public.push_devices group by 1;
--   Last pushes:             select title, pushed_at, push_result from public.notifications
--                            order by created_at desc limit 10;
--   HTTP calls from the DB:  select id, status_code, error_msg, created
--                            from net._http_response order by created desc limit 10;
-- -----------------------------------------------------------------------------
