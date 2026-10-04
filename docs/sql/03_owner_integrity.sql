-- Read-only: owner integrity per organization. Safe to run anytime.
-- Expected: no rows in (1) and (2). Rows in (3) are organizations without an Owner
-- (fix by hand with SystemMaster support: choose the right person, then
--  update profiles set role='owner' ... and companies.owner_id — never automatically).

-- (1) organizations with more than one owner
select company_id, count(*) owners, array_agg(id) owner_ids
from public.profiles where role = 'owner' group by company_id having count(*) > 1;

-- (2) companies.owner_id pointing to someone who is not that org's owner
select c.id, c.name, c.owner_id, p.role, p.company_id = c.id same_org
from public.companies c left join public.profiles p on p.id = c.owner_id
where c.owner_id is not null and (p.id is null or p.role <> 'owner' or p.company_id <> c.id);

-- (3) organizations with no owner
select c.id, c.name, c.org_code, c.owner_id
from public.companies c
where not exists (select 1 from public.profiles p where p.company_id = c.id and p.role = 'owner');

-- (4) pending ownership transfers
select id, company_id, from_user, to_user, created_at, expires_at
from public.ownership_transfers where status = 'pending';
