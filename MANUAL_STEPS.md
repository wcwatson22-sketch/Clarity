# Clarity Finance — Things I Need From You

Everything in this file requires action outside the codebase.
The repo is ready. These are the only blockers between you and a live app.

---

## 🔑 Secrets You Must Generate / Obtain

### 1. JWT Secret Key
**What:** A 64-character random string that signs authentication tokens. If this leaks, attackers can impersonate any user.

**Generate it:**
```bash
openssl rand -base64 48
```

**Where it goes:** `/etc/clarity/env` on your server as `Jwt__Key=<value>`

---

### 2. Resend API Key (Email)
**What:** Clarity sends transactional emails (email verification, password reset). Resend is the recommended provider — free tier includes 3,000 emails/month.

**Steps:**
1. Create account at [resend.com](https://resend.com)
2. Add your domain under **Domains** → follow the DNS verification steps (adds 2–3 DNS records)
3. Create an API key under **API Keys**
4. Copy the key (shown once)

**Where it goes:** `/etc/clarity/env` on your server as `Smtp__Password=re_xxxxx`

> **Shortcut for testing:** Resend has a sandbox mode — emails go to your Resend dashboard, not actual recipients. Useful before you verify your domain.

---

### 3. Stripe Account + Product Setup
**What:** Clarity's upgrade flow sends users to Stripe Checkout. You need a Stripe account with a product and price created.

**Steps:**
1. Create account at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Go to **Products** → **Add product**
   - Name: `Clarity Premium`
   - Pricing: `$5.00 / month` (or your chosen price), recurring
3. Copy the **Price ID** (starts with `price_`)
4. Go to **Developers → API keys**
   - Copy the **Secret key** — use `sk_test_...` for testing, `sk_live_...` for real payments

**Where it goes in `/etc/clarity/env`:**
```
Stripe__SecretKey=sk_test_...
Stripe__PremiumPriceId=price_...
```

---

### 4. Stripe Webhook Secret
**What:** Verifies that webhook events (subscription confirmed, subscription cancelled) actually come from Stripe, not an attacker.

**Steps — do this AFTER your domain is live:**
1. Stripe Dashboard → **Developers → Webhooks**
2. Click **Add endpoint**
   - URL: `https://clarityfinancialtools.com/api/payments/webhook`
   - Events: select `checkout.session.completed` and `customer.subscription.deleted`
3. After creating, click the endpoint → copy the **Signing secret** (starts with `whsec_`)

**Where it goes:** `/etc/clarity/env` as `Stripe__WebhookSecret=whsec_...`

---

## 🖥️ Infrastructure You Must Provision

### 5. VPS (Virtual Private Server)
**Recommended providers:** DigitalOcean, Hetzner, Linode, Vultr
**Minimum spec:** 1GB RAM, 1 vCPU, 25GB SSD — costs ~$6/month

**After provisioning:**
- Note the public IP address
- Add your SSH public key during setup (or via the provider's dashboard)

---

### 6. Domain Name
**What:** A domain pointed at your VPS IP via an A record.
- Buy from Namecheap, Cloudflare, Google Domains, etc.
- Add an **A record**: `clarityfinancialtools.com` → `<your VPS IP>`
- DNS propagation takes 5–30 minutes

---

## ⚙️ Server Config You Must Run

### 7. Edit `appsettings.Production.json` (in the repo — but you choose the domain)
```json
{
  "AppUrl": "https://clarityfinancialtools.com",
  "AllowedOrigins": ["https://clarityfinancialtools.com"],
  "Smtp": {
    "FromEmail": "noreply@clarityfinancialtools.com"
  }
}
```
Replace `clarityfinancialtools.com` with your actual domain, then rebuild and redeploy.

---

### 8. Create `/etc/clarity/env` on Your Server
This file holds all secrets. **Never commit it to the repo.**

```bash
sudo mkdir -p /etc/clarity
sudo nano /etc/clarity/env
```

Paste (filling in your actual values):
```
ASPNETCORE_ENVIRONMENT=Production
Jwt__Key=<your 64-char random string>
Smtp__Host=smtp.resend.com
Smtp__Port=587
Smtp__Username=resend
Smtp__Password=<your Resend API key>
Stripe__SecretKey=sk_test_<your key>
Stripe__WebhookSecret=whsec_<your secret>
Stripe__PremiumPriceId=price_<your price id>
```

Lock it down:
```bash
sudo chmod 600 /etc/clarity/env
sudo chown root:root /etc/clarity/env
```

---

## 🎨 Assets You Must Create

### 9. PWA Icons
Two PNG files are needed for the "Add to Home Screen" prompt on mobile:
- `frontend/src/icons/icon-192x192.png` (192×192 px)
- `frontend/src/icons/icon-512x512.png` (512×512 px)

**Fastest path:**
1. Design a 512×512 logo (or use a simple green circle with "C")
2. Go to [realfavicongenerator.net](https://realfavicongenerator.net) or [maskable.app](https://maskable.app)
3. Upload your logo → download the generated icon set
4. Place `icon-192x192.png` and `icon-512x512.png` in `frontend/src/icons/`

> **Note:** The app works fine without these. They only affect the "Add to Home Screen" install prompt on iOS/Android. Skip for soft launch, add before wide announcement.

---

## Summary: Minimum Required to Go Live

| # | Item | Where |
|---|------|--------|
| 1 | JWT secret | Generate + add to `/etc/clarity/env` |
| 2 | Domain + A record | Domain registrar |
| 3 | VPS | Cloud provider |
| 4 | Resend API key | resend.com |
| 5 | Stripe keys + Price ID | dashboard.stripe.com |
| 6 | Stripe webhook secret | After domain is live |
| 7 | `appsettings.Production.json` domain | Edit in repo, redeploy |

**Time estimate:** ~2 hours end-to-end if accounts are created fresh. ~45 minutes if you already have Stripe and Resend accounts.
