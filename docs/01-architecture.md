# 01 Architecture

Everything runs inside one Google account owned by SRE ITB (the "org account"). Nothing is hosted elsewhere.

```
Google Form ──submit──▶ Form Responses (raw, locked)
                              │ onFormSubmit (installable)
                              ▼
Master ──▶ Evaluations (one row per period+nim+role, editable scores)
                              │ formulas
                              ▼
                        Summary ──▶ Leaderboard
                              │ menu actions
                              ▼
               Report PDFs, Best Staff posters (Drive)

Daily trigger ──▶ Master birthdays ──▶ poster (Drive) + email to OM
```

## 1. Drive layout

```
SRE Staff Evaluation 26-27/          owned by the org account
├── System/                          spreadsheet (+ bound script), Form
├── Templates/                       Slides: birthday, best staff. Docs: report card
├── Output/
│   ├── Birthday/<YYYY-MM>/
│   ├── BestStaff/<period_id>/
│   └── Reports/<period_id>/<division>/
└── DEV/                             DEV copies used for testing
```

Folder and template IDs go in `Config`, never in code.

## 2. Spreadsheet tabs

| Tab | Purpose | Admin access |
| --- | --- | --- |
| `Config` | Key/value settings + periods table | view |
| `Master` | Staff roster | view |
| `Admins` | Evaluator list for flagging | view |
| `Form Responses` | Raw Form output, linked to the Form | locked, never edit |
| `Evaluations` | One row per `(period_id, nim, role)` | edit score + comment columns only |
| `Summary` | Formulas: final scores, status, progress | view, except `tie_override` |
| `Leaderboard` | Formulas: ranking per division for a chosen period | view, except the period selector |
| `BirthdayLog` | Prevents duplicate birthday sends | locked |
| `Rejected` | Submissions from emails not in `Admins` | view |

Protected ranges are set by the lead with `setupProtections()` (L-03). Only the org account and `LEAD_EMAIL` can edit locked ranges. Scripts run from the menu run as the admin who clicks, so any menu action that writes to a locked tab (for example `openPeriod`) must be run by the lead or the org account.

### 2.1 `Config`

Key/value block (column A key, column B value, header row `key | value`). `setupSheets()` adds any missing key:

| Key | Example | Used by |
| --- | --- | --- |
| `ACTIVE_PERIOD` | `P1` | Evaluations, Reports, posters |
| `OM_EMAILS` | comma-separated | Birthday |
| `FOLDER_BIRTHDAY` | Drive folder ID | Birthday |
| `FOLDER_BEST_STAFF` | Drive folder ID | BestStaffPoster |
| `FOLDER_REPORTS` | Drive folder ID | Reports |
| `TEMPLATE_BIRTHDAY` | Slides ID | Birthday |
| `TEMPLATE_BEST_STAFF` | Slides ID | BestStaffPoster |
| `TEMPLATE_REPORT` | Docs ID | Reports |
| `FORM_ID` | Form ID | FormSync, Setup |
| `ENV` | `DEV` or `PROD` | Setup (`seedFakeData` runs only in `DEV`) |
| `LEAD_EMAIL` | lead's email | Setup (editor of protected ranges) |

Periods table at `Config!D1:G1` headers, data in named range `PERIODS` = `Config!D2:G50`: `period_id | label | start_date | end_date`. Example row: `P1 | Dec 2026 - Feb 2027 | 2026-12-01 | 2027-02-28`.

### 2.2 `Master`

| Col | Field | Notes |
| --- | --- | --- |
| A | `nim` | text, unique key |
| B | `name` | |
| C | `division` | exact value from `docs/00-scope.md` section 3 |
| D | `email` | |
| E | `birth_date` | date |
| F | `photo_file_id` | Drive file ID readable by the org account |
| G | `active` | TRUE/FALSE. Inactive staff are excluded everywhere |

### 2.3 `Admins`

