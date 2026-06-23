# Clarity Financial Tools — Security Documentation

> Living document. Describes the production architecture, data inventory, endpoint
> inventory, incident-response plan, penetration-test prep, and the pre-deploy
> security checklist. It states only controls that have been **verified**; it does
> not claim "fully secure", "bank-level", or "end-to-end encrypted".

## 1. Architecture

| Layer | Detail |
|---|---|
| Public marketing site | Angular SPA, static files served by **Caddy** from `/var/www/clarity` |
| Authenticated web app | Same Angular SPA (auth-guarded routes) |
| Native app | Capacitor (iOS) wrapping the same Angular build; anchored at login/dashboard |
| Backend API | ASP.NET Core 9 (Kestrel), systemd service `clarity-api`, runs as **www-data** |
| Kestrel bind | **127.0.0.1:5000** only (never public) |
| Reverse proxy / TLS | **Caddy** terminates TLS (Let's Encrypt, auto-renew), proxies `/api`→127.0.0.1:5000 |
| Database | **SQLite** file `/opt/clarity-api/clarity.db` (perms 600, www-data) |
| File storage | None (featured-image is a URL field; no uploads yet) |
| Email | **Resend** API (key in env) |
| Payments | **Stripe** (web), **Apple StoreKit/IAP** (iOS) |
| Analytics | Google Analytics (web only; no financial values) + privacy-safe `dataLayer` Learn events |
| Secrets | `/etc/clarity/env` (root-only 600) + Codemagic encrypted env (CI) |
| Host | DigitalOcean droplet, Ubuntu 22.04 LTS, `ufw` (22/80/443), `fail2ban` active |
| Deploy | `backend/deploy.sh`→`remote-apply.sh` (preflight, chown www-data, health-check, rollback); frontend via scp + `chmod -R a+rX` |
| Admin access | SSH as root with key `clarity_deploy`; app admin via `User.IsAdmin`→JWT `role=admin` |

**TLS termination:** Caddy (edge). App↔API is same-host loopback (127.0.0.1).

## 2. Data inventory

| Data | Collected | Stored | Transmitted | Cached (client) | Logged | Backed up | Deleted on account delete |
|---|---|---|---|---|---|---|---|
| Email, Username, Name, Age, City/State | signup | Users table | HTTPS | localStorage `clarity_user` | minimized | yes | yes |
| Income / expenses / budgets / assets / liabilities / DTI / net worth | app forms | per-user tables (UserId-scoped) | HTTPS | component state only | **never** | yes | yes |
| Spouse income, retirement contributions | Cash Flow | **localStorage only**, per-user keys (`__u<id>`) | n/a | yes (scoped) | never | no (device-local) | n/a (device-local) |
| Real-estate property data | Real Estate tab | RealEstateProperties (UserId) | HTTPS | component state | never | yes | yes |
| Snapshots | Dashboard | Snapshots (UserId) | HTTPS | component state | never | yes | yes |
| Support / Learn submissions | forms | emailed to support inbox (not stored in DB) | HTTPS | none | type/id only | n/a | n/a |
| Subscription status | Stripe/Apple | Users.Tier + provider IDs | HTTPS | localStorage `clarity_user` | minimized | yes | yes (mapping) |
| Auth/session (JWT) | login | client only | HTTPS | localStorage `clarity_token` | never | no | cleared on logout |

**Not collected / must never be collected:** bank/brokerage credentials, third-party passwords, SSNs, full account numbers, card numbers, CVV, security-question answers. No data collected is unnecessary; all fields map to a displayed metric.

## 3. Endpoint inventory & intended classification

| Endpoint | Classification | Enforced by |
|---|---|---|
| `GET /api/status` | Public | none (health) |
| `GET /api/learn/articles`, `/articles/{slug}`, `/sitemap.xml` | Public | published-only filter |
| `POST /api/learn/submissions` | Public (rate-limited 3/10min,10/24h) | honeypot + validation |
| `POST /api/auth/{signup,login,refresh,forgot-*,reset-password,verify-email}` | Public | rate-limited "auth" 10/min |
| `GET/POST/PUT/DELETE /api/{accounts,budget,income,snapshots,real-estate}` | Authenticated user | `[Authorize]` + `UserId` scoping |
| `PUT /api/profile`, `POST /api/profile/complete-setup`, `DELETE /api/profile/me`, `POST /api/profile/change-password` | Authenticated user | `[Authorize]` + UserId |
| `POST /api/payments/{create-checkout,verify-iap,restore-iap}` | Authenticated user | `[Authorize]` |
| `POST /api/payments/webhook` | Public (Stripe) | **Stripe signature verification** |
| `POST /api/payments/dev-upgrade` | Dev only | `404` unless `IsDevelopment()` |
| `/api/admin/learn/articles/*` | Admin | `[Authorize(Policy="AdminOnly")]` (role=admin) |
| `/api/admin/*` (roster) | Admin | `adminGuard` + AdminOnly |
| `/api/support/message` | Authenticated user | `[Authorize]` |

Every user-owned read/update/delete uses `WHERE Id = id AND UserId = authenticatedUserId`; create server-assigns `UserId` from the JWT (client-supplied owner ignored). Verified by `backend/scripts/cross-account-test.sh`.

## 4. Incident-response plan (lightweight)

1. **Report intake:** security reports go to the verified support address (`clarityfinancialtools@gmail.com`). (`security@` only if/when that mailbox is monitored.)
2. **Contain / disable access:** rotate `Jwt__Key` in `/etc/clarity/env` + restart `clarity-api` → invalidates **all** outstanding JWTs (forces re-login). For a single account, set a flag / reset password.
3. **Revoke tokens:** JWTs are stateless; rotating `Jwt__Key` is the global revocation lever. Document time of rotation.
4. **Rotate secrets:** update the affected key in `/etc/clarity/env` (and Codemagic env for CI secrets) and restart. Never commit secrets.
5. **Preserve logs:** `journalctl -u clarity-api > /root/incident-<date>.log`; snapshot the droplet before remediation if feasible.
6. **Identify affected records/users:** query by `UserId`/timestamps in SQLite (read-only); never print financial values into shared channels.
7. **Protect backups:** confirm backup integrity; restrict access; do not overwrite known-good backups.
8. **Notification decision:** owner (Clearpath Digital LLC) decides; notify affected users + authorities as legally required.
9. **Deploy & verify fix:** via `backend/deploy.sh` (health-checked, auto-rollback); run the security checklist (§6).
10. **Post-incident review:** root cause, timeline, fix, prevention — recorded in this repo under `docs/incidents/`.

## 5. Penetration-test preparation

- **Scope (recommended):** authenticated web app + API (horizontal authZ / BOLA, account takeover, admin authZ, business-logic/premium-bypass), server/reverse-proxy config, mobile app (token storage, transport). 
- **Test accounts:** create User A, User B, and one Admin in a **staging** copy (do not test destructive flows on prod). `backend/scripts/cross-account-test.sh` provisions/cleans throwaway users.
- **Data-flow & auth flow:** see §1–§3; JWT bearer auth (no cookies → no CSRF surface), 7-day(?) expiry, `role=admin` claim from `User.IsAdmin`.
- **Excluded third parties:** Stripe, Apple, Resend, Google Analytics, DigitalOcean, Let's Encrypt (test only Clarity's integration points, not the providers).
- **Known limitations:** SQLite single-file DB; at-rest disk encryption not enabled (see §6); rate limits are in-memory/per-process.
- **Safe window / escalation:** coordinate a window with the owner; escalate via the support address. **No DoS/brute-force/destructive testing against production.**
- An independent qualified tester must perform the actual assessment — this document is preparation only, not a completed pentest.

