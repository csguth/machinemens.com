# machinemens.com — Machinemens official website

Official website for **Machinemens** (black/death metal band), replacing the band's Linktree.

## Stack (zero build process, all free/cheap)

| Tool | Purpose | Cost |
|---|---|---|
| Plain HTML + Tailwind CDN | Website | Free |
| Alpine.js CDN | EN/NL bilingual toggle | Free |
| GitHub Pages | Production hosting + HTTPS | Free |
| Cloudflare Pages | Staging hosting (`staging.<domain>`) | Free |
| Domain registrar: Namecheap | Custom domain (`machinemens.com`, registered) | ~€10-15/year |

**Monthly cost: €0** (just the domain renewal once a year)

This repo intentionally mirrors the setup of [csguth/gatoweb.nl](https://github.com/csguth/gatoweb.nl)
(branching model, staging/production split, i18n pattern) so both projects are easy to maintain
with the same mental model.

---

## Repository structure

```
index.html           Public landing page (bilingual EN/NL) — v1 is a Linktree replacement
css/site.css          Styles: brand colors, staging banner, EN/NL show/hide rules
js/lang-toggle.js      Alpine component for the EN/NL toggle (localStorage-persisted)
js/tailwind-config.js  Tailwind Play CDN theme extension (brand colors)
images/logo.png        Band logo (wordmark), also used as favicon
robots.txt, sitemap.xml
.github/workflows/
  deploy-pages.yml               Production deploy -> GitHub Pages (push to main)
  deploy-staging-cloudflare.yml  Staging deploy -> Cloudflare Pages (push to staging)
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
# Merge -> auto-deploys to staging (Cloudflare Pages)
# Test manually on staging
# Open a PR: staging -> main  (use a regular merge, NEVER squash/rebase,
#                              so the exact tested commit reaches main)
# Merge -> auto-deploys to production (GitHub Pages)
```

Hotfixes can branch directly from `main` and be merged back into `main` via a PR labeled
`hotfix` (bypasses the "must come from staging" guard) — then the same fix should be
cherry-picked/merged into `staging` too so both branches stay in sync.

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

### Internal / infra (staging only)
- `CLOUDFLARE_ACCOUNT_ID` (repo variable) and `CLOUDFLARE_API_TOKEN` (repo **secret**) — used only
  by the staging deploy workflow, same Cloudflare account as gatoweb.nl, dedicated Pages project
  `machinemens-com-staging`.

Notes:
- Language default: browser language detection (`nl` → Dutch) with fallback to English, or the
  user's previous manual choice, persisted in `localStorage.machinemens_lang`.
- Placeholders `__SITE_URL__` / `__ENV_LABEL__` in `index.html`, `robots.txt`, `sitemap.xml` are
  substituted with `sed` at deploy time — see each workflow's "Build site with injected variables" step.

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

---

## Project board

Roadmap is tracked on the [Machinemens — Website Roadmap](https://github.com/users/csguth/projects/2)
project board. See `.github/skills/github-project-management/SKILL.md` for the exact `gh` CLI
commands/IDs to triage issues onto it (Status: Todo/In Progress/Done, Priority: High/Medium/Low).

Workflow: every feature/issue is added to the board first with a Priority, then planned (favoring
simplicity), then implemented via a PR targeting `staging`.

---

## Roadmap / open work (post v1)

v1 = Linktree replacement (this repo's initial content: logo + official links, bilingual EN/NL).

Planned next (tracked as issues on the board, not yet built):
- Shop / e-commerce (merch)
- Video player / embedded media section
- Shows / tour dates (agenda)
- Contact form

## Content overview (v1)

- **Brand:** Machinemens (black/death metal band)
- **Languages:** English / Nederlands (auto-detected + manual toggle, persisted)
- **Links:** Spotify (artist + individual releases), YouTube, Instagram — sourced from the band's
  previous Linktree (https://linktr.ee/machinemens)