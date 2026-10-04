-- Phase 4 — Organization ownership transfer
--
-- Additive and rerunnable. No data is deleted or rewritten.
--
--  * ownership_transfers: one PENDING request per organization (partial unique index)
--  * ownership_transfer_initiate / _accept / _cancel: service-role only. The web
--    API route re-verifies the caller's password first and passes the verified
--    user id. Acceptance is atomic: old owner -> admin, new owner -> owner,
--    companies.owner_id updated, audit row, notifications to both.
--  * companies.owner_id can no longer be changed from the browser.
--  * Single-owner rule: partial unique index on profiles(company_id) where
--    role = 'owner' — created only if production has no organization with
--    more than one owner (it is skipped with a NOTICE otherwise, never fails).
--
-- Rollback (non-destructive):
--   drop trigger if exists smhrms_companies_owner_guard on public.companies;
--   drop index if exists public.profiles_one_owner_per_company;
--   revoke execute on function public.ownership_transfer_initiate(uuid,uuid,text) from service_role; (etc.)
--   The table can stay; it is only read by the new UI.

begin;

create table if not exists public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled', 'declined', 'expired')),
  note text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '72 hours',
  decided_at timestamptz,
  decided_by uuid
);

create unique index if not exists ownership_transfers_one_pending
  on public.ownership_transfers (company_id) where status = 'pending';
create index if not exists ownership_transfers_to_user_idx
  on public.ownership_transfers (to_user, status);

alter table public.ownership_transfers enable row level security;

drop policy if exists ownership_transfers_select on public.ownership_transfers;
create policy ownership_transfers_select on public.ownership_transfers
  for select to authenticated
  using (
    company_id = public.my_company_id()
    and (to_user = auth.uid() or from_user = auth.uid() or public.is_company_admin())
  );

-- No browser writes at all: every change goes through the service-role RPCs.
revoke insert, update, delete on public.ownership_transfers from anon, authenticated;
grant select on public.ownership_transfers to authenticated;
grant all on public.ownership_transfers to service_role;

-- ---------------------------------------------------------------------------
-- companies.owner_id is not editable from the browser (Admins could otherwise
-- write their own id there through the "update own company" policy).
-- ---------------------------------------------------------------------------
create or replace function public.smhrms_companies_owner_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.smhrms_is_browser_role() and new.owner_id is distinct from old.owner_id then
    raise exception 'Ownership can only be changed with Settings → Ownership transfer.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists smhrms_companies_owner_guard on public.companies;
create trigger smhrms_companies_owner_guard before update on public.companies
for each row execute function public.smhrms_companies_owner_guard();

-- ---------------------------------------------------------------------------
-- Expire stale requests (called by every RPC; cheap).
-- ---------------------------------------------------------------------------
create or replace function public.smhrms_expire_ownership_transfers(p_company uuid)
returns void language sql security definer set search_path = public as $$
  update public.ownership_transfers
     set status = 'expired', decided_at = now()
   where company_id = p_company and status = 'pending' and expires_at <= now();
$$;
revoke all on function public.smhrms_expire_ownership_transfers(uuid) from public, anon, authenticated;

