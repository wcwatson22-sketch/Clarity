# Clarity Finance — Post-Deployment Smoke Test

Run this checklist immediately after deploying to a new server.
Each test should take < 2 minutes. Full checklist: ~20 minutes.

---

## 1. Infrastructure Health

```bash
# Backend is alive
curl -s https://clarityfinancialtools.com/healthz
# Expected: 200 OK

curl -s https://clarityfinancialtools.com/readyz
# Expected: 200 OK

# HTTPS cert is valid (no warnings)
curl -vI https://clarityfinancialtools.com 2>&1 | grep "SSL certificate"
# Expected: SSL certificate verify ok
```

---

## 2. Frontend Loads

| Test | Expected |
|------|----------|
| Open `https://clarityfinancialtools.com` in browser | Redirects to `/login` (or landing page) |
| No console errors (open DevTools → Console) | Clean console |
| Page title is "Clarity — Personal Finance Dashboard" | ✓ |
| Favicon appears in browser tab | ✓ |

---

## 3. Auth Flow — Registration

1. Go to `https://clarityfinancialtools.com/register`
2. Enter a real email address you can check, a name, and a password
3. Click **Create Account**
4. **Expected:** "Check your email" confirmation shown
5. Check your inbox — verification email should arrive within 60 seconds
6. Click the verification link
7. **Expected:** Redirected to login page with "Email verified" message

> **If email doesn't arrive:** Check `/etc/clarity/env` — confirm `Smtp__Password` is set and `ASPNETCORE_ENVIRONMENT=Production`. Check server logs: `journalctl -u clarity-api -f`

---

## 4. Auth Flow — Login

1. Log in with the account you just verified
2. **Expected:** Dashboard loads
3. **Expected:** Empty state shown — "No assets yet" and "No liabilities yet" (not fake seed data)
4. **Expected:** Net Worth = $0, all metrics show $0 or "—"

---

## 5. Dashboard — Add an Asset

1. Click **+ Add Your First Asset**
2. Select type: **Checking Account**, enter name: `Test Checking`, value: `5000`
3. Click **Add**
4. **Expected:** Asset appears in the list
5. **Expected:** Net Worth updates to **$5,000**
6. **Expected:** Total Assets metric updates
7. Change the value to `6000` → **Expected:** Net Worth immediately updates to $6,000

---

## 6. Dashboard — Add a Liability

1. Click **+ Add Your First Liability**
2. Select type: **Credit Card**, enter name: `Test Card`, value: `1000`
3. Click **Add**
4. **Expected:** Liability appears in the list
5. **Expected:** Net Worth updates to **$5,000** (assets - liabilities)
6. **Expected:** DTI metric changes from "—" to a percentage (if income set) or stays "—"

---

## 7. Cash Flow Page

1. Navigate to Cash Flow
2. Click **+ Add Income Source**
3. Enter name: `Salary`, set type to **Fixed**, monthly amount: `5000`
4. Click **Add**
5. **Expected:** Monthly Income shows **$5,000**
6. **Expected:** Dashboard DTI metric now shows a percentage (not "—")

7. Add a budget expense: name `Rent`, category `Housing`, amount `1500`
8. **Expected:** Monthly Expenses updates, Surplus/Deficit updates

9. Add a second income source, switch type to **Variable**
10. **Expected:** 6 month input fields auto-populate (current + past 5 months)

---

## 8. Onboarding (First Login)

1. Log out
2. Register a **second** new account
3. After verifying and logging in
4. **Expected:** Onboarding walkthrough modal appears
5. Click through all steps
6. Click **Get Started**
7. **Expected:** Modal closes and does NOT reappear on page refresh

---

## 9. Upgrade / Stripe

1. On your test account, navigate to **Settings** or find the upgrade prompt
2. Hit the free-tier snapshot limit (save > 4 snapshots):
   - Dashboard → change a value → it auto-saves a snapshot
   - Or check if there's a manual save button
3. **Expected:** Upgrade modal appears when limit is hit
4. Click **Upgrade to Premium**
5. **Expected:** Redirected to Stripe Checkout (test mode: use card `4242 4242 4242 4242`, any future expiry, any CVC)
6. Complete test checkout
7. **Expected:** Redirected back to app, plan shows "Premium"

> **If Stripe redirects fail:** Confirm `Stripe__WebhookSecret` is set correctly and the webhook endpoint is registered in the Stripe Dashboard.

---

## 10. Password Reset

1. Log out
2. Click **Forgot Password**
3. Enter the email of your test account
4. **Expected:** "Check your email" message shown
5. Check inbox — reset email should arrive within 60 seconds
6. Click the reset link
7. **Expected:** Password reset form loads
8. Enter a new password and submit
9. **Expected:** Can log in with the new password

---

## 11. Mobile / PWA

1. Open `https://clarityfinancialtools.com` on your phone
2. **Expected:** Page is responsive and usable
3. On iOS: tap Share → Add to Home Screen
4. On Android: tap ⋮ → Add to Home Screen (or install prompt appears)
5. **Expected:** App icon appears (if icons are placed in `frontend/src/icons/`)
6. Launch from home screen
7. **Expected:** Opens in standalone mode (no browser chrome)

---

## 12. Error Handling

1. In browser DevTools → Network → set to "Offline"
2. Try navigating to a protected route
3. **Expected:** Error boundary modal appears with "Reload page" option (not a white screen)
4. Re-enable network → click "Reload page"
5. **Expected:** App recovers

---

## Pass Criteria

All items in sections 1–10 must pass before announcing publicly.
Sections 11–12 are recommended but not blockers for soft launch.

---

## Troubleshooting Commands

```bash
# Live backend logs
sudo journalctl -u clarity-api -f

# Last 100 lines of logs
sudo journalctl -u clarity-api -n 100

# Check service status
sudo systemctl status clarity-api

# Check Caddy status
sudo systemctl status caddy

# Test API directly (bypass Caddy)
curl http://localhost:5000/healthz

# Database exists
ls -lh /opt/clarity-api/clarity.db
```
