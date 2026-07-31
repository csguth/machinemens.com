# Copilot instructions — machinemens.com

This repo is a **Hugo-built static site** (Go templates + Tailwind Play CDN + Alpine.js CDN),
mirroring the setup of `csguth/gatoweb.nl`. Read `README.md` first for the full picture
(stack, environments, deploy config). This file has the operating rules for agent sessions.

## Golden rules
- The site is generated with **Hugo** (SSG). Shared markup lives in `layouts/` (partials +
  `_default/baseof.html`); page content/metadata lives in `content/**/_index.md`; assets served
  as-is live in `static/`. The build outputs to `site/` (git-ignored). Keep dependencies minimal:
  only Hugo + the CDN scripts — no npm/bundler/JS toolchain unless the user explicitly asks.
- Runtime is a plain static site, but i18n is now done at **compile time** (see below): Hugo
  renders one fully-translated page per language under a language-prefixed URL (`/en/…`,
  `/nl/…`, `/pt/…`). The bare root `/` is a tiny JS redirect to the visitor's language.
- Never edit `main` or `staging` directly. All work happens on a feature branch, PR'd into
  `staging` first. Promotion `staging -> main` is its own PR (regular merge, not squash/rebase).
  Hotfixes may branch from `main` and merge back to `main` with the `hotfix` label — then must
  also be synced into `staging`.
- `.github/workflows/guard-main-merges.yml` enforces the above for PRs into `main`. Don't
  remove/weaken it without the user's explicit approval.
- Placeholders `__SITE_URL__` / `__ENV_LABEL__` are kept verbatim in the generated HTML and
  substituted at deploy time by the workflows (each runs `hugo` then `sed`) — never hardcode a
  real domain or env label into the layouts/partials, `static/robots.txt` or `static/sitemap.xml`.
- i18n is **compile-time / URL-per-language** (Hugo multilingual). Every user-facing UI string
  lives in `i18n/{en,nl,pt}.toml` and is emitted with `{{ i18n "key" }}`; per-page metadata
  (title/description) lives in `content/**/_index.{en,nl,pt}.md`. Internal links use `relLangURL`
  so navigation stays within the active language. The header language selector is plain links to
  `.AllTranslations` (each language's URL). The client preference is still saved in
  `localStorage.machinemens_lang`: `static/js/lang-persist.js` writes the current page's lang on
  every load, and `static/js/root-redirect.js` (served from the root alias, `layouts/alias.html`)
  reads it to send returning visitors to `/en|nl|pt/`. Don't reintroduce client-side `.en/.nl/.pt`
  span toggling — add new strings as i18n keys in all three `i18n/*.toml` files.

## Project board workflow
Every feature/issue is triaged onto the "Machinemens — Website Roadmap" GitHub Project **first**
(with a Priority set), then planned favoring simplicity, then implemented as a PR into `staging`.
Use the `.github/skills/github-project-management/SKILL.md` skill for the exact `gh` CLI commands
and IDs (project number, field IDs, option IDs) — don't rediscover them by querying the API from
scratch each session.

## Feature branch preview
When a PR targets `staging`, the existing `deploy-staging-cloudflare.yml` workflow can be manually
dispatched (`workflow_dispatch`) on the feature branch itself to produce an isolated Cloudflare
Pages preview URL before merging, the same way gatoweb.nl's `/deploy-preview` prompt works. It
reuses the `staging` GitHub Environment's config, so treat preview data as shared with staging.

## Secrets/vars this repo depends on (all one-time setup, see README "Deploy configuration")
- Repo/environment variables: `SITE_URL`, `ENV_LABEL`
- Staging-only: `CLOUDFLARE_ACCOUNT_ID` (var), `CLOUDFLARE_API_TOKEN` (secret)
None of these are stored in the repo; if a workflow fails with "Missing variable", it's a one-time
GitHub Settings configuration gap, not a code bug — tell the user which one is missing.

## Current state (v2 — multi-page restructure in progress)
The site is moving from a single-page Linktree replacement to a multi-page architecture
(tracked as epic #47): `/` (home hub with teasers) + dedicated pages `/music/`, `/shows/`,
`/news/`, `/shop/`. Shared header/nav/footer markup is now factored into Hugo partials
(`layouts/partials/`) + `layouts/_default/baseof.html`. `/music/` is data-driven from
`static/data/releases.json` (Alpine `fetch` + `x-for`) so new releases don't require new markup;
`/shows/` and `/news/` should follow the same data-driven approach when implemented. A new page is
a new `content/<section>/_index.{en,nl,pt}.md` + a `layouts/<section>/list.html`, with UI strings
added to `i18n/*.toml`. Remaining pages/features are tracked on the project board — don't build
them speculatively without an issue/plan first.

## Building locally
Install Hugo (extended) and run `hugo` from the repo root to generate `site/`, or `hugo server`
for a live preview. The CI workflows install a pinned Hugo version and run `hugo --gc --minify`
(minified output) before the `sed` placeholder substitution. `hugo --minify` only covers
rendered HTML/CSS — static JS in `site/js/` is minified separately in CI with `npx terser`
(no repo dependency added; never run locally, so the site stays zero-build).