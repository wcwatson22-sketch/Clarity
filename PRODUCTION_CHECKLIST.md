# Clarity Finance — Production Checklist

Run through this list top-to-bottom before announcing the app publicly.
Check each box as you complete it. Items marked 🔑 require secrets/credentials you supply.

---

## Phase 1 — Server Setup

- [ ] VPS provisioned (Ubuntu 22.04+, minimum 1GB RAM)
- [ ] Domain A record pointed at server IP (allow 5–30 min to propagate)
- [ ] SSH access confirmed
- [ ] .NET 9 runtime installed (`dotnet --version` shows 9.x)
- [ ] Caddy installed and running (`systemctl status caddy`)
- [ ] Backup directory created: `sudo mkdir -p /opt/clarity-backups && sudo chown www-data:www-data /opt/clarity-backups`

---

## Phase 2 — Secrets & Config

- [ ] 🔑 JWT secret generated: `openssl rand -base64 48` → saved as `Jwt__Key` in `/etc/clarity/env`
- [ ] 🔑 Resend API key created at resend.com → saved as `Smtp__Password` in `/etc/clarity/env`
- [ ] 🔑 Resend domain verified (or sandbox domain confirmed working)
- [ ] 🔑 Stripe account created, product + price set up → `Stripe__PremiumPriceId` saved
- [ ] 🔑 Stripe secret key (test or live) → `Stripe__SecretKey` saved
- [ ] `/etc/clarity/env` permissions: `chmod 600 /etc/clarity/env && chown root:root /etc/clarity/env`
- [ ] `ASPNETCORE_ENVIRONMENT=Production` is set in `/etc/clarity/env`

---

## Phase 3 — Code Config (done in repo)

- [ ] `appsettings.Production.json` — `AppUrl` updated to your real domain
- [ ] `appsettings.Production.json` — `AllowedOrigins` updated to your real domain
- [ ] `appsettings.Production.json` — `Smtp.FromEmail` updated to your domain (e.g. `noreply@clarityfinancialtools.com`)
- [ ] `.gitignore` confirms `*.db` is excluded (database never committed)
- [ ] `.gitignore` confirms `appsettings.Production.json` is NOT excluded (it only has non-secret values)

---

## Phase 4 — Build & Deploy

- [ ] Frontend built: `cd frontend && npm install && npx ng build --configuration production`
- [ ] Frontend dist copied to server: `scp -r dist/clarity-frontend/browser/ user@SERVER:/var/www/clarity/`
- [ ] Backend published: `cd backend/Clarity.Api && dotnet publish -c Release -o /tmp/clarity-publish`
- [ ] Backend copied to server: `scp -r /tmp/clarity-publish user@SERVER:/opt/clarity-api/`
- [ ] systemd service file created at `/etc/systemd/system/clarity-api.service` (see DEPLOY.md §6)
- [ ] Service enabled and started: `systemctl enable clarity-api && systemctl start clarity-api`
- [ ] Service is running: `systemctl status clarity-api` shows `active (running)`

---

## Phase 5 — Caddy & HTTPS

- [ ] Caddyfile configured with your real domain (see DEPLOY.md §7)
- [ ] Caddy reloaded: `systemctl reload caddy`
- [ ] HTTPS cert issued automatically — verify: `https://clarityfinancialtools.com` loads without warnings
- [ ] HTTP redirects to HTTPS (Caddy does this automatically)

---

## Phase 6 — Stripe Webhook

- [ ] 🔑 Webhook endpoint registered in Stripe Dashboard: `https://clarityfinancialtools.com/api/payments/webhook`
- [ ] Events selected: `checkout.session.completed` + `customer.subscription.deleted`
- [ ] 🔑 Webhook signing secret (`whsec_...`) saved as `Stripe__WebhookSecret` in `/etc/clarity/env`
- [ ] Backend restarted after adding webhook secret: `systemctl restart clarity-api`

---

## Phase 7 — Smoke Test

Run through SMOKE_TEST.md after deployment. All items must pass.

- [ ] Health check passes: `curl https://clarityfinancialtools.com/healthz` returns `200 OK`
- [ ] Can register a new account
- [ ] Verification email received and link works
- [ ] Can log in after verification
- [ ] Dashboard loads with empty state (no seed data)
- [ ] Can add an asset and see net worth update
- [ ] Can add a budget item
- [ ] Upgrade modal appears when free-tier limit is hit
- [ ] Stripe checkout opens (test mode or live)
- [ ] Password reset email arrives and link works

---

## Phase 8 — Backup

- [ ] Cron job configured (see DEPLOY.md §10 or run `scripts/backup.sh`)
- [ ] Test backup manually: `sudo -u www-data sqlite3 /opt/clarity-api/clarity.db ".backup '/opt/clarity-backups/test.db'"` — verify file created
- [ ] Cron entry confirmed: `crontab -l -u www-data`

---

## Phase 9 — Before Announcing

- [ ] Swap Stripe keys from TEST → LIVE when ready for real payments
- [ ] Confirm `FromEmail` domain passes SPF/DKIM (check Resend dashboard)
- [ ] PWA icons placed in `frontend/src/icons/` and app reinstalled on mobile to confirm
- [ ] Error monitoring considered (Sentry free tier — optional but recommended)
- [ ] Review rate-limit settings in `Program.cs` if expecting traffic spike at launch

---

## Quick Reference: Restart Commands

```bash
# Restart backend (after config/code changes)
sudo systemctl restart clarity-api

# Check backend logs (live)
sudo journalctl -u clarity-api -f

# Reload Caddy (after Caddyfile changes)
sudo systemctl reload caddy

# Check backend health
curl https://clarityfinancialtools.com/healthz
```
