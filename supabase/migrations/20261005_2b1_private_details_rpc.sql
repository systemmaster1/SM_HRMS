-- =============================================================================
-- SM HRMS · Phase 2b-1 (step A) · Private employee details through RPCs
-- 2026-10-05 · ADDITIVE · SAFE TO RE-RUN · NO DATA IS CHANGED
--
-- Bank account, home address, date of birth and emergency contact stay in
-- public.profiles (no data is moved or copied). From now on the web/Android
-- app reads and writes them ONLY through these two functions, which allow:
--   * the employee themself, and
--   * an ACTIVE Owner/Admin of the SAME organization.
-- Managers and colleagues cannot read them.
--
-- Step B (20261005_2b1_profiles_column_privileges.sql) then removes direct
-- browser access to those columns. Apply step B ONLY AFTER the web app
-- version that uses these functions is live.
-- =============================================================================
begin;

create or replace function public.smhrms_private_detail_keys()
returns text[] language sql immutable set search_path = public as $$
  select array['date_of_birth','address','city','state','pincode',
               'bank_account_name','bank_account_number','bank_ifsc','bank_name',
               'emergency_contact_name','emergency_contact_phone']::text[];
$$;

-- Who may see / change an employee's private details.
create or replace function public.smhrms_can_access_private_details(p_employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles target on target.id = p_employee
    where me.id = auth.uid()
      and coalesce(me.status, 'active') = 'active'
      and me.company_id is not null
      and (
        me.id = target.id
        or (me.role in ('owner', 'admin') and target.company_id = me.company_id)
      )
  );
$$;

create or replace function public.get_employee_private_details(p_employee uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  if not public.smhrms_can_access_private_details(p_employee) then
    raise exception 'You do not have permission to view these details.' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'date_of_birth', p.date_of_birth,
           'address', p.address, 'city', p.city, 'state', p.state, 'pincode', p.pincode,
           'bank_account_name', p.bank_account_name, 'bank_account_number', p.bank_account_number,
           'bank_ifsc', p.bank_ifsc, 'bank_name', p.bank_name,
           'emergency_contact_name', p.emergency_contact_name,
           'emergency_contact_phone', p.emergency_contact_phone)
    into v
  from public.profiles p where p.id = p_employee;
  return coalesce(v, '{}'::jsonb);
end $$;

create or replace function public.set_employee_private_details(p_employee uuid, p_details jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  k text;
  val text;
  changed text[] := '{}';
  v_company uuid;
  v_rows int;
begin
  if auth.uid() is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  if not public.smhrms_can_access_private_details(p_employee) then
    raise exception 'You do not have permission to change these details.' using errcode = '42501';
  end if;
  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'Invalid details.' using errcode = '22023';
  end if;

  for k in select jsonb_object_keys(p_details) loop
    if not (k = any(public.smhrms_private_detail_keys())) then
      raise exception 'Unknown field: %', k using errcode = '22023';
    end if;
    val := nullif(btrim(coalesce(p_details ->> k, '')), '');
    if val is not null and length(val) > 300 then
      raise exception 'Value for % is too long.', replace(k, '_', ' ') using errcode = '22001';
    end if;
    if k = 'bank_ifsc' and val is not null and upper(val) !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then
      raise exception 'Enter a valid 11-character IFSC code (e.g. HDFC0001234).' using errcode = '22023';
    end if;
    if k = 'bank_account_number' and val is not null and val !~ '^[0-9]{6,20}$' then
      raise exception 'Bank account number must be 6–20 digits.' using errcode = '22023';
    end if;
    if k = 'pincode' and val is not null and val !~ '^[0-9]{6}$' then
      raise exception 'PIN code must be 6 digits.' using errcode = '22023';
    end if;
    if k = 'date_of_birth' and val is not null then
      begin
        if val::date > current_date or val::date < date '1900-01-01' then
          raise exception 'Enter a valid date of birth.' using errcode = '22023';
        end if;
      exception when invalid_datetime_format or datetime_field_overflow then
        raise exception 'Enter a valid date of birth.' using errcode = '22023';
      end;
    end if;

    execute format('update public.profiles set %1$I = $1::%2$s where id = $2 and %1$I is distinct from $1::%2$s',
                   k, case when k = 'date_of_birth' then 'date' else 'text' end)
      using case when k = 'bank_ifsc' then upper(val) else val end, p_employee;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then changed := changed || k; end if;
  end loop;

  -- Audit only WHICH fields changed, never the values.
  if array_length(changed, 1) > 0 then
    select company_id into v_company from public.profiles where id = p_employee;
    begin
      perform public.write_audit(v_company, 'employee_private_details_updated', 'profile',
                                 p_employee::text, null, jsonb_build_object('fields', changed));
    exception when undefined_function then null;
    end;
  end if;
end $$;

revoke all on function public.smhrms_can_access_private_details(uuid) from public, anon;
revoke all on function public.get_employee_private_details(uuid) from public, anon;
revoke all on function public.set_employee_private_details(uuid, jsonb) from public, anon;
grant execute on function public.smhrms_can_access_private_details(uuid) to authenticated;
grant execute on function public.get_employee_private_details(uuid) to authenticated;
grant execute on function public.set_employee_private_details(uuid, jsonb) to authenticated;

commit;
