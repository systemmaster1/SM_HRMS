-- SM HRMS · Field visit lifecycle repair v8
-- Safe/re-runnable. Repairs the shared visit action RPC for every organization.
begin;

create or replace function public.field_visit_action_v6(
  p_visit_id uuid,
  p_action text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_person_met text default null,
  p_outcome text default null,
  p_completion_notes text default null,
  p_next_followup_at timestamptz default null
)
returns public.field_visits
language plpgsql security definer set search_path = public as $$
declare
  v public.field_visits;
  v_company uuid := public.my_company_id();
  v_now timestamptz := now();
begin
  if auth.uid() is null or v_company is null then raise exception 'Your session is no longer valid. Please sign in again.'; end if;
  select * into v from public.field_visits where id=p_visit_id and company_id=v_company for update;
  if v.id is null then raise exception 'Visit not found in your organization.'; end if;
  if v.employee_id <> auth.uid() and not public.is_company_admin() and not public.reports_to_me(v.employee_id) then
    raise exception 'You do not have permission to update this visit.';
  end if;

  if p_action='accept' then
    if v.status not in ('assigned','planned') then raise exception 'This visit cannot be accepted from its current status (%).',v.status; end if;
    update public.field_visits set status='accepted',accepted_at=coalesce(accepted_at,v_now) where id=v.id returning * into v;
  elsif p_action='start_travel' then
    if v.status not in ('assigned','planned','accepted') then raise exception 'Start Travel is not available from status (%).',v.status; end if;
    if p_lat is null or p_lng is null then raise exception 'Current location is required to start travel.'; end if;
    update public.field_visits set status='on_the_way',accepted_at=coalesce(accepted_at,v_now),travel_started_at=coalesce(travel_started_at,v_now),last_lat=p_lat,last_lng=p_lng,last_location_at=v_now where id=v.id returning * into v;
  elsif p_action='check_in' then
    if v.status not in ('accepted','on_the_way','reached') then raise exception 'Check In is not available from status (%).',v.status; end if;
    if p_lat is null or p_lng is null then raise exception 'Current location is required to check in.'; end if;
    update public.field_visits set status='checked_in',reached_at=coalesce(reached_at,v_now),check_in_at=coalesce(check_in_at,v_now),check_in_lat=coalesce(check_in_lat,p_lat),check_in_lng=coalesce(check_in_lng,p_lng),last_lat=p_lat,last_lng=p_lng,last_location_at=v_now where id=v.id returning * into v;
  elsif p_action='meeting' then
    if v.status not in ('checked_in','meeting') then raise exception 'Start Meeting is available only after Check In.'; end if;
    update public.field_visits set status='meeting',meeting_started_at=coalesce(meeting_started_at,v_now) where id=v.id returning * into v;
  elsif p_action='complete' then
    if v.status not in ('checked_in','meeting') then raise exception 'Complete Visit is available only after Check In.'; end if;
    if nullif(btrim(coalesce(p_person_met,'')),'') is null then raise exception 'Person met is required.'; end if;
    if nullif(btrim(coalesce(p_outcome,'')),'') is null then raise exception 'Visit outcome is required.'; end if;
    if nullif(btrim(coalesce(p_completion_notes,'')),'') is null then raise exception 'Visit notes are required.'; end if;
    if p_outcome='follow_up_required' and p_next_followup_at is null then raise exception 'Next follow-up date and time is required.'; end if;
    update public.field_visits set status='completed',meeting_started_at=coalesce(meeting_started_at,check_in_at,v_now),completed_at=coalesce(completed_at,v_now),check_out_at=coalesce(check_out_at,v_now),person_met=btrim(p_person_met),outcome=p_outcome,completion_notes=btrim(p_completion_notes),next_followup_at=p_next_followup_at,last_lat=coalesce(p_lat,last_lat,check_in_lat),last_lng=coalesce(p_lng,last_lng,check_in_lng),last_location_at=case when p_lat is not null and p_lng is not null then v_now else last_location_at end where id=v.id returning * into v;
  else
    raise exception 'Unknown visit action (%).',p_action;
  end if;
  return v;
end $$;

revoke all on function public.field_visit_action_v6(uuid,text,double precision,double precision,text,text,text,timestamptz) from public;
grant execute on function public.field_visit_action_v6(uuid,text,double precision,double precision,text,text,text,timestamptz) to authenticated;
commit;
