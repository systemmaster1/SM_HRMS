-- =============================================================================
-- SM HRMS · Phase 2B · Work calendar, daily attendance log, recurring tasks,
--                     reminders and tamper-proof field-visit timestamps
--
-- Run ONCE in Supabase → SQL Editor, BEFORE uploading the Phase 2B code.
-- Safe to re-run. It only ADDS tables, columns, functions and triggers; no
-- existing function, table or row is deleted.
--
-- Needs pg_cron (Supabase Dashboard → Integrations → Cron → Enable).
-- The last section schedules the jobs; if pg_cron is not enabled it prints a
-- notice and you can run that section again after enabling it.
-- =============================================================================

begin;

-- =============================================================================
-- 1) WORK CALENDAR
--    Weekly off days: 0 = Sunday … 6 = Saturday.
--    saturday_off_weeks: which Saturdays of the month are off, e.g. {2,4}.
--    Employees can override the company weekly off (e.g. retail staff: Tuesday).
-- =============================================================================
alter table public.companies add column if not exists weekly_off_days    int[] not null default '{0}';
alter table public.companies add column if not exists saturday_off_weeks int[] not null default '{}';
alter table public.profiles  add column if not exists weekly_off_days    int[];   -- null = company default

create index if not exists holidays_company_date_idx on public.holidays(company_id, holiday_date);

/** 'holiday' | 'weekly_off' | null (working day) for an employee on a date. */
create or replace function public.day_off_reason(p_company uuid, p_employee uuid, p_date date)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_week int[];
  v_sat  int[];
  v_dow  int := extract(dow from p_date)::int;
begin
  if exists (
    select 1 from public.holidays h
    where h.company_id = p_company and h.holiday_date = p_date
      and coalesce(nullif(to_jsonb(h)->>'holiday_type', ''), 'public') = 'public'
  ) then
    return 'holiday';
  end if;

  select coalesce(p.weekly_off_days, c.weekly_off_days, '{0}'), coalesce(c.saturday_off_weeks, '{}')
    into v_week, v_sat
  from public.companies c
  left join public.profiles p on p.id = p_employee
  where c.id = p_company;

  if v_dow = any(coalesce(v_week, '{0}')) then
    return 'weekly_off';
  end if;

  -- 1st Saturday = days 1-7, 2nd = 8-14, … (only for employees on the company pattern)
  if v_dow = 6 and ((extract(day from p_date)::int - 1) / 7 + 1) = any(coalesce(v_sat, '{}')) then
    if (select p.weekly_off_days from public.profiles p where p.id = p_employee) is null then
      return 'weekly_off';
    end if;
  end if;

  return null;
end $$;

/** The same date if it is a working day, otherwise the next working day. */
create or replace function public.next_working_day(p_company uuid, p_employee uuid, p_date date)
returns date
language plpgsql stable security definer set search_path = public as $$
declare d date := p_date;
begin
  for i in 1..60 loop
    if public.day_off_reason(p_company, p_employee, d) is null then
      return d;
    end if;
    d := d + 1;
  end loop;
  return p_date;  -- everything is off for 60 days: do not move
end $$;

create or replace function public.today_ist() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- =============================================================================
-- 2) DAILY ATTENDANCE LOG
--    One row per active employee per day. Existing attendance/payroll logic is
--    not touched; this is a complete register built from it.
--    Priority: check-in record > approved leave > holiday > weekly off > absent.
-- =============================================================================
create table if not exists public.attendance_daily_log (
  employee_id  uuid not null references public.profiles(id) on delete cascade,
  work_date    date not null,
  company_id   uuid not null references public.companies(id) on delete cascade,
  status       text not null check (status in
                 ('present', 'late', 'half_day', 'on_leave', 'holiday', 'weekly_off', 'absent', 'pending')),
  check_in     timestamptz,
  check_out    timestamptz,
  work_minutes integer,
  note         text,
  finalized    boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (employee_id, work_date)
);

