-- =============================================================================
-- SM HRMS · LIVE tenant-isolation test against the production database
--
-- SAFE: every probe runs inside its own sub-transaction that is ALWAYS rolled
-- back (each probe ends by raising an internal exception that undoes it).
-- No row is inserted, changed or deleted permanently. Only the result list in
-- a session-temporary table remains, and it disappears when the editor closes.
--
-- What it does
--   Picks two real organizations automatically (A and B) and an ACTIVE
--   employee + admin of A. Then, impersonating those users exactly like the
--   browser API does (role "authenticated" + JWT sub), it tries to:
--     · SELECT organization B rows from every table that has company_id
--     · UPDATE and DELETE organization B rows
--     · INSERT a row carrying organization B's company_id
--     · read colleagues' bank account numbers as a plain employee
--     · promote themselves to owner/admin, move to org B
--     · list org B files in Storage
--   Expected result: every line says PASS. Any FAIL is a release blocker;
--   CHECK lines failed for another reason and need a quick manual look.
--
-- How: Supabase → SQL Editor → New query → paste → Run → Download CSV.
-- =============================================================================
create temp table if not exists smhrms_isolation_results(
  seq serial, result text, actor text, test text, tbl text, detail text);
truncate smhrms_isolation_results;

-- PASS  = 0 rows affected, or blocked by RLS / permission / guard
-- FAIL  = rows of the other organization were affected (all rolled back)
-- CHECK = failed for another reason (e.g. foreign key) — review the detail
create or replace function pg_temp.smhrms_verdict(msg text) returns text language sql immutable as $f$
  select case
    when msg like 'SMHRMS_PROBE:0' then 'PASS'
    when msg like 'SMHRMS_PROBE:%' then 'FAIL'
    when msg ~* '(row-level security|permission|not allowed|cannot|only |immutable|not found in your|sign in again|not active|must belong|for yourself)' then 'PASS'
    else 'CHECK'
  end
$f$;

do $$
declare
  org_a uuid; org_b uuid; emp_a uuid; adm_a uuid;
  t record; n bigint; probe_msg text; actor_id uuid; actor_name text;
  probe_sql text;
