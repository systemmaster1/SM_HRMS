// Database security-guard regression tests.
// Runs the real migration files in an embedded PostgreSQL (PGlite) with a
// minimal Supabase-like setup (auth.uid(), authenticated/anon/service_role).
// Run: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";

import path from "path";
import { fileURLToPath } from "url";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations") + "/";
const db = new PGlite();

const OWNER_A = "00000000-0000-0000-0000-00000000000a";
const ADMIN_A = "00000000-0000-0000-0000-0000000000a1";
const ADMIN2_A = "00000000-0000-0000-0000-0000000000a5";
const MGR_A = "00000000-0000-0000-0000-0000000000a2";
const EMP_A = "00000000-0000-0000-0000-0000000000a3";
const LEFT_A = "00000000-0000-0000-0000-0000000000a4";
const OWNER_B = "00000000-0000-0000-0000-00000000000b";
const NEWUSER = "00000000-0000-0000-0000-0000000000c1";
const CO_A = "10000000-0000-0000-0000-00000000000a";
const CO_B = "10000000-0000-0000-0000-00000000000b";
const CO_NEW = "10000000-0000-0000-0000-00000000000c";

await db.exec(`
create role authenticated nologin; create role anon nologin; create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
create table public.companies(id uuid primary key, name text, owner_id uuid, created_at timestamptz default now());
create table public.profiles(id uuid primary key, company_id uuid references public.companies(id) on delete cascade, role text, status text default 'active',
  full_name text, email text, phone text, manager_id uuid, work_manager_id uuid, field_manager_id uuid, access_permissions jsonb default '{}',
  department text default '', designation text default '', photo_required boolean default false, address text, bank_account_number text,
  employee_code text, branch_id uuid, left_at timestamptz, must_change_password boolean default false, field_tracking_enabled boolean default false,
  employee_type text, tracking_mode text, tracking_interval_minutes int, tracking_stale_after_minutes int, route_history_enabled boolean, date_of_birth date);
create table public.field_visits(id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id) on delete cascade, employee_id uuid,
  client_name text, status text default 'planned', scheduled_at timestamptz, visit_date date, accepted_at timestamptz, travel_started_at timestamptz,
  reached_at timestamptz, check_in_at timestamptz, meeting_started_at timestamptz, completed_at timestamptz, check_out_at timestamptz,
  check_in_lat float8, check_in_lng float8, person_met text, outcome text, completion_notes text, created_at timestamptz default now(),
  original_scheduled_at timestamptz, reschedule_count int, reminder_sent_at timestamptz, last_lat float8, last_lng float8, last_location_at timestamptz,
  next_followup_at timestamptz, assigned_by uuid);
alter table public.field_visits add constraint field_visits_status_check check (status in ('planned','assigned','accepted','on_the_way','reached','checked_in','meeting','completed','cancelled'));
create table public.leaves(id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id) on delete cascade, employee_id uuid,
  from_date date, to_date date, day_type text default 'full_day', status text default 'pending', decided_by uuid, decided_at timestamptz,
  buddy_id uuid, buddy_status text default 'none', reason text, days numeric);
create table public.support_meetings(id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id) on delete cascade,
  requested_by uuid, host_user_id uuid, title text, starts_at timestamptz, ends_at timestamptz, status text default 'requested',
  meeting_url text, internal_notes text, updated_at timestamptz default now());
create table public.employee_location_history(id bigserial primary key, company_id uuid references public.companies(id) on delete cascade, employee_id uuid, latitude float8, longitude float8);
create table public.tracking_events(id bigserial primary key, company_id uuid references public.companies(id) on delete cascade, employee_id uuid, event text);
create table public.platform_admins(user_id uuid primary key);
create function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.platform_admins where user_id=auth.uid()) $$;
create function public.my_company_id() returns uuid language sql stable security definer set search_path=public as $$ select company_id from public.profiles where id=auth.uid() $$;
create function public.is_company_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('owner','admin')) $$;
create function public.reports_to_me(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=p and manager_id=auth.uid()) $$;
grant all on all tables in schema public to authenticated, anon, service_role;
grant all on all sequences in schema public to authenticated, anon, service_role;
grant usage on schema public to authenticated, anon, service_role;

insert into companies values ('${CO_A}','A','${OWNER_A}'),('${CO_B}','B','${OWNER_B}');
insert into profiles(id,company_id,role,email,full_name,manager_id) values
 ('${OWNER_A}','${CO_A}','owner','owner@a','Owner A',null),
 ('${ADMIN_A}','${CO_A}','admin','admin@a','Admin A',null),
 ('${ADMIN2_A}','${CO_A}','admin','admin2@a','Admin2 A',null),
 ('${MGR_A}','${CO_A}','manager','mgr@a','Mgr A',null),
 ('${EMP_A}','${CO_A}','employee','emp@a','Emp A','${MGR_A}'),
 ('${OWNER_B}','${CO_B}','owner','owner@b','Owner B',null),
 ('${NEWUSER}',null,null,'new@x','New',null);
insert into profiles(id,company_id,role,status,email,full_name) values ('${LEFT_A}','${CO_A}','employee','left','left@a','Left A');
`);