create index if not exists attendance_daily_log_company_date_idx
  on public.attendance_daily_log(company_id, work_date);

alter table public.attendance_daily_log enable row level security;

drop policy if exists attendance_daily_log_select on public.attendance_daily_log;
create policy attendance_daily_log_select on public.attendance_daily_log
for select to authenticated
using (
  company_id = public.my_company_id()
  and (employee_id = auth.uid() or public.is_company_admin() or public.reports_to_me(employee_id))
);
-- Written only by the functions below.

/**
 * Builds the register for one date (all companies, or one company).
 * p_final = true after the day is over: employees with nothing recorded
 * become 'absent' instead of 'pending'.
 */
create or replace function public.refresh_attendance_log(
  p_date date, p_final boolean default false, p_company uuid default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with emp as (
    select p.id, p.company_id
    from public.profiles p
    where coalesce(p.status, 'active') = 'active'
      and p.company_id is not null
      and (p_company is null or p.company_id = p_company)
      and coalesce(nullif(to_jsonb(p)->>'joined_on', '')::date, p_date) <= p_date
  ),
  att as (
    select distinct on (a.employee_id)
      a.employee_id,
      lower(coalesce(to_jsonb(a)->>'status', ''))                       as st,
      coalesce((to_jsonb(a)->>'is_late')::boolean, false)               as late,
      nullif(coalesce(to_jsonb(a)->>'check_in', to_jsonb(a)->>'check_in_at'), '')::timestamptz   as cin,
      nullif(coalesce(to_jsonb(a)->>'check_out', to_jsonb(a)->>'check_out_at'), '')::timestamptz as cout,
      nullif(to_jsonb(a)->>'work_minutes', '')::integer                 as mins
    from public.attendance a
    join emp on emp.id = a.employee_id
    where a.work_date = p_date
    order by a.employee_id, nullif(coalesce(to_jsonb(a)->>'check_in', to_jsonb(a)->>'check_in_at'), '') nulls last
  ),
  lv as (
    select distinct l.employee_id,
           coalesce(nullif(to_jsonb(l)->>'day_type', ''), 'full_day') as day_type
    from public.leaves l
    join emp on emp.id = l.employee_id
    where l.status = 'approved'
      and p_date between l.from_date and coalesce(l.to_date, l.from_date)
  ),
  calc as (
    select
      emp.id as employee_id, emp.company_id,
      att.cin, att.cout, att.mins,
      public.day_off_reason(emp.company_id, emp.id, p_date) as off,
      case
        when att.employee_id is not null and (att.cin is not null or att.st in ('present', 'late', 'half_day'))
          then case
                 when att.st = 'half_day' then 'half_day'
                 when att.late or att.st = 'late' then 'late'
                 else 'present'
               end
        when lv.employee_id is not null then 'on_leave'
        else null
      end as worked_or_leave,
      lv.day_type,
      att.st
    from emp
    left join att on att.employee_id = emp.id
    left join lv  on lv.employee_id  = emp.id
  ),
  final as (
    select employee_id, company_id, cin, cout, mins,
      coalesce(
        worked_or_leave,
        off,
        case when p_final or st = 'absent' then 'absent' else 'pending' end
      ) as status,
      case
        when worked_or_leave is not null and off is not null then 'Worked on ' || replace(off, '_', ' ')
        when worked_or_leave = 'on_leave' and day_type <> 'full_day' then replace(day_type, '_', ' ')
        else null
      end as note
    from calc
  ),
  up as (
    insert into public.attendance_daily_log as t
      (employee_id, work_date, company_id, status, check_in, check_out, work_minutes, note, finalized, updated_at)
    select employee_id, p_date, company_id, status, cin, cout, mins, note, p_final, now()
    from final
    on conflict (employee_id, work_date) do update
      set status       = excluded.status,
          check_in     = excluded.check_in,
          check_out    = excluded.check_out,
          work_minutes = excluded.work_minutes,
          note         = excluded.note,
          finalized    = t.finalized or excluded.finalized,
          updated_at   = now()
    returning 1
  )
  select count(*) into n from up;
  return n;
end $$;

/** Admin tool: rebuild the register for a date range of the caller's company. */
create or replace function public.rebuild_my_attendance_log(p_from date, p_to date)
returns integer
language plpgsql security definer set search_path = public as $$
declare d date; total integer := 0; v_company uuid := public.my_company_id();
begin
  if not public.is_company_admin() then
    raise exception 'Only admins can rebuild the attendance register';
  end if;
  if p_to - p_from > 400 then
    raise exception 'Please choose at most 400 days at a time';
  end if;
  d := p_from;
  while d <= least(p_to, public.today_ist()) loop
    total := total + public.refresh_attendance_log(d, d < public.today_ist(), v_company);
    d := d + 1;
  end loop;
  return total;
end $$;

-- =============================================================================
-- 3) RECURRING TASK ENGINE (server-side)
--    Every night (and whenever an admin creates a checklist) each active
--    template creates its occurrences for the next 7 days at its frequency.
--    Occurrences never fall on a holiday / weekly off (moved to the next
--    working day) and due times are kept inside company working hours.
-- =============================================================================
alter table public.checklist_instances add column if not exists reminder_sent_at timestamptz;
alter table public.delegations         add column if not exists reminder_sent_at timestamptz;
alter table public.delegations         add column if not exists overdue_notified_at timestamptz;

