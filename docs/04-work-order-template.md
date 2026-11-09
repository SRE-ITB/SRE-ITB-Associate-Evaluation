# 04 Work Order Template

Copy into `tasks/<ID>.md`. If a work order cannot be executed without asking basic questions, fix the work order.

```markdown
# <ID> <Title>

| Field | Value |
| --- | --- |
| Owner | |
| Reviewer | |
| Target merge | YYYY-MM-DD |
| Depends on | |
| Files | src/... (the only files you may change) |

## Goal
One sentence.

## Context
What you need to know. Link to sections in docs/00-scope.md and docs/01-architecture.md.

## Suggested steps
1. ...

## Boundary
What you must not touch.

## Done =
- [ ] Testable criterion, each one gets a screenshot in the PR.

## How to demo
Steps the reviewer follows in a DEV copy.

## Blockers
- YYYY-MM-DD: ...
```
