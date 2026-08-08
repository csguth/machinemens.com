# machinemens.com — Machinemens official website

Official website for **Machinemens** (black/death metal band), replacing the band's Linktree.

## Stack (Hugo static site + CDN runtime, all free/cheap)

| Tool | Purpose | Cost |
|---|---|---|
| Hugo (SSG) | Builds the static HTML from `layouts/` + `content/` + `static/` | Free |
| Tailwind CDN | Styling (Play CDN, no build step for CSS) | Free |
| Alpine.js CDN | EN/NL/PT trilingual toggle + data-driven pages | Free |
| GitHub Pages | Production hosting + HTTPS | Free |
| Cloudflare Pages | Staging hosting (`staging.<domain>`) | Free |
| Domain registrar: Namecheap | Custom domain (`machinemens.com`, registered) | ~€10-15/year |

**Monthly cost: €0** (just the domain renewal once a year)

Hugo builds the site as **multilingual, one page per language**: every UI string lives in
`i18n/{en,nl,pt}.toml` and the same content is rendered under a language-prefixed URL —
`/en/…` (English), `/nl/…` (Dutch), `/pt/…` (Portuguese). The bare root `/` is a tiny JS
redirect that sends each visitor to their saved/detected language. Output is **minified** in CI.
This repo intentionally mirrors the setup of
[csguth/gatoweb.nl](https://github.com/csguth/gatoweb.nl) (branching model,
staging/production split, i18n pattern) so both projects are easy to maintain with the same
mental model.

---

## Building locally