create index if not exists checklist_instances_template_due_idx
  on public.checklist_instances(template_id, due_date);

/** Adds n months, keeping the original day-of-month where possible (31st → 30th/28th). */
create or replace function public.add_months_anchored(p_date date, p_months int, p_anchor_day int)
returns date language sql immutable as $$
  select least(
    (date_trunc('month', p_date) + make_interval(months => p_months))::date + (p_anchor_day - 1),
    ((date_trunc('month', p_date) + make_interval(months => p_months + 1))::date - 1)
  )
$$;

create or replace function public.generate_recurring_tasks(
  p_days_ahead int default 7, p_company uuid default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  t        record;
  occ      date;
  due      date;
  nxt      date;
  anchor   int;
  horizon  date := public.today_ist() + p_days_ahead;
  created  integer := 0;
  guard    int;
  v_time   time;
  v_start  time;
  v_end    time;
begin
  for t in
    select ct.*, coalesce(c.work_start::time, '09:30'::time) as ws, coalesce(c.work_end::time, '18:30'::time) as we
    from public.checklist_templates ct
    join public.companies c on c.id = ct.company_id
    where ct.next_due_date is not null
      and ct.next_due_date <= horizon
      and coalesce((to_jsonb(ct)->>'active')::boolean, true)
      and (p_company is null or ct.company_id = p_company)
    for update of ct skip locked
  loop
    occ    := t.next_due_date;
    anchor := extract(day from coalesce(t.start_date, t.next_due_date))::int;
    guard  := 0;

    -- keep the due time inside working hours
    v_start := t.ws; v_end := t.we;
    v_time  := coalesce(nullif(to_jsonb(t)->>'due_time', '')::time, v_start);
    if v_end > v_start then
      v_time := greatest(v_start, least(v_time, v_end));
    end if;

    while occ <= horizon and guard < 400 loop
      guard := guard + 1;
      exit when t.end_date is not null and occ > t.end_date;

      -- Occurrences missed for more than 3 days are skipped, not dumped as overdue.
      if occ >= public.today_ist() - 3 then
        due := case when t.frequency = 'daily'
                    then occ   -- daily: simply skip off days (no pile-up on Monday)
                    else public.next_working_day(t.company_id, t.assigned_to, occ) end;

        if public.day_off_reason(t.company_id, t.assigned_to, due) is null
           and (t.end_date is null or due <= t.end_date + 7)
           and not exists (
             select 1 from public.checklist_instances i
             where i.template_id = t.id and i.due_date = due
           )
        then
          insert into public.checklist_instances (company_id, template_id, assigned_to, due_date, due_time)
          values (t.company_id, t.id, t.assigned_to, due, v_time);
          created := created + 1;
        end if;
      end if;

      nxt := case t.frequency
        when 'daily'       then occ + 1
        when 'weekly'      then occ + 7
        when 'monthly'     then public.add_months_anchored(occ, 1, anchor)
        when 'quarterly'   then public.add_months_anchored(occ, 3, anchor)
        when 'half_yearly' then public.add_months_anchored(occ, 6, anchor)
        when 'yearly'      then public.add_months_anchored(occ, 12, anchor)
        else null
      end;
      exit when nxt is null or nxt <= occ;
      occ := nxt;
    end loop;

    update public.checklist_templates set next_due_date = occ where id = t.id;
  end loop;

  return created;
end $$;

/** Called from the Tasks page / after creating a checklist: runs for the caller's company. */
create or replace function public.generate_my_company_tasks()
returns integer
language plpgsql security definer set search_path = public as $$
begin
  if public.my_company_id() is null then return 0; end if;
  return public.generate_recurring_tasks(7, public.my_company_id());
end $$;

-- =============================================================================
-- 4) FIELD VISITS · planned vs actual, tamper-proof timestamps, plan alerts
-- =============================================================================
alter table public.field_visits add column if not exists original_scheduled_at timestamptz;
alter table public.field_visits add column if not exists reschedule_count     integer not null default 0;
alter table public.field_visits add column if not exists reminder_sent_at     timestamptz;

