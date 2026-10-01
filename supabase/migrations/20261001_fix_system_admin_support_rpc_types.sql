-- SM HRMS · Repair System Admin Help Desk RPC return signatures
-- Fixes PostgreSQL: structure of query does not match function result type
-- Safe to re-run. No production rows are deleted.
begin;

drop function if exists public.system_admin_support_tickets(text);
create function public.system_admin_support_tickets(p_status text default null)
returns table (
  id uuid, ticket_no bigint, company_id uuid, org_name text, org_code text,
  subject text, description text, category text, priority text, status text,
  raised_by uuid, raised_by_name text, raised_by_email text, assigned_to uuid,
  source text, ai_summary text, meeting_required boolean,
  plan text, target_date date, created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_system_admin() then raise exception 'System admin access required'; end if;
  return query
  select
    t.id::uuid, t.ticket_no::bigint, t.company_id::uuid,
    c.name::text, c.org_code::text,
    t.subject::text, t.description::text, t.category::text, t.priority::text, t.status::text,
    t.raised_by::uuid, p.full_name::text, p.email::text, t.assigned_to::uuid,
    t.source::text, t.ai_summary::text, t.meeting_required::boolean,
    t.plan::text, t.target_date::date, t.created_at::timestamptz, t.updated_at::timestamptz
  from public.tickets t
  join public.companies c on c.id=t.company_id
  left join public.profiles p on p.id=t.raised_by
  where p_status is null or p_status='' or t.status::text=p_status
  order by case when t.priority::text='urgent' then 0 when t.priority::text='high' then 1 else 2 end, t.created_at desc;
end $$;

drop function if exists public.system_admin_support_meetings(text);
create function public.system_admin_support_meetings(p_status text default null)
returns table (
 id uuid, company_id uuid, org_name text, org_code text, ticket_id uuid, ticket_no bigint,
 title text, description text, starts_at timestamptz, ends_at timestamptz, timezone text,
 status text, provider text, meeting_url text, attendee_name text, attendee_email text,
 requested_by uuid, requested_by_name text, host_user_id uuid, internal_notes text
)
language plpgsql security definer set search_path=public
as $$
begin
 if not public.is_system_admin() then raise exception 'System admin access required'; end if;
 return query
 select
   m.id::uuid,m.company_id::uuid,c.name::text,c.org_code::text,m.ticket_id::uuid,t.ticket_no::bigint,
   m.title::text,m.description::text,m.starts_at::timestamptz,m.ends_at::timestamptz,m.timezone::text,
   m.status::text,m.provider::text,m.meeting_url::text,m.attendee_name::text,m.attendee_email::text,
   m.requested_by::uuid,p.full_name::text,m.host_user_id::uuid,m.internal_notes::text
 from public.support_meetings m
 join public.companies c on c.id=m.company_id
 left join public.tickets t on t.id=m.ticket_id
 left join public.profiles p on p.id=m.requested_by
 where p_status is null or p_status='' or m.status::text=p_status
 order by m.starts_at asc;
end $$;

revoke all on function public.system_admin_support_tickets(text) from public;
revoke all on function public.system_admin_support_meetings(text) from public;
grant execute on function public.system_admin_support_tickets(text) to authenticated;
grant execute on function public.system_admin_support_meetings(text) to authenticated;

commit;