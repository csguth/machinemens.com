---
name: cloudflare-preview-deploy
description: 'Trigger, watch, and report the Cloudflare Pages staging preview deploy for machinemens.com. Use whenever a PR is opened targeting `staging`, whenever a commit is pushed to a feature branch with an open PR into `staging`, or whenever the user asks to "dispare o preview" / "mande pra staging" / check a deploy.'
argument-hint: '[branch name or PR number]'
---

# Cloudflare Preview Deploy (machinemens.com)

## When to Use
- **Immediately after opening a PR targeting `staging`** (via `gh pr create` or the
  `create-pr`/`create-draft-pr` skills) — always watch the resulting preview deploy and report
  the link, without waiting for the user to ask.
- After pushing new commits to a feature branch that has an open PR targeting `staging`.
- Whenever the user asks to trigger/check a preview deploy.
- After merging a PR into `staging` (auto-deploys to `staging.machinemens.com`).

## Background
`.github/workflows/deploy-staging-cloudflare.yml` runs on:
- `push` to `staging` (real staging deploy → `staging.machinemens.com`)
- `pull_request` targeting `staging` (preview deploy, auto-triggered on PR open/sync — no manual dispatch needed)
- `workflow_dispatch` (manual fallback, e.g. for branches without an open PR yet)

Every push to a branch with an open PR into `staging` **automatically** triggers a new preview
run. Do not run `gh workflow run` manually unless the branch has no open PR yet.

## Procedure: Watch a Deploy and Report the Link

1. **Find the run** (usually already triggered by the push moments earlier):
   ```
   gh run list --workflow "deploy-staging-cloudflare.yml" --branch <branch> --limit 3
   ```
   If no run shows up yet for the latest commit, wait a few seconds and re-check, or fall back to
   manual dispatch: `gh workflow run "Deploy Staging (Cloudflare Pages)" --ref <branch>`.

2. **Watch it to completion** (use async mode with a long delay, don't block indefinitely):
   ```
   gh run watch <run-id> --exit-status
   ```

3. **Extract the preview URL** from the job log once it succeeds:
   ```
   gh run view <run-id> --log | Select-String "pages.dev"
   ```
   (Grep for `pages.dev`; the deploy step prints `✨ Deployment complete! Take a peek over at https://<hash>.machinemens-com-staging.pages.dev`.)

4. **Report to the user**: always share the resulting preview URL directly, even if not asked
   explicitly — don't just say "deploy succeeded".

5. If the run fails, fetch the failing step's log and summarize the error instead of the URL.

## Notes
- This is always the *staging* Cloudflare Pages project (`machinemens-com-staging`), never
  production. Production deploys are handled by `.github/workflows/deploy-pages.yml` on `main`.
- A push to `staging` itself (e.g. after merging a PR) also triggers this workflow — apply the
  same watch-and-report procedure to confirm `staging.machinemens.com` updated successfully.
- Preview URLs are per-deploy (unique hash subdomain) and shared with the `staging` GitHub
  Environment config — treat them as pointing to shared staging data, not isolated per-branch data.
