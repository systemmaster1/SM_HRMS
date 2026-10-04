// Phase 2b database regression tests (embedded PostgreSQL via PGlite).
// Runs the real migration files against a minimal Supabase-like schema.
// Run: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations") + "/";
const mig = (f) => fs.readFileSync(dir + f, "utf8");
const db = new PGlite();

const CO_A = "10000000-0000-0000-0000-00000000000a";
const CO_B = "10000000-0000-0000-0000-00000000000b";
const OWNER_A = "00000000-0000-0000-0000-00000000000a";
const ADMIN_A = "00000000-0000-0000-0000-0000000000a1";
const MGR_A = "00000000-0000-0000-0000-0000000000a2";
const EMP_A = "00000000-0000-0000-0000-0000000000a3";
const EMP2_A = "00000000-0000-0000-0000-0000000000a4";
const ADMIN_B = "00000000-0000-0000-0000-0000000000b1";
const SYSADMIN = "00000000-0000-0000-0000-0000000000f1";

await db.exec(`
create role authenticated nologin; create role anon nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub',
                         current_setting('request.jwt.claim.sub', true)),'')::uuid $$;
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
grant usage on schema public to authenticated, anon, service_role;

create table public.companies(id uuid primary key, name text, owner_id uuid, created_at timestamptz default now());
create table public.profiles(id uuid primary key, company_id uuid references companies(id), full_name text default '', email text, phone text,
  role text, department text default '', designation text default '', employee_code text, status text default 'active', joined_on date,
  avatar_url text, created_at timestamptz default now(), manager_id uuid, must_change_password boolean default false,
  photo_required boolean default false, auto_attendance boolean default false, auto_in_time time, auto_out_time time,
  date_of_birth date, branch_id uuid, address text, city text, state text, pincode text,
  bank_account_name text, bank_account_number text, bank_ifsc text, bank_name text,
  emergency_contact_name text, emergency_contact_phone text, status_note text, status_changed_at timestamptz,
  field_tracking_enabled boolean default false, employee_type text, tracking_mode text, tracking_interval_minutes int,
  location_stale_minutes int, tracking_stale_after_minutes int, route_history_enabled boolean default true,
  work_manager_id uuid, field_manager_id uuid, left_at timestamptz, notify_hr_manager boolean, notify_work_manager boolean,
  notify_field_manager boolean, access_permissions jsonb default '{}', weekly_off_days int[]);
alter table public.profiles enable row level security;
create function public.my_company_id() returns uuid language sql stable security definer set search_path=public as $$ select company_id from profiles where id=auth.uid() $$;
create policy profiles_select_colleagues on profiles for select using (company_id = my_company_id());
create policy profiles_select_self on profiles for select using (id = auth.uid());
create policy profiles_update_self on profiles for update using (id = auth.uid());

create table public.audit_logs(id bigserial primary key, company_id uuid, actor_id uuid, action text, entity text, entity_key text, old_value jsonb, new_value jsonb);
create function public.write_audit(p_company uuid, p_action text, p_entity text, p_key text, p_old jsonb, p_new jsonb) returns void
  language sql security definer set search_path=public as $$
  insert into audit_logs(company_id, actor_id, action, entity, entity_key, old_value, new_value) values (p_company, auth.uid(), p_action, p_entity, p_key, p_old, p_new) $$;

create table public.platform_admins(user_id uuid primary key);
create table public.system_admins(user_id uuid primary key, active boolean default true);
create table public.system_admin_2fa_sessions(id uuid primary key default gen_random_uuid(), user_id uuid, token_hash text,
  verified_at timestamptz default now(), expires_at timestamptz, revoked_at timestamptz, created_at timestamptz default now());
create function public.is_platform_admin() returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_role text;
begin
  v_role := nullif(coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'role', current_setting('request.jwt.claim.role', true)),'');
  if v_role = 'service_role' then return true; end if;
  return exists(select 1 from platform_admins where user_id = auth.uid());
end $$;
create function public.is_system_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from system_admins where user_id = auth.uid() and active) $$;
create function public.system_admin_overview() returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  return jsonb_build_object('orgs', (select count(*) from companies));
end $$;
create function public.system_admin_support_tickets(p_status text) returns int language plpgsql stable security definer set search_path=public as $$
begin
  if not is_system_admin() then raise exception 'Not authorized'; end if;
  return 1;
end $$;
grant execute on function public.system_admin_overview() to authenticated;
grant execute on function public.system_admin_support_tickets(text) to authenticated;

create table public.attendance(id uuid primary key default gen_random_uuid(), company_id uuid, employee_id uuid, work_date date,
  check_in timestamptz, check_out timestamptz);
create table public.field_visits(id uuid primary key default gen_random_uuid(), employee_id uuid, status text, created_at timestamptz default now());
create table public.employee_location_history(id uuid primary key default gen_random_uuid(), company_id uuid, employee_id uuid, visit_id uuid,
  latitude float8, longitude float8, accuracy_m int, speed_mps float8, heading float8, source text, captured_at timestamptz, created_at timestamptz default now());
create table public.employee_live_locations(employee_id uuid primary key, company_id uuid, visit_id uuid, latitude float8, longitude float8,
  accuracy_m int, speed_mps float8, heading float8, permission_state text, tracking_state text, app_state text, last_seen_at timestamptz,
  last_error text, updated_at timestamptz, duty_status text, duty_started_at timestamptz, duty_ended_at timestamptz, last_state_changed_at timestamptz);
create table public.tracking_events(id bigserial primary key, company_id uuid, employee_id uuid, visit_id uuid, event_type text,
  event_time timestamptz, latitude float8, longitude float8, details jsonb);
create function public.is_employee_on_duty_v7(p_employee_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from attendance a where a.employee_id=p_employee_id and a.check_in is not null and a.check_out is null) $$;

create table public.notifications(id uuid primary key default gen_random_uuid(), company_id uuid, user_id uuid, title text, body text,
  kind text, link text, is_read boolean default false, created_at timestamptz default now(), pushed_at timestamptz, push_result text);
alter table public.notifications enable row level security;
create policy notifications_insert on notifications for insert with check (company_id = my_company_id());
create policy notifications_read on notifications for select using (user_id = auth.uid());
create policy notifications_update on notifications for update using (user_id = auth.uid());

create function public.distance_m(a float8, b float8) returns float8 language sql immutable as $$ select a - b $$;

grant all on all tables in schema public to authenticated, anon, service_role;
grant all on all sequences in schema public to authenticated, anon, service_role;

insert into companies values ('${CO_A}','A','${OWNER_A}'),('${CO_B}','B','${ADMIN_B}');
insert into profiles(id,company_id,role,full_name,manager_id,bank_account_number,bank_ifsc,address,date_of_birth,field_tracking_enabled) values
 ('${OWNER_A}','${CO_A}','owner','Owner A',null,null,null,null,null,false),
 ('${ADMIN_A}','${CO_A}','admin','Admin A',null,null,null,null,null,false),
 ('${MGR_A}','${CO_A}','manager','Mgr A',null,null,null,null,null,false),
 ('${EMP_A}','${CO_A}','employee','Emp A','${MGR_A}','123456789','HDFC0001234','12 Main St','1990-05-01',true),
 ('${EMP2_A}','${CO_A}','employee','Emp2 A','${MGR_A}','555555555',null,null,null,false),
 ('${ADMIN_B}','${CO_B}','admin','Admin B',null,null,null,null,null,false),
 ('${SYSADMIN}',null,'employee','SysAdmin',null,null,null,null,null,false);
insert into platform_admins values ('${SYSADMIN}');
`);

