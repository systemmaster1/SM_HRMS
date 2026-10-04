-- =============================================================================
-- SM HRMS · Phase 2b-3 · Offline GPS queue upload (Android 1.8.6+)
-- 2026-10-05 · ADDITIVE · SAFE TO RE-RUN · NO DATA IS CHANGED OR DELETED
--
-- The Android app now stores every duty GPS point on the phone first and
-- uploads it in batches. If the internet is lost, points wait on the phone
-- (bounded queue) and are uploaded when the network returns.
--
-- Server rules (the phone is never trusted on its own):
--   * Only the signed-in employee's own points, only if Field Tracking is ON.
--   * Each point must fall inside one of the employee's attendance duties
--     (server-recorded Attendance IN .. OUT). Anything outside is rejected,
--     so a phone clock cannot place points outside duty.
--   * Points older than 72 hours or more than 2 minutes in the future are
--     rejected / clamped.
--   * Every point has a phone-generated id; re-sending the same point is
--     acknowledged but stored once (idempotent).
--   * device_captured_at (phone clock) and received_at (server clock) are both
--     kept; offline_upload marks points that arrived late.
-- =============================================================================
begin;

alter table public.employee_location_history add column if not exists client_point_id text;
alter table public.employee_location_history add column if not exists device_captured_at timestamptz;
alter table public.employee_location_history add column if not exists received_at timestamptz default now();
alter table public.employee_location_history add column if not exists offline_upload boolean not null default false;

create unique index if not exists employee_location_history_client_point_uq
  on public.employee_location_history (employee_id, client_point_id)
  where client_point_id is not null;

