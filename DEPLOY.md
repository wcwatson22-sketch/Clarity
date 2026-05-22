# Clarity Finance — Deployment Guide

Deploy Clarity to a single Ubuntu 22.04 VPS with Caddy + SQLite.
Estimated cost: **$6–12/month**. Estimated first-deploy time: **~1 hour**.

---

## Before You Start

You need four things from outside the repo (see `MANUAL_GO_LIVE_STEPS.md`):
1. A domain name
2. A VPS with Ubuntu 22.04 and your SSH key added
3. A [Resend](https://resend.com) API key (email)
4. A [Stripe](https://dashboard.stripe.com) account with a product + price created

Your server needs nothing pre-installed — `server-setup.sh` handles everything.

---

## Step 1 — Fill in `scripts/deploy.conf`

Open `scripts/deploy.conf` and set your three values:

```bash
DOMAIN="clarityfinancialtools.com"      # ← your real domain
SERVER_IP="1.2.3.4"          # ← your VPS public IP
SERVER_USER="root"           # ← SSH user (usually root on fresh VPS)
```

That's the only file you edit in the repo.

---

## Step 2 — Run Server Setup (once)

From your local machine, in the repo root:

```bash
bash scripts/server-setup.sh
```

This SSHes into your VPS and installs:
- .NET 9 runtime
- Caddy web server
- SQLite CLI
- Application directories (`/opt/clarity-api`, `/var/www/clarity`, `/etc/clarity`)
- Daily 3am backup cron

It also copies `scripts/env.template` to `/etc/clarity/env` on the server with your domain pre-filled.

---

## Step 3 — Fill in Secrets on the Server

SSH into your server:

```bash
ssh root@<YOUR_SERVER_IP>
sudo nano /etc/clarity/env
```

Fill in every `REPLACE_ME` value:

```bash
Jwt__Key=<run: openssl rand -base64 48>
Smtp__Password=<your Resend API key>
Stripe__SecretKey=sk_test_<your key>
Stripe__PremiumPriceId=price_<your price ID>
# Leave Stripe__WebhookSecret for now — add after first deployment
```

Save and exit (`Ctrl+X → Y → Enter`). The file is already `chmod 600` from setup.

---

## Step 4 — Deploy

Back on your local machine:

```bash
bash scripts/deploy.sh
```

This will:
1. Build the Angular frontend (`ng build --configuration production`)
2. Publish the .NET backend (`dotnet publish -c Release`)
3. SCP both to the server
4. Deploy the systemd service file and start the API
5. Deploy the Caddyfile with your domain and reload Caddy
6. Run a health check and print the result

Caddy automatically obtains and renews a TLS certificate from Let's Encrypt. HTTPS is live within ~30 seconds of the first deployment.

---

## Step 5 — Register Stripe Webhook

After the app is live:

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
   - URL: `https://clarityfinancialtools.com/api/payments/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`
3. After creating it, click the endpoint → **Reveal signing secret** → copy `whsec_...`

SSH into server and add it:
```bash
sudo nano /etc/clarity/env
# Add:  Stripe__WebhookSecret=whsec_...
sudo systemctl restart clarity-api
```

---

## Step 6 — Smoke Test

Follow `SMOKE_TEST.md`. All sections 1–10 must pass before announcing publicly.

Quick sanity check:
```bash
curl https://clarityfinancialtools.com/healthz     # should return 200
curl https://clarityfinancialtools.com/readyz      # should return 200
```

---

## Subsequent Deployments

Every time you push code changes:

```bash
bash scripts/deploy.sh
```

The script stops the service, ships new files, restarts, and health-checks automatically.

---

## Useful Server Commands

```bash
# Live API logs
sudo journalctl -u clarity-api -f

# Last 50 log lines
sudo journalctl -u clarity-api -n 50

# Service status
sudo systemctl status clarity-api

# Restart after config change
sudo systemctl restart clarity-api

# Manual database backup
sudo -u www-data bash /opt/clarity-api/scripts/backup.sh

# Restore from a backup
sudo bash /opt/clarity-api/scripts/restore.sh /opt/clarity-backups/clarity_YYYYMMDD_HHMMSS.db
```

---

## Database

SQLite lives at `/opt/clarity-api/clarity.db`.

The daily backup cron (installed by `server-setup.sh`) creates timestamped copies in `/opt/clarity-backups/` and prunes files older than 30 days.

> SQLite is fine for an MVP with hundreds of users. Migrate to PostgreSQL when you need multiple server instances or expect thousands of concurrent users.

---

## File Reference

| File | Purpose |
|------|---------|
| `scripts/deploy.conf` | Your domain, server IP, SSH user — **edit this** |
| `scripts/env.template` | Template for `/etc/clarity/env` on server — fill in secrets |
| `scripts/server-setup.sh` | One-time VPS setup — run once |
| `scripts/deploy.sh` | Build + deploy — run every release |
| `scripts/clarity-api.service` | systemd unit file — auto-deployed by deploy.sh |
| `scripts/Caddyfile.template` | Caddy config template — auto-deployed by deploy.sh |
| `scripts/backup.sh` | SQLite backup — runs via cron, can run manually |
| `scripts/restore.sh` | Restore from a backup file |
| `scripts/generate-icons.html` | Open in browser to generate PWA icons |
| `MANUAL_GO_LIVE_STEPS.md` | Outside-repo tasks (domain, VPS, Resend, Stripe) |
| `VALUES_TO_PROVIDE.md` | Reference sheet for gathering all required values |
| `SMOKE_TEST.md` | Post-deploy checklist |
| `PRODUCTION_CHECKLIST.md` | Full phase-by-phase pre-launch checklist |
