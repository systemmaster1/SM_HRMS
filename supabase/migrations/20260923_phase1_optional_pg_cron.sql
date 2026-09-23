-- =============================================================================
-- SM HRMS · Phase 1 · OPTIONAL — auto-attendance every 15 minutes via pg_cron
--
-- Vercel Hobby allows cron only once per day, so the 15-minute auto-attendance
-- job runs inside Supabase instead.
--
-- 1. Supabase Dashboard → Integrations → Cron → Enable (installs pg_cron).
-- 2. Run this file in SQL Editor.
-- =============================================================================
select cron.unschedule(jobid) from cron.job where jobname = 'smhrms-auto-attendance';

select cron.schedule(
  'smhrms-auto-attendance',
  '*/15 * * * *',
  $$ select public.run_auto_attendance(); $$
);

-- Check it:   select * from cron.job_run_details order by start_time desc limit 10;
