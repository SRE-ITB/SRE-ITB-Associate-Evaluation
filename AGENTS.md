# AGENTS.md

Rules for AI coding agents (Claude Code, Codex, and others) working in this repo. Humans follow them too.

## Before writing any code

1. Read this file, `docs/00-scope.md`, `docs/01-architecture.md`, and the work order in `tasks/<ID>.md` you were given.
2. No work order, no code. If the task has no work order, stop and ask the human.
3. If the work order contradicts `docs/00-scope.md`, stop and report it. Do not pick one silently.

## Scope of changes

- Change only the files listed under `Files` in the work order.
- `src/Config.gs`, `src/Utils.gs`, `src/Triggers.gs`, `src/appsscript.json`, and `DECISIONS.md` belong to the lead. Propose changes in the PR description instead of editing them.
- Do not rename Form items, sheet tabs, or columns. They are a contract (`docs/01-architecture.md`).

## Apps Script constraints

- Runtime V8, plain `.gs` files, global functions. No npm packages, no ES module `import`/`export`.
- Max 6 minutes per execution. Long jobs must batch and resume via `PropertiesService`.
- Read and write sheets in bulk (`getValues`/`setValues`). No per-cell loops against the sheet.
- Use `LockService.getScriptLock()` around writes to shared sheets.
- No hardcoded IDs, emails, dates, or periods. Read them through `getConfig()`.
- Time zone is Asia/Jakarta. Never compare dates using UTC defaults.
- Do not swallow errors. Log with context and rethrow.

## Code style

- Clear names over comments. Comment only non-obvious reasons, in one line. No narrating comments.
- JSDoc only on functions called by triggers or the menu.

## Commands

- Only `clasp push` to the DEV copy configured in your local `.clasp.json`.
- Never run `clasp push` against PROD, never run `installTriggers()`, never call `clasp deploy`. Lead only.
- Never edit `.clasp.json` to point at another script ID.

## Data and privacy

- Never put real staff data (names with NIM, birth dates, emails, photos, scores, comments) in code, tests, commits, PR text, or prompts.
- Use fake fixtures only, such as staff A and B in `docs/00-scope.md` section 8.

## Proof of work

- The human runs the feature in their DEV copy and captures the screenshots for each `Done =` item. The agent may prepare the test steps but must never fabricate results or screenshots.
- If spreadsheet formulas, protections, or Form settings changed, update `docs/01-architecture.md` in the same PR.
