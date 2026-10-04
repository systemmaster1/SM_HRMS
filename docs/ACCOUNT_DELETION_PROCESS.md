# Account & data deletion — operating procedure

Public entry point (Google Play requirement): **https://hrms.systemmaster.in/delete-account** (opens without sign-in).
Privacy Policy sections 9–10 describe the same process. If this procedure changes, update both pages.

## Who can ask, and for what

| Requester | What can be deleted | Who decides |
|---|---|---|
| Employee | Their login and personal data | Their organization (data controller) + SystemMaster executes |
| Organization Owner | Any employee's login; the whole organization | Owner |
| Ex-employee (no login) | Same as employee | Organization; SystemMaster coordinates if the org is unreachable |

SM HRMS processes HR records on behalf of the employer. Attendance, payroll and statutory records may have to be kept by the employer for legal periods; those are **anonymised** rather than deleted when the employer asks to keep them.

## Steps (target: done within 30 days, acknowledged within 3 working days)

1. **Receive** — email to Connect@systemmaster.in (from the page) or a Help Desk ticket. Log it in the System Admin Help Desk with category *Account deletion*.
2. **Verify identity** — reply to the email address registered on the account (or confirm by OTP through the app). Never act on a request from a different address.
3. **Inform the organization** — send the Owner the request; they have 7 days to object only for records they must legally keep.
4. **Remove access immediately** (same day): Team → Remove employee (sets status *left*, bans login, stops tracking). Sign-out is enforced at the next request.
5. **Delete / anonymise** (service role, SQL editor):
   - Personal fields → `null`: phone, date of birth, address, city, state, pincode, bank fields, emergency contact, avatar; `full_name` → `Former employee <code>`; `email` → `deleted+<id>@invalid`.
   - Files: avatar, attendance selfies and employee documents under `<company_id>/<employee_id>/` in Storage.
   - GPS: raw `employee_location_history` older than the organization's retention, or all of it if the organization agrees.
   - Delete the Supabase Auth user (Admin API) so the email can sign up again.
   - Keep (anonymised): attendance totals, payroll figures, leave and task records needed by the employer.
6. **Whole organization** — System Admin → organization → *Permanently delete* (OTP-protected). This deletes all tenant data and auth users.
7. **Confirm** to the requester and the Owner by email; close the ticket with the date. Keep only the ticket (no personal data) as proof.

## Backups

Deleted data disappears from Supabase daily backups after their retention (7 days on Pro). Client-owned Google Sheet backups belong to the organization; tell the Owner to delete the rows there.

## Status

- [x] Public request page without login
- [x] Removal of access (Team → Remove)
- [x] Organization deletion (System Admin, OTP)
- [ ] One-click "anonymise employee" server action (planned; today step 5 is a manual SQL script run by SystemMaster)