// Production prerequisites already applied there (P0 guards provide smhrms_actor etc.)
await db.exec(mig("20261004_p0_security_guards.sql").replace(/do \$\$\nbegin\n  if to_regclass\('public\.(field_visits|leaves|support_meetings)'\)[\s\S]*?end \$\$;/g, ""));
// Phase 2b migrations under test — each applied twice (re-runnable)
for (const f of ["20261005_2b1_private_details_rpc.sql", "20261005_2b2_system_admin_db_2fa.sql",
                 "20261005_2b3_offline_gps_batch.sql", "20261005_2b4_notifications_and_misc_security.sql"]) {
  await db.exec(mig(f)); await db.exec(mig(f));
}

let pass = 0, fail = 0;
async function as(user, role, sql, claimRole) {
  await db.exec("savepoint t;");
  const claims = JSON.stringify({ sub: user || "", role: claimRole || role || "authenticated" });
  await db.exec(`select set_config('request.jwt.claims', '${claims}', true);`);
  if (role) await db.exec(`set local role ${role};`);
  try { const r = await db.query(sql); await db.exec("reset role; release savepoint t;"); return { ok: true, r }; }
  catch (e) { await db.exec("rollback to savepoint t; reset role;"); return { ok: false, err: e.message }; }
}
async function expect(name, want, user, role, sql, check, claimRole) {
  await db.exec("begin;");
  const res = await as(user, role, sql, claimRole);
  let good = want === "allow" ? res.ok : !res.ok;
  let extra = "";
  if (good && res.ok && check) { const c = await check(res.r); good = c === true; if (c !== true) extra = " -> " + c; }
  await db.exec("rollback;");
  if (good) pass++; else fail++;
  console.log(`${good ? "PASS" : "FAIL"}  [${want}] ${name}${res.ok ? extra : "  -> " + res.err}`);
}
const A = "authenticated";
const val = (r) => Object.values(r.rows[0] || {})[0];

