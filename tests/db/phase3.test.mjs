// Phase 3 database regression tests (embedded PostgreSQL via PGlite).
// Uses the REAL production definitions of check_in / check_out (from the
// schema snapshot) so the migration's in-place rewrite is tested on real text.
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mig = (f) => fs.readFileSync(`${root}/supabase/migrations/${f}`, "utf8");
const snapshot = fs.readFileSync(`${root}/supabase/baseline/20261004_production_schema_snapshot.sql`, "utf8");
const fn = (name) => {
  const m = snapshot.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$function\\$`));
  if (!m) throw new Error("not in snapshot: " + name);
  return m[0] + ";";
};
const db = new PGlite();

const CO_A = "10000000-0000-0000-0000-00000000000a";
const CO_B = "10000000-0000-0000-0000-00000000000b";
const OWNER_A = "00000000-0000-0000-0000-00000000000a";
const ADMIN_A = "00000000-0000-0000-0000-0000000000a1";
const MGR_A = "00000000-0000-0000-0000-0000000000a2";
const EMP_A = "00000000-0000-0000-0000-0000000000a3";
const EMP2_A = "00000000-0000-0000-0000-0000000000a4";
const OFF_A = "00000000-0000-0000-0000-0000000000a9";
const ADMIN_B = "00000000-0000-0000-0000-0000000000b1";

await db.exec(`
create role authenticated nologin; create role anon nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub',
                         current_setting('request.jwt.claim.sub', true)),'')::uuid $$;
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
grant usage on schema public to authenticated, anon, service_role;

create table public.companies(id uuid primary key, name text, owner_id uuid, created_at timestamptz default now(),
  work_start time default '09:30', grace_minutes int default 15, half_day_minutes int default 240,
  geofence_enabled boolean default false, office_lat float8, office_lng float8, office_radius_m int default 200,
  account_status text not null default 'active');
create table public.branches(id uuid primary key, geofence_enabled boolean, office_lat float8, office_lng float8, office_radius_m int);
create table public.profiles(id uuid primary key, company_id uuid, role text, status text default 'active', full_name text default '',
  manager_id uuid, work_manager_id uuid, field_manager_id uuid, branch_id uuid, email text, phone text, access_permissions jsonb default '{}');
create function public.my_company_id() returns uuid language sql stable security definer set search_path=public as $$ select company_id from profiles where id=auth.uid() $$;
create function public.is_company_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in ('owner','admin')) $$;
create function public.reports_to_me(p uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=p and manager_id=auth.uid()) $$;
create function public.distance_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns integer language sql immutable as $$ select 0 $$;

create table public.attendance(id uuid primary key default gen_random_uuid(), company_id uuid, employee_id uuid, work_date date,
  check_in timestamptz, check_in_lat float8, check_in_lng float8, check_out timestamptz, check_out_lat float8, check_out_lng float8,
  status text, work_minutes int, created_at timestamptz default now(), is_late boolean, late_minutes int, notes text,
  check_in_photo text, check_out_photo text, check_in_address text, check_out_address text, check_in_ip text, check_out_ip text,
  is_auto boolean, check_in_distance_m int, check_out_distance_m int, check_in_outside boolean, check_out_outside boolean,
  unique(employee_id, work_date));
create table public.leaves(id uuid primary key default gen_random_uuid(), company_id uuid, employee_id uuid, from_date date, to_date date,
  day_type text default 'full_day', days numeric, status text default 'pending', decided_by uuid, decided_at timestamptz, buddy_id uuid, buddy_status text);
create table public.delegations(id uuid primary key default gen_random_uuid(), company_id uuid, title text, description text,
  assigned_to uuid, assigned_by uuid, priority text, due_date date, due_time time, completed_at timestamptz, created_at timestamptz default now(),
  kra_id text, revised_count int default 0, reminder_sent_at timestamptz, overdue_notified_at timestamptz, status text);
alter table public.delegations enable row level security;
create policy d_ins on delegations for insert with check (company_id = my_company_id() and (is_company_admin() or reports_to_me(assigned_to) or assigned_to = auth.uid()));
create policy d_sel on delegations for select using (company_id = my_company_id());
create policy d_upd on delegations for update using (company_id = my_company_id() and (assigned_to = auth.uid() or assigned_by = auth.uid() or is_company_admin()));
create table public.field_visits(id uuid primary key default gen_random_uuid(), company_id uuid, employee_id uuid, client_name text,
  status text default 'planned', created_at timestamptz default now(), accepted_at timestamptz, travel_started_at timestamptz, reached_at timestamptz,
  check_in_at timestamptz, meeting_started_at timestamptz, completed_at timestamptz, check_out_at timestamptz, check_in_lat float8, check_in_lng float8,
  person_met text, outcome text, completion_notes text);
grant all on all tables in schema public to authenticated, anon, service_role;

