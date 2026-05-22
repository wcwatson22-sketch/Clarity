# Clarity Finance — Values to Provide

Gather these before running the deploy scripts.
Fill in your values below as a reference — **do not commit this file with real values**.

---

## 1. Infrastructure

```
Production domain:    clarityfinancialtools.com
VPS IP address:       206.81.14.66
SSH user on VPS:      root
```

---

## 2. Secrets (go into /etc/clarity/env on the server)

```
Jwt__Key:
  Generate:  openssl rand -base64 48
  Value:     ____________________________________________

Smtp__Password (Resend API key):
  Get from:  https://resend.com → API Keys
  Value:     re___________________________________________

Stripe__SecretKey (test mode):
  Get from:  https://dashboard.stripe.com → Developers → API Keys
  Value:     sk_test______________________________________

Stripe__PremiumPriceId:
  Get from:  Stripe → Products → your product → Price ID
  Value:     price________________________________________

Stripe__WebhookSecret (add AFTER first deployment):
  Get from:  Stripe → Developers → Webhooks → your endpoint → Signing secret
  Value:     whsec____________________________________________
```

---

## 3. Where Each Value Goes

| Value | File / Location |
|-------|-----------------|
| Domain, VPS IP, SSH user | `scripts/deploy.conf` |
| Jwt__Key | `/etc/clarity/env` on server |
| Smtp__Password | `/etc/clarity/env` on server |
| Stripe__SecretKey | `/etc/clarity/env` on server |
| Stripe__PremiumPriceId | `/etc/clarity/env` on server |
| Stripe__WebhookSecret | `/etc/clarity/env` on server (after webhook registered) |

---

## 4. Steps in Order

1. Fill in `scripts/deploy.conf` (domain + server IP)
2. Run `bash scripts/server-setup.sh` (one-time server setup)
3. SSH to server, copy `scripts/env.template` → `/etc/clarity/env`, fill in all values
4. Run `bash scripts/deploy.sh` (builds and ships the app)
5. Register Stripe webhook → add `Stripe__WebhookSecret` to `/etc/clarity/env` → `systemctl restart clarity-api`
6. Run through `SMOKE_TEST.md`
