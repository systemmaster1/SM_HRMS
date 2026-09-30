-- SM HRMS · Field Visit V2 Phase 1
-- Standard visit-field rules + immutable server creation timestamp.
-- Safe to re-run. Existing visit data is preserved.
begin;

create table if not exists public.visit_form_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  customer_name_required boolean not null default true,
  company_name_required boolean not null default false,
  contact_person_required boolean not null default false,
  contact_number_required boolean not null default false,
  contact_email_required boolean not null default false,
  purpose_required boolean not null default true,
  address_required boolean not null default false,
  scheduled_at_required boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.visit_form_settings enable row level security;

drop policy if exists visit_form_settings_select on public.visit_form_settings;
drop policy if exists visit_form_settings_insert on public.visit_form_settings;
drop policy if exists visit_form_settings_update on public.visit_form_settings;

create policy visit_form_settings_select on public.visit_form_settings
for select to authenticated
using (company_id = public.my_company_id());

create policy visit_form_settings_insert on public.visit_form_settings
for insert to authenticated
with check (company_id = public.my_company_id() and public.is_company_admin());

create policy visit_form_settings_update on public.visit_form_settings
for update to authenticated
using (company_id = public.my_company_id() and public.is_company_admin())
with check (company_id = public.my_company_id() and public.is_company_admin());

-- created_at is the authoritative, non-editable visit creation timestamp.
alter table public.field_visits add column if not exists created_at timestamptz not null default now();

create or replace function public.smhrms_lock_visit_created_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  elsif new.created_at is null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_smhrms_lock_visit_created_at on public.field_visits;
create trigger trg_smhrms_lock_visit_created_at
before insert or update on public.field_visits
for each row execute function public.smhrms_lock_visit_created_at();

insert into public.visit_form_settings (company_id)
select id from public.companies
on conflict (company_id) do nothing;

commit;