// Existing production migrations that we change/depend on
await db.exec(fs.readFileSync(repo + "20261001_tracking_history_immutable.sql", "utf8"));
await db.exec(fs.readFileSync(repo + "20261001_field_visit_lifecycle_repair_v8.sql", "utf8"));
// The migration under test
await db.exec(fs.readFileSync(repo + "20261004_p0_security_guards.sql", "utf8"));
// run twice to prove it is re-runnable
await db.exec(fs.readFileSync(repo + "20261004_p0_security_guards.sql", "utf8"));

let pass = 0, fail = 0;
// Runs `sql` as a browser/server role inside the CURRENT transaction, using a
// savepoint so a failure does not abort the outer transaction.
async function as(user, role, sql) {
  await db.exec("savepoint t;");
  await db.exec(`select set_config('request.jwt.claim.sub', '${user || ""}', true);`);
  if (role) await db.exec(`set local role ${role};`);
  try { const r = await db.query(sql); await db.exec("reset role; release savepoint t;"); return { ok: true, r }; }
  catch (e) { await db.exec("rollback to savepoint t; reset role;"); return { ok: false, err: e.message }; }
}
async function expect(name, want, user, role, sql) {
  await db.exec("begin;");
  const res = await as(user, role, sql);
  await db.exec("rollback;");
  const good = want === "allow" ? res.ok : !res.ok;
  if (good) pass++; else fail++;
  console.log(`${good ? "PASS" : "FAIL"}  [${want}] ${name}${res.ok ? "" : "  -> " + res.err}`);
}
const A = "authenticated";

