# Copilot instructions — machinemens.com

This repo is a **zero-build static site** (plain HTML + Tailwind Play CDN + Alpine.js CDN),
mirroring the setup of `csguth/gatoweb.nl`. Read `README.md` first for the full picture
(stack, environments, deploy config). This file has the operating rules for agent sessions.

## Golden rules
- No build tooling, no npm/node dependency, no bundler. Keep it this way unless the user
  explicitly asks to add a build step.
- Never edit `main` or `staging` directly. All work happens on a feature branch, PR'd into
  `staging` first. Promotion `staging -> main` is its own PR (regular merge, not squash/rebase).
  Hotfixes may branch from `main` and merge back to `main` with the `hotfix` label — then must
  also be synced into `staging`.
- `.github/workflows/guard-main-merges.yml` enforces the above for PRs into `main`. Don't
  remove/weaken it without the user's explicit approval.
- Placeholders `__SITE_URL__` / `__ENV_LABEL__` are substituted at deploy time by the workflows —
  never hardcode a real domain or env label into `index.html`/`robots.txt`/`sitemap.xml`.
- i18n: every user-facing string needs `.en`, `.nl` and `.pt` elements (see `index.html` for the
  pattern), toggled by `js/lang-toggle.js` via the `data-lang` attribute on `<body>`
  (`localStorage.machinemens_lang`). Don't introduce a different i18n mechanism.

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
`/news/`, `/shop/`. Each new page duplicates the shared header/nav/footer markup (zero-build,
no includes) and must replicate the i18n (en/nl/pt) pattern. `/music/` is data-driven from
`data/releases.json` (Alpine `fetch` + `x-for`) so new releases don't require new markup;
`/shows/` and `/news/` should follow the same data-driven approach when implemented. Remaining
pages/features are tracked on the project board — don't build them speculatively without an
issue/plan first.