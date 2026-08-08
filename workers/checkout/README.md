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
| Custom domain | `api.machinemens.com` | `api-staging.machinemens.com` |
| `SITE_URL` (catalog source) | `https://machinemens.com` | `https://staging.machinemens.com` |
| PayPal API | live (`api-m.paypal.com`) | sandbox (`api-m.sandbox.paypal.com`) |

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
2. **Custom domain**: after the first deploy, attach `api.machinemens.com` /
   `api-staging.machinemens.com` to the respective Worker in the Cloudflare dashboard
   (Workers & Pages → Settings → Domains & Routes). This also creates the DNS record.
3. **Secrets** (never in `wrangler.toml`, set with `wrangler secret put <NAME>` or via the
   `deploy-checkout-worker-*.yml` GitHub Actions workflow from repo/environment secrets):
   - `PRINTFUL_API_KEY` — Printful dashboard → Settings → API access (Bearer token).
   - `RESEND_API_KEY` — Resend dashboard → API Keys.
   - `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` — same PayPal REST app as the frontend's
     `PAYPAL_CLIENT_ID` var (sandbox app for staging, live app for production); the Secret is the
     one piece not already configured elsewhere.
4. **Printful Sync Products**: create the sync products for both t-shirts (art is already
   prepared) and note each size's `sync_variant_id`. Fill these into
   `static/data/products.json`'s `printfulVariants` map — until then, checkout for that
   product/size is rejected with a 400 (`Product not yet available for order`).
5. Cloudflare API token used by CI needs the **Workers Scripts: Edit** permission (the existing
   token only has Pages edit — either broaden it or add a second token/secret).

## Local development

```
cd workers/checkout
npm install
npx wrangler dev            # production-shaped env
npx wrangler dev --env staging
```

Secrets for local dev go in a git-ignored `.dev.vars` file (`KEY=value` per line), never committed.
