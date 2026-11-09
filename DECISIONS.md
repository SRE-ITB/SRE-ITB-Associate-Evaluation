# Decisions

Append-only. Never edit or delete an entry. To change a decision, add a new entry that supersedes it and mark the old one `Superseded by D-xxx`. The only allowed edit is the status of a `Proposed` entry (to `Accepted` or `Superseded by D-xxx`).
Business rules must match the PRD. Change the PRD first.

Status: `Accepted` (agreed with OM or the lead), `Proposed` (technical default, open for objection before UAT).

Entries D-001 to D-022 were recorded on 2026-11-09 from discussions in September to November 2026.

| ID | Decision | Why | Status |
| --- | --- | --- | --- |
| D-001 | No website. Build on Google Form + Sheets + Apps Script | Functionality is simple. A website adds hosting, auth, and yearly maintenance that the scope does not need | Accepted |
| D-002 | No AppSheet | Paid per user, and its main advantage (per-staff login) is out of scope | Accepted |
| D-003 | Out of scope: president voting, staff login to view report cards, app-style leaderboard | Keeps the system auth-free. Revisit with a website if these become needed | Accepted |
| D-004 | 4 indicators, integer scale 1-5, no weights between indicators | OM rubric | Accepted |
| D-005 | Non-OM staff: one Kadiv/Wakadiv representative 60%, one asso OM 40% | OM rule. Simplified from an earlier 2+2 evaluator draft | Accepted |
| D-006 | OM staff: Kadiv/Wakadiv OM 100%. Form submissions by asso OM for OM staff are ignored. Manual sheet edits stay open to all admins, including OM staff | Avoid peer self-evaluation via the Form. Sheet-level trust accepted by OM, audited via version history | Accepted |
| D-007 | One evaluation per staff every 3 months. P1 = Dec 2026 to Feb 2027 | OM rule | Accepted |
| D-008 | Red Notice when `final_avg <= 2`. Takes priority over Best Staff | OM rule. Includes 2 | Accepted |
| D-009 | Best Staff = highest `final_total` per division per period. Ties decided manually by evaluators | OM rule | Accepted |
| D-010 | Input via one Google Form with branching per division. Revisions done in the `Evaluations` sheet. Latest action wins (Form or manual) | Form gives validation and mobile use. Editing in Form is clumsy | Accepted |
| D-011 | Single Admin role: all Kadiv/Wakadiv of evaluated divisions + all asso OM. Admins can edit any row | Simplicity. Integrity relies on audit trail, not access limits | Accepted |
| D-012 | Evaluator comment is required. Shown on the report card without name and without role marker | OM rule | Accepted |
| D-013 | Only staff are evaluated. Kadiv/Wakadiv excluded. GenSec units excluded. E&C split into Research and Product groups | OM rule. Heads are evaluated by department heads outside this system | Accepted |
| D-014 | Birthday notification: one daily email to all OM members | OM rule | Accepted |
| D-015 | All files, the bound script, and all triggers are owned by the SRE ITB Google account, held by the Wakadiv IT Development | Survives handover. Personal-account triggers die when the person leaves | Accepted |
| D-016 | Team: lead + 2 devs + 1 designer. Source in GitHub (SRE ITB org) via clasp | Parallel work without overwriting each other in the browser editor | Accepted |
| D-017 | Best Staff poster is generated manually from the menu | Waits for final scores and tie decisions | Accepted |
| D-018 | Report cards are generated every period | OM rule | Accepted |
| D-019 | Submitter email not matching `Admins` is flagged `ROLE_MISMATCH`, never rejected | Catches mistakes without blocking a trusted admin | Superseded by D-023 |
| D-020 | Best Staff status is provisional until the whole division is complete for the period | Avoids announcing a winner before everyone is scored | Superseded by D-024 |
| D-021 | Report cards are generated from the menu by OM, not by a trigger | OM decides when results are final | Accepted (2026-11-09) |
| D-022 | PRD (Claude Docs, Indonesian) is the business source of truth. Repo docs are English and derived from it | One source for OM, English for devs and AI agents | Accepted |
| D-023 | Submissions from an email not listed in `Admins` are rejected: not written to `Evaluations`, logged in `Rejected`, and the submitter gets an email saying to use their registered account. Registered admins with a role or division mismatch are still written, flagged `ROLE_MISMATCH` | Lead decision (2026-11-09). Google Form on a consumer account cannot block viewing, so anyone with the link can still open the Form and see staff names. Accepted limitation | Accepted |
| D-024 | Best Staff shows as `Best Staff (Sementara)` until every staff in the division is complete for the period, then `Best Staff`. Best Staff posters only use the final status | Lead decision (2026-11-09). Admins see progress early without mistaking it for a final result | Accepted |
| D-025 | All work orders, including report cards and Best Staff posters, are due by 2026-11-30 | Lead decision (2026-11-09). Supersedes the earlier plan to deliver A-04 and B-03 in December | Accepted |
