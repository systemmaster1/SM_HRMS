// Phase 4 database tests: ownership transfer (embedded PostgreSQL via PGlite).
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
const ADMIN2_A = "00000000-0000-0000-0000-0000000000a5";
const OFFADMIN_A = "00000000-0000-0000-0000-0000000000a9";
const OWNER_B = "00000000-0000-0000-0000-00000000000b";
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

create table public.companies(id uuid primary key, name text, owner_id uuid, account_status text not null default 'active', city text default '', created_at timestamptz default now());
create table public.profiles(id uuid primary key, company_id uuid, role text, status text default 'active', full_name text default '',
  manager_id uuid, work_manager_id uuid, field_manager_id uuid, branch_id uuid, email text, phone text,
  access_permissions jsonb default '{}', must_change_password boolean default false, left_at timestamptz);
create table public.audit_logs(id uuid primary key default gen_random_uuid(), company_id uuid, actor_id uuid, actor_label text,
  action text not null, entity text not null, entity_key text, old_value jsonb, new_value jsonb, created_at timestamptz default now());
create table public.notifications(id uuid primary key default gen_random_uuid(), company_id uuid not null, user_id uuid not null,
  title text not null, body text default '', kind text not null default 'info', link text default '', is_read boolean not null default false,
  created_at timestamptz not null default now());
create function public.my_company_id() returns uuid language sql stable security definer set search_path=public as $$ select company_id from profiles where id=auth.uid() $$;
create function public.is_company_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in ('owner','admin')) $$;
alter table public.companies enable row level security;
create policy c_sel on companies for select using (id = my_company_id());
create policy c_upd on companies for update using (id = my_company_id() and is_company_admin());
grant all on all tables in schema public to authenticated, anon, service_role;

insert into companies(id,name,owner_id) values ('${CO_A}','Org A','${OWNER_A}'),('${CO_B}','Org B','${OWNER_B}');
insert into profiles(id,company_id,role,status,full_name) values
 ('${OWNER_A}','${CO_A}','owner','active','Olivia'), ('${ADMIN_A}','${CO_A}','admin','active','Arun'),
 ('${MGR_A}','${CO_A}','manager','active','Meena'), ('${ADMIN2_A}','${CO_A}','admin','active','Asha'),
 ('${OFFADMIN_A}','${CO_A}','admin','disabled','Old'),
 ('${OWNER_B}','${CO_B}','owner','active','Ben'), ('${ADMIN_B}','${CO_B}','admin','active','Bo');
