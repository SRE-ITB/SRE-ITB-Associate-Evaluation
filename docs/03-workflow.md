# 03 Workflow

Lightweight on purpose: 5 people, one Apps Script project, a small CI that only checks rules (D-029).

## 1. Environments

| Env | What | Who pushes code |
| --- | --- | --- |
| DEV | Copy of the spreadsheet + Form + bound script, fake data, one per dev | Each dev, to their own copy |
| PROD | The real spreadsheet used by OM, in the Shared drive, bound script and triggers owned by the org account | Lead only, after merge |

Never test against PROD. Never put real staff data in DEV.

## 2. One-time setup (per dev)

1. Install Node.js LTS, then `npm install -g @google/clasp`.
2. Enable the Apps Script API for your account: https://script.google.com/home/usersettings
3. `clasp login`.
4. Clone the repo. Copy `.clasp.example.json` to `.clasp.json` and set `scriptId` to your DEV copy (Extensions > Apps Script > Project Settings > Script ID).
5. `.clasp.json` is gitignored. Do not commit it.
6. In the `DEV/` folder of the Shared drive, create a spreadsheet `DEV - <your name>` and a folder `DEV - <your name>/Output` for posters and report cards. Its script ID goes into `.clasp.json` (step 4).
7. `clasp push`. In the Apps Script editor, pick `Setup.gs`, pick `setupSheets`, click Run. On the first run accept the authorization prompt (Advanced > Go to ... (unsafe) > Allow; normal for an unverified script of your own).
8. In the `Config` tab set `ENV = DEV`, then run `seedFakeData()` and `setupForm()`. Reload the spreadsheet: the `SRE Tools` menu appears. Running any setup function again is safe.

The same guide in Indonesian lives in the PRD tab "Cara Kerja Appscript".

### 2.1 Daily loop outside VS Code

1. Edit in VS Code, `clasp push`.
2. Refresh the Apps Script editor tab so it loads the pushed code.
3. Run the function you are working on (pick file and function in the toolbar, click Run). For menu functions, reload the spreadsheet and use `SRE Tools`.
4. Read the Execution log under the editor. For trigger runs, open the Executions page (list icon in the left sidebar).
5. Check the result in the DEV spreadsheet or Form and take one screenshot per `Done =` item.

Never edit code in the Apps Script editor. It is not in git and the next `clasp push` overwrites it.

### 2.2 Triggers in DEV

`installTriggers()` is for PROD and the lead only. In DEV, add what you need by hand on the Triggers page (clock icon) > Add Trigger:

| Function | Event source | Event type | Who |
| --- | --- | --- | --- |
| `onFormSubmitHandler` | From spreadsheet | On form submit | Juan |
| `onEditHandler` | From spreadsheet | On edit | Juan |

Do not install the daily `syncForm` and `dailyBirthday` triggers in DEV. Run those functions with Run instead of waiting for the morning.

### 2.3 Per-dev work outside VS Code

| Dev | In the DEV spreadsheet, Form, or Drive |
| --- | --- |
| Juan (A) | Submit through the DEV Form (Form > Go to live form). Add your own email to `Admins` as `KW` with a division to test KW submissions (`seedFakeData` already adds you as `OM`). Test rejection from a second Gmail not in `Admins`. Test manual edits and multi-row pastes in `Evaluations!F:J`. Write the `Summary` formulas (A-02) in the template row, then copy them into `docs/01-architecture.md` section 2.5 |
| Bayu (B) | After `syncForm`, open the DEV Form in edit mode to check each division dropdown. Never add, remove, or rename Form items by hand. Copy the poster templates into your DEV folder (a plain Slides file with the same placeholders until D-01 lands) and set `TEMPLATE_*`, `FOLDER_BIRTHDAY`, `FOLDER_BEST_STAFF` in DEV `Config` to your copies and your DEV `Output` folder. Set DEV `OM_EMAILS` to your own email. To test birthdays, set one fake `birth_date` to today and run `dailyBirthday` |
| Karmel (C) | Before A-02 is merged, type fake `Summary` rows by hand following section 2.5. Write the `Leaderboard` formulas (C-01) with the period selector in `B1`, then copy them into `docs/01-architecture.md` section 2.6. Copy the report template into your DEV folder, set `TEMPLATE_REPORT` and `FOLDER_REPORTS` in DEV `Config`, generate from the menu, and check that no temporary Docs are left behind |

Anything you change in a sheet or Form (formulas, validation, conditional formatting, protections, Form settings) is not in git. Record it in `docs/01-architecture.md` and under "Changes outside git" in the same PR.

### 2.4 Never, in any copy

- Open or change the PROD spreadsheet, Form, or script.
- Run `installTriggers()`, push to PROD, or point `.clasp.json` at someone else's script.
- Rename tabs, columns, or Form items. They are the contract the code reads.
- Put file IDs, folder IDs, or emails in code. Use `Config`.
- Send many emails while testing. Consumer Gmail has a daily recipient cap.
- Copy real data from PROD into DEV.

### 2.5 Resetting a DEV copy

| Problem | Fix |
| --- | --- |
| Bad data | Delete rows 2 and below in the affected tab, run `seedFakeData()` again (it only fills empty tabs) |
| Missing tab or header | Run `setupSheets()` again (adds what is missing, never deletes data) |
| Everything broken | Create a new DEV spreadsheet and repeat steps 6 to 8 with the new script ID |

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
| `proof-of-work` | The PR changes a file under `src/` and its description still contains `PROOF-PENDING`. PRs that change nothing under `src/` skip this check |

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
