#!/usr/bin/env bash
# Fails when a feat/fix branch changes files outside the `Files` row of its work order.
# Usage: boundary.sh <branch-name> <base-ref>   (run from the repo root)
set -euo pipefail

branch="${1:?branch name required}"
base="${2:?base ref required}"

if [[ ! "$branch" =~ ^(feat|fix)/([A-Z]-[0-9]{2})- ]]; then
  echo "Branch '$branch' is not tied to a work order. Boundary check skipped."
  exit 0
fi
id="${BASH_REMATCH[2]}"
work_order="tasks/${id}.md"

if [ ! -f "$work_order" ]; then
  echo "::error::Work order $work_order not found for branch '$branch'."
  exit 1
fi

files_row=$(grep -m1 '^| Files |' "$work_order" || true)
if [ -z "$files_row" ]; then
  echo "::error::$work_order has no '| Files |' row."
  exit 1
fi

mapfile -t allowed < <(printf '%s\n' "$files_row" | grep -oE '`[^`]+`' | tr -d '`')
allowed+=("docs/01-architecture.md" "$work_order")

echo "Allowed by $work_order:"
printf '  %s\n' "${allowed[@]}"

mapfile -t changed < <(git diff --name-only "$base"...HEAD)

outside=()
for file in "${changed[@]}"; do
  ok=0
  for path in "${allowed[@]}"; do
    if [ "$file" = "$path" ] || { [[ "$path" == */ ]] && [[ "$file" == "$path"* ]]; }; then
      ok=1
      break
    fi
  done
  [ "$ok" -eq 1 ] || outside+=("$file")
done

if [ ${#outside[@]} -gt 0 ]; then
  echo "::error::Files changed outside the boundary of $id. Move the change to the right work order, or ask the lead to update the Files row."
  printf '  %s\n' "${outside[@]}"
  exit 1
fi
echo "All ${#changed[@]} changed files are inside the boundary of $id."