console.log("--- profiles ---");
await expect("employee edits own name/phone", "allow", EMP_A, A, `update profiles set full_name='E', phone='9' where id='${EMP_A}'`);
await expect("employee promotes self to admin", "deny", EMP_A, A, `update profiles set role='admin' where id='${EMP_A}'`);
await expect("employee promotes self to owner", "deny", EMP_A, A, `update profiles set role='owner' where id='${EMP_A}'`);
await expect("employee moves self to org B", "deny", EMP_A, A, `update profiles set company_id='${CO_B}' where id='${EMP_A}'`);
await expect("employee changes own access_permissions", "deny", EMP_A, A, `update profiles set access_permissions='{"payroll":"company"}' where id='${EMP_A}'`);
await expect("employee changes own manager", "deny", EMP_A, A, `update profiles set manager_id=null where id='${EMP_A}'`);
await expect("employee edits colleague's bank", "deny", EMP_A, A, `update profiles set bank_account_number='x' where id='${MGR_A}'`);
await expect("employee changes own login email", "deny", EMP_A, A, `update profiles set email='x@y' where id='${EMP_A}'`);
await expect("admin sets employee attendance config", "allow", ADMIN_A, A, `update profiles set photo_required=true where id='${EMP_A}'`);
await expect("admin edits employee address/bank", "allow", ADMIN_A, A, `update profiles set address='x', bank_account_number='1' where id='${EMP_A}'`);
await expect("admin promotes employee to manager", "allow", ADMIN_A, A, `update profiles set role='manager' where id='${EMP_A}'`);
await expect("admin promotes employee to admin", "deny", ADMIN_A, A, `update profiles set role='admin' where id='${EMP_A}'`);
await expect("admin promotes employee to owner", "deny", ADMIN_A, A, `update profiles set role='owner' where id='${EMP_A}'`);
await expect("admin changes owner's phone", "deny", ADMIN_A, A, `update profiles set phone='1' where id='${OWNER_A}'`);
await expect("admin disables another admin", "deny", ADMIN_A, A, `update profiles set status='disabled' where id='${ADMIN2_A}'`);
await expect("admin changes own role", "deny", ADMIN_A, A, `update profiles set role='employee' where id='${ADMIN_A}'`);
await expect("admin of A edits org-B owner", "deny", ADMIN_A, A, `update profiles set full_name='hacked' where id='${OWNER_B}'`);
await expect("admin of A sets org-B user's dept", "deny", ADMIN_A, A, `update profiles set department='x' where id='${OWNER_B}'`);
await expect("owner promotes employee to admin", "allow", OWNER_A, A, `update profiles set role='admin' where id='${EMP_A}'`);
await expect("owner demotes admin", "allow", OWNER_A, A, `update profiles set role='manager' where id='${ADMIN_A}'`);
await expect("owner makes someone owner via UPDATE", "deny", OWNER_A, A, `update profiles set role='owner' where id='${ADMIN_A}'`);
await expect("owner disables employee", "allow", OWNER_A, A, `update profiles set status='disabled' where id='${EMP_A}'`);
await expect("manager edits report's address", "allow", MGR_A, A, `update profiles set address='x' where id='${EMP_A}'`);
await expect("manager changes report's role", "deny", MGR_A, A, `update profiles set role='manager' where id='${EMP_A}'`);
await expect("removed employee edits own profile", "deny", LEFT_A, A, `update profiles set full_name='x' where id='${LEFT_A}'`);
await expect("anon updates a profile", "deny", null, "anon", `update profiles set full_name='x' where id='${EMP_A}'`);
await expect("browser inserts owner profile", "deny", NEWUSER, A, `insert into profiles(id,company_id,role) values (gen_random_uuid(),'${CO_A}','owner')`);
await expect("service role changes role (server API)", "allow", null, "service_role", `update profiles set role='admin' where id='${EMP_A}'`);
await expect("SQL editor/postgres changes email", "allow", null, null, `update profiles set email='new@a' where id='${EMP_A}'`);
await db.exec(`create function public.test_definer_promote(p uuid) returns void language sql security definer set search_path=public as $$ update public.profiles set role='admin', company_id=company_id where id=p $$; grant execute on function public.test_definer_promote(uuid) to authenticated;`);
await expect("SECURITY DEFINER RPC still works", "allow", EMP_A, A, `select public.test_definer_promote('${EMP_A}')`);
await db.exec(`insert into companies values ('${CO_NEW}','New','${NEWUSER}');`);
await expect("onboarding: new owner joins own company", "allow", NEWUSER, A, `update profiles set company_id='${CO_NEW}', role='owner' where id='${NEWUSER}'`);
await expect("onboarding: new user joins someone else's company", "deny", NEWUSER, A, `update profiles set company_id='${CO_A}', role='employee' where id='${NEWUSER}'`);

