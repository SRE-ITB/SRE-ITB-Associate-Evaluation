# SRE ITB Staff Evaluation System 2026/2027

Quarterly staff evaluation for SRE ITB, requested by the Organizational Management (OM) division.
Built on Google Form + Google Sheets + Apps Script. No website, no paid tools.

Business requirements live in the PRD (Indonesian, approved by OM):
https://docs.google.com/document/d/19LpI_MYgcKYfxZ3E3Sel0GvFbCnTydWbp6E6Jx0zAPc/edit

This repo holds the Apps Script source and the technical docs derived from the PRD.

## What the system does

- Admins (Kadiv/Wakadiv + asso OM) submit evaluations through one Google Form.
- Submissions are upserted into the `Evaluations` sheet. Admins can fix values there.
- Formulas compute final score, Red Notice, Best Staff, leaderboard, and progress.
- Report cards (PDF) are generated per staff per period.
- Birthday posters are generated every morning and announced by email to OM.
- Best Staff posters are generated per division at the end of a period.

## Repo layout

```
.
├── AGENTS.md                  rules for AI agents (read first)
├── DECISIONS.md               append-only decision log
├── docs/
│   ├── 00-scope.md            business rules, technical translation of the PRD
│   ├── 01-architecture.md     sheets, form, scripts, triggers, formulas
│   ├── 02-assignments.md      who owns what, weekly checkpoints, dependencies
│   ├── 03-workflow.md         clasp, branches, commits, PR, deploy
│   └── 04-work-order-template.md
├── tasks/                     one work order per task
├── src/                       Apps Script source (clasp rootDir)
├── scripts/deploy-prod.sh     PROD deploy (lead only)
└── .github/                   PR template, CODEOWNERS, CI
```

## Reading order

| Role | Read |
| --- | --- |
| Everyone | `AGENTS.md`, `docs/00-scope.md`, your work order in `tasks/` |
| Devs | + `docs/01-architecture.md`, `docs/03-workflow.md` |
| Lead | everything, plus keep `DECISIONS.md` current |

## Quick start (devs)

1. Install Node.js LTS and clasp: `npm install -g @google/clasp`
2. `clasp login` with the account that has access to your DEV copy.
3. Clone this repo, copy `.clasp.example.json` to `.clasp.json`, set `scriptId` to your DEV copy's script.
4. `clasp push` to your DEV copy only. Never push to PROD (lead only).

Details: `docs/03-workflow.md`.

## Status

Target: ready for use on 2026-11-30. First evaluation period: December 2026 to February 2027.
