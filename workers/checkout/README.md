# Checkout Worker (Printful/PayPal integration for /shop/)

Cloudflare Worker that backs the `/shop/` checkout: creates and captures PayPal orders
server-side (so amounts are always re-derived from the trusted catalog, never from the
client), then creates a **draft** order in Printful (print-on-demand dropship fulfillment) for
manual review/confirmation. Falls back to an email alert (via Resend) if the Printful call
fails after a payment has already been captured. Background/rationale: issue #124.

This is deployed as **two independent Workers** (not a Cloudflare Pages Function), because
production is served by GitHub Pages (no serverless support) while only staging runs on
Cloudflare Pages — a Pages Function would only ever be reachable from the staging project.

| | Production | Staging |
|---|---|---|
| Worker name | `machinemens-checkout` | `machinemens-checkout-staging` |
| URL | `https://machinemens-checkout.csguth.workers.dev` | `https://machinemens-checkout-staging.csguth.workers.dev` |
| `SITE_URL` (catalog source) | `https://machinemens.com` | `https://staging.machinemens.com` |
| PayPal API | live (`api-m.paypal.com`) | sandbox (`api-m.sandbox.paypal.com`) |

No Custom Domain (`api.machinemens.com`) is used: Cloudflare requires the whole domain to be an
active Cloudflare zone (nameservers on Cloudflare) for that, and production DNS stays on
Namecheap/GitHub Pages. The free `*.workers.dev` URL needs zero DNS changes — revisit a Custom
Domain if `machinemens.com`'s DNS ever moves to Cloudflare.

## Endpoints

- `POST /paypal/create-order` — body `{ items: [{ id, size, qty }], shippingCountry, itemNames? }`.
  Re-prices the cart from `${SITE_URL}/data/products.json` (never trusts client prices), creates
  the PayPal order, stores the trusted line items in KV keyed by the PayPal order id. Returns
  `{ id }`.
- `POST /paypal/capture-order` — body `{ orderID }`. Captures the PayPal order, creates a Printful
  draft order from the KV record + the address PayPal returns, emails a fallback alert on Printful
  failure. Idempotent (safe to call more than once for the same `orderID`). Returns `{ success }`.

## One-time setup (per environment)

1. **KV namespace**: `npx wrangler kv namespace create ORDERS_KV` (production) and
   `npx wrangler kv namespace create ORDERS_KV --env staging` (staging). Paste the printed ids
   into `wrangler.toml` (`kv_namespaces` / `[env.staging]`).
2. **`CHECKOUT_API_URL`**: after the first deploy, set the GitHub repo/environment variable to
   the Worker's `*.workers.dev` URL (see table above) — that's what gets injected into `/shop/`
   via the `__CHECKOUT_API_URL__` placeholder.
3. **Secrets** (never in `wrangler.toml`, set with `wrangler secret put <NAME>` or via the
   `deploy-checkout-worker-*.yml` GitHub Actions workflow from repo/environment secrets):
   - `PRINTFUL_API_KEY` — Printful dashboard → Settings → API access. This is an **account-level**
     token (the Printful account may hold multiple stores), so every API call also needs the
     `X-PF-Store-Id` header — that's `PRINTFUL_STORE_ID` in `wrangler.toml` (`18582480`, "Machinemens
     Webshop"), not a secret since a store id isn't sensitive.
   - `RESEND_API_KEY` — Resend dashboard → API Keys. Requires **`send.machinemens.com`**
     (production) and **`send-staging.machinemens.com`** (staging) to each be added and verified
     as their own domain in Resend — see "Sending domain DNS setup" below. `RESEND_FROM_EMAIL` in
     `wrangler.toml` already matches this per environment.
   - `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` — same PayPal REST app as the frontend's
     `PAYPAL_CLIENT_ID` var (sandbox app for staging, live app for production); the Secret is the
     one piece not already configured elsewhere.
4. **Printful Sync Products**: the two t-shirts are already synced ("Machinemens Original Zwart" /
   "Machinemens Original Roze", both store id `18582480`), and `static/data/products.json`'s
   `printfulVariants` map already has the real `sync_variant_id`s for S/M/L/XL/XXL (XXL maps to
   Printful's "2XL" variant). Both staging and production point at this same store — safe because
   orders are always created as unconfirmed drafts (`confirm: false`), so testing in staging never
   auto-charges/ships anything.
5. Cloudflare API token used by CI needs the **Workers Scripts: Edit** permission (the existing
   token only has Pages edit — either broaden it or add a second token/secret).

### Sending domain DNS setup (Resend)

`contact@machinemens.com`'s Namecheap email forwarding has been retired (the site now uses
`machinemens.contact@gmail.com` directly), which frees up Namecheap's "Mail Settings" to switch
from `Email Forwarding` to `Custom MX` without breaking anything -- that's what unlocks adding a
custom `MX Record` in Namecheap's Advanced DNS (it's otherwise hidden from the Type dropdown).

1. Namecheap → Advanced DNS → **Mail Settings** → change the dropdown to `Custom MX`.
2. Under **Host Records**, add for each environment (values come from the Resend "Add Domain"
   page — copy them exactly, host is relative so type only the part before `.machinemens.com`):
   - `MX Record`, Host `send`, Value/Priority as given by Resend (production).
   - `TXT Record`, Host `send`, SPF value as given by Resend (production).
   - `TXT Record`, Host `resend._domainkey.send` (or whatever Resend labels the DKIM host as).
   - Repeat the same 3 records with `send-staging` instead of `send` for the staging domain.
3. In Resend, add and verify `send.machinemens.com` and `send-staging.machinemens.com` as two
   separate domains (each gets its own DKIM key).

## Local development

```
cd workers/checkout
npm install
npx wrangler dev            # production-shaped env
npx wrangler dev --env staging
```

Secrets for local dev go in a git-ignored `.dev.vars` file (`KEY=value` per line), never committed.
