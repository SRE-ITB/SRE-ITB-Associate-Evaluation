# 02 Assignments and Timeline

## Team

| Role | Name | Owns |
| --- | --- | --- |
| Lead | Reinsen Silitonga (Wakadiv IT Development) | Setup, data structure, org account, review, triggers, UAT with OM |
| Dev A | TBD | Evaluation data flow, rejection of unregistered emails, scoring and status |
| Dev B | TBD | Form sync, birthday poster + email, Best Staff poster |
| Dev C | TBD | Leaderboard and progress, report cards |
| Designer | Jevon (UI/UX, IT Development) | Poster and report card templates |

Rules:

- One active work order per person. Start the next only when the current one is merged.
- Reviews rotate: Dev C reviews Dev A, Dev A reviews Dev B, Dev B reviews Dev C. Then the lead approves and merges.
- Each person writes the docs for their own part in the same PR.

## Work orders

| ID | Owner | Title | Depends on | Target |
| --- | --- | --- | --- | --- |
| L-01 | Lead | Org account, Drive structure, access | - | 2026-11-11 |
| L-02 | Lead | Repo, clasp, DEV copies | L-01 | 2026-11-12 |
| L-03 | Lead | Spreadsheet skeleton, Form skeleton, Master data import | L-01 | 2026-11-14 |
| D-01 | Designer | Templates: birthday, Best Staff, report card | - | 2026-11-15 |
| B-01 | Dev B | FormSync: periods and staff dropdowns | L-02, L-03 | 2026-11-17 |
| A-01 | Dev A | Evaluations upsert, rejection, edit audit, openPeriod | L-02, L-03 | 2026-11-18 |
| A-02 | Dev A | Summary formulas and status | A-01 | 2026-11-21 |
| B-02 | Dev B | Daily birthday poster + email | L-03, D-01 | 2026-11-21 |
| C-01 | Dev C | Leaderboard and progress | L-03 (build against fake Summary rows), re-test after A-02 | 2026-11-23 |
| B-03 | Dev B | Best Staff poster generation | A-02, B-02, D-01 | 2026-11-25 |
| C-02 | Dev C | Report card PDF generation | D-01 (build against fake Summary rows), re-test after A-02 | 2026-11-25 |
| L-04 | Lead | Install triggers on PROD, UAT with OM | all above | 2026-11-28 |

Everything is due by 2026-11-30 (D-025).

## Weekly checkpoints

No formal sprints and no tasks/sprint-N folders. Each checkpoint is a 30-minute meeting: everyone demos their work from their DEV copy, then the lead decides to continue or adjust. Everything is due by 2026-11-30.

| Checkpoint | Date | Pass condition | If it fails |
| --- | --- | --- | --- |
| 1 | Sun 2026-11-15 | L-01 to L-03 and D-01 done. All three devs ran clasp push to their DEV copy | Devs cannot start. Lead focuses on finishing setup |
| 2 | Sun 2026-11-22 | A-01, A-02, B-01, B-02 merged. Birthday posters running | Lead pairs with Dev A. Dev C keeps building against fake data |
| 3 | Wed 2026-11-25 | C-01, C-02, B-03 merged | Devs who are done and the lead help finish the rest before UAT on 27 Nov |

Week 1 for devs:

- Install Node.js LTS and clasp.
- `clasp push` to an empty Apps Script project.
- Learn `SpreadsheetApp`, `getValues`/`setValues`, and triggers.
- Dev C prepares fake `Summary` rows following `docs/01-architecture.md` section 2.5.

UAT with OM on 27-28 Nov, fixes on 29-30 Nov, ready on 30 Nov.

## Critical path and risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Templates late (D-01) | B-02 blocked, no birthday posters in December | Designer starts day 1. B-02 can build against a placeholder template |
| Master data photos not readable by the org account | Birthday and Best Staff posters fail | Check in L-03, before B-02 starts |
| A-01/A-02 is the critical path | If A-02 is late on 21 Nov, the re-test of C-01, C-02, and B-03 with real formulas slips | Lead pairs with Dev A early in week 2 |
| One dev unavailable | Single point of failure | Review rotation keeps every dev familiar with another dev's code |