create table if not exists public.field_visit_schedule_changes (
  id          uuid primary key default gen_random_uuid(),
  visit_id    uuid not null references public.field_visits(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  old_at      timestamptz,
  new_at      timestamptz,
  changed_by  uuid references public.profiles(id) on delete set null,
  changed_at  timestamptz not null default now()
);
create index if not exists field_visit_schedule_changes_visit_idx
  on public.field_visit_schedule_changes(visit_id, changed_at);

alter table public.field_visit_schedule_changes enable row level security;
drop policy if exists field_visit_schedule_changes_select on public.field_visit_schedule_changes;
create policy field_visit_schedule_changes_select on public.field_visit_schedule_changes
for select to authenticated
using (
  company_id = public.my_company_id()
  and exists (
    select 1 from public.field_visits v
    where v.id = visit_id
      and (v.employee_id = auth.uid() or public.is_company_admin() or public.reports_to_me(v.employee_id))
  )
);

/** Once an actual timestamp is recorded it can never be changed or cleared. */
create or replace function public.field_visits_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o   jsonb;
  n   jsonb;
  c   text;
  fix jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    new.original_scheduled_at := coalesce(new.original_scheduled_at, new.scheduled_at);
    return new;
  end if;

  o := to_jsonb(old);
  n := to_jsonb(new);
  foreach c in array array['accepted_at', 'travel_started_at', 'reached_at', 'check_in_at',
                           'meeting_started_at', 'completed_at', 'check_out_at', 'original_scheduled_at']
  loop
    if o ? c and (o->>c) is not null and (n->>c) is distinct from (o->>c) then
      fix := fix || jsonb_build_object(c, o->c);
    end if;
  end loop;
  if fix <> '{}'::jsonb then
    new := jsonb_populate_record(new, fix);
  end if;

  -- Reschedule: keep the first plan, log the change, re-arm the 30-min reminder.
  if new.scheduled_at is distinct from old.scheduled_at then
    new.original_scheduled_at := coalesce(old.original_scheduled_at, old.scheduled_at, new.scheduled_at);
    if old.scheduled_at is not null then
      new.reschedule_count := coalesce(old.reschedule_count, 0) + 1;
    end if;
    new.reminder_sent_at := null;
  end if;

  return new;
end $$;

drop trigger if exists field_visits_guard on public.field_visits;
create trigger field_visits_guard
before insert or update on public.field_visits
for each row execute function public.field_visits_guard();

/** Notifications when a plan is created or changed by someone else. */
create or replace function public.field_visits_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.assigned_by);
  v_name  text;
  v_when  text;
