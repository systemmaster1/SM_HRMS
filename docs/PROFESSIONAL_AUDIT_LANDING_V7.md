# SM HRMS — Professional Audit & Landing Upgrade

## What I verified in the uploaded project
Existing modules/routes include Dashboard, Attendance, Leave, Payroll, Tasks, Field Visits, Field Reports, EM Report, Team, Directory, Organization, Help Desk, Holidays, Policies, Export, Integrations, Settings and Profile.

The project already contains a PWA manifest, service worker bootstrap and install prompt component.

## Landing upgrade
FULL REPLACE:
- src/components/LandingPage.tsx

This upgrade adds:
- Direct PWA install CTA when the browser exposes the install prompt.
- Android/iPhone install guidance fallback.
- Stronger "one app / one source of truth" positioning.
- Management trust section.
- Connected workflow feature matrix.
- Field-sales / live-operations positioning.
- No fake Play Store download claim.

## Important before promising "100% trust"
No software should market employee GPS as infallible. Web/PWA tracking can be affected by OS background restrictions, revoked permissions, battery optimization, network loss and GPS availability.

For enterprise-grade production, still recommended:
1. Deploy the latest duty-only/server-timestamp tracking migration (v6) if it is not yet in this uploaded GitHub ZIP.
2. Add automated database backups + restore drills.
3. Add error monitoring and uptime monitoring.
4. Add audit-log retention policy and admin audit log.
5. Add Terms of Service / DPA / retention & deletion controls.
6. Add MFA for Owner/Admin when authentication stack supports it.
7. For reliable locked-screen/background GPS, build a native Android app/foreground location service rather than claiming the PWA can always track in background.