`);
await db.exec(mig("20261004_p0_security_guards.sql"));
await db.exec(mig("20261007_p4_ownership_transfer.sql"));
await db.exec(mig("20261007_p4_ownership_transfer.sql")); // re-runnable

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
const A = "authenticated", S = "service_role";
const one = async (q) => (await db.query(q)).rows[0];
const T = "80000000-0000-0000-0000-000000000001";
const pending = (to = ADMIN_A, extra = "") =>
  `insert into ownership_transfers(id, company_id, from_user, to_user${extra ? ", expires_at" : ""}) values ('${T}','${CO_A}','${OWNER_A}','${to}'${extra ? ", " + extra : ""});`;

console.log("--- initiate ---");
await expect("owner proposes an active admin", "allow", null, S, `select (ownership_transfer_initiate('${OWNER_A}','${ADMIN_A}','handover')).status s`,
  async (r) => {
    if (r.rows[0].s !== "pending") return r.rows[0].s;
    const n = await one(`select count(*)::int c from notifications where user_id='${ADMIN_A}'`);
    const a = await one(`select count(*)::int c from audit_logs where action='ownership_transfer_requested'`);
    return (n.c === 1 && a.c === 1) || JSON.stringify({ n, a });
  });
await expect("admin cannot initiate", "deny", null, S, `select ownership_transfer_initiate('${ADMIN_A}','${ADMIN2_A}','')`);
await expect("owner cannot propose a manager", "deny", null, S, `select ownership_transfer_initiate('${OWNER_A}','${MGR_A}','')`);
await expect("owner cannot propose a disabled admin", "deny", null, S, `select ownership_transfer_initiate('${OWNER_A}','${OFFADMIN_A}','')`);
await expect("owner cannot propose another org's admin", "deny", null, S, `select ownership_transfer_initiate('${OWNER_A}','${ADMIN_B}','')`);
await expect("owner cannot propose self", "deny", null, S, `select ownership_transfer_initiate('${OWNER_A}','${OWNER_A}','')`);
await expect("only one pending request per organization", "deny", null, S, `select ownership_transfer_initiate('${OWNER_A}','${ADMIN2_A}','')`, null, pending());
await expect("expired pending request does not block a new one", "allow", null, S, `select ownership_transfer_initiate('${OWNER_A}','${ADMIN2_A}','')`,
  async () => (await one(`select status from ownership_transfers where id='${T}'`)).status === "expired" || "not expired",
  pending(ADMIN_A, "now() - interval '1 minute'"));
await expect("browser cannot call initiate RPC", "deny", OWNER_A, A, `select ownership_transfer_initiate('${OWNER_A}','${ADMIN_A}','')`);
await expect("browser cannot insert a transfer row", "deny", OWNER_A, A, pending());

console.log("--- accept ---");
await expect("proposed admin accepts: atomic role swap", "allow", null, S, `select (ownership_transfer_accept('${ADMIN_A}','${T}')).status s`,
  async (r) => {
    const roles = await db.query(`select id, role from profiles where id in ('${OWNER_A}','${ADMIN_A}') order by id`);
    const c = await one(`select owner_id from companies where id='${CO_A}'`);
    const owners = await one(`select count(*)::int c from profiles where company_id='${CO_A}' and role='owner'`);
    const ok = r.rows[0].s === "accepted" && c.owner_id === ADMIN_A && owners.c === 1
      && roles.rows.find((x) => x.id === OWNER_A).role === "admin" && roles.rows.find((x) => x.id === ADMIN_A).role === "owner";
    const notes = await one(`select count(*)::int c from notifications`);
    return (ok && notes.c === 2) || JSON.stringify({ roles: roles.rows, c, owners, notes });
  }, pending());
await expect("someone else cannot accept", "deny", null, S, `select ownership_transfer_accept('${ADMIN2_A}','${T}')`, null, pending());
await expect("expired request cannot be accepted", "deny", null, S, `select ownership_transfer_accept('${ADMIN_A}','${T}')`, null,
  pending(ADMIN_A, "now() - interval '1 minute'"));
await expect("accept refused if target was demoted meanwhile", "deny", null, S, `select ownership_transfer_accept('${ADMIN_A}','${T}')`, null,
  pending() + `update profiles set role='manager' where id='${ADMIN_A}';`);
await expect("accepted request cannot be accepted twice", "deny", null, S,
  `select ownership_transfer_accept('${ADMIN_A}','${T}')`, null, pending() + `select ownership_transfer_accept('${ADMIN_A}','${T}');`);
await expect("browser cannot call accept RPC", "deny", ADMIN_A, A, `select ownership_transfer_accept('${ADMIN_A}','${T}')`, null, pending());

console.log("--- cancel / decline ---");
await expect("owner cancels", "allow", null, S, `select (ownership_transfer_cancel('${OWNER_A}','${T}')).status s`,
  (r) => r.rows[0].s === "cancelled" || r.rows[0].s, pending());
await expect("proposed admin declines", "allow", null, S, `select (ownership_transfer_cancel('${ADMIN_A}','${T}')).status s`,
  (r) => r.rows[0].s === "declined" || r.rows[0].s, pending());
await expect("unrelated admin cannot cancel", "deny", null, S, `select ownership_transfer_cancel('${ADMIN2_A}','${T}')`, null, pending());

console.log("--- visibility & integrity ---");
await expect("proposed admin sees the request", "allow", ADMIN_A, A, `select count(*)::int c from ownership_transfers`,
  (r) => r.rows[0].c === 1 || r.rows[0].c, pending());
await expect("manager does not see the request", "allow", MGR_A, A, `select count(*)::int c from ownership_transfers`,
  (r) => r.rows[0].c === 0 || r.rows[0].c, pending());
await expect("other org does not see the request", "allow", OWNER_B, A, `select count(*)::int c from ownership_transfers`,
  (r) => r.rows[0].c === 0 || r.rows[0].c, pending());
await expect("browser cannot update a transfer row", "deny", ADMIN_A, A, `update ownership_transfers set status='accepted' where id='${T}'`,
  null, pending());
await expect("admin cannot write companies.owner_id", "deny", ADMIN_A, A, `update companies set owner_id='${ADMIN_A}' where id='${CO_A}'`);
await expect("admin can still edit other company fields", "allow", ADMIN_A, A, `update companies set city='Pune' where id='${CO_A}'`);
await expect("second owner in one organization is impossible", "deny", null, S, `update profiles set role='owner' where id='${ADMIN2_A}'`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