begin
  select full_name into v_name from public.profiles where id = v_actor;
  v_when := case when new.scheduled_at is null then to_char(new.visit_date, 'DD Mon YYYY')
                 else to_char(new.scheduled_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM') end;

  if tg_op = 'INSERT' then
    if v_actor is not null and v_actor <> new.employee_id then
      insert into public.notifications (company_id, user_id, title, body, kind, link)
      values (new.company_id, new.employee_id,
              'New visit planned: ' || coalesce(nullif(new.client_name, ''), 'Client visit'),
              coalesce(v_name, 'Your manager') || ' planned this visit for ' || v_when || '.',
              'visit_planned', '/field-visits');
    end if;
    return new;
  end if;

  if new.scheduled_at is distinct from old.scheduled_at then
    insert into public.field_visit_schedule_changes (visit_id, company_id, old_at, new_at, changed_by)
    values (new.id, new.company_id, old.scheduled_at, new.scheduled_at, v_actor);

    if v_actor is not null and v_actor <> new.employee_id then
      insert into public.notifications (company_id, user_id, title, body, kind, link)
      values (new.company_id, new.employee_id,
              'Visit rescheduled: ' || coalesce(nullif(new.client_name, ''), 'Client visit'),
              'New time: ' || v_when || ' (changed by ' || coalesce(v_name, 'your manager') || ').',
              'visit_rescheduled', '/field-visits');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists field_visits_notify on public.field_visits;
create trigger field_visits_notify
after insert or update of scheduled_at on public.field_visits
for each row execute function public.field_visits_notify();

-- Existing visits: remember today's scheduled time as the original plan.
update public.field_visits
set original_scheduled_at = scheduled_at
where original_scheduled_at is null and scheduled_at is not null;

-- =============================================================================
-- 5) REMINDERS (runs every 5 minutes)
--    · Visit starts in ≤ 30 min            → employee
--    · Task due in ≤ 30 min                → employee
--    · Morning summary at work start       → employee (tasks + visits today)
--    · Delegation overdue                  → person who assigned it
-- =============================================================================
create table if not exists public.daily_digest_log (
  employee_id uuid not null references public.profiles(id) on delete cascade,
  day         date not null,
  sent_at     timestamptz not null default now(),
  primary key (employee_id, day)
);
alter table public.daily_digest_log enable row level security;  -- server only

create or replace function public.run_reminders() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_now    timestamptz := now();
  v_today  date := public.today_ist();
  v_visits int := 0;
  v_tasks  int := 0;
  v_digest int := 0;
  v_over   int := 0;