console.log("--- field_visits ---");
await db.exec(`insert into field_visits(id,company_id,employee_id,client_name,status) values ('20000000-0000-0000-0000-000000000001','${CO_A}','${EMP_A}','Client','planned'),('20000000-0000-0000-0000-000000000002','${CO_A}','${EMP_A}','Client2','checked_in');`);
await expect("employee creates planned visit", "allow", EMP_A, A, `insert into field_visits(company_id,employee_id,client_name,status) values ('${CO_A}','${EMP_A}','X','planned')`);
await expect("visit without customer name", "deny", EMP_A, A, `insert into field_visits(company_id,employee_id,client_name,status) values ('${CO_A}','${EMP_A}','  ','planned')`);
await expect("employee inserts already-completed visit", "deny", EMP_A, A, `insert into field_visits(company_id,employee_id,client_name,status) values ('${CO_A}','${EMP_A}','X','completed')`);
{
  await db.exec("begin;");
  await as(EMP_A, A, `insert into field_visits(id,company_id,employee_id,client_name,status,completed_at,created_at) values ('20000000-0000-0000-0000-0000000000ff','${CO_A}','${EMP_A}','X','planned', now()-interval '3 days', now()-interval '3 days')`);
  const r = await db.query(`select completed_at, created_at > now()-interval '1 minute' as fresh from field_visits where id='20000000-0000-0000-0000-0000000000ff'`);
  await db.exec("rollback;");
  const ok = r.rows[0]?.completed_at === null && r.rows[0]?.fresh === true;
  ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  [server] client-supplied completed_at/created_at replaced by trusted values`);
}
await expect("direct UPDATE planned -> meeting (old bypass)", "deny", EMP_A, A, `update field_visits set status='meeting', meeting_started_at=now() where id='20000000-0000-0000-0000-000000000001'`);
await expect("employee reschedules visit (scheduled_at)", "allow", EMP_A, A, `update field_visits set scheduled_at=now()+interval '1 day' where id='20000000-0000-0000-0000-000000000001'`);
await expect("RPC: Start Meeting after check-in (regression)", "allow", EMP_A, A, `select status from field_visit_action_v6('20000000-0000-0000-0000-000000000002','meeting')`);
await expect("RPC: Start Meeting before check-in is rejected", "deny", EMP_A, A, `select status from field_visit_action_v6('20000000-0000-0000-0000-000000000001','meeting')`);
await expect("RPC: Complete with notes after check-in", "allow", EMP_A, A, `select status from field_visit_action_v6('20000000-0000-0000-0000-000000000002','complete',null,null,'Mr X','successful','done',null)`);
await expect("RPC: accept planned visit", "allow", EMP_A, A, `select status from field_visit_action_v6('20000000-0000-0000-0000-000000000001','accept')`);
await expect("RPC: org B owner acts on org A visit", "deny", OWNER_B, A, `select status from field_visit_action_v6('20000000-0000-0000-0000-000000000002','meeting')`);

console.log("--- leaves ---");
await db.exec(`insert into leaves(id,company_id,employee_id,from_date,to_date,status) values ('30000000-0000-0000-0000-000000000001','${CO_A}','${EMP_A}','2026-11-10','2026-11-12','pending');`);
await expect("employee applies leave", "allow", EMP_A, A, `insert into leaves(company_id,employee_id,from_date,to_date) values ('${CO_A}','${EMP_A}','2026-11-20','2026-11-21')`);
{
  await db.exec("begin;");
  await as(EMP_A, A, `insert into leaves(id,company_id,employee_id,from_date,to_date,status,decided_by) values ('30000000-0000-0000-0000-0000000000aa','${CO_A}','${EMP_A}','2026-12-01','2026-12-01','approved','${EMP_A}')`);
  const r = await db.query(`select status, decided_by from leaves where id='30000000-0000-0000-0000-0000000000aa'`);
  await db.exec("rollback;");
  const ok = r.rows[0]?.status === "pending" && r.rows[0]?.decided_by === null;
  ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  [server] self-approved insert is forced back to pending`);
}
await expect("overlapping leave request", "deny", EMP_A, A, `insert into leaves(company_id,employee_id,from_date,to_date) values ('${CO_A}','${EMP_A}','2026-11-11','2026-11-15')`);
await expect("first_half + second_half same day", "allow", EMP_A, A, `with a as (select 1) insert into leaves(company_id,employee_id,from_date,to_date,day_type) values ('${CO_A}','${EMP_A}','2026-11-25','2026-11-25','first_half')`);
await db.exec(`insert into leaves(company_id,employee_id,from_date,to_date,day_type,status) values ('${CO_A}','${EMP_A}','2026-11-26','2026-11-26','first_half','pending')`);
await expect("second_half on a day that has first_half", "allow", EMP_A, A, `insert into leaves(company_id,employee_id,from_date,to_date,day_type) values ('${CO_A}','${EMP_A}','2026-11-26','2026-11-26','second_half')`);
await expect("full day on a day that has first_half", "deny", EMP_A, A, `insert into leaves(company_id,employee_id,from_date,to_date,day_type) values ('${CO_A}','${EMP_A}','2026-11-26','2026-11-26','full_day')`);
await expect("employee applies for colleague", "deny", EMP_A, A, `insert into leaves(company_id,employee_id,from_date,to_date) values ('${CO_A}','${MGR_A}','2026-11-20','2026-11-21')`);
await expect("employee approves own leave", "deny", EMP_A, A, `update leaves set status='approved' where id='30000000-0000-0000-0000-000000000001'`);
await expect("employee withdraws own leave", "allow", EMP_A, A, `update leaves set status='cancelled' where id='30000000-0000-0000-0000-000000000001'`);
await expect("reporting manager approves", "allow", MGR_A, A, `update leaves set status='approved' where id='30000000-0000-0000-0000-000000000001'`);
await expect("admin approves", "allow", ADMIN_A, A, `update leaves set status='approved' where id='30000000-0000-0000-0000-000000000001'`);
await expect("org B owner approves org A leave", "deny", OWNER_B, A, `update leaves set status='approved' where id='30000000-0000-0000-0000-000000000001'`);
{
  await db.exec("begin;");
  await as(ADMIN_A, A, `update leaves set status='approved', decided_by='${OWNER_B}', decided_at='2020-01-01' where id='30000000-0000-0000-0000-000000000001'`);
  const r = await db.query(`select decided_by, decided_at > now()-interval '1 minute' as fresh from leaves where id='30000000-0000-0000-0000-000000000001'`);
  await db.exec("rollback;");
  const ok = r.rows[0]?.decided_by === ADMIN_A && r.rows[0]?.fresh === true;
  ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  [server] decided_by/decided_at come from the server`);
}

console.log("--- support_meetings ---");
await db.exec(`insert into support_meetings(id,company_id,requested_by,title,starts_at,ends_at,status) values ('40000000-0000-0000-0000-000000000001','${CO_A}','${ADMIN_A}','T',now(),now()+interval '30 min','requested');`);
await expect("org admin self-confirms meeting", "deny", ADMIN_A, A, `update support_meetings set status='confirmed' where id='40000000-0000-0000-0000-000000000001'`);
await expect("org admin edits internal notes", "deny", ADMIN_A, A, `update support_meetings set internal_notes='x' where id='40000000-0000-0000-0000-000000000001'`);
await expect("org admin cancels own request", "allow", ADMIN_A, A, `update support_meetings set status='cancelled', updated_at=now() where id='40000000-0000-0000-0000-000000000001'`);
await db.exec(`insert into platform_admins values ('${OWNER_B}');`);
await expect("platform admin confirms meeting", "allow", OWNER_B, A, `update support_meetings set status='confirmed', meeting_url='https://x' where id='40000000-0000-0000-0000-000000000001'`);
await db.exec(`delete from platform_admins;`);

console.log("--- GPS history ---");
// RLS already hides these rows from browsers. Simulate a too-broad policy so
// the immutability trigger itself is tested (defence in depth).
await db.exec(`create policy test_all on employee_location_history for all to authenticated using (true) with check (true);
               create policy test_all on tracking_events for all to authenticated using (true) with check (true);`);
await db.exec(`insert into employee_location_history(company_id,employee_id,latitude,longitude) values ('${CO_A}','${EMP_A}',1,1); insert into tracking_events(company_id,employee_id,event) values ('${CO_A}','${EMP_A}','x');`);
await expect("employee rewrites GPS point", "deny", EMP_A, A, `update employee_location_history set latitude=2`);
await expect("employee deletes GPS point", "deny", EMP_A, A, `delete from employee_location_history`);
await expect("employee deletes tracking event", "deny", EMP_A, A, `delete from tracking_events`);
await expect("server deletes organization (cascade through GPS)", "allow", null, null, `delete from companies where id='${CO_A}'`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
