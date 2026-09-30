-- SM HRMS · Phase AI-1 · SM Assistant foundation
-- Additive and safe to re-run. No existing HRMS rows are changed.
begin;

insert into public.features (key,parent_key,name,description,availability,sort_order)
values ('ai.assistant',null,'SM Assistant','AI assistant for HRMS data and workflows','paid',60)
on conflict (key) do update set name=excluded.name,description=excluded.description;

-- Existing organizations keep the new module available; SystemMaster can override it later.
insert into public.organization_feature_overrides(company_id,feature_key,enabled,reason)
select id,'ai.assistant',true,'AI-1 rollout: existing organization'
from public.companies
on conflict (company_id,feature_key) do nothing;

create table if not exists public.ai_settings(
  company_id uuid primary key references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  provider text check(provider in ('gemini','openai','anthropic')),
  model text,
  model_options jsonb not null default '[]'::jsonb,
  api_key_ciphertext text,
  api_key_iv text,
  api_key_tag text,
  key_hint text,
  employee_enabled boolean not null default true,
  manager_enabled boolean not null default true,
  admin_enabled boolean not null default true,
  monthly_request_limit integer check(monthly_request_limit is null or monthly_request_limit > 0),
  monthly_token_limit bigint check(monthly_token_limit is null or monthly_token_limit > 0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table if not exists public.ai_user_access(
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  enabled boolean not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(company_id,user_id)
);
create table if not exists public.ai_conversations(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.ai_messages(
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check(role in ('user','assistant','tool')),
  content text not null default '',
  tool_name text,
  tool_payload jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.ai_usage_log(
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  model text not null,
  requests integer not null default 1,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.ai_action_log(
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_type text,
  target_id text,
  payload jsonb,
  status text not null default 'executed',
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx on public.ai_messages(conversation_id,created_at);
create index if not exists ai_usage_company_month_idx on public.ai_usage_log(company_id,created_at);
create index if not exists ai_usage_user_time_idx on public.ai_usage_log(user_id,created_at);

alter table public.ai_settings enable row level security;
alter table public.ai_user_access enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_log enable row level security;
alter table public.ai_action_log enable row level security;

drop policy if exists ai_settings_admin on public.ai_settings;
create policy ai_settings_admin on public.ai_settings for all to authenticated
using(company_id=public.my_company_id() and public.is_company_admin() and public.has_feature('ai.assistant'))
with check(company_id=public.my_company_id() and public.is_company_admin() and public.has_feature('ai.assistant'));

drop policy if exists ai_user_access_read on public.ai_user_access;
create policy ai_user_access_read on public.ai_user_access for select to authenticated
using(company_id=public.my_company_id() and (user_id=auth.uid() or public.is_company_admin()) and public.has_feature('ai.assistant'));
drop policy if exists ai_user_access_admin on public.ai_user_access;
create policy ai_user_access_admin on public.ai_user_access for all to authenticated
using(company_id=public.my_company_id() and public.is_company_admin() and public.has_feature('ai.assistant'))
with check(company_id=public.my_company_id() and public.is_company_admin() and public.has_feature('ai.assistant'));

drop policy if exists ai_conversations_own on public.ai_conversations;
create policy ai_conversations_own on public.ai_conversations for all to authenticated
using(company_id=public.my_company_id() and user_id=auth.uid() and public.has_feature('ai.assistant'))
with check(company_id=public.my_company_id() and user_id=auth.uid() and public.has_feature('ai.assistant'));
drop policy if exists ai_messages_own on public.ai_messages;
create policy ai_messages_own on public.ai_messages for all to authenticated
using(company_id=public.my_company_id() and user_id=auth.uid() and public.has_feature('ai.assistant'))
with check(company_id=public.my_company_id() and user_id=auth.uid() and public.has_feature('ai.assistant'));
drop policy if exists ai_usage_own_admin on public.ai_usage_log;
create policy ai_usage_own_admin on public.ai_usage_log for select to authenticated
using(company_id=public.my_company_id() and (user_id=auth.uid() or public.is_company_admin()) and public.has_feature('ai.assistant'));
drop policy if exists ai_usage_insert_own on public.ai_usage_log;
create policy ai_usage_insert_own on public.ai_usage_log for insert to authenticated
with check(company_id=public.my_company_id() and user_id=auth.uid() and public.has_feature('ai.assistant'));
drop policy if exists ai_action_read on public.ai_action_log;
create policy ai_action_read on public.ai_action_log for select to authenticated
using(company_id=public.my_company_id() and (user_id=auth.uid() or public.is_company_admin()) and public.has_feature('ai.assistant'));

create or replace function public.ai_access_allowed() returns boolean
language plpgsql stable security definer set search_path=public as $$
declare p record; s record; ov boolean;
begin
  if auth.uid() is null or not public.has_feature('ai.assistant') then return false; end if;
  select id,company_id,role,status into p from public.profiles where id=auth.uid();
  if p.id is null or p.status<>'active' or p.company_id<>public.my_company_id() then return false; end if;
  select * into s from public.ai_settings where company_id=p.company_id;
  if s.company_id is null or not s.enabled then return false; end if;
  select enabled into ov from public.ai_user_access where company_id=p.company_id and user_id=p.id;
  if ov is not null then return ov; end if;
  return case p.role when 'employee' then s.employee_enabled when 'manager' then s.manager_enabled else s.admin_enabled end;
end $$;
grant execute on function public.ai_access_allowed() to authenticated;

create or replace function public.ai_usage_allowed() returns boolean
language plpgsql stable security definer set search_path=public as $$
declare s record; req bigint; tok bigint; user_minute bigint; org_minute bigint;
begin
  if not public.ai_access_allowed() then return false; end if;
  select * into s from public.ai_settings where company_id=public.my_company_id();
  select coalesce(sum(requests),0),coalesce(sum(input_tokens+output_tokens),0) into req,tok
  from public.ai_usage_log where company_id=public.my_company_id() and created_at>=date_trunc('month',now());
  select coalesce(sum(requests),0) into user_minute from public.ai_usage_log where user_id=auth.uid() and created_at>=now()-interval '1 minute';
  select coalesce(sum(requests),0) into org_minute from public.ai_usage_log where company_id=public.my_company_id() and created_at>=now()-interval '1 minute';
  if user_minute >= 20 or org_minute >= 100 then return false; end if;
  return (s.monthly_request_limit is null or req<s.monthly_request_limit)
     and (s.monthly_token_limit is null or tok<s.monthly_token_limit);
end $$;
grant execute on function public.ai_usage_allowed() to authenticated;

-- Add the new tables to the entitlement audit map where Phase A is installed.
insert into public.feature_table_map(table_name,feature_key,parent_table,parent_fk) values
 ('ai_settings','ai.assistant',null,null),('ai_user_access','ai.assistant',null,null),
 ('ai_conversations','ai.assistant',null,null),('ai_messages','ai.assistant',null,null),
 ('ai_usage_log','ai.assistant',null,null),('ai_action_log','ai.assistant',null,null)
on conflict(table_name) do update set feature_key=excluded.feature_key;

commit;