begin
  -- 1. Visits starting within 30 minutes
  with due as (
    update public.field_visits v
    set reminder_sent_at = v_now
    where v.scheduled_at > v_now
      and v.scheduled_at <= v_now + interval '30 minutes'
      and v.reminder_sent_at is null
      and v.travel_started_at is null
      and coalesce(v.status, '') not in ('completed', 'cancelled', 'rejected', 'missed')
    returning v.company_id, v.employee_id, v.client_name, v.address, v.scheduled_at
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select company_id, employee_id,
           'Visit in 30 minutes: ' || coalesce(nullif(client_name, ''), 'Client visit'),
           'Planned for ' || to_char(scheduled_at at time zone 'Asia/Kolkata', 'HH12:MI AM')
             || coalesce(' · ' || nullif(address, ''), '') || '. Tap to start travel.',
           'visit_reminder', '/field-visits'
    from due
    returning 1
  ) select count(*) into v_visits from ins;

  -- 2a. Checklist tasks due within 30 minutes
  with due as (
    update public.checklist_instances i
    set reminder_sent_at = v_now
    from public.checklist_templates t
    where t.id = i.template_id
      and i.completed_at is null
      and i.reminder_sent_at is null
      and i.due_date = v_today
      and i.due_time is not null
      and ((i.due_date + i.due_time::time) at time zone 'Asia/Kolkata') > v_now
      and ((i.due_date + i.due_time::time) at time zone 'Asia/Kolkata') <= v_now + interval '30 minutes'
    returning i.company_id, i.assigned_to, t.title, i.due_time
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select company_id, assigned_to, 'Task due soon: ' || title,
           'Due today at ' || to_char(v_today + due_time::time, 'HH12:MI AM') || '.', 'task_reminder', '/tasks'
    from due returning 1
  ) select count(*) into v_tasks from ins;

  -- 2b. Delegations due within 30 minutes
  with due as (
    update public.delegations d
    set reminder_sent_at = v_now
    where d.completed_at is null
      and d.reminder_sent_at is null
      and d.due_date = v_today
      and d.due_time is not null
      and ((d.due_date + d.due_time::time) at time zone 'Asia/Kolkata') > v_now
      and ((d.due_date + d.due_time::time) at time zone 'Asia/Kolkata') <= v_now + interval '30 minutes'
    returning d.company_id, d.assigned_to, d.title, d.due_time
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select company_id, assigned_to, 'Task due soon: ' || title,
           'Due today at ' || to_char(v_today + due_time::time, 'HH12:MI AM') || '.', 'task_reminder', '/tasks'
    from due returning 1
  ) select v_tasks + count(*) into v_tasks from ins;

  -- 3. Morning summary, once a day, when the company's working day starts
  --    (not on holidays / weekly offs / approved leave)
  with emp as (
    select p.id, p.company_id
    from public.profiles p
    join public.companies c on c.id = p.company_id
    where coalesce(p.status, 'active') = 'active'
      and (v_now at time zone 'Asia/Kolkata')::time >= coalesce(c.work_start::time, '09:30'::time)
      and (v_now at time zone 'Asia/Kolkata')::time <  coalesce(c.work_start::time, '09:30'::time) + interval '2 hours'
      and public.day_off_reason(p.company_id, p.id, v_today) is null
      and not exists (select 1 from public.daily_digest_log g where g.employee_id = p.id and g.day = v_today)
      and not exists (select 1 from public.leaves l where l.employee_id = p.id and l.status = 'approved'
                      and v_today between l.from_date and coalesce(l.to_date, l.from_date))
  ), counts as (
    select emp.id, emp.company_id,
      (select count(*) from public.checklist_instances i
        where i.assigned_to = emp.id and i.due_date = v_today and i.completed_at is null)
      + (select count(*) from public.delegations d
        where d.assigned_to = emp.id and d.due_date <= v_today and d.completed_at is null) as tasks,
      (select count(*) from public.field_visits v
        where v.employee_id = emp.id and v.visit_date = v_today
          and coalesce(v.status, '') not in ('completed', 'cancelled', 'rejected')) as visits
    from emp
  ), logged as (
    insert into public.daily_digest_log (employee_id, day)
    select id, v_today from counts where tasks + visits > 0
    on conflict do nothing
    returning employee_id
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select c.company_id, c.id, 'Your plan for today',
           case
             when c.tasks > 0 and c.visits > 0 then
               'You have ' || c.tasks || ' open task' || case when c.tasks = 1 then '' else 's' end
               || ' and ' || c.visits || ' visit' || case when c.visits = 1 then '' else 's' end || ' today.'
             when c.tasks > 0 then
               'You have ' || c.tasks || ' open task' || case when c.tasks = 1 then '' else 's' end || ' today.'
             else
               'You have ' || c.visits || ' visit' || case when c.visits = 1 then '' else 's' end || ' planned today.'
           end,
           'daily_digest', case when c.visits > 0 then '/field-visits' else '/tasks' end
    from counts c join logged l on l.employee_id = c.id
    returning 1
  ) select count(*) into v_digest from ins;

  -- 4. Delegation overdue → tell the person who assigned it (once)
  with od as (
    update public.delegations d
    set overdue_notified_at = v_now
    where d.completed_at is null
      and d.overdue_notified_at is null
      and d.assigned_by is not null
      and d.assigned_by <> d.assigned_to
      and ((d.due_date + coalesce(d.due_time::time, '23:59'::time)) at time zone 'Asia/Kolkata') < v_now
      and d.due_date >= v_today - 7
    returning d.company_id, d.assigned_by, d.assigned_to, d.title
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select od.company_id, od.assigned_by, 'Overdue: ' || od.title,
           coalesce(p.full_name, 'The assignee') || ' has not completed this task yet.',
           'task_overdue', '/tasks'
    from od left join public.profiles p on p.id = od.assigned_to
    returning 1
  ) select count(*) into v_over from ins;

  return jsonb_build_object('visits', v_visits, 'tasks', v_tasks, 'digests', v_digest, 'overdue', v_over);
