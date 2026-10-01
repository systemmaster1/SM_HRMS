-- SM HRMS support meeting reminder delivery state
-- Safe / additive / re-runnable
begin;
alter table public.support_meetings add column if not exists confirmation_email_sent_at timestamptz;
alter table public.support_meetings add column if not exists reminder_60_sent_at timestamptz;
alter table public.support_meetings add column if not exists reminder_10_sent_at timestamptz;
alter table public.support_meetings add column if not exists last_notification_error text;
create index if not exists support_meetings_reminder_scan_idx on public.support_meetings(status,starts_at)
where status in ('confirmed','rescheduled');
commit;