begin
  -- Two organizations that both have active members.
  select p.company_id into org_a
  from public.profiles p
  where p.company_id is not null and coalesce(p.status::text, 'active') = 'active' and p.role::text = 'employee'
  group by p.company_id order by count(*) desc limit 1;
  select p.company_id into org_b
  from public.profiles p
  where p.company_id is not null and p.company_id <> org_a
  group by p.company_id order by count(*) desc limit 1;
  select id into emp_a from public.profiles where company_id = org_a and role::text = 'employee'
    and coalesce(status::text, 'active') = 'active' limit 1;
  select id into adm_a from public.profiles where company_id = org_a and role::text in ('admin', 'owner')
    and coalesce(status::text, 'active') = 'active' order by (role::text = 'admin') desc limit 1;

  if org_a is null or org_b is null or emp_a is null then
    insert into smhrms_isolation_results(result, actor, test, tbl, detail)
    values ('SKIPPED', '-', 'setup', '-', 'Need at least two organizations and one active employee.');
    return;
  end if;

  for actor_id, actor_name in select * from (values (emp_a, 'employee of A'), (adm_a, 'admin/owner of A')) v(i, nme) where i is not null loop

    for t in
      select c.table_name
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
      where c.table_schema = 'public' and c.column_name = 'company_id' and tb.table_type = 'BASE TABLE'
      order by c.table_name
    loop
      -- ---------- SELECT ----------
      begin
        perform set_config('request.jwt.claims', json_build_object('sub', actor_id, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', actor_id::text, true);
        perform set_config('request.jwt.claim.role', 'authenticated', true);
        execute 'set local role authenticated';
        execute format('select count(*) from public.%I where company_id = $1', t.table_name) into n using org_b;
        raise exception 'SMHRMS_PROBE:%', n;
      exception when others then
        probe_msg := sqlerrm;
      end;
      insert into smhrms_isolation_results(result, actor, test, tbl, detail)
      values (pg_temp.smhrms_verdict(probe_msg),
              actor_name, 'read org B rows', t.table_name,
              case when probe_msg like 'SMHRMS_PROBE:%' then replace(probe_msg, 'SMHRMS_PROBE:', '') || ' org-B rows visible'
                   else left(probe_msg, 160) end);

      -- ---------- UPDATE ----------
      begin
        perform set_config('request.jwt.claims', json_build_object('sub', actor_id, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', actor_id::text, true);
        execute 'set local role authenticated';
        execute format('update public.%I set company_id = company_id where company_id = $1', t.table_name) using org_b;
        get diagnostics n = row_count;
        raise exception 'SMHRMS_PROBE:%', n;
      exception when others then
        probe_msg := sqlerrm;
      end;
      insert into smhrms_isolation_results(result, actor, test, tbl, detail)
      values (pg_temp.smhrms_verdict(probe_msg),
              actor_name, 'update org B rows', t.table_name,
              case when probe_msg like 'SMHRMS_PROBE:%' then replace(probe_msg, 'SMHRMS_PROBE:', '') || ' org-B rows updatable (rolled back)'
                   else left(probe_msg, 160) end);

      -- ---------- DELETE ----------
      begin
        perform set_config('request.jwt.claims', json_build_object('sub', actor_id, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', actor_id::text, true);
        execute 'set local role authenticated';
        execute format('delete from public.%I where company_id = $1', t.table_name) using org_b;
        get diagnostics n = row_count;
        raise exception 'SMHRMS_PROBE:%', n;   -- always undone
      exception when others then
        probe_msg := sqlerrm;
      end;
      insert into smhrms_isolation_results(result, actor, test, tbl, detail)
      values (pg_temp.smhrms_verdict(probe_msg),
              actor_name, 'delete org B rows', t.table_name,
              case when probe_msg like 'SMHRMS_PROBE:%' then replace(probe_msg, 'SMHRMS_PROBE:', '') || ' org-B rows deletable (rolled back)'
                   else left(probe_msg, 160) end);

      -- ---------- INSERT with org B company_id (copy of an org-B row) ----------
      begin
        execute 'drop table if exists smhrms_probe_row';
        execute format('create temp table smhrms_probe_row as select * from public.%I where company_id = $1 limit 1', t.table_name) using org_b;
        execute 'grant all on smhrms_probe_row to authenticated';
        perform set_config('request.jwt.claims', json_build_object('sub', actor_id, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', actor_id::text, true);
        execute 'set local role authenticated';
        -- Re-insert the copied row; primary keys clash only if the copy is
        -- visible, so first try a fresh id when an "id uuid" column exists.
        begin
          execute 'update smhrms_probe_row set id = gen_random_uuid()';
        exception when others then null;
        end;
        execute format('insert into public.%I select * from smhrms_probe_row', t.table_name);
        get diagnostics n = row_count;
        raise exception 'SMHRMS_PROBE:%', n;
      exception when others then
        probe_msg := sqlerrm;
      end;
      insert into smhrms_isolation_results(result, actor, test, tbl, detail)
      values (pg_temp.smhrms_verdict(probe_msg),
              actor_name, 'insert row into org B', t.table_name,
              case when probe_msg like 'SMHRMS_PROBE:0' then 'no org-B sample row to copy'
                   when probe_msg like 'SMHRMS_PROBE:%' then 'row with org-B company_id was ACCEPTED (rolled back)'
                   else left(probe_msg, 160) end);
    end loop;
  end loop;

  -- ---------- Privilege escalation on own profile ----------
  for probe_sql, actor_name in select * from (values
      (format('update public.profiles set role = %L where id = %L', 'owner', emp_a), 'employee -> owner'),
      (format('update public.profiles set role = %L where id = %L', 'admin', emp_a), 'employee -> admin'),
      (format('update public.profiles set company_id = %L where id = %L', org_b, emp_a), 'employee moves to org B'),
      (format('update public.profiles set access_permissions = %L::jsonb where id = %L', '{"payroll":"company"}', emp_a), 'employee grants self payroll access')
    ) v(q, nme) loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', emp_a, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', emp_a::text, true);
      execute 'set local role authenticated';
      execute probe_sql;
      get diagnostics n = row_count;
      raise exception 'SMHRMS_PROBE:%', n;
    exception when others then
      probe_msg := sqlerrm;
    end;
    insert into smhrms_isolation_results(result, actor, test, tbl, detail)
    values (pg_temp.smhrms_verdict(probe_msg),
            'employee of A', actor_name, 'profiles',
            case when probe_msg like 'SMHRMS_PROBE:%' then replace(probe_msg, 'SMHRMS_PROBE:', '') || ' row(s) changed (rolled back)' else left(probe_msg, 160) end);
  end loop;

  -- ---------- Colleagues' bank details visible to a plain employee ----------
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', emp_a, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', emp_a::text, true);
    execute 'set local role authenticated';
    execute 'select count(*) from public.profiles where id <> $1 and coalesce(bank_account_number, '''') <> ''''' into n using emp_a;
    raise exception 'SMHRMS_PROBE:%', n;
  exception when others then
    probe_msg := sqlerrm;
  end;
  insert into smhrms_isolation_results(result, actor, test, tbl, detail)
  values (case pg_temp.smhrms_verdict(probe_msg) when 'FAIL' then 'FAIL (P1 privacy)' else pg_temp.smhrms_verdict(probe_msg) end,
          'employee of A', 'read colleagues'' bank account numbers', 'profiles',
          case when probe_msg like 'SMHRMS_PROBE:%' then replace(probe_msg, 'SMHRMS_PROBE:', '') || ' colleagues'' bank numbers readable'
               else left(probe_msg, 160) end);

  -- ---------- Storage: list org B files ----------
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', emp_a, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', emp_a::text, true);
    execute 'set local role authenticated';
    execute 'select count(*) from storage.objects where name like $1' into n using org_b::text || '/%';
    raise exception 'SMHRMS_PROBE:%', n;
  exception when others then
    probe_msg := sqlerrm;
  end;
  insert into smhrms_isolation_results(result, actor, test, tbl, detail)
  values (pg_temp.smhrms_verdict(probe_msg),
          'employee of A', 'list org B files in Storage', 'storage.objects',
          case when probe_msg like 'SMHRMS_PROBE:%' then replace(probe_msg, 'SMHRMS_PROBE:', '') || ' org-B files listable'
               else left(probe_msg, 160) end);
end $$;

select result, actor, test, tbl, detail
from smhrms_isolation_results
order by case when result like 'FAIL%' then 0 when result = 'CHECK' then 1 when result = 'SKIPPED' then 2 else 3 end, seq;
