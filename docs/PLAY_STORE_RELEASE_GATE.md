# Play Store release gate

Internal Testing may be recommended only when every gate is PASS (or a blocker is explicitly documented and accepted). Production requires a successful Internal Testing round first.

_Last updated: 4 Oct 2026 · branch `hardening/phase-1-2-audit-p0`_

| # | Gate | Status | Evidence / next step |
|---|---|---|---|
| 1 | P0 security issues = 0 | **OPEN** | DB P0 fixed in production; web/Android fixes need PR merge + device test |
| 2 | Known cross-tenant leaks = 0 | PASS (catalog + privilege-escalation live test) | Storage logo overwrite across orgs fixed by p0b migration (to apply) |
| 3 | Production web build | PASS (branch) | `tsc` + `next build` pass locally; CI on PR |
| 4 | Android signed build | PASS (CI run 37146841623) | Real-device test pending |
| 5 | Core workflow tests | **NEEDS LIVE E2E TEST** | `docs/RELEASE_TEST_MATRIX.md` (Phase 3) |
| 6 | Background location tests | **BLOCKED ON DECISION** | OWNER A7, then real-device test |
| 7 | Privacy behaviour matches app | **OPEN** | Disclosure text added in app; Privacy Policy + Data Safety must be aligned after A7 |
| 8 | Account deletion process exists | PARTIAL | Public page fixed (was login-protected). Operational workflow (request intake, identity check, deletion/anonymisation, confirmation) still to document |
| 9 | Official branding installed | **OPEN** | No approved launcher/Play icon in repo |
| 10 | Critical email/notification flows tested | **NEEDS LIVE TEST** | Android 13 notification permission now requested |
| 11 | Crash / blocking bugs = 0 | **OPEN** | Location permission blocker fixed in code, not yet device-tested |
| 12 | App Links verified | **OPEN** | `assetlinks.json` placeholder (OWNER A8) |

**Current verdict: NOT READY for Internal Testing.**