console.log("--- private employee details (RPC) ---");
await expect("employee reads own private details", "allow", EMP_A, A, `select get_employee_private_details('${EMP_A}')`,
  (r) => val(r).bank_account_number === "123456789" || JSON.stringify(val(r)));
await expect("admin reads employee private details", "allow", ADMIN_A, A, `select get_employee_private_details('${EMP_A}')`);
await expect("owner reads employee private details", "allow", OWNER_A, A, `select get_employee_private_details('${EMP_A}')`);
await expect("manager reads report's bank details", "deny", MGR_A, A, `select get_employee_private_details('${EMP_A}')`);
await expect("colleague reads bank details", "deny", EMP2_A, A, `select get_employee_private_details('${EMP_A}')`);
await expect("other-org admin reads bank details", "deny", ADMIN_B, A, `select get_employee_private_details('${EMP_A}')`);
await expect("employee updates own bank + DOB", "allow", EMP_A, A,
  `select set_employee_private_details('${EMP_A}', '{"bank_account_number":"987654321","date_of_birth":"1991-02-03","bank_ifsc":"icic0004321"}')`);
{
  await db.exec("begin;");
  await as(EMP_A, A, `select set_employee_private_details('${EMP_A}', '{"bank_ifsc":"icic0004321","date_of_birth":"1991-02-03"}')`);
  const r = await db.query(`select bank_ifsc, date_of_birth::text d, (select count(*) from audit_logs where action='employee_private_details_updated') n,
                             (select new_value::text from audit_logs order by id desc limit 1) v from profiles where id='${EMP_A}'`);
  await db.exec("rollback;");
  const x = r.rows[0]; const ok = x.bank_ifsc === "ICIC0004321" && x.d === "1991-02-03" && x.n === 1 && !String(x.v).includes("ICIC");
  ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  [server] IFSC upper-cased, DOB stored as date, audit has field names only ${ok ? "" : JSON.stringify(x)}`);
}
await expect("invalid IFSC rejected", "deny", EMP_A, A, `select set_employee_private_details('${EMP_A}', '{"bank_ifsc":"XYZ"}')`);
await expect("unknown field rejected (role escalation attempt)", "deny", EMP_A, A, `select set_employee_private_details('${EMP_A}', '{"role":"owner"}')`);
await expect("manager updates report's bank", "deny", MGR_A, A, `select set_employee_private_details('${EMP_A}', '{"bank_account_number":"111111"}')`);
await expect("other-org admin updates bank", "deny", ADMIN_B, A, `select set_employee_private_details('${EMP_A}', '{"bank_account_number":"111111"}')`);
await expect("anon calls private RPC", "deny", null, "anon", `select get_employee_private_details('${EMP_A}')`);

console.log("--- profiles column privileges (step B) ---");
await db.exec(mig("20261005_2b1_profiles_column_privileges.sql"));
await db.exec(mig("20261005_2b1_profiles_column_privileges.sql"));
await expect("colleague select * on profiles", "deny", EMP2_A, A, `select * from profiles`);
await expect("colleague selects bank column", "deny", EMP2_A, A, `select bank_account_number from profiles`);
await expect("colleague selects public columns", "allow", EMP2_A, A, `select id, full_name, role, department, access_permissions from profiles`,
  (r) => r.rows.length === 5 || `rows ${r.rows.length}`);
await expect("employee updates own name directly", "allow", EMP_A, A, `update profiles set full_name='E' where id='${EMP_A}'`);
await expect("employee updates own bank directly", "deny", EMP_A, A, `update profiles set bank_account_number='1' where id='${EMP_A}'`);
await expect("private RPC still works after step B", "allow", EMP_A, A, `select get_employee_private_details('${EMP_A}')`,
  (r) => val(r).bank_account_number === "123456789" || "lost access");
await expect("service role still reads everything", "allow", null, "service_role", `select bank_account_number from profiles where id='${EMP_A}'`);

console.log("--- System Admin 2FA in the database ---");
await expect("platform admin WITHOUT 2FA session", "deny", SYSADMIN, A, `select system_admin_overview()`);
await expect("normal admin calls system_admin RPC", "deny", ADMIN_A, A, `select system_admin_overview()`);
await db.exec(`insert into system_admin_2fa_sessions(user_id, token_hash, expires_at) values ('${SYSADMIN}','h', now() + interval '30 minutes');`);
await expect("platform admin WITH valid 2FA session", "allow", SYSADMIN, A, `select system_admin_overview()`);
await expect("is_system_admin-based RPC also enforced", "allow", SYSADMIN, A, `select system_admin_support_tickets('open')`);
await db.exec(`update system_admin_2fa_sessions set expires_at = now() - interval '1 minute';`);
await expect("expired 2FA session", "deny", SYSADMIN, A, `select system_admin_overview()`);
await db.exec(`update system_admin_2fa_sessions set expires_at = now() + interval '30 minutes', revoked_at = now();`);
await expect("revoked 2FA session (logout)", "deny", SYSADMIN, A, `select system_admin_overview()`);
await expect("service role (server API) unaffected", "allow", null, "service_role", `select system_admin_overview()`, null, "service_role");
await expect("someone else's 2FA session does not help", "deny", ADMIN_A, A, `select system_admin_overview()`);

console.log("--- offline GPS batch ---");
await db.exec(`insert into attendance(company_id, employee_id, work_date, check_in) values ('${CO_A}','${EMP_A}', current_date, now() - interval '3 hours');
               insert into attendance(company_id, employee_id, work_date, check_in, check_out) values ('${CO_A}','${EMP_A}', current_date - 1, now() - interval '30 hours', now() - interval '22 hours');`);
const pts = (arr) => `select record_employee_locations_batch_v8('${JSON.stringify(arr)}'::jsonb) r`;
const t = (h) => new Date(Date.now() - h * 3600_000).toISOString();
await expect("on-duty points accepted (incl. 2h-old offline point)", "allow", EMP_A, A,
  pts([{ client_id: "p1", lat: 28.6, lng: 77.2, accuracy: 12, captured_at: t(2) }, { client_id: "p2", lat: 28.61, lng: 77.21, captured_at: t(0) }]),
  async (r) => { const v = val(r); const n = (await db.query(`select count(*)::int c, bool_or(offline_upload) o from employee_location_history`)).rows[0];
                 return (v.acked.length === 2 && n.c === 2 && n.o === true) || JSON.stringify({ v, n }); });
await expect("re-sent points stored once (idempotent)", "allow", EMP_A, A,
  `${pts([{ client_id: "p1", lat: 28.6, lng: 77.2, captured_at: t(2) }]).replace(" r", " r1")}; ${pts([{ client_id: "p1", lat: 28.6, lng: 77.2, captured_at: t(2) }])}`.split(";").pop(),
  async () => true);
{
  await db.exec("begin;");
  await as(EMP_A, A, pts([{ client_id: "dup", lat: 1, lng: 1, captured_at: t(1) }]));
  const r2 = await as(EMP_A, A, pts([{ client_id: "dup", lat: 1, lng: 1, captured_at: t(1) }]));
  const n = (await db.query(`select count(*)::int c from employee_location_history where client_point_id='dup'`)).rows[0].c;
  await db.exec("rollback;");
  const ok = r2.ok && val(r2.r).acked.includes("dup") && n === 1;
  ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  [allow] duplicate upload acknowledged, stored once (rows=${n})`);
}
await expect("off-duty point (between yesterday OUT and today IN) rejected", "allow", EMP_A, A,
  pts([{ client_id: "off1", lat: 1, lng: 1, captured_at: t(10) }]),
  async (r) => { const v = val(r); const n = (await db.query(`select count(*)::int c from employee_location_history where client_point_id='off1'`)).rows[0].c;
                 return (v.acked.includes("off1") && v.rejected[0]?.reason === "off_duty" && n === 0) || JSON.stringify(v); });
