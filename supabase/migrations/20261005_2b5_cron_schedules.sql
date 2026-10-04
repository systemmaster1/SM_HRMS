-- =============================================================================
-- SM HRMS · Phase 2b-5 · Scheduled jobs (pg_cron)
-- 2026-10-05 · SAFE TO RE-RUN (replaces only the smhrms-* jobs it owns)
--
-- Requires the pg_cron extension (Supabase → Database → Extensions → pg_cron).
-- Times are UTC; IST = UTC + 5:30.
--
-- Jobs:
--   smhrms-auto-attendance       every 15 min  auto IN/OUT for employees marked "auto attendance"
--   smhrms-reminders             every 5 min   visit/task due-soon, morning digest, overdue alerts
--   smhrms-attendance-today      every 30 min  today's attendance register (holiday/weekly-off/leave)
--   smhrms-attendance-close      23:55 IST     close the day (no IN -> Absent)
--   smhrms-attendance-yesterday  00:40 IST     re-check yesterday (late approvals / late OUT)
--   smhrms-recurring-tasks       00:15 IST     create recurring tasks for the next 7 days
--   smhrms-cleanup               03:10 IST     housekeeping of expired rate-limit rows
--
-- Each job is idempotent (the underlying functions use "sent_at"/"already
-- exists" markers), so an overlapping or repeated run cannot duplicate data.
-- Check runs:  select jobname, status, start_time, return_message
--              from cron.job_run_details d join cron.job j using (jobid)
--              order by start_time desc limit 20;
-- =============================================================================
do $$
declare
  j text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron is not enabled. Supabase Dashboard -> Database -> Extensions -> pg_cron -> Enable, then run this file again.';
  end if;

  foreach j in array array['smhrms-auto-attendance','smhrms-reminders','smhrms-attendance-today',
                           'smhrms-attendance-close','smhrms-attendance-yesterday',
                           'smhrms-recurring-tasks','smhrms-cleanup'] loop
    perform cron.unschedule(jobid) from cron.job where jobname = j;
  end loop;

  if to_regprocedure('public.run_auto_attendance()') is not null then
    perform cron.schedule('smhrms-auto-attendance', '*/15 * * * *', 'select public.run_auto_attendance();');
  end if;
  if to_regprocedure('public.run_reminders()') is not null then
    perform cron.schedule('smhrms-reminders', '*/5 * * * *', 'select public.run_reminders();');
  end if;
  if to_regprocedure('public.refresh_attendance_log(date, boolean, uuid)') is not null then
    perform cron.schedule('smhrms-attendance-today', '*/30 * * * *',
      'select public.refresh_attendance_log(public.today_ist(), false);');
    perform cron.schedule('smhrms-attendance-close', '25 18 * * *',
      'select public.refresh_attendance_log(public.today_ist(), true);');
    perform cron.schedule('smhrms-attendance-yesterday', '10 19 * * *',
      'select public.refresh_attendance_log(public.today_ist() - 1, true);');
  end if;
  if to_regprocedure('public.generate_recurring_tasks(integer, uuid)') is not null then
    perform cron.schedule('smhrms-recurring-tasks', '45 18 * * *', 'select public.generate_recurring_tasks(7);');
  end if;
  if to_regclass('public.auth_rate_limits') is not null then
    perform cron.schedule('smhrms-cleanup', '40 21 * * *',
      $c$delete from public.auth_rate_limits where window_start < now() - interval '1 day';$c$);
  end if;
end $$;

select jobname, schedule, active from cron.job where jobname like 'smhrms-%' order by jobname;