Install [Hugo extended](https://gohugo.io/installation/), then from the repo root:

```
hugo          # build the static site into site/ (git-ignored)
hugo server   # live-preview at http://localhost:1313
```

The CI workflows install a pinned Hugo version and run `hugo --gc --minify` before substituting
the `__SITE_URL__` / `__ENV_LABEL__` placeholders with `sed`. `hugo --minify` only minifies the
rendered HTML/CSS; the static JS in `site/js/` (copied verbatim from `static/js/`) is minified
separately in CI via `npx terser` (no dependency added to the repo — the tool is only ever
invoked inside the workflow, never locally, so the site stays zero-build).

---

## Repository structure

```
hugo.toml              Hugo config (multilingual en/nl/pt, publishDir = site, disables generated sitemap/robots/RSS)
i18n/                  Compile-time UI translations
  en.toml, nl.toml, pt.toml  All user-facing strings, referenced via {{ i18n "key" }}
layouts/
  _default/baseof.html  Shared page skeleton (head + body + header/footer partials + blocks)
  alias.html            Root "/" redirect template (loads js/root-redirect.js)
  partials/head.html    <head> (meta/OG/Twitter/JSON-LD-on-home + hreflang) — per-page title/description
  partials/header.html  Staging banner + nav + EN/NL/PT language selector (links to each language URL)
  partials/footer.html  Footer
  index.html            Home page "main" block (hub: social links, teasers of latest release/next show)
  music/list.html       /music/ "main" block (full discography + live sessions)
  shows/list.html       /shows/ "main" block (upcoming + past shows)
  shop/list.html        /shop/ "main" block (product grid + cart + PayPal Smart Buttons checkout)
  contact/list.html     /contact/ "main" block (bookings + general contact link-cards)
content/                Per-language front matter (title/description), translated by filename:
  _index.{en,nl,pt}.md        Home
  music/_index.{en,nl,pt}.md  /music/
  shows/_index.{en,nl,pt}.md  /shows/
  shop/_index.{en,nl,pt}.md   /shop/
  contact/_index.{en,nl,pt}.md  /contact/
static/                 Copied verbatim into the build output (served as-is):
  favicon.png          Root favicon used by all pages + the bare "/" redirect page
  apple-touch-icon.png Root Apple touch icon, kept in sync with the favicon asset
  css/site.css          Styles: brand colors, staging banner, shared nav/listen-get button styles
  js/lang-persist.js    Saves the current page's language into localStorage on load
  js/root-redirect.js   Root "/" redirect to /en|nl|pt/ based on saved/detected language
  js/tailwind-config.js Tailwind Play CDN theme extension (brand colors)
  js/music-page.js      Alpine component for /music/ (fetches data/releases.json)
  js/shows-page.js      Alpine component for /shows/ (fetches data/shows.json)
  js/shows-teaser.js    Alpine component for the home "next show" teaser
  js/cart-store.js      Shared localStorage cart (add/setQty/remove/clear), used by cart-badge.js
                        and shop-page.js so the header badge and /shop/ page stay in sync
  js/cart-badge.js      Alpine component for the header cart-count badge (loaded on every page)
  js/shop-page.js       Alpine component for /shop/ (fetches data/products.json, renders the
                        cart, and mounts PayPal JS SDK Smart Buttons -- order create/capture
                        happen server-side in the checkout Worker, see below)
  data/releases.json    Discography data consumed by /music/ (Alpine fetch + x-for) — add a new
                        release here, including its per-store links, when it drops
  data/shows.json       Shows/agenda data consumed by /shows/ and the home teaser
  data/products.json    Product catalog consumed by /shop/ (id/price/image) -- product display
                        names are translated i18n keys (shop_product_<id>), resolved server-side
                        in layouts/shop/list.html and passed into the Alpine component. Also the
                        single source of truth for Printful fulfillment: each product's
                        printfulVariants map (size -> sync_variant_id) is read by the checkout
                        Worker (workers/checkout/) to build Printful orders (store id
                        18582480, "Machinemens Webshop" -- see workers/checkout/README.md).
  images/logo.png       Band logo (wordmark)
  images/favicon.png    Source favicon image copied to the root favicon paths above
  robots.txt, sitemap.xml, CNAME
site/                   Hugo build output (git-ignored; what actually gets deployed)
workers/checkout/       Cloudflare Worker backing /shop/'s checkout (server-side PayPal order
                        create/capture + Printful print-on-demand draft order creation, with a
                        Resend email fallback on Printful failures). Deployed as two independent
                        Workers on their free *.workers.dev URLs (no Custom Domain, since that
                        would require machinemens.com's DNS to move to Cloudflare) -- see
                        workers/checkout/README.md for full details.
.github/workflows/
  deploy-pages.yml               Production deploy -> GitHub Pages (push to main)
  deploy-staging-cloudflare.yml  Staging deploy -> Cloudflare Pages (push to staging)
  deploy-preview-cloudflare.yml  PR preview -> Cloudflare Pages (pull_request into staging),
                                  posts a sticky comment with the preview URL on the PR
  deploy-preview-cloudflare-main.yml
                                  PR preview -> Cloudflare Pages (pull_request into main, i.e.
                                  the staging -> main promotion PR or a hotfix PR), posts a
                                  sticky comment with the preview URL on the PR
  deploy-checkout-worker-production.yml
                                  Deploys workers/checkout/ to Cloudflare (production Worker),
                                  triggered on push to main touching workers/checkout/**
  deploy-checkout-worker-staging.yml
                                  Deploys workers/checkout/ to Cloudflare (staging Worker),
                                  triggered on push to staging touching workers/checkout/**
  guard-main-merges.yml          Enforces the staging -> main promotion order (see below)
.github/skills/github-project-management/SKILL.md
                        Copilot skill with the exact gh CLI commands/IDs to manage the
                        project board (issues, Status, Priority) without rediscovering IDs.
```

---

## Environments

| | Production | Staging |
|---|---|---|
| Branch | `main` | `staging` |
| URL | `SITE_URL` var (`https://machinemens.com`) | `SITE_URL` var (`https://staging.machinemens.com`) |
| Hosting | GitHub Pages | Cloudflare Pages (project `machinemens-com-staging`) |
| Workflow | `deploy-pages.yml` | `deploy-staging-cloudflare.yml` |
| GitHub Environment | `github-pages` | `staging` |
| Visual indicator | none (`data-env="production"`, banner hidden) | amber "STAGING" banner (`data-env="staging"`) |

Both environments are built from the exact same source files — the only difference is which
GitHub Environment's variables get substituted at deploy time.

---

## Branching & promotion workflow

New work follows a **feature → staging → manual test → production** flow, enforced by branch
protection (not just convention):

```
git checkout staging && git pull
git checkout -b feature/my-change
# ... work, commit ...
# Open a PR: feature/my-change -> staging
#   -> deploy-preview-cloudflare.yml deploys an isolated PR preview and posts
#      the URL as a sticky comment on the PR automatically
# Merge -> auto-deploys to staging (Cloudflare Pages)
# Test manually on staging
# Open a PR: staging -> main  (use a regular merge, NEVER squash/rebase,
#                              so the exact tested commit reaches main)
#   -> deploy-preview-cloudflare-main.yml deploys an isolated preview of that
#      exact commit and posts the URL as a sticky comment on the PR automatically
# Merge -> auto-deploys to production (GitHub Pages)
```

Hotfixes can branch directly from `main` and be merged back into `main` via a PR labeled
`hotfix` (bypasses the "must come from staging" guard) — then the same fix should be
cherry-picked/merged into `staging` too so both branches stay in sync. Hotfix PRs also get
an isolated preview from `deploy-preview-cloudflare-main.yml`, same as promotion PRs.

Rules enforced on GitHub:
- Both `main` and `staging` require a Pull Request to merge (no direct pushes) and block force-pushes/deletions.
- `.github/workflows/guard-main-merges.yml` fails any PR targeting `main` whose source branch isn't
  `staging`, unless the PR is labeled `hotfix` (emergency bypass for urgent production fixes).

---

## Deploy configuration

Before first deploy, add these **repository or environment** variables
(`Settings → Secrets and variables → Actions → Variables`). Use **Secrets** only for actual credentials.

### Required (both environments)
- `SITE_URL` — e.g. `https://machinemens.com` (production) / `https://staging.machinemens.com` (staging)
- `ENV_LABEL` — `production` or `staging`, drives the visible staging banner (`data-env` attribute)
- PAYPAL_CLIENT_ID — PayPal REST app **Client ID** (the public/publishable one, safe to embed client-side; never the Secret) used by the PayPal JS SDK Smart Buttons on /shop/. Use a Sandbox app's Client ID for staging/previews and a Live app's for production.
- `CHECKOUT_API_URL` — base URL of the checkout Worker (`workers/checkout/`), e.g.
  `https://machinemens-checkout.csguth.workers.dev` (production) /
  `https://machinemens-checkout-staging.csguth.workers.dev` (staging). Injected into `/shop/` via
  the `__CHECKOUT_API_URL__` placeholder.

### Checkout Worker (both environments — see workers/checkout/README.md for full setup)
- `CLOUDFLARE_ACCOUNT_ID` (variable) and `CLOUDFLARE_API_TOKEN` (secret) — now needed in **both**
  environments (not staging-only anymore), since the production checkout Worker also deploys to
  Cloudflare even though the static site itself is on GitHub Pages. The token needs the
  **Workers Scripts: Edit** permission in addition to Pages edit.
- `PRINTFUL_API_KEY` (secret) — Printful dashboard → Settings → API access.
- `RESEND_API_KEY` (secret) — Resend dashboard → API Keys. Used for the fallback email sent when
  a Printful order can't be created automatically after a successful payment. Requires
  `send.machinemens.com` verified as a domain in Resend (shared by both environments — the Free
  plan only allows 1 domain) — see `workers/checkout/README.md`'s "Sending domain DNS setup".
- `PAYPAL_CLIENT_SECRET` (secret) — pairs with `PAYPAL_CLIENT_ID` above (same PayPal REST app);
  used server-side to create/capture PayPal orders.

Notes:
- Language & URL: the site is served per-language under `/en/`, `/nl/` and `/pt/`. The bare root
  `/` runs `js/root-redirect.js`, which picks the language from the visitor's saved choice
  (`localStorage.machinemens_lang`), else browser language (`pt`/`nl`), else English. The header
  language selector is plain links to each language's URL, so the URL always changes with the
  language; `js/lang-persist.js` re-saves the current page's language on every load.
- Placeholders `__SITE_URL__` / `__ENV_LABEL__` / `__PAYPAL_CLIENT_ID__` / `__CHECKOUT_API_URL__`
  (in the Hugo layouts, `static/robots.txt`, `static/sitemap.xml`) are kept verbatim in the
  generated HTML and substituted with `sed` at deploy time — see each workflow's "Build site with
  Hugo and inject variables" step, which runs `hugo --gc --minify` first and then the `sed`
  substitution.

Changes go live automatically:
- push/merge to `staging` → deploys to the staging Cloudflare Pages URL in ~1-2 minutes
- push/merge to `main` → deploys to production GitHub Pages in ~1-2 minutes

---

## GitHub Pages setup (one-time)

1. `Settings → Pages`: Source = **GitHub Actions**; set Custom domain to `machinemens.com`; enable
   "Enforce HTTPS" after DNS propagates.
2. `CNAME` file at the repo root holds the production domain (`machinemens.com`).
3. Namecheap DNS: 4x `A` records to GitHub Pages IPs (`185.199.108-111.153`) for `@`, plus a `www`
   CNAME to `csguth.github.io.` — same pattern as gatoweb.nl.

## Cloudflare Pages setup (one-time)

1. Create a Cloudflare Pages project named `machinemens-com-staging` (production branch: `staging`)
   in the same Cloudflare account used for gatoweb.nl.
2. Attach `staging.machinemens.com` as a custom domain (CNAME `staging` →
   `machinemens-com-staging.pages.dev` at Namecheap).
3. Create a `CLOUDFLARE_API_TOKEN` (Pages edit permission) and set it as a repo secret; set
   `CLOUDFLARE_ACCOUNT_ID` as a repo variable.

## Checkout Worker setup (one-time)

The `/shop/` checkout (PayPal order create/capture + Printful print-on-demand fulfillment) runs
in `workers/checkout/`, deployed as **two separate Cloudflare Workers** (not Pages Functions,
since production is GitHub Pages and has no serverless support) — see
[workers/checkout/README.md](workers/checkout/README.md) for the full endpoint/architecture
reference. One-time setup:

1. **Printful**: account/store already set up (API type store "Machinemens Webshop", id
   `18582480`), both t-shirts already have Sync Products, and `static/data/products.json`'s
   `printfulVariants` map already has the real `sync_variant_id`s. Still needed: generate the API
   token (Settings → API access) if not already done.
2. **Resend**: `contact@machinemens.com`'s Namecheap email forwarding was retired (the site now
   shows `machinemens.contact@gmail.com` directly), which frees Namecheap's Mail Settings to
   switch to `Custom MX` and add Resend's records directly. Verify `send.machinemens.com` as a
   domain in Resend (shared by both environments, since the Free plan only allows 1 domain — see
   `RESEND_FROM_EMAIL` in `wrangler.toml`) — full steps in `workers/checkout/README.md`. Generate
   an API key.