`email | name | role (KW or OM) | division (blank for OM)`. Emails not listed here are rejected (D-023). Listed emails with a role or division mismatch are written and flagged `ROLE_MISMATCH`.

### 2.4 `Evaluations`

| Col | Field | Editable by admins |
| --- | --- | --- |
| A | `period_id` | no |
| B | `nim` | no |
| C | `name` | no |
| D | `division` | no |
| E | `role` (`KW` or `OM`) | no |
| F-I | `i1`..`i4` (integer 1-5, data validation "reject input") | yes |
| J | `comment` (required, non-empty) | yes |
| K | `submitted_by` | no |
| L | `updated_at` | no |
| M | `source` (`FORM` or `MANUAL`) | no |
| N | `flag` (`IGNORED_OM_ROLE`, `ROLE_MISMATCH`, or blank) | no |

Rows with `flag = IGNORED_OM_ROLE` are excluded from all formulas. `ROLE_MISMATCH` is informational and still counted.

### 2.5 `Summary`

One row per active staff per period. Rows are created by `openPeriod()` (A-01). Columns:

| Col | Field |
| --- | --- |
| A-D | `period_id`, `nim`, `name`, `division` |
| E | `has_kw` |
| F | `has_om` (TRUE for OM staff, not required) |
| G-J | `final_i1`..`final_i4` |
| K | `final_total` (rounded to 4 decimals for safe comparison) |
| L | `final_avg` |
| M | `complete` |
| N | `status_auto` (includes `Best Staff (Sementara)`) |
| O | `tie_override` (checkbox, admin-editable) |
| P | `status` (final, after override) |
| Q | `division_complete` |

Formula sketches (A-02 owns the final versions and must keep this section in sync):

```
E2  =COUNTIFS(Evaluations!A:A,$A2, Evaluations!B:B,$B2, Evaluations!E:E,"KW", Evaluations!N:N,"<>IGNORED_OM_ROLE")>0
F2  =IF($D2="Organizational Management", TRUE,
        COUNTIFS(Evaluations!A:A,$A2, Evaluations!B:B,$B2, Evaluations!E:E,"OM", Evaluations!N:N,"<>IGNORED_OM_ROLE")>0)
G2  =IF($D2="Organizational Management", kw_i1, 0.6*kw_i1 + 0.4*om_i1)
K2  =ROUND(SUM(G2:J2), 4)
L2  =K2/4
M2  =AND(E2, F2)
```

`kw_i1` and `om_i1` are lookups on `Evaluations` filtered by period, nim, role, and flag. Status order follows `docs/00-scope.md` section 8.

`tie_override` is a checkbox in the template row (A-02), not a column-wide validation: empty checkboxes hold FALSE and would make `getLastRow()` count every row.

Formulas live in the spreadsheet, not in git. Any change to them must be reflected in this file in the same PR.

### 2.6 `Leaderboard`

A period selector cell at `Leaderboard!B1` (dropdown from `PERIODS`, the only admin-editable cell, constant `LEADERBOARD_PERIOD_SELECTOR_A1`) and one block per division using `SORT(FILTER(Summary...))` by `final_total` descending, showing name, total, average, status.

### 2.7 `BirthdayLog`

`date | nim | poster_file_id | emailed_at`.

### 2.8 `Rejected`

`timestamp | email | period | role | division | nim | reason`. Written by `onFormSubmitHandler`, read-only for admins.

## 3. Google Form

Settings: collect verified email addresses (sign-in required), one response per user OFF, edit after submit OFF, no response receipts.

Field titles are part of the contract. The script maps by title, so do not rename without updating `Config.gs`.

