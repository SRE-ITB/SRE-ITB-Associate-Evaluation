# 02 Assignments and Timeline

## Team

| Role | Name | Owns |
| --- | --- | --- |
| Lead | Reinsen Silitonga (Wakadiv IT Development) | Setup, data structure, org account, review, triggers, UAT with OM |
| Dev A | TBD | Evaluation data flow, scoring, leaderboard, report cards |
| Dev B | TBD | Form sync, birthday poster + email, Best Staff poster |
| Designer | Jevon (UI/UX, IT Development) | Poster and report card templates |

Rules:

- One active work order per person. Start the next only when the current one is merged.
- Dev A and Dev B review each other's PRs first, then the lead approves and merges.
- Each person writes the docs for their own part in the same PR.

## Work orders

| ID | Owner | Title | Depends on | Target |
| --- | --- | --- | --- | --- |
| L-01 | Lead | Org account, Drive structure, access | - | 2026-11-11 |
| L-02 | Lead | Repo, clasp, DEV copies | L-01 | 2026-11-12 |
| L-03 | Lead | Spreadsheet skeleton, Form skeleton, Master data import | L-01 | 2026-11-14 |
| D-01 | Designer | Templates: birthday, Best Staff, report card | - | 2026-11-15 |
| A-01 | Dev A | Evaluations upsert, rejection, edit audit, openPeriod | L-02, L-03 | 2026-11-18 |
| B-01 | Dev B | FormSync: periods and staff dropdowns | L-02, L-03 | 2026-11-17 |
| A-02 | Dev A | Summary formulas and status | A-01 | 2026-11-21 |
| B-02 | Dev B | Daily birthday poster + email | L-03, D-01 | 2026-11-21 |
| A-03 | Dev A | Leaderboard and progress | A-02 | 2026-11-23 |
| B-03 | Dev B | Best Staff poster generation | A-02, B-02, D-01 | 2026-11-25 |
| A-04 | Dev A | Report card PDF generation | A-02, D-01 | 2026-11-26 |
| L-04 | Lead | Install triggers on PROD, UAT with OM | all above | 2026-11-28 |

Everything is due by 2026-11-30 (D-025).

## Timeline

| Week | Dates | Goal |
| --- | --- | --- |
| 1 | 9-15 Nov | PRD approved by OM. L-01..L-03 done. Templates (D-01) done |
| 2 | 16-22 Nov | A-01, A-02, B-01, B-02 merged |
| 3 | 23-26 Nov | A-03, A-04, B-03 merged |
| - | 27-28 Nov | L-04: triggers on PROD, UAT with OM |
| - | 29-30 Nov | Fixes from UAT. **Ready on 30 Nov** |

## Critical path and risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Templates late (D-01) | B-02 blocked, no birthday posters in December | Designer starts day 1. B-02 can build against a placeholder template |
| Master data photos not readable by the org account | Birthday and Best Staff posters fail | Check in L-03, before B-02 starts |
| A-01 slips | A-02, A-03 slip, UAT shrinks | Lead pairs with Dev A early in week 2 |
| One dev unavailable | Single point of failure | Cross-review keeps both devs familiar with each other's code |
| Dev A carries 4 work orders in under 3 weeks | A-04 slips past UAT | If A-02 is late on 21 Nov, move A-04 to Dev B |
