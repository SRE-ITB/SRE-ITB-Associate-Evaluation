#!/usr/bin/env bash
# Lead only. Pushes main to the PROD Apps Script project (docs/03-workflow.md section 6, D-029).
set -euo pipefail

die() {
  echo "deploy-prod: $1" >&2
  exit 1
}

cd "$(git rev-parse --show-toplevel)"

command -v clasp >/dev/null || die "clasp not installed (npm install -g @google/clasp)"
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || die "switch to main first"
[ -z "$(git status --porcelain)" ] || die "working tree is not clean"
git fetch --quiet origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "main differs from origin/main, run git pull"
[ -f .clasp.prod.json ] || die ".clasp.prod.json not found (PROD scriptId, rootDir src)"

prod_id=$(grep -o '"scriptId"[^,}]*' .clasp.prod.json | sed 's/.*"\([^"]*\)"$/\1/')
[ -n "$prod_id" ] || die "scriptId missing in .clasp.prod.json"

backup=""
if [ -f .clasp.json ]; then
  backup=$(mktemp)
  cp .clasp.json "$backup"
fi
restore() {
  if [ -n "$backup" ]; then
    mv "$backup" .clasp.json
  else
    rm -f .clasp.json
  fi
}
trap restore EXIT

cp .clasp.prod.json .clasp.json

commit=$(git rev-parse --short HEAD)
echo "About to push main ($commit) to PROD script $prod_id"
read -r -p "Type PROD to continue: " answer
[ "$answer" = "PROD" ] || die "cancelled"

clasp push --force

tag="prod-$(TZ=Asia/Jakarta date +%Y%m%d-%H%M)"
git tag "$tag"
echo "Pushed $commit to PROD. Local tag $tag created. Share it with:"
echo "  git push origin $tag"