create or replace function public.smhrms_owner_audit(p_company uuid, p_actor uuid, p_action text, p_key text, p_old jsonb, p_new jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  select coalesce(nullif(full_name, ''), email) into v_label from public.profiles where id = p_actor;
  insert into public.audit_logs (company_id, actor_id, actor_label, action, entity, entity_key, old_value, new_value)
  values (p_company, p_actor, coalesce(v_label, 'Unknown user'), p_action, 'ownership', p_key, p_old, p_new);
end $$;
revoke all on function public.smhrms_owner_audit(uuid, uuid, text, text, jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Initiate: the current Owner proposes an active Admin of the same org.
-- ---------------------------------------------------------------------------
create or replace function public.ownership_transfer_initiate(p_actor uuid, p_to uuid, p_note text default '')
returns public.ownership_transfers
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  target public.profiles;
  comp public.companies;
  t public.ownership_transfers;
begin
  select * into me from public.profiles where id = p_actor;
  if me.id is null or me.status <> 'active' or me.role <> 'owner' or me.company_id is null then
    raise exception 'Only the active Organization Owner can transfer ownership.';
  end if;
  select * into comp from public.companies where id = me.company_id for update;
  if comp.account_status = 'suspended' then
    raise exception 'Your organization is suspended. Please contact SystemMaster support.';
  end if;
  if p_to = p_actor then
    raise exception 'Choose another person.';
  end if;
  select * into target from public.profiles where id = p_to;
  if target.id is null or target.company_id is distinct from me.company_id then
    raise exception 'Choose a member of your organization.';
  end if;
  if target.status <> 'active' then
    raise exception 'The new owner must be an active member.';
  end if;
  if target.role <> 'admin' then
    raise exception 'Make this person an Admin first, then transfer ownership.';
  end if;

  perform public.smhrms_expire_ownership_transfers(me.company_id);
  if exists (select 1 from public.ownership_transfers where company_id = me.company_id and status = 'pending') then
    raise exception 'An ownership transfer is already pending. Cancel it first.';
  end if;

  insert into public.ownership_transfers (company_id, from_user, to_user, note)
  values (me.company_id, p_actor, p_to, left(coalesce(btrim(p_note), ''), 300))
  returning * into t;

  perform public.smhrms_owner_audit(me.company_id, p_actor, 'ownership_transfer_requested', t.id::text,
    jsonb_build_object('owner', p_actor), jsonb_build_object('proposed_owner', p_to, 'expires_at', t.expires_at));

  insert into public.notifications (company_id, user_id, title, body, kind, link)
  values (me.company_id, p_to, 'Ownership transfer request',
          coalesce(nullif(me.full_name, ''), 'The Owner') || ' wants to make you the Owner of ' || comp.name
            || '. Open Settings to accept or decline (valid 72 hours).',
          'info', '/settings#ownership');
  return t;
end $$;

-- ---------------------------------------------------------------------------
-- Accept: atomic role swap.
-- ---------------------------------------------------------------------------
create or replace function public.ownership_transfer_accept(p_actor uuid, p_transfer uuid)
returns public.ownership_transfers
language plpgsql security definer set search_path = public as $$
declare
  t public.ownership_transfers;
  old_owner public.profiles;
  new_owner public.profiles;
  comp public.companies;
begin
  select * into t from public.ownership_transfers where id = p_transfer for update;
  if t.id is null or t.to_user <> p_actor then
    raise exception 'Transfer request not found.';
  end if;
  -- Lock the organization so two requests cannot race.
  select * into comp from public.companies where id = t.company_id for update;
  if t.status = 'pending' and t.expires_at <= now() then
    update public.ownership_transfers set status = 'expired', decided_at = now() where id = t.id;
    raise exception 'This request has expired. Ask the Owner to send a new one.';
  end if;
  if t.status <> 'pending' then
    raise exception 'This request is already %.', t.status;
  end if;

  select * into old_owner from public.profiles where id = t.from_user for update;
  select * into new_owner from public.profiles where id = t.to_user for update;
  if old_owner.id is null or old_owner.role <> 'owner' or old_owner.company_id <> t.company_id then
    raise exception 'The person who sent this request is no longer the Owner.';
  end if;
  if new_owner.status <> 'active' or new_owner.role <> 'admin' or new_owner.company_id <> t.company_id then
    raise exception 'Only an active Admin of this organization can accept.';
  end if;

  -- Demote first so the single-owner index is never violated.
  update public.profiles set role = 'admin' where id = old_owner.id;
  update public.profiles set role = 'owner', must_change_password = false where id = new_owner.id;
  update public.companies set owner_id = new_owner.id where id = t.company_id;

  update public.ownership_transfers
     set status = 'accepted', decided_at = now(), decided_by = p_actor
   where id = t.id
  returning * into t;

  perform public.smhrms_owner_audit(t.company_id, p_actor, 'ownership_transferred', t.id::text,
    jsonb_build_object('owner', old_owner.id, 'owner_role_after', 'admin'),
    jsonb_build_object('owner', new_owner.id));

  insert into public.notifications (company_id, user_id, title, body, kind, link) values
    (t.company_id, old_owner.id, 'Ownership transferred',
     coalesce(nullif(new_owner.full_name, ''), 'The new owner') || ' is now the Owner of ' || comp.name || '. You are now an Admin.',
     'info', '/settings#ownership'),
    (t.company_id, new_owner.id, 'You are now the Owner',
     'You are now the Owner of ' || comp.name || '.', 'info', '/settings#ownership');
  return t;
end $$;

-- ---------------------------------------------------------------------------
-- Cancel (by the Owner who sent it) or decline (by the proposed owner).
-- ---------------------------------------------------------------------------
create or replace function public.ownership_transfer_cancel(p_actor uuid, p_transfer uuid)
returns public.ownership_transfers
language plpgsql security definer set search_path = public as $$
declare
  t public.ownership_transfers;
  v_status text;
begin
  select * into t from public.ownership_transfers where id = p_transfer for update;
  if t.id is null or p_actor not in (t.from_user, t.to_user) then
    raise exception 'Transfer request not found.';
  end if;
  if t.status <> 'pending' then
    raise exception 'This request is already %.', t.status;
  end if;
  v_status := case when p_actor = t.to_user then 'declined' else 'cancelled' end;
  update public.ownership_transfers
     set status = v_status, decided_at = now(), decided_by = p_actor
   where id = t.id
  returning * into t;

  perform public.smhrms_owner_audit(t.company_id, p_actor, 'ownership_transfer_' || v_status, t.id::text, null,
    jsonb_build_object('status', v_status));

  insert into public.notifications (company_id, user_id, title, body, kind, link)
  values (t.company_id,
          case when p_actor = t.to_user then t.from_user else t.to_user end,
          case when v_status = 'declined' then 'Ownership transfer declined' else 'Ownership transfer cancelled' end,
          case when v_status = 'declined' then 'The request to transfer ownership was declined.'
               else 'The Owner cancelled the ownership transfer request.' end,
          'info', '/settings#ownership');
  return t;
end $$;

revoke all on function public.ownership_transfer_initiate(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.ownership_transfer_accept(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ownership_transfer_cancel(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ownership_transfer_initiate(uuid, uuid, text) to service_role;
grant execute on function public.ownership_transfer_accept(uuid, uuid) to service_role;
grant execute on function public.ownership_transfer_cancel(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Single owner per organization (only when existing data allows it).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select company_id from public.profiles
    where role = 'owner' and company_id is not null
    group by company_id having count(*) > 1
  ) then
    raise notice 'profiles_one_owner_per_company NOT created: some organization has more than one owner. Run docs/sql/03_owner_integrity.sql.';
  else
    create unique index if not exists profiles_one_owner_per_company
      on public.profiles (company_id) where role = 'owner';
  end if;
end $$;

commit;
