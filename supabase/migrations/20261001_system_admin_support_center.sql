-- SM HRMS · System Admin Support Center RPCs
-- Requires 20261001_support_center_v2_meetings.sql
begin;

create or replace function public.system_admin_support_tickets(p_status text default null)
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
  select t.id,t.ticket_no,t.company_id,c.name,c.org_code,t.subject,t.description,t.category,t.priority,t.status,
         t.raised_by,p.full_name,p.email,t.assigned_to,t.source,t.ai_summary,t.meeting_required,
         t.plan,t.target_date,t.created_at,t.updated_at
  from public.tickets t
  join public.companies c on c.id=t.company_id
  left join public.profiles p on p.id=t.raised_by
  where p_status is null or p_status='' or t.status=p_status
  order by case when t.priority='urgent' then 0 when t.priority='high' then 1 else 2 end, t.created_at desc;
end $$;

create or replace function public.system_admin_support_meetings(p_status text default null)
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
 select m.id,m.company_id,c.name,c.org_code,m.ticket_id,t.ticket_no,m.title,m.description,m.starts_at,m.ends_at,m.timezone,
        m.status,m.provider,m.meeting_url,m.attendee_name,m.attendee_email,m.requested_by,p.full_name,m.host_user_id,m.internal_notes
 from public.support_meetings m
 join public.companies c on c.id=m.company_id
 left join public.tickets t on t.id=m.ticket_id
 left join public.profiles p on p.id=m.requested_by
 where p_status is null or p_status='' or m.status=p_status
 order by m.starts_at asc;
end $$;

create or replace function public.system_admin_update_support_ticket(
 p_ticket uuid,p_status text default null,p_priority text default null,p_plan text default null,p_target_date date default null
) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_system_admin() then raise exception 'System admin access required'; end if;
 update public.tickets set
   status=coalesce(p_status,status), priority=coalesce(p_priority,priority),
   plan=coalesce(p_plan,plan), target_date=coalesce(p_target_date,target_date),
   resolved_at=case when p_status='resolved' then now() when p_status is not null and p_status<>'resolved' then null else resolved_at end,
   updated_at=now()
 where id=p_ticket;
end $$;

create or replace function public.system_admin_update_support_meeting(
 p_meeting uuid,p_status text default null,p_meeting_url text default null,p_notes text default null
) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_system_admin() then raise exception 'System admin access required'; end if;
 update public.support_meetings set
   status=coalesce(p_status,status), meeting_url=coalesce(p_meeting_url,meeting_url),
   internal_notes=coalesce(p_notes,internal_notes), updated_at=now()
 where id=p_meeting;
end $$;

revoke all on function public.system_admin_support_tickets(text) from public;
revoke all on function public.system_admin_support_meetings(text) from public;
revoke all on function public.system_admin_update_support_ticket(uuid,text,text,text,date) from public;
revoke all on function public.system_admin_update_support_meeting(uuid,text,text,text) from public;
grant execute on function public.system_admin_support_tickets(text) to authenticated;
grant execute on function public.system_admin_support_meetings(text) to authenticated;
grant execute on function public.system_admin_update_support_ticket(uuid,text,text,text,date) to authenticated;
grant execute on function public.system_admin_update_support_meeting(uuid,text,text,text) to authenticated;
commit;