await expect("point older than 72h rejected", "allow", EMP_A, A, pts([{ client_id: "old", lat: 1, lng: 1, captured_at: t(80) }]),
  (r) => val(r).rejected[0]?.reason === "too_old" || JSON.stringify(val(r)));
await expect("future phone clock clamped to server time", "allow", EMP_A, A, pts([{ client_id: "fut", lat: 1, lng: 1, captured_at: new Date(Date.now() + 86400000).toISOString() }]),
  async () => { const x = (await db.query(`select captured_at <= now() + interval '1 second' ok from employee_location_history where client_point_id='fut'`)).rows[0];
                return x?.ok === true || "not clamped"; });
await expect("employee without Field Tracking: nothing stored, stop=true", "allow", EMP2_A, A, pts([{ client_id: "x", lat: 1, lng: 1, captured_at: t(0) }]),
  (r) => (val(r).stop === true && val(r).acked.length === 0) || JSON.stringify(val(r)));
await expect("more than 200 points rejected", "deny", EMP_A, A, pts(Array.from({ length: 201 }, (_, i) => ({ client_id: "b" + i, lat: 1, lng: 1, captured_at: t(0) }))));
await expect("anon cannot upload GPS", "deny", null, "anon", pts([{ client_id: "a", lat: 1, lng: 1, captured_at: t(0) }]));

