# Clarity Finance — Manual Go-Live Steps

These are the **only** tasks that require action outside this repo.
Everything else is handled by the scripts in `scripts/`.

---

## Step 1 — Buy a Domain

Pick any registrar (Namecheap, Cloudflare, Porkbun, Google Domains).
You'll point it at your server in Step 3.

---

## Step 2 — Provision a VPS

**Recommended specs:** 1 vCPU · 1 GB RAM · 25 GB SSD — ~$6/month

| Provider | Link |
|----------|------|
| Hetzner (cheapest) | https://hetzner.com/cloud |
| DigitalOcean | https://digitalocean.com |
| Linode / Akamai | https://linode.com |
| Vultr | https://vultr.com |

**During provisioning:**
- Choose **Ubuntu 22.04 LTS**
- Add your SSH public key (`~/.ssh/id_rsa.pub` or `~/.ssh/id_ed25519.pub`)
- Note the public **IPv4 address** once it boots

---

## Step 3 — Point Your Domain at the VPS

In your domain registrar's DNS panel, add an **A record**:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | `<your VPS IP>` | 300 |

Also add a `www` redirect if you want:

| Type | Host | Value |
|------|------|-------|
| CNAME | www | clarityfinancialtools.com |

Propagation takes 5–30 minutes. Verify: `dig clarityfinancialtools.com +short` returns your VPS IP.

---

## Step 4 — Create a Resend Account (Email)

1. Sign up at **https://resend.com** (free tier: 3,000 emails/month)
2. Go to **Domains** → Add your domain → follow the DNS steps (adds SPF/DKIM records)
3. Go to **API Keys** → Create API Key → copy it (shown once)

Save the API key — you'll put it in `scripts/env.template` as `Smtp__Password`.

> **Shortcut:** While your domain is being verified, Resend's sandbox mode delivers to your Resend dashboard instead of real inboxes — useful for initial testing.

---

## Step 5 — Create a Stripe Account + Product

1. Sign up at **https://dashboard.stripe.com**
2. Go to **Products** → **Add product**
   - Name: `Clarity Premium`
   - Pricing model: **Recurring**
   - Price: `$5.00 / month` (or whatever you choose)
   - Click **Save product**
3. Copy the **Price ID** — starts with `price_` — from the product page
4. Go to **Developers → API keys**
   - Copy the **Secret key** starting with `sk_test_` (stay in test mode until ready)

Save both — you'll add them to `scripts/env.template`.

---

## Step 6 — Register Stripe Webhook (after domain is live)

Do this **after** your domain resolves and the app is deployed.

1. Stripe Dashboard → **Developers → Webhooks** → **Add endpoint**
2. **Endpoint URL:** `https://clarityfinancialtools.com/api/payments/webhook`
3. **Events to select:**
   - `checkout.session.completed`
   - `customer.subscription.deleted`
4. Click **Add endpoint**
5. On the endpoint detail page, click **Reveal** under "Signing secret"
6. Copy the value starting with `whsec_`

Add it to `/etc/clarity/env` on your server as `Stripe__WebhookSecret=whsec_...`, then run:
```bash
sudo systemctl restart clarity-api
```

---

## That's It

Once you have:
- ✅ VPS IP address
- ✅ Domain pointing at it
- ✅ Resend API key
- ✅ Stripe test secret key + price ID

Open `scripts/deploy.conf`, fill in your domain + server IP, then follow `DEPLOY.md`.
The Stripe webhook secret gets added after the first deployment.
