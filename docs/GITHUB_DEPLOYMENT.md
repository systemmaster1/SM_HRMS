# SM HRMS — GitHub + Supabase + Vercel deployment

## 1. Run database migration first
Open Supabase > SQL Editor and run:
`supabase/migrations/20260810_field_force_upgrade.sql`

Do not put your Supabase service-role key or database password in GitHub.

## 2. GitHub files
Replace the existing project with this upgraded project, or copy the changed files while preserving the same paths.
Important new files:
- `supabase/migrations/20260810_field_force_upgrade.sql`
- `src/components/PwaBootstrap.tsx`
- `src/components/ActiveVisitTracker.tsx`
- `public/sw.js`

Important changed files:
- `src/app/layout.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/field-visits/page.tsx`
- `src/lib/types.ts`

## 3. Vercel environment variables
Set only these browser-safe public values in Vercel Project > Settings > Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

If your existing project has additional server-only variables, keep them. Never prefix secrets with NEXT_PUBLIC.

## 4. Deploy
Push to the branch connected to Vercel. Vercel will build automatically.
Add domain: `hrms.systemmaster.in` in Vercel > Project > Settings > Domains.
Use the exact DNS record Vercel shows in Hostinger.

## 5. Mobile install (PWA)
On Android Chrome open `https://hrms.systemmaster.in`, sign in, and use the displayed **Install SM HRMS** prompt (or Chrome menu > Install app).
The app uses the same Supabase login/data as the web version.

## 6. Location tracking behavior
When an employee has an active visit, the installed PWA/web app records a GPS point about every 5 minutes while the app is active and again when it becomes visible.
For guaranteed tracking while the phone is locked or Android has killed Chrome/PWA, a native Android foreground-location service is still required. Do not claim browser/PWA tracking is guaranteed in that state.