3. **PayPal**: generate the **Client Secret** for the same sandbox app (staging) and live app
   (production) whose Client ID is already used as `PAYPAL_CLIENT_ID`.
4. **Cloudflare**:
   - Expand `CLOUDFLARE_API_TOKEN`'s permissions to include **Workers Scripts: Edit** (it
     currently only has Pages edit).
   - Create the two KV namespaces (`wrangler kv namespace create ORDERS_KV` and
     `... --env staging` from `workers/checkout/`) and paste their ids into `wrangler.toml`.
   - No Custom Domain step needed — each Worker deploys to its free `*.workers.dev` URL (see
     `workers/checkout/README.md`), since a Custom Domain would require `machinemens.com`'s DNS
     to move to Cloudflare.
5. Add the new secrets/vars from the "Deploy configuration" section above
   (`PRINTFUL_API_KEY`, `RESEND_API_KEY`, `PAYPAL_CLIENT_SECRET`, `CHECKOUT_API_URL`) to both the
   `github-pages` and `staging` GitHub Environments.

---

## Project board

Roadmap is tracked on the [Machinemens — Website Roadmap](https://github.com/users/csguth/projects/2)
project board. See `.github/skills/github-project-management/SKILL.md` for the exact `gh` CLI
commands/IDs to triage issues onto it (Status: Todo/In Progress/Done, Priority: High/Medium/Low).

Workflow: every feature/issue is added to the board first with a Priority, then planned (favoring
simplicity), then implemented via a PR targeting `staging`.

---

## Roadmap / open work (post v1)

v1 = Linktree replacement (this repo's initial content: logo + official links, trilingual EN/NL/PT).

Planned next (tracked as issues on the board, not yet built):
- Video player / embedded media section
- Shows / tour dates (agenda)
- Contact form

## Content overview (v1)

- **Brand:** Machinemens (black/death metal band)
- **Languages:** English / Nederlands (auto-detected + manual toggle, persisted)
- **Links:** Spotify (artist + individual releases), YouTube, Instagram — sourced from the band's
  previous Linktree (https://linktr.ee/machinemens)