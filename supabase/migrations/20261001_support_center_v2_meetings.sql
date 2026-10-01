-- SM HRMS · Support Center V2 + Meeting foundation
-- 2026-10-01 · additive / safe to re-run
begin;

alter table public.tickets add column if not exists source text not null default 'manual';
alter table public.tickets add column if not exists ai_summary text;
alter table public.tickets add column if not exists meeting_required boolean not null default false;
alter table public.tickets add column if not exists updated_at timestamptz not null default now();

create table if not exists public.support_meetings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  host_user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Asia/Kolkata',
  status text not null default 'requested'
    check (status in ('requested','confirmed','rescheduled','completed','cancelled')),
  provider text not null default 'manual'
    check (provider in ('manual','google_calendar','outlook_calendar')),
  external_event_id text,
  meeting_url text,
  attendee_email text,
  attendee_name text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists support_meetings_company_start_idx
  on public.support_meetings(company_id,starts_at);
create index if not exists support_meetings_ticket_idx
  on public.support_meetings(ticket_id);
create index if not exists support_meetings_host_start_idx
  on public.support_meetings(host_user_id,starts_at);

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google_calendar','outlook_calendar')),
  calendar_id text,
  account_email text,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_iv text,
  token_tag text,
  expires_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,provider)
);

alter table public.support_meetings enable row level security;
alter table public.calendar_connections enable row level security;

drop policy if exists support_meetings_read on public.support_meetings;
create policy support_meetings_read on public.support_meetings for select to authenticated
using (
  company_id=public.my_company_id()
  and (
    requested_by=auth.uid()
    or host_user_id=auth.uid()
    or public.is_company_admin()
  )
);

drop policy if exists support_meetings_create on public.support_meetings;
create policy support_meetings_create on public.support_meetings for insert to authenticated
with check (
  company_id=public.my_company_id()
  and requested_by=auth.uid()
);

drop policy if exists support_meetings_manage on public.support_meetings;
create policy support_meetings_manage on public.support_meetings for update to authenticated
using (
  company_id=public.my_company_id()
  and (host_user_id=auth.uid() or public.is_company_admin())
)
with check (company_id=public.my_company_id());

drop policy if exists calendar_connections_own on public.calendar_connections;
create policy calendar_connections_own on public.calendar_connections for select to authenticated
using (company_id=public.my_company_id() and user_id=auth.uid());

-- OAuth tokens must never be writable from the browser. Server/service-role APIs own inserts/updates.
revoke insert,update,delete on public.calendar_connections from authenticated;
grant select on public.calendar_connections to authenticated;

-- Explicit org-safe indexes for Help Desk.
create index if not exists tickets_company_created_idx on public.tickets(company_id,created_at desc);
create index if not exists ticket_comments_company_ticket_idx on public.ticket_comments(company_id,ticket_id,created_at);

commit;
