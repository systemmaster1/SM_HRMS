# Play Store release gate

Internal Testing may be recommended only when every gate is PASS (or a blocker is explicitly documented and accepted). Production requires a successful Internal Testing round first.

_Last updated: 4 Oct 2026 · branch `hardening/phase-1-2-audit-p0`_

| # | Gate | Status | Evidence / next step |
|---|---|---|---|
| 1 | P0 security issues = 0 | **OPEN** | Code P0s fixed on branch; DB guards need production migration (OWNER A4) |
| 2 | Known cross-tenant leaks = 0 | **NEEDS LIVE TEST** | Run `docs/sql/02_live_tenant_isolation_test.sql` (OWNER A2) |
| 3 | Production web build | PASS (branch) | `tsc` + `next build` pass locally; CI on PR |
| 4 | Android signed build | **NEEDS ANDROID BUILD** | Run workflow on branch (OWNER A6) |
| 5 | Core workflow tests | **NEEDS LIVE E2E TEST** | `docs/RELEASE_TEST_MATRIX.md` (Phase 3) |
| 6 | Background location tests | **BLOCKED ON DECISION** | OWNER A7, then real-device test |
| 7 | Privacy behaviour matches app | **OPEN** | Disclosure text added in app; Privacy Policy + Data Safety must be aligned after A7 |
| 8 | Account deletion process exists | PARTIAL | Public page fixed (was login-protected). Operational workflow (request intake, identity check, deletion/anonymisation, confirmation) still to document |
| 9 | Official branding installed | **OPEN** | No approved launcher/Play icon in repo |
| 10 | Critical email/notification flows tested | **NEEDS LIVE TEST** | Android 13 notification permission now requested |
| 11 | Crash / blocking bugs = 0 | **OPEN** | Location permission blocker fixed in code, not yet device-tested |
| 12 | App Links verified | **OPEN** | `assetlinks.json` placeholder (OWNER A8) |

**Current verdict: NOT READY for Internal Testing.**
