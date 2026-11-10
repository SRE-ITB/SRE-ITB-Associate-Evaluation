## Work order

- ID: <!-- e.g. A-01 -->
- File: `tasks/<ID>.md`

## What and why

<!-- One or two sentences. -->

## Changes outside git

<!--
Formulas, protections, data validation, Form fields, or Config keys you changed by hand.
List them here AND update docs/01-architecture.md in this PR. Write "None" if nothing.
-->

None

## How to demo (DEV copy)

<!-- Steps the reviewer follows in their own DEV copy, with fake data only. -->

1.

## Proof of work

<!--
One #### heading per `Done =` item in the work order, in the same order.
Put the screenshot or recording on its own line under the heading, replacing PROOF-PENDING.
Capture it yourself from your DEV copy with fake data. Agents never fabricate proof.
If the PR changes anything under src/, CI fails while PROOF-PENDING is left anywhere outside these comments.
PR with no change under src/: replace the headings below with "docs only" (CI skips the check).
No tables in this section: dragging an image into a table cell breaks the layout.
-->

#### 1. <copy the first Done = item>

PROOF-PENDING

#### 2. <copy the next Done = item>

PROOF-PENDING

## Checklist

- [ ] Only files listed under `Files` in the work order are changed
- [ ] No hardcoded IDs, emails, dates, or periods (everything through `getConfig()`)
- [ ] Sheet reads and writes are bulk (`getValues`/`setValues`), shared writes use `LockService`
- [ ] Errors are logged with context and rethrown
- [ ] No real staff data in code, screenshots, or this description
- [ ] `docs/01-architecture.md` updated if anything outside git changed
- [ ] Reviewed by the dev named in the work order