## 6. Pre-deploy security checklist (release gate)

Run before every production deploy (see `backend/scripts/security-gate.sh`):

- [ ] Cross-account authorization tests pass (`cross-account-test.sh` against staging)
- [ ] Admin authorization holds (anon/regular → 401/403 on `/api/admin/*`)
- [ ] No secrets in the diff / tree (grep for `sk_live`,`whsec_`,`-----BEGIN`,`re_[A-Za-z0-9]{20}`)
- [ ] `dotnet list package --vulnerable` and `npm audit --omit=dev` reviewed; no new critical/high without a documented compensating control
- [ ] Production build succeeds; frontend `npx ng test` passes
- [ ] DB migration reviewed; backup taken before migration
- [ ] HTTPS + HTTP→HTTPS redirect verified; security headers present
- [ ] CORS origins correct; no `AllowAnyOrigin`
- [ ] No financial values in logs/analytics
- [ ] Account switching tested (User A → logout → User B shows nothing of A)
- [ ] Backup succeeded; health check returns 200 after deploy

## 7. Verified controls (as of 2026-06-23)

TLS in transit (Let's Encrypt, HSTS, HTTP→HTTPS 308); BCrypt password hashing; bearer-token auth (no cookie/CSRF surface); per-user backend authorization on all user-owned entities; security headers (CSP/HSTS/X-Frame/X-Content-Type/Referrer); env secrets root-only 600; Kestrel loopback-only; ufw + fail2ban; 0 financial values in recent logs.

**Not verified / open:** disk encryption at rest (NOT enabled — SQLite on unencrypted ext4); SSH password auth + root login still enabled; Angular framework has open XSS/DoS advisories pending a within-major update; Apple IAP requires `Apple__AscPrivateKeyB64` in prod env to verify receipts (now fails closed without it).