end $$;

-- =============================================================================
-- 6) Permissions: company-wide jobs are server-only
-- =============================================================================
revoke all on function public.refresh_attendance_log(date, boolean, uuid) from public, anon, authenticated;
revoke all on function public.generate_recurring_tasks(int, uuid)          from public, anon, authenticated;
revoke all on function public.run_reminders()                               from public, anon, authenticated;
grant execute on function public.rebuild_my_attendance_log(date, date) to authenticated;
grant execute on function public.generate_my_company_tasks()           to authenticated;
grant execute on function public.day_off_reason(uuid, uuid, date)      to authenticated;
grant execute on function public.next_working_day(uuid, uuid, date)    to authenticated;

commit;

-- =============================================================================
-- 7) Schedules (pg_cron). Times are UTC; IST = UTC + 5:30.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron is not enabled. Enable it (Dashboard → Integrations → Cron) and run section 7 again.';
    return;
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname like 'smhrms-%'
    and jobname in ('smhrms-reminders', 'smhrms-attendance-today', 'smhrms-attendance-close',
                    'smhrms-attendance-yesterday', 'smhrms-recurring-tasks');

  -- Reminders every 5 minutes
  perform cron.schedule('smhrms-reminders', '*/5 * * * *',
    $j$ select public.run_reminders(); $j$);

  -- Today's register every 30 minutes (holiday / weekly off / leave show from 12:00 AM)
  perform cron.schedule('smhrms-attendance-today', '*/30 * * * *',
    $j$ select public.refresh_attendance_log(public.today_ist(), false); $j$);

  -- 11:55 PM IST: close the day (no check-in → Absent)
  perform cron.schedule('smhrms-attendance-close', '25 18 * * *',
    $j$ select public.refresh_attendance_log(public.today_ist(), true); $j$);

  -- 12:40 AM IST: re-check yesterday (late leave approvals, late check-outs)
  perform cron.schedule('smhrms-attendance-yesterday', '10 19 * * *',
    $j$ select public.refresh_attendance_log(public.today_ist() - 1, true); $j$);

  -- 12:15 AM IST: create recurring tasks for the next 7 days
  perform cron.schedule('smhrms-recurring-tasks', '45 18 * * *',
    $j$ select public.generate_recurring_tasks(7); $j$);
end $$;

-- First run right now, so you can see results immediately.
select public.refresh_attendance_log(public.today_ist(), false) as register_rows_today;
select public.generate_recurring_tasks(7)                        as recurring_tasks_created;