insert into companies(id,name,owner_id) values ('${CO_A}','A','${OWNER_A}'),('${CO_B}','B','${ADMIN_B}');
insert into profiles(id,company_id,role,manager_id,field_manager_id,status) values
 ('${OWNER_A}','${CO_A}','owner',null,null,'active'), ('${ADMIN_A}','${CO_A}','admin',null,null,'active'),
 ('${MGR_A}','${CO_A}','manager',null,null,'active'), ('${EMP_A}','${CO_A}','employee','${MGR_A}','${MGR_A}','active'),
 ('${EMP2_A}','${CO_A}','employee','${MGR_A}',null,'active'), ('${OFF_A}','${CO_A}','employee',null,null,'disabled'),
 ('${ADMIN_B}','${CO_B}','admin',null,null,'active');
`);
await db.exec(fn("check_in")); await db.exec(fn("check_out"));
await db.exec(`grant execute on all functions in schema public to authenticated;`);
await db.exec(mig("20261004_p0_security_guards.sql"));
await db.exec(mig("20261005_2b4_notifications_and_misc_security.sql").replace(/-- 1\) notifications[\s\S]*?-- 2\) duty status/, "-- 2) duty status").replace(/-- 3\) fixed search_path[\s\S]*$/, "commit;"));
await db.exec(mig("20261006_p3_core_reliability.sql"));
await db.exec(mig("20261006_p3_core_reliability.sql")); // re-runnable

let pass = 0, fail = 0;
async function as(user, role, sql) {
  await db.exec("savepoint t;");
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: user || "", role: role || "authenticated" })}', true);`);
  if (role) await db.exec(`set local role ${role};`);
  try { const r = await db.query(sql); await db.exec("reset role; release savepoint t;"); return { ok: true, r }; }
  catch (e) { await db.exec("rollback to savepoint t; reset role;"); return { ok: false, err: e.message }; }
}
async function expect(name, want, user, role, sql, check, setup) {
  await db.exec("begin;");
  if (setup) await db.exec(setup);
  const res = await as(user, role, sql);
  let good = want === "allow" ? res.ok : !res.ok, extra = "";
  if (good && res.ok && check) { const c = await check(res.r); good = c === true; if (c !== true) extra = " -> " + c; }
  await db.exec("rollback;");
  good ? pass++ : fail++;
  console.log(`${good ? "PASS" : "FAIL"}  [${want}] ${name}${res.ok ? extra : "  -> " + res.err}`);
}
const A = "authenticated";
const one = async (q) => (await db.query(q)).rows[0];

console.log("--- attendance ---");
await expect("active employee checks in", "allow", EMP_A, A, `select (check_in()).id`);
await expect("disabled employee cannot check in", "deny", OFF_A, A, `select (check_in()).id`);
await expect("suspended organization cannot check in", "deny", EMP_A, A, `select (check_in()).id`, null,
  `update companies set account_status='suspended' where id='${CO_A}';`);
await expect("second check-in same day keeps first punch (no duplicate)", "allow", EMP_A, A,
  `select (check_in()).id`,
  async () => { const r = await one(`select count(*)::int c, min(check_in) < now() first_kept from attendance where employee_id='${EMP_A}'`); return r.c === 1 || "duplicate"; },
  `insert into attendance(company_id, employee_id, work_date, check_in, status) values ('${CO_A}','${EMP_A}', (now() at time zone 'Asia/Kolkata')::date, now() - interval '2 hours', 'present');`);
await expect("night shift: OUT after midnight closes yesterday's open duty", "allow", EMP_A, A, `select (check_out()).id`,
  async () => { const r = await one(`select check_out is not null closed from attendance where employee_id='${EMP_A}' and work_date = current_date - 1`); return r?.closed === true || "not closed"; },
  `insert into attendance(company_id, employee_id, work_date, check_in, status) values ('${CO_A}','${EMP_A}', current_date - 1, now() - interval '8 hours', 'present');`);
await expect("check-out without any open duty still fails clearly", "deny", EMP2_A, A, `select (check_out()).id`);
await expect("duty status follows open duty across midnight", "allow", ADMIN_A, A, `select is_employee_on_duty_v7('${EMP_A}') v`,
  (r) => r.rows[0].v === true || "false",
  `insert into attendance(company_id, employee_id, work_date, check_in, status) values ('${CO_A}','${EMP_A}', current_date - 1, now() - interval '6 hours', 'present');`);
await expect("stale open duty (>20h) is not on duty", "allow", ADMIN_A, A, `select is_employee_on_duty_v7('${EMP_A}') v`,
  (r) => r.rows[0].v === false || "true",
  `insert into attendance(company_id, employee_id, work_date, check_in, status) values ('${CO_A}','${EMP_A}', current_date - 2, now() - interval '30 hours', 'present');`);

