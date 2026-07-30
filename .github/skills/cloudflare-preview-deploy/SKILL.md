---
name: cloudflare-preview-deploy
description: 'Check/report the Cloudflare Pages PR preview deploy for machinemens.com. Use whenever a PR is opened targeting `staging`, whenever a commit is pushed to a feature branch with an open PR into `staging`, or whenever the user asks to "dispare o preview" / "mande pra staging" / check a deploy.'
argument-hint: '[branch name or PR number]'
---

# Cloudflare Preview Deploy (machinemens.com)

## When to Use
- Whenever the user asks to trigger/check a preview deploy, or wants the preview link surfaced
  in chat instead of just reading the PR comment themselves.
- After merging a PR into `staging` (auto-deploys to `staging.machinemens.com`).

## Background
Two workflows split staging-related Cloudflare Pages deploys, mirroring gatoweb.nl:

- `.github/workflows/deploy-preview-cloudflare.yml` — runs on `pull_request`
  (opened/synchronize/reopened) **targeting `staging`**. Deploys to a stable
  `pr-<number>` alias on the `machinemens-com-staging` Cloudflare project (isolated per PR,
  re-deployed on every push) and **automatically posts/updates a sticky comment** on the PR
  with the preview URL (marker `<!-- cloudflare-pr-preview -->`). No manual dispatch or
  watching needed — the comment appears on its own within a couple of minutes of the
  PR being opened or updated.
- `.github/workflows/deploy-staging-cloudflare.yml` — runs on `push` to `staging` (real deploy
  to `staging.machinemens.com`) and `workflow_dispatch` (manual fallback). Does **not** run on
  pull requests anymore.

## Procedure: Report a Preview Link
1. **Prefer reading the sticky PR comment directly** instead of digging through workflow logs:
   ```
   gh pr view <pr-number> --json comments --jq '.comments[] | select(.body | contains("cloudflare-pr-preview")) | .body'
   ```
   If the comment isn't there yet, the workflow is likely still running — check with:
   ```
   gh run list --workflow "deploy-preview-cloudflare.yml" --branch <branch> --limit 3
   ```
   and optionally `gh run watch <run-id> --exit-status` before re-checking the comment.

2. **Report to the user**: share the preview URL from the sticky comment, even if not asked
   explicitly — don't just say "deploy succeeded".

3. If the run fails, fetch the failing step's log (`gh run view <run-id> --log`) and summarize
   the error instead of the URL.

4. For a branch without an open PR yet, there is no automatic trigger — open the PR first
   (via `create-pr`/`create-draft-pr` skills), which will trigger the preview workflow.

## Notes
- This is always the *staging* Cloudflare Pages project (`machinemens-com-staging`), never
  production. Production deploys are handled by `.github/workflows/deploy-pages.yml` on `main`.
- A push to `staging` itself (e.g. after merging a PR) triggers `deploy-staging-cloudflare.yml`
  instead — apply the same "check and report" mindset to confirm `staging.machinemens.com`
  updated successfully (`gh run list --workflow "deploy-staging-cloudflare.yml" --branch staging`).
- Preview URLs are per-PR (stable `pr-<number>` alias) and shared with the `staging` GitHub
  Environment config — treat them as pointing to shared staging data, not isolated per-branch data.