| Section | Field title | Type |
| --- | --- | --- |
| 1 | `Period` | dropdown (from `PERIODS`) |
| 1 | `Evaluator role` | multiple choice: `Kadiv/Wakadiv representative`, `Asso OM` |
| 1 | `Division` | multiple choice, "go to section based on answer" |
| 2-14 (one per division) | `Staff - <division>` | dropdown, items `Name (NIM)` |
| 2-14 | `Meeting attendance and progress-report activeness` | linear scale 1-5, required |
| 2-14 | `Task contribution` | linear scale 1-5, required |
| 2-14 | `Initiative` | linear scale 1-5, required |
| 2-14 | `Teamwork and communication` | linear scale 1-5, required |
| 2-14 | `Comment` | paragraph, required |

Each division section ends with "Submit form". Staff dropdowns and the period list are generated by `FormSync.gs` (B-01), never edited by hand. NIM is parsed with `/\((\d+)\)\s*$/`.

## 4. Apps Script

Container-bound to the spreadsheet. Runtime V8, `timeZone: Asia/Jakarta` in `appsscript.json`.

| File | Owner | Responsibility |
| --- | --- | --- |
| `appsscript.json` | Lead | manifest, time zone, scopes |
| `Config.gs` | Lead | sheet names, column indexes, Form titles, `getConfig()` |
| `Utils.gs` | Lead | shared helpers (logging, date helpers) |
| `Menu.gs` | Lead | `onOpen` custom menu `SRE Tools` |
| `Triggers.gs` | Lead | `installTriggers()`, `removeTriggers()` |
| `Setup.gs` | Lead | `setupSheets()`, `setupForm()`, `setupProtections()`, `seedFakeData()`. Run from the editor only, never from the menu |
| `Evaluations.gs` | Dev A | `onFormSubmitHandler`, `onEditHandler`, `openPeriod()` |
| `Reports.gs` | Dev C | `generateReports(periodId)` |
| `FormSync.gs` | Dev B | `syncForm()` |
| `Posters.gs` | Dev B | shared Slides-to-PNG helper |
| `Birthday.gs` | Dev B | `dailyBirthday()` |
| `BestStaffPoster.gs` | Dev B | `generateBestStaffPosters(periodId)` |

Sheet formulas also have owners: the `Summary` formulas (section 2.5) are owned by Dev A, the `Leaderboard` formulas (section 2.6) by Dev C.

Devs add their menu entries by editing `Menu.gs` in their PR. The lead reviews that change.

### 4.1 Rules for all scripts

- Read and write in bulk (`getValues`, `setValues`). No per-cell loops against the sheet.
- Wrap every write to `Evaluations`, `Summary`, or `BirthdayLog` in `LockService.getScriptLock()`.
- No hardcoded IDs, emails, or dates. Use `getConfig()`.
- Fail loudly: log the error with context and rethrow. Do not swallow errors.

## 5. Triggers

Installed only from the org account by the lead (L-04). Triggers run as the account that installed them.

| Handler | Type | When |
| --- | --- | --- |
| `onFormSubmitHandler` | spreadsheet onFormSubmit | every submission |
| `onEditHandler` | spreadsheet onEdit (installable) | every edit, exits early unless `Evaluations!F:J` |
| `dailyBirthday` | time-driven, daily | 06:00-07:00 Asia/Jakarta |
| `syncForm` | time-driven, daily | 05:00-06:00 Asia/Jakarta, also in the menu |

`generateReports` and `generateBestStaffPosters` are menu-only.

## 6. Limits to respect

Check the official Apps Script quotas page before relying on these numbers.

- Max 6 minutes per execution. Report generation must process in batches (for example one division per run) and resume where it stopped.
- Consumer accounts have a daily cap on email recipients. Birthday sends one email per day to the OM list, not one per staff.
- `Session.getActiveUser().getEmail()` may return empty for edits by other consumer accounts. `onEditHandler` writes `MANUAL (unknown)` in that case. Version history remains the reliable audit trail.

## 7. Data privacy

`Master` holds personal data (birth dates, emails, photos). Never commit real data, exports, or screenshots of it to this repo. Use fake fixtures in DEV copies.