create or replace function public.record_employee_locations_batch_v8(p_points jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company uuid;
  v_enabled boolean;
  v_route boolean;
  v_status text;
  v_now timestamptz := clock_timestamp();
  pt jsonb;
  v_client text;
  v_lat double precision;
  v_lng double precision;
  v_t timestamptz;
  v_device_t timestamptz;
  v_acked text[] := '{}';
  v_rejected jsonb := '[]'::jsonb;
  v_latest jsonb;
  v_latest_t timestamptz;
  v_visit uuid;
  v_prev_state text;
  v_inserted int;
begin
  if v_uid is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  if p_points is null or jsonb_typeof(p_points) <> 'array' then
    raise exception 'Invalid GPS batch.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_points) > 200 then
    raise exception 'Too many GPS points in one upload (max 200).' using errcode = '22023';
  end if;

  select company_id, coalesce(field_tracking_enabled, false), coalesce(route_history_enabled, true), coalesce(status, 'active')
    into v_company, v_enabled, v_route, v_status
  from public.profiles where id = v_uid;

  -- Tracking switched off / employee removed: acknowledge nothing new, tell the phone to stop.
  if v_company is null or not v_enabled or v_status <> 'active' then
    return jsonb_build_object('acked', '[]'::jsonb, 'rejected', '[]'::jsonb, 'stop', true);
  end if;

  for pt in
    select value from jsonb_array_elements(p_points)
    order by value ->> 'captured_at'
  loop
    v_client := left(nullif(btrim(pt ->> 'client_id'), ''), 64);
    begin
      v_lat := (pt ->> 'lat')::double precision;
      v_lng := (pt ->> 'lng')::double precision;
      v_device_t := (pt ->> 'captured_at')::timestamptz;
    exception when others then
      v_rejected := v_rejected || jsonb_build_object('client_id', v_client, 'reason', 'invalid');
      if v_client is not null then v_acked := v_acked || v_client; end if; -- drop malformed point
      continue;
    end;

    if v_client is null or v_lat is null or v_lng is null or v_device_t is null
       or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
      v_rejected := v_rejected || jsonb_build_object('client_id', v_client, 'reason', 'invalid');
      if v_client is not null then v_acked := v_acked || v_client; end if;
      continue;
    end if;

    v_t := least(v_device_t, v_now);
    if v_device_t > v_now + interval '2 minutes' then
      v_t := v_now;
    end if;
    if v_t < v_now - interval '72 hours' then
      v_rejected := v_rejected || jsonb_build_object('client_id', v_client, 'reason', 'too_old');
      v_acked := v_acked || v_client;
      continue;
    end if;

    -- Must be inside a server-recorded duty (Attendance IN .. OUT).
    if not exists (
      select 1 from public.attendance a
      where a.employee_id = v_uid
        and a.company_id = v_company
        and a.check_in is not null
        and a.check_in <= v_t
        and a.check_in >= v_t - interval '24 hours'
        and (a.check_out is null or a.check_out >= v_t)
    ) then
      v_rejected := v_rejected || jsonb_build_object('client_id', v_client, 'reason', 'off_duty');
      v_acked := v_acked || v_client;
      continue;
    end if;

    if v_route then
      select id into v_visit from public.field_visits
      where employee_id = v_uid
        and status in ('accepted','on_the_way','reached','checked_in','meeting')
      order by created_at desc limit 1;

      insert into public.employee_location_history(
        company_id, employee_id, visit_id, latitude, longitude, accuracy_m, speed_mps, heading,
        source, captured_at, created_at, client_point_id, device_captured_at, received_at, offline_upload)
      values (
        v_company, v_uid, v_visit, v_lat, v_lng,
        nullif(pt ->> 'accuracy', '')::numeric::int,
        nullif(pt ->> 'speed', '')::double precision,
        nullif(pt ->> 'heading', '')::double precision,
        case when v_now - v_t > interval '2 minutes' then 'android_offline' else 'android_native' end,
        v_t, v_now, v_client, v_device_t, v_now, (v_now - v_t > interval '2 minutes'))
      on conflict (employee_id, client_point_id) where client_point_id is not null do nothing;
    end if;

    v_acked := v_acked || v_client;
    if v_latest_t is null or v_t > v_latest_t then
      v_latest_t := v_t;
      v_latest := pt;
    end if;
  end loop;

  -- Live position: only from a point taken in the last 3 minutes.
  if v_latest is not null and v_latest_t > v_now - interval '3 minutes'
     and public.is_employee_on_duty_v7(v_uid) then
    select tracking_state into v_prev_state from public.employee_live_locations where employee_id = v_uid;
    insert into public.employee_live_locations(
      employee_id, company_id, visit_id, latitude, longitude, accuracy_m, speed_mps, heading,
      permission_state, tracking_state, app_state, duty_status, duty_started_at, duty_ended_at,
      last_seen_at, last_error, last_state_changed_at, updated_at)
    values (
      v_uid, v_company, v_visit, (v_latest ->> 'lat')::double precision, (v_latest ->> 'lng')::double precision,
      nullif(v_latest ->> 'accuracy', '')::numeric::int,
      nullif(v_latest ->> 'speed', '')::double precision,
      nullif(v_latest ->> 'heading', '')::double precision,
      'granted', 'live', 'android_native', 'on_duty', v_now, null, v_now, null, v_now, v_now)
    on conflict (employee_id) do update set
      company_id = excluded.company_id, visit_id = excluded.visit_id,
      latitude = excluded.latitude, longitude = excluded.longitude,
      accuracy_m = excluded.accuracy_m, speed_mps = excluded.speed_mps, heading = excluded.heading,
      permission_state = 'granted', tracking_state = 'live', app_state = excluded.app_state,
      duty_status = 'on_duty',
      duty_started_at = coalesce(public.employee_live_locations.duty_started_at, v_now),
      duty_ended_at = null, last_seen_at = v_now, last_error = null,
      last_state_changed_at = case when public.employee_live_locations.tracking_state <> 'live'
                                   then v_now else public.employee_live_locations.last_state_changed_at end,
      updated_at = v_now;

    if v_prev_state is distinct from 'live' then
      insert into public.tracking_events(company_id, employee_id, visit_id, event_type, event_time, latitude, longitude, details)
      values (v_company, v_uid, v_visit,
        case when v_prev_state in ('permission_denied','unavailable','timeout','offline','stale')
             then 'location_restored' else 'location_received' end,
        v_now, (v_latest ->> 'lat')::double precision, (v_latest ->> 'lng')::double precision,
        jsonb_build_object('timestamp_source', 'server', 'batch', true));
    end if;
  end if;

  return jsonb_build_object(
    'acked', to_jsonb(v_acked),
    'rejected', v_rejected,
    'stop', not public.is_employee_on_duty_v7(v_uid));
end $$;

revoke all on function public.record_employee_locations_batch_v8(jsonb) from public, anon;
grant execute on function public.record_employee_locations_batch_v8(jsonb) to authenticated;

commit;
