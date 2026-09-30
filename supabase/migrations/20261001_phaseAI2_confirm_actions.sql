-- SM HRMS · AI-2B · Confirm-before-write foundation
-- Additive and safe to re-run.
begin;

create table if not exists public.ai_pending_actions(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete cascade,
  action text not null,
  target_type text,
  target_id text,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','confirmed','cancelled','executed','failed','expired')),
  expires_at timestamptz not null default (now()+interval '15 minutes'),
  confirmed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_pending_actions_user_status_idx
on public.ai_pending_actions(user_id,status,created_at desc);

alter table public.ai_pending_actions enable row level security;

drop policy if exists ai_pending_actions_own on public.ai_pending_actions;
create policy ai_pending_actions_own on public.ai_pending_actions
for all to authenticated
using(company_id=public.my_company_id() and user_id=auth.uid() and public.has_feature('ai.assistant'))
with check(company_id=public.my_company_id() and user_id=auth.uid() and public.has_feature('ai.assistant'));

drop policy if exists ai_action_insert_own on public.ai_action_log;
create policy ai_action_insert_own on public.ai_action_log
for insert to authenticated
with check(company_id=public.my_company_id() and user_id=auth.uid() and public.has_feature('ai.assistant'));

insert into public.feature_table_map(table_name,feature_key,parent_table,parent_fk)
values ('ai_pending_actions','ai.assistant',null,null)
on conflict(table_name) do update set feature_key=excluded.feature_key;

commit;
