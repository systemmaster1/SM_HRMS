// Phase 5 database tests: task extension approvals (embedded PostgreSQL via PGlite).
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mig = (f) => fs.readFileSync(`${root}/supabase/migrations/${f}`, "utf8");
const db = new PGlite();

const CO_A = "10000000-0000-0000-0000-00000000000a";
const CO_B = "10000000-0000-0000-0000-00000000000b";
const OWNER_A = "00000000-0000-0000-0000-00000000000a";
const ADMIN_A = "00000000-0000-0000-0000-0000000000a1";
const MGR_A = "00000000-0000-0000-0000-0000000000a2";
const EMP_A = "00000000-0000-0000-0000-0000000000a3";
const EMP2_A = "00000000-0000-0000-0000-0000000000a4";
const ADMIN_B = "00000000-0000-0000-0000-0000000000b1";
const D = "60000000-0000-0000-0000-000000000001";
const X = "61000000-0000-0000-0000-000000000001";

await db.exec(`
create role authenticated nologin; create role anon nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub',
                         current_setting('request.jwt.claim.sub', true)),'')::uuid $$;
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
grant usage on schema public to authenticated, anon, service_role;
create table public.companies(id uuid primary key, name text, owner_id uuid, account_status text default 'active', created_at timestamptz default now());
create table public.profiles(id uuid primary key, company_id uuid, role text, status text default 'active', full_name text default '',
  manager_id uuid, work_manager_id uuid, field_manager_id uuid, email text, phone text, access_permissions jsonb default '{}');
create function public.my_company_id() returns uuid language sql stable security definer set search_path=public as $$ select company_id from profiles where id=auth.uid() $$;
create function public.is_company_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in ('owner','admin')) $$;
create table public.delegations(id uuid primary key, company_id uuid, title text, assigned_to uuid, assigned_by uuid, due_date date);
create table public.task_extensions(id uuid primary key default gen_random_uuid(), company_id uuid not null, delegation_id uuid not null,
  requested_by uuid not null, requested_date date not null, requested_time time, reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid, decided_at timestamptz, created_at timestamptz not null default now());
alter table public.task_extensions enable row level security;
create policy extensions_company on public.task_extensions for all using (company_id = my_company_id());
grant all on all tables in schema public to authenticated, anon, service_role;
insert into companies(id,name,owner_id) values ('${CO_A}','A','${OWNER_A}'),('${CO_B}','B',null);
insert into profiles(id,company_id,role,manager_id) values
 ('${OWNER_A}','${CO_A}','owner',null),('${ADMIN_A}','${CO_A}','admin',null),('${MGR_A}','${CO_A}','manager',null),
 ('${EMP_A}','${CO_A}','employee','${MGR_A}'),('${EMP2_A}','${CO_A}','employee','${MGR_A}'),('${ADMIN_B}','${CO_B}','admin',null);
insert into delegations(id,company_id,title,assigned_to,assigned_by,due_date) values ('${D}','${CO_A}','T','${EMP_A}','${MGR_A}',current_date);
`);
await db.exec(mig("20261004_p0_security_guards.sql"));
await db.exec(mig("20261008_p5_task_extension_guard.sql"));
await db.exec(mig("20261008_p5_task_extension_guard.sql"));

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
const req = `insert into task_extensions(id, company_id, delegation_id, requested_by, requested_date) values ('${X}','${CO_A}','${D}','${EMP_A}', current_date + 3);`;

await expect("assignee requests more time", "allow", EMP_A, A,
  `insert into task_extensions(company_id, delegation_id, requested_by, requested_date, status) values ('${CO_A}','${D}','${OWNER_A}', current_date + 2, 'approved')`,
  async () => { const r = await one(`select requested_by, status from task_extensions`); return (r.requested_by === EMP_A && r.status === "pending") || JSON.stringify(r); });
await expect("colleague requests time on someone else's task", "deny", EMP2_A, A,
  `insert into task_extensions(company_id, delegation_id, requested_by, requested_date) values ('${CO_A}','${D}','${EMP2_A}', current_date + 2)`);
await expect("assignee approves own request", "deny", EMP_A, A, `update task_extensions set status='approved' where id='${X}'`, null, req);
await expect("colleague approves", "deny", EMP2_A, A, `update task_extensions set status='approved' where id='${X}'`, null, req);
await expect("task sender approves (server sets decided_by)", "allow", MGR_A, A,
  `update task_extensions set status='approved', decided_by='${OWNER_A}' where id='${X}'`,
  async () => (await one(`select decided_by from task_extensions`)).decided_by === MGR_A || "decided_by spoofed", req);
await expect("admin rejects", "allow", ADMIN_A, A, `update task_extensions set status='rejected' where id='${X}'`, null, req);
await expect("decided request cannot be decided again", "deny", ADMIN_A, A, `update task_extensions set status='approved' where id='${X}'`, null,
  req + `update task_extensions set status='rejected' where id='${X}';`);
await expect("other-org admin cannot see/decide (0 rows)", "allow", ADMIN_B, A, `update task_extensions set status='approved' where id='${X}'`,
  async () => (await one(`select status from task_extensions`)).status === "pending" || "changed", req);
await expect("requester edits pending reason", "allow", EMP_A, A, `update task_extensions set reason='traffic' where id='${X}'`, null, req);
await expect("sender cannot rewrite requested date", "deny", MGR_A, A, `update task_extensions set requested_date=current_date+30 where id='${X}'`, null, req);
await expect("employee cannot delete", "deny", EMP_A, A, `delete from task_extensions where id='${X}'`, null, req);
await expect("admin deletes", "allow", ADMIN_A, A, `delete from task_extensions where id='${X}'`, null, req);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
