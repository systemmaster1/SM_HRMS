# SM HRMS

**Empowering People. Optimizing Talent.**
Multi-company HRMS by SystemMaster Automations.

Next.js 14 · Supabase · Tailwind CSS

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Notes |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret. Server-only. Never commit. |

## Features
- Self-serve sign-up + organization onboarding, 7-day trial
- Multi-tenant: each company's data fully isolated (RLS)
- Team management: admin creates member accounts (email + password)
- Reporting manager hierarchy
- Sign in with **email or mobile number**
- Password recovery: employees via admin/manager; owners via email OTP
- Attendance, Leave approvals, Tasks, GPS field visits
- Company logo upload, organization details, live billing (₹99/user/month)

## Roles
Owner → Admin → Manager → Employee
