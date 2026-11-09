# 00 Scope and Business Rules

Source of truth for business rules: the PRD (Claude Docs, Indonesian), version as of 2026-11-09.
This file is the technical translation. If the two disagree, the PRD wins: raise it with the lead, update the PRD first, then this file and `DECISIONS.md`.

## 1. In scope

- Staff evaluation in 13 evaluation groups (see section 3).
- Final score, Red Notice, Best Staff, leaderboard, and progress per period.
- Report card PDF per staff per period.
- Daily birthday poster + email to OM.
- Best Staff poster per division per period.

## 2. Out of scope

- Evaluating Kadiv/Wakadiv (done by department heads outside this system).
- Units under General Secretariat (Secretary, Treasurer, Permit & Authorization).
- President/VP voting.
- Staff login to view their own report card. Reports are distributed by OM.
- An app-style leaderboard. The leaderboard is a sheet tab.
- User guidebook (written after the system ships).

## 3. Evaluation groups

Division values must match exactly across `Master`, the Form, and formulas.

| Department | Division value | Evaluated by (KW representative) |
| --- | --- | --- |
| Finance | Sponsorship | Kadiv or Wakadiv |
| Finance | Entrepreneurship | Kadiv or Wakadiv |
| Internal | Organizational Development | Kadiv or Wakadiv |
| Internal | Organizational Management | Kadiv or Wakadiv OM (100%) |
| Academics | Community Development | Kadiv or Wakadiv |
| Academics | Competency Enhancement | Kadiv or Wakadiv |
| Academics | E&C Research | Kadiv E&C or Wakadiv Research |
| Academics | E&C Product | Kadiv E&C or Wakadiv Product |
| External | Event | Kadiv or Wakadiv |
| External | Partnership | Kadiv or Wakadiv |
| Media & Communication | Design | Kadiv or Wakadiv |
| Media & Communication | IT Development | Kadiv or Wakadiv |
| Media & Communication | Publication & Documentation | Kadiv or Wakadiv |

## 4. Periods

- One evaluation per staff per period. A period is 3 months.
- P1: 2026-12-01 to 2027-02-28. Later periods continue every 3 months.
- Period dates live in the `Config` sheet, never hardcoded.

## 5. Indicators

Scale 1 to 5 (integers). No weights between indicators.

| Key | Indicator |
| --- | --- |
| `i1` | Meeting attendance and progress-report activeness |
| `i2` | Task contribution |
| `i3` | Initiative |
| `i4` | Teamwork and communication |

Every evaluation also has a required free-text `comment`.

## 6. Evaluator roles and weights

| Staff division | Role `KW` (one Kadiv/Wakadiv representative) | Role `OM` (one asso OM) |
| --- | --- | --- |
| Any division except OM | 0.6 | 0.4 |
| Organizational Management | 1.0 | not used |

- Any asso OM may evaluate any non-OM staff.
- Only emails listed in `Admins` may submit. Other submissions are rejected and logged, and the submitter is told by email (D-023). The Form link itself cannot be restricted, so anyone with the link can still open it.
- Form submissions with role `OM` for an OM staff member are ignored (stored with flag `IGNORED_OM_ROLE`, not counted).
- Manual edits in the spreadsheet are allowed for everyone with Admin access, including OM staff editing OM rows. This is a trust-based decision (D-006).

## 7. Score computation

Per indicator `k`:

```
final_k = KW_k                          if division = Organizational Management
final_k = 0.6 * KW_k + 0.4 * OM_k       otherwise
```

```
final_total = final_1 + final_2 + final_3 + final_4      (range 4 to 20)
final_avg   = final_total / 4                            (range 1 to 5)
```

Keep full precision in calculations. Round to 1 decimal only for display.

## 8. Status

Evaluated per staff per period, in this order:

| Order | Status | Rule |
| --- | --- | --- |
| 1 | `Incomplete` | A required evaluation is missing (non-OM: KW and OM; OM staff: KW) |
| 2 | `Red Notice` | `final_avg <= 2` |
| 3 | `Best Staff (Sementara)` / `Best Staff` | Highest `final_total` in the division among complete, non-Red-Notice staff, and no tie. Shows `(Sementara)` until the whole division is complete for the period |
| 4 | `Tie` | Shares the highest `final_total` with another staff in the division. An admin picks one via the override checkbox |
| 5 | `Normal` | Everything else |

- Best Staff stays `Best Staff (Sementara)` until every staff in the division is complete for that period (D-024).
- If an admin ticks the override for one tied staff, that staff becomes `Best Staff` and the others become `Normal`.

### Worked examples (non-OM)

| Staff | KW scores | OM scores | final_total | final_avg | Status |
| --- | --- | --- | --- | --- | --- |
| A | 4, 4, 3, 5 (16) | 3, 4, 3, 4 (14) | 0.6*16 + 0.4*14 = 15.2 | 3.8 | Normal or Best Staff |
| B | 2, 2, 1, 2 (7) | 2, 3, 2, 2 (9) | 0.6*7 + 0.4*9 = 7.8 | 1.95 | Red Notice |

Use these as test fixtures.

## 9. Edits and conflicts

- One row per `(period, nim, role)` in `Evaluations`.
- Latest action wins: a new Form submission overwrites the row, and so does a manual edit.
- Every write records who and when (`submitted_by`, `updated_at`, `source`). Spreadsheet version history is the audit fallback.

## 10. Report card

- Generated per staff per period, for complete rows only, when OM presses the menu button (D-021). Pressing it again regenerates and overwrites.
- Contains: name, NIM, division, period, `final_k` per indicator, `final_total`, `final_avg`, status (Best Staff or Red Notice when applicable), comments.
- Comments are shown without evaluator name and without role marker. Order them in a way that does not reveal the role (sort alphabetically by text).
- Note: for OM staff, comments always come from KW OM, so anonymity is weaker there. Accepted by OM.

## 11. Birthday poster

- Checked daily in the morning (Asia/Jakarta) for active staff in `Master`.
- Feb 29 birthdays are celebrated on Feb 28 in non-leap years.
- One poster per staff saved to Drive, then one summary email per day to all OM members (list in `Config`).
- Never send twice for the same staff on the same date (`BirthdayLog`).

## 12. Best Staff poster

- Run manually from the custom menu after all ties are resolved. Only divisions with a final `Best Staff` (not `Sementara`) get a poster.
- One poster per division per period.

## 13. Deadlines

| Must be ready | Items |
| --- | --- |
| 2026-11-30 | Everything in scope, tested with OM (D-025) |
