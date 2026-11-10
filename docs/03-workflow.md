# 03 Workflow

Lightweight on purpose: 5 people, one Apps Script project, a small CI that only checks rules (D-029).

## 1. Environments

| Env | What | Who pushes code |
| --- | --- | --- |
| DEV | Copy of the spreadsheet + Form + bound script, fake data, one per dev | Each dev, to their own copy |
| PROD | The real spreadsheet used by OM, owned by the org account | Lead only, after merge |

Never test against PROD. Never put real staff data in DEV.

## 2. One-time setup (per dev)

1. Install Node.js LTS, then `npm install -g @google/clasp`.
2. Enable the Apps Script API for your account: https://script.google.com/home/usersettings
3. `clasp login`.
4. Clone the repo. Copy `.clasp.example.json` to `.clasp.json` and set `scriptId` to your DEV copy (Extensions > Apps Script > Project Settings > Script ID).
5. `.clasp.json` is gitignored. Do not commit it.
6. `clasp push`, then in your DEV spreadsheet fill the `Config` tab with `ENV = DEV` and run, from the Apps Script editor: `setupSheets()`, `seedFakeData()`, `setupForm()`. Running them again is safe.

## 3. Flow for one task

```
read work order (tasks/<ID>.md) + docs/00-scope.md
  -> git switch -c feat/<ID>-<slug>
  -> edit src/*.gs
  -> clasp push            (to your DEV copy)
  -> test every "Done =" item in your DEV copy, take screenshots
  -> commit, push branch, open PR with the template
  -> review by the dev named as Reviewer in the work order (24h) -> approval by lead (24h)
  -> lead squash-merges into main
  -> lead runs clasp push to PROD (batched, not after every merge)
```

## 4. Branches and commits

- `main` is the only long-lived branch. No direct pushes; everything goes through a PR.
- Branch names: `feat/<ID>-<slug>`, `fix/<ID>-<slug>`, `docs/<slug>`.
- Conventional Commits: `feat`, `fix`, `docs`, `refactor`, `chore`. Example: `feat(A-01): upsert form submissions into Evaluations`.

## 5. Pull requests

- Use `.github/PULL_REQUEST_TEMPLATE.md`.
- One work order per PR. Keep PRs under about 300 changed lines.
- Proof: one screenshot or short recording per `Done =` item, taken from your DEV copy with fake data.
- If you changed spreadsheet formulas, protections, or Form fields, describe the change in the PR and update `docs/01-architecture.md` in the same PR. These live outside git, so the doc is their only record.
- Reviewer checks: matches the work order, stays inside its boundary, follows `docs/01-architecture.md` section 4.1, no hardcoded IDs or personal data.

### 5.1 CI checks

Every PR to `main` runs `.github/workflows/ci.yml`. All checks must pass before merge.

| Check | Fails when |
| --- | --- |
| `syntax` | A `src/*.gs` file has a JavaScript syntax error |
| `guardrails` | `src/` has `import`/`export`, a string that looks like a Drive ID, or an email address. `.clasp.json` is committed. `appsscript.json` is not `Asia/Jakarta` + `V8` |
| `boundary` | A `feat/<ID>-*` or `fix/<ID>-*` branch changes a file not listed under `Files` in `tasks/<ID>.md` (`docs/01-architecture.md` and `tasks/<ID>.md` are always allowed) |
| `pr-hygiene` | PR title is not a Conventional Commit, or the branch name does not follow section 4 |
| `proof-of-work` | The PR description still contains `PROOF-PENDING`. Docs-only PRs write "docs only" under Proof instead |

CI cannot check Apps Script behavior. The `Done =` screenshots remain the real test.

## 6. Deploying to PROD (lead)

Keep `.clasp.prod.json` (PROD script ID, gitignored) next to `.clasp.json`. Never store org account credentials in GitHub (D-029).

1. `git switch main && git pull`.
2. `scripts/deploy-prod.sh`. It refuses to run unless you are on `main`, the tree is clean, and `main` equals `origin/main`. It pushes with `.clasp.prod.json` and leaves `.clasp.json` pointing at your DEV copy. It creates a local tag `prod-YYYYMMDD-HHMM` and prints the command to push it.
3. Apply any sheet or Form changes listed in merged PRs by hand.
4. Smoke test: one Form submission with a test row, then delete that row.

## 7. Communication

- Async standup in the group chat on workdays: done / next / blocked.
- Weekly checkpoint meeting, 30 minutes, dates and pass conditions in `docs/02-assignments.md`.
- Blocked more than 4 hours: tag the lead.
- Decisions that change scope, rules, or structure go to `DECISIONS.md` via PR. Business rule changes go to the PRD first.
