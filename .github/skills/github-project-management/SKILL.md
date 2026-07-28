---
name: github-project-management
description: 'Triage and manage issues on the "Machinemens — Website Roadmap" GitHub Project (owner csguth, project #2). Use when creating issues, adding items to the project board, setting Status/Priority, applying labels, or reviewing/reporting on the roadmap board.'
argument-hint: '[issue title or task description]'
---

# GitHub Project Management (Machinemens — Website Roadmap)

## When to Use
- Creating a new issue and triaging it onto the project board
- Adding an existing issue/PR to the project
- Setting or updating `Status` or `Priority` on a project item
- Applying/removing repo labels during triage
- Reporting on what's Todo / In Progress / Done, or listing items by priority

## Prerequisites
- `gh` CLI authenticated with access to `csguth/machinemens.com` and the user's projects
- Requires `project` scope: if commands fail with a permissions error, run `gh auth refresh -s project` first

## Key IDs (avoid re-discovering these every session)

| Item | Value |
|---|---|
| Repo | `csguth/machinemens.com` |
| Project owner | `csguth` |
| Project number | `2` |
| Project title | Machinemens — Website Roadmap |
| Project node ID | `PVT_kwHOABmUcs4BefWA` |

### Status field (`ProjectV2SingleSelectField`)
| Option | ID |
|---|---|
| Todo | `f75ad846` |
| In Progress | `47fc9ee4` |
| Done | `98236657` |

Field ID: `PVTSSF_lAHOABmUcs4BefWAzhY5JWI`

### Priority field (`ProjectV2SingleSelectField`, custom)
| Option | ID |
|---|---|
| High | `af690cab` |
| Medium | `7429a189` |
| Low | `319e89cd` |

Field ID: `PVTSSF_lAHOABmUcs4BefWAzhY5JZk`

If field/option IDs ever stop working (e.g. project was recreated), refresh them with:
```
gh project field-list 2 --owner csguth --format json
```

### Repo labels
`bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`
(no priority labels exist — priority is tracked via the project's `Priority` field, not labels)

## Procedure: Full Triage of a New Task

1. **Create the issue** (skip if it already exists):
   ```
   gh issue create --repo csguth/machinemens.com --title "<title>" --body "<description>" --label "<label>"
   ```
   Capture the returned issue URL/number.

2. **Add the issue to the project** — this returns the project *item ID* (different from the issue number), needed for all following steps:
   ```
   gh project item-add 2 --owner csguth --url https://github.com/csguth/machinemens.com/issues/<N> --format json
   ```
   Extract `.id` from the JSON output as `ITEM_ID`.

3. **Set Status**:
   ```
   gh project item-edit --project-id PVT_kwHOABmUcs4BefWA --id <ITEM_ID> \
     --field-id PVTSSF_lAHOABmUcs4BefWAzhY5JWI --single-select-option-id <STATUS_OPTION_ID>
   ```

4. **Set Priority**:
   ```
   gh project item-edit --project-id PVT_kwHOABmUcs4BefWA --id <ITEM_ID> \
     --field-id PVTSSF_lAHOABmUcs4BefWAzhY5JZk --single-select-option-id <PRIORITY_OPTION_ID>
   ```

5. **Confirm** by listing the item:
   ```
   gh project item-list 2 --owner csguth --format json
   ```

Ask the user for Status/Priority/labels if not specified — do not guess a priority for someone else's task.

## Procedure: Move Existing Item Between Statuses

1. Find the item ID: `gh project item-list 2 --owner csguth --format json` and match by issue title/number.
2. Run the `item-edit` command from step 3 above with the new Status option ID.

## Procedure: Post-Merge Board Update (mandatory)

**Whenever a PR is merged into `staging` or `main` and its resulting deploy workflow
succeeds**, immediately update the board for every issue that PR closes/addresses — but the
issue is only **closed** once the change has actually reached **production** (`main`):

- **Merge into `staging` + successful staging deploy** (not yet promoted to `main`):
  - Keep the issue **open**.
  - Set/keep board Status = **In Progress** (`47fc9ee4`) — not Done.
  - Add a comment noting it's live on staging (with the verified staging URL) and still
    pending promotion to `main`/production.
- **Promotion PR merged into `main` + successful production deploy**:
  - **Close** the issue: `gh issue close <N> --repo csguth/machinemens.com --reason completed --comment "..."`
    referencing the PR(s) and the verified production URL.
  - Confirm the project item's Status flips to **Done** — closing usually auto-syncs it via
    the project's built-in workflow; verify with `gh project item-list 2 --owner csguth --format json`
    and only run the manual `item-edit` Status update if it didn't auto-sync.
- If an issue is mistakenly closed/marked Done on a staging-only merge, reopen it
  (`gh issue reopen <N> --repo csguth/machinemens.com --comment "..."`) and manually reset
  board Status back to **In Progress** — reopening does **not** automatically revert the
  project Status field, so that step must be done explicitly.

Do this before moving on to the next task — don't batch it for later or wait to be asked.
This applies to every merge+successful-deploy cycle going forward, not just one-off requests.

## Procedure: Board Report

```
gh project item-list 2 --owner csguth --format json
```
Group the returned items by `status` field value and summarize (counts + titles) per column. Include Priority per item when relevant.

## Notes
- Prefer the `gh` CLI (`gh issue`, `gh project`, `gh label`) over MCP GitHub tools per this repo's tooling conventions.
- Labels are managed at the repo level (`gh label create/edit/delete --repo csguth/machinemens.com`), separate from the project's own `Labels` field (which just mirrors issue labels).
- If a new custom field or option is needed, create it with `gh project field-create` and update the tables above so future sessions don't need to rediscover it.
- This repo follows the same feature -> staging -> main promotion workflow as csguth/gatoweb.nl. Every feature/issue is added to this board first (with Priority set), then planned (favor simplicity), then implemented as a PR targeting `staging`.