#!/usr/bin/env bash
set -euo pipefail
repository=${1:?Use: bash ops/deploy-private.sh owner/private-repo from the prepared bundle}
if [[ ! "$repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then exit 1; fi
private=$(gh api "repos/$repository" --jq '.private')
if [ "$private" != true ]; then echo 'Refusing to upload study data to a public repository.' >&2; exit 1; fi
branches=$(gh api "repos/$repository/branches" --jq 'length')
if [ "$branches" != 0 ]; then echo 'Target must be a new empty private repository.' >&2; exit 1; fi
test -f state/protocol.json
test -f frozen/package-lock.json
test -f .github/workflows/paper.yml
git init --initial-branch=main
git add -- .
git commit -m 'Freeze private Market Lens paper-study operations'
git remote add origin "https://github.com/$repository.git"
git push --set-upstream origin main
echo 'Private seed uploaded. Verify the bootstrap Actions run before relying on the scheduler.'