console.log("--- leave days ---");
for (const [dt, from, to, want] of [["full_day", "2026-11-10", "2026-11-12", 3], ["first_half", "2026-11-10", "2026-11-12", 0.5], ["short_morning", "2026-11-10", "2026-11-10", 0], ["wfh", "2026-11-10", "2026-11-10", 0]]) {
  await expect(`${dt} ${from}..${to} counted as ${want} (client sent 99)`, "allow", EMP_A, A,
    `insert into leaves(company_id, employee_id, from_date, to_date, day_type, days) values ('${CO_A}','${EMP_A}','${from}','${to}','${dt}',99)`,
    async () => { const r = await one(`select days::float d, to_date::text t from leaves`); return (r.d === want && (dt === "full_day" || r.t === from)) || JSON.stringify(r); });
}

console.log("--- tasks ---");
const task = (id, by = MGR_A, to = EMP_A) => `insert into delegations(id, company_id, title, assigned_to, assigned_by, due_date, status) values ('${id}','${CO_A}','T','${to}','${by}', current_date, 'pending');`;
const T1 = "60000000-0000-0000-0000-000000000001";
await expect("manager assigns task to report", "allow", MGR_A, A,
  `insert into delegations(company_id,title,assigned_to,assigned_by,due_date) values ('${CO_A}','X','${EMP_A}','${OWNER_A}', current_date)`,
  async () => (await one(`select assigned_by from delegations`)).assigned_by === MGR_A || "assigned_by spoofed");
await expect("assign task to other-org user", "deny", ADMIN_A, A,
  `insert into delegations(company_id,title,assigned_to,due_date) values ('${CO_A}','X','${ADMIN_B}', current_date)`);
await expect("assignee completes task (server time)", "allow", EMP_A, A,
  `update delegations set completed_at = '2020-01-01', status='complete' where id='${T1}'`,
  async () => { const r = await one(`select completed_at > now() - interval '1 minute' fresh from delegations where id='${T1}'`); return r.fresh === true || "phone time kept"; }, task(T1));
await expect("assignee moves own due date", "deny", EMP_A, A, `update delegations set due_date = current_date + 30 where id='${T1}'`, null, task(T1));
await expect("assignee reassigns task", "deny", EMP_A, A, `update delegations set assigned_to='${EMP2_A}' where id='${T1}'`, null, task(T1));
await expect("assignee re-opens completed task", "deny", EMP_A, A, `update delegations set completed_at=null where id='${T1}'`, null,
  task(T1) + `update delegations set completed_at=now() where id='${T1}';`);
await expect("sender changes due date (extension)", "allow", MGR_A, A, `update delegations set due_date = current_date + 3, revised_count = 1 where id='${T1}'`, null, task(T1));
await expect("sender re-opens task", "allow", MGR_A, A, `update delegations set completed_at=null where id='${T1}'`, null,
  task(T1) + `update delegations set completed_at=now() where id='${T1}';`);
await expect("admin edits any task", "allow", ADMIN_A, A, `update delegations set title='Y', assigned_to='${EMP2_A}' where id='${T1}'`, null, task(T1));
await expect("sender reassigns to other-org user", "deny", MGR_A, A, `update delegations set assigned_to='${ADMIN_B}' where id='${T1}'`, null, task(T1));

console.log("--- field visit cancel ---");
const V = "70000000-0000-0000-0000-000000000001";
const visit = (status) => `insert into field_visits(id, company_id, employee_id, client_name, status) values ('${V}','${CO_A}','${EMP_A}','C','${status}');`;
await expect("employee cancels own planned visit with reason", "allow", EMP_A, A, `select (field_visit_cancel_v1('${V}','Customer not available')).status s`,
  (r) => r.rows[0].s === "cancelled" || r.rows[0].s, visit("planned"));
await expect("cancel without reason", "deny", EMP_A, A, `select field_visit_cancel_v1('${V}','  ')`, null, visit("planned"));
await expect("employee cancels after check-in", "deny", EMP_A, A, `select field_visit_cancel_v1('${V}','x')`, null, visit("checked_in"));
await expect("field manager cancels after check-in", "allow", MGR_A, A, `select field_visit_cancel_v1('${V}','client left')`, null, visit("checked_in"));
await expect("colleague cancels someone else's visit", "deny", EMP2_A, A, `select field_visit_cancel_v1('${V}','x')`, null, visit("planned"));
await expect("other-org admin cancels visit", "deny", ADMIN_B, A, `select field_visit_cancel_v1('${V}','x')`, null, visit("planned"));
await expect("completed visit cannot be cancelled", "deny", ADMIN_A, A, `select field_visit_cancel_v1('${V}','x')`, null, visit("completed"));
await expect("cancel columns not writable directly", "deny", EMP_A, A, `update field_visits set cancel_reason='x' where id='${V}'`, null, visit("planned"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
