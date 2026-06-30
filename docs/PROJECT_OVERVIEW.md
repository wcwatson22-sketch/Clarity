# Clarity Financial Tools — Build Overview

*A plain-English summary of what Clarity is, how it's built, and the major work delivered — from both the website and the mobile-app standpoint.*

Owned and operated by **Clearpath Digital LLC**. Last updated: June 2026.

---

## 1. What Clarity is

Clarity is a personal financial-clarity platform. Users enter their own figures — income, expenses, assets, liabilities, debts, retirement contributions, and investment-property details — and Clarity turns them into a clear picture of their **net worth, cash flow, debt-to-income (DTI), and loan readiness**.

It is intentionally *not* an account-aggregator: Clarity never connects to or asks for bank/brokerage logins. Users decide what to track. It's free to use, with an optional **Premium** tier ($2.99/month) for deeper tools.

---

## 2. How it's built (one product, three surfaces)

Clarity runs from a **single shared codebase** that powers three experiences:

| Surface | What it is | Technology |
|---|---|---|
| **Public marketing website** | Crawlable pages anyone can visit (Home, Features, Pricing, Learn, About) | Angular |
| **Authenticated web app** | The signed-in financial command center | Angular (same build) |
| **Native iOS app** | The same experience wrapped for iPhone, anchored at login | Angular + Capacitor |
| **Backend API** | Secure server that stores data and enforces the rules | ASP.NET Core 9 |
| **Database** | Per-user financial data | SQLite |
| **Hosting** | Cloud server with managed TLS and reverse proxy | DigitalOcean + Caddy |

**Why this matters:** one codebase keeps the website and the app perfectly in sync, while the backend is the single source of truth that enforces security — so the app and website behave identically and safely.

---

## 3. The build journey (major milestones)

### Foundation & launch readiness
- Stabilized login and performance; brought the website and app to feature parity.
- Reworked pricing into a clean **freemium model** — Free forever, with a single **$2.99/month Premium** tier (retired the legacy trial and "Base" plan).
- Built core financial tools: **Dashboard** (net worth, assets/liabilities, DTI, snapshots), **Cash Flow**, **Compare**, **Loan Prep**, **Loan Impact Calculator**, and **Real Estate** investment analysis.

### Cash Flow improvements
- Added a **Monthly / Annual toggle** so users can enter income, expenses, and budgets in whichever period they think in — while every calculation stays correct internally.

### The public "Learn" center *(website + app)*
- **Website:** launched a public, search-engine-friendly **Learn** hub at `/learn` with educational articles (cash flow, DTI, net worth, loan prep, real estate). Each article has its own shareable URL, SEO metadata, breadcrumbs, related links, and clear educational disclaimers.
- **App:** kept the in-app Learn experience intact for members.
- Added a **content management system** so the owner can create, edit, preview, publish, and unpublish articles from a private admin screen — **no code changes or redeploys needed** to publish content.
- Added a **reader submission form** (questions, topic suggestions, corrections) that emails the team directly — with spam protection and privacy safeguards.

### Marketing site polish *(website)*
- Added a **Home** nav button and a larger, more visible Clarity logo.
- Added **real product screenshots** (Dashboard, Cash Flow, Loan Prep, Learn) with a clear "sample data" note.
- Warmed up the design with brand color and fixed navigation/scroll behavior.

### App Store compliance *(app)*
- Generated compliant App Store assets and subscription review materials.
- Resolved Apple's auto-renewable-subscription metadata requirements and made in-app legal links (Privacy Policy, Terms of Use) open correctly on iOS.
- **Result: the app was approved by Apple and is live on the App Store.**

### Security & privacy (a major, ongoing focus)
- **Account isolation:** confirmed and verified that every user's financial data is private to their account and enforced on the server — not just hidden in the app. Added automated cross-account tests.
- **Account deletion:** ensured deleting an account removes all associated data (including real-estate records) with nothing left behind.
- **Comprehensive security pass:** reviewed authentication, authorization, payments, encryption in transit, server hardening, dependencies, logging, and privacy against industry baselines (OWASP). Hardened subscription verification and the deployment process.
- **Safer deployments:** built a deployment process with pre-checks, automatic health verification, and rollback so a bad release can't take the site down.

---

## 4. Security & privacy posture (honest summary)

**Verified and in place:**
- All traffic encrypted in transit (HTTPS/TLS, auto-renewing certificate).
- Passwords stored only as salted one-way hashes (never reversible, never logged).
- Every user's data is access-controlled on the server by their authenticated identity.
- Subscription status verified server-side (Stripe signatures on the web; Apple-verified receipts on iOS) — it can't be unlocked by tampering with the app.
- Secrets kept out of the codebase; security headers, rate limiting, and a firewall in place; no financial values written to logs or analytics.
- Clarity does **not** collect bank/brokerage credentials, Social Security numbers, full account numbers, or card numbers.

**Documented and tracked (not yet complete):**
- Encryption of data **at rest** on disk (planned via the hosting provider).
- A few server/dependency hardening items scheduled with the owner.
- An **independent penetration test** is recommended before broad scale — Clarity has been *prepared* for one but a third-party assessment has not been performed.

*We deliberately avoid claims like "fully secure," "unhackable," or "bank-level encryption."*

---

## 5. Current status

- **Website:** live in production at clarityfinancialtools.com (marketing site, authenticated app, and public Learn center).
- **iOS app:** **approved by Apple and live on the App Store, ready for distribution.**
- **Content:** owner can manage Learn articles directly through the admin interface.
- **Documentation:** architecture, data inventory, incident-response plan, and a pre-release security checklist are maintained in the repository.

---

*This overview is intentionally high-level. Detailed technical, security, and architecture documentation is maintained separately in the project repository.*
