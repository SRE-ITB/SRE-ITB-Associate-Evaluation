#!/usr/bin/env bash
# Static checks for the Apps Script rules in AGENTS.md. Run from the repo root.
set -uo pipefail

failed=0
fail() {
  echo "::error::$1"
  failed=1
}

shopt -s nullglob
gs_files=(src/*.gs)

if [ ${#gs_files[@]} -gt 0 ]; then
  if grep -nE '^\s*(import|export)\b' "${gs_files[@]}"; then
    fail "ES module import/export found in src/. Apps Script uses plain global functions."
  fi

  if grep -nE "['\"\`][A-Za-z0-9_-]{25,}['\"\`]" "${gs_files[@]}"; then
    fail "String that looks like a Drive/Form/Script ID found in src/. Read IDs through getConfig()."
  fi

  if grep -nE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "${gs_files[@]}" | grep -v '@example\.com'; then
    fail "Email address found in src/. Read emails through getConfig() or the Admins tab."
  fi
fi

for f in .clasp.json .clasp.prod.json .clasprc.json; do
  if git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    fail "$f is committed. It must stay local (see .gitignore)."
  fi
done

manifest=src/appsscript.json
if [ ! -f "$manifest" ]; then
  fail "$manifest is missing."
else
  grep -q '"timeZone": *"Asia/Jakarta"' "$manifest" || fail "$manifest must set \"timeZone\": \"Asia/Jakarta\"."
  grep -q '"runtimeVersion": *"V8"' "$manifest" || fail "$manifest must set \"runtimeVersion\": \"V8\"."
fi

if [ "$failed" -ne 0 ]; then
  exit 1
fi
echo "Guardrails passed."