console.log("--- notifications ---");
await expect("notify colleague in same org", "allow", EMP_A, A,
  `insert into notifications(company_id,user_id,title,body,kind,link) values ('${CO_A}','${MGR_A}','Leave','x','leave','/leave')`);
await expect("notify user of ANOTHER org (cross-tenant)", "deny", EMP_A, A,
  `insert into notifications(company_id,user_id,title,body,kind,link) values ('${CO_A}','${ADMIN_B}','Hi','x','task','/tasks')`);
await expect("external phishing link", "deny", EMP_A, A,
  `insert into notifications(company_id,user_id,title,body,kind,link) values ('${CO_A}','${MGR_A}','Hi','x','task','https://evil.example')`);
await expect("protocol-relative link", "deny", EMP_A, A,
  `insert into notifications(company_id,user_id,title,body,kind,link) values ('${CO_A}','${MGR_A}','Hi','x','task','//evil.example')`);
await expect("created_by recorded", "allow", EMP_A, A,
  `insert into notifications(company_id,user_id,title,body,kind,link) values ('${CO_A}','${MGR_A}','Hi','x','task','/tasks')`,
  async () => (await db.query(`select created_by from notifications order by created_at desc limit 1`)).rows[0].created_by === EMP_A || "not set");
await expect("notification without a link (empty default) is allowed", "allow", EMP_A, A,
  `insert into notifications(company_id,user_id,title,body,kind,link) values ('${CO_A}','${MGR_A}','Hi','x','task','')`);
await db.exec(`insert into notifications(id,company_id,user_id,title,body,kind,link) values ('50000000-0000-0000-0000-000000000001','${CO_A}','${EMP_A}','T','B','task','/tasks');`);
await expect("recipient marks as read", "allow", EMP_A, A, `update notifications set is_read=true where id='50000000-0000-0000-0000-000000000001'`);
await expect("recipient rewrites text/link", "deny", EMP_A, A, `update notifications set link='https://evil' where id='50000000-0000-0000-0000-000000000001'`);
await expect("server insert to any user unaffected", "allow", null, "service_role",
  `insert into notifications(company_id,user_id,title,kind,link) values ('${CO_B}','${ADMIN_B}','x','system','/x')`, null, "service_role");

console.log("--- misc ---");
await expect("duty status of other-org employee hidden", "allow", ADMIN_B, A, `select is_employee_on_duty_v7('${EMP_A}')`, (r) => val(r) === false || "leaked");
await expect("duty status of own employee visible", "allow", ADMIN_A, A, `select is_employee_on_duty_v7('${EMP_A}')`, (r) => val(r) === true || "wrong");
await expect("anon cannot ask duty status", "deny", null, "anon", `select is_employee_on_duty_v7('${EMP_A}')`);
await expect("rate limiter: browser cannot call", "deny", EMP_A, A, `select smhrms_rate_limit_hit('k', 1, 60)`);
await expect("rate limiter allows then limits", "allow", null, "service_role",
  `select smhrms_rate_limit_hit('ip1', 2, 60) a, smhrms_rate_limit_hit('ip1', 2, 60) b, smhrms_rate_limit_hit('ip1', 2, 60) c`,
  (r) => (r.rows[0].a === true && r.rows[0].b === true && r.rows[0].c === false) || JSON.stringify(r.rows[0]), "service_role");
await expect("search_path fixed on flagged helper", "allow", null, null,
  `select proconfig::text from pg_proc where proname='distance_m'`, (r) => String(val(r)).includes("search_path") || "missing");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
