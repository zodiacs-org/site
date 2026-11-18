#!/usr/bin/env bash
# Publish the current HEAD to a protected branch through a pull request.
#
# The protection rule on main requires changes to arrive through a pull
# request, so a workflow's direct push dies with GH006. This satisfies the
# rule literally instead of bypassing it: push HEAD to a short-lived publish
# branch, open a pull request with the workflow token, squash-merge it once
# GitHub reports it mergeable, and delete the branch. No bypass actor, no
# extra secret. It fails closed — leaving the pull request open for a
# person — when the token may not open pull requests (a repository Actions
# setting) or when the rule also demands approvals or status checks that a
# workflow cannot supply for its own pull request.
#
# Usage: publish-through-pr.sh <base-branch> <verified-base-sha> <title> [body]
# Prints the merged base-branch SHA as its last line of stdout.
set -euo pipefail

base="${1:?base branch}"
verified="${2:?verified base sha}"
title="${3:?pull request and commit title}"
body="${4:-Published through a pull request because the protection rule on \`${1}\` requires one. Generated and verified by the ${GITHUB_WORKFLOW:-local} workflow, run ${GITHUB_RUN_ID:-local}.}"

: "${GH_TOKEN:?GH_TOKEN is required (set it to github.token)}"
tmp="${RUNNER_TEMP:-/tmp}"

slug=$(printf '%s' "$title" | tr -c 'A-Za-z0-9' '-' | tr -s '-' | sed 's/^-//; s/-$//' | tr 'A-Z' 'a-z' | cut -c1-48)
branch="publish/${slug}-${GITHUB_RUN_ID:-$$}"

# The artifacts on HEAD were verified against one exact base revision.
# Never land them on a revision the verifiers did not exercise.
git fetch origin "$base"
if [ "$(git rev-parse "origin/$base")" != "$verified" ]; then
  echo "publish-through-pr: $base advanced after verification; rerun the complete workflow" >&2
  exit 1
fi

git push origin "HEAD:refs/heads/$branch"

if ! pr_url=$(gh pr create --base "$base" --head "$branch" --title "$title" --body "$body" 2>"$tmp/publish-pr-create.err"); then
  cat "$tmp/publish-pr-create.err" >&2
  if grep -qi "not permitted to create or approve pull requests" "$tmp/publish-pr-create.err"; then
    echo "::error title=The workflow token may not open pull requests::Enable Settings → Actions → General → Workflow permissions → \"Allow GitHub Actions to create and approve pull requests\" (or add a bypass actor for the pull-request rule on $base)." >&2
  fi
  git push origin --delete "$branch" >/dev/null 2>&1 || true
  exit 1
fi
echo "publish-through-pr: opened $pr_url"

# Since 2026-11-15 the protection rule on the base also requires status
# checks. A pull request opened with the workflow token triggers no
# pull_request workflows, so those checks never started and every
# publication pull request sat blocked ("4 of 4 required status checks are
# expected"). workflow_dispatch is the documented exception: run the same
# check workflows on the publish branch, wait for every required check on
# this exact head to finish, and merge only when all of them pass. Nothing
# is bypassed; a failing or missing check leaves the pull request open.
head_sha=$(git rev-parse HEAD)
required=()
while IFS= read -r context; do
  if [ -n "$context" ]; then required+=("$context"); fi
done < <(gh api "repos/{owner}/{repo}/branches/$base" --jq '.protection.required_status_checks.contexts[]?' 2>/dev/null || true)

if [ "${#required[@]}" -gt 0 ]; then
  echo "publish-through-pr: $base requires: $(printf '"%s" ' "${required[@]}")"
  if ! gh workflow run site-check.yml --ref "$branch" -f "scope_base=$verified" 2>"$tmp/publish-checks.err" \
    || ! gh workflow run sitemap-dates.yml --ref "$branch" -f "base=$verified" -f "head=$head_sha" 2>>"$tmp/publish-checks.err"; then
    cat "$tmp/publish-checks.err" >&2
    echo "::error title=Required checks could not be started::$pr_url stays open for a person; the workflow token could not dispatch the check workflows on $branch (it needs actions: write)." >&2
    exit 1
  fi
  echo "publish-through-pr: dispatched site-check.yml and sitemap-dates.yml on $branch ($head_sha)"

  deadline=$(( $(date +%s) + ${PUBLISH_CHECKS_TIMEOUT_MINUTES:-100} * 60 ))
  while :; do
    runs=$(gh api --paginate "repos/{owner}/{repo}/commits/$head_sha/check-runs?per_page=100" \
      --jq '.check_runs[] | {id, name, status, conclusion, html_url}' | jq -s '.')
    waiting=()
    failed=()
    for context in "${required[@]}"; do
      latest=$(jq -c --arg name "$context" '[.[] | select(.name == $name)] | max_by(.id) // empty' <<<"$runs")
      if [ -z "$latest" ] || [ "$(jq -r .status <<<"$latest")" != "completed" ]; then
        waiting+=("$context")
      else
        case "$(jq -r .conclusion <<<"$latest")" in
          success|skipped|neutral) ;;
          *) failed+=("$context ($(jq -r '.conclusion + ": " + .html_url' <<<"$latest"))") ;;
        esac
      fi
    done
    if [ "${#failed[@]}" -gt 0 ]; then
      printf 'publish-through-pr: required check failed: %s\n' "${failed[@]}" >&2
      echo "::error title=A required check failed on the publication pull request::$pr_url stays open for a person. Failed: ${failed[*]}" >&2
      exit 1
    fi
    if [ "${#waiting[@]}" -eq 0 ]; then break; fi
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "::error title=Required checks did not finish in time::$pr_url stays open for a person; still waiting on: ${waiting[*]}" >&2
      exit 1
    fi
    sleep 30
  done
  echo "publish-through-pr: all required checks passed on $head_sha"
fi

# GitHub computes mergeability asynchronously after creation; a brand-new
# pull request with no required checks settles within seconds.
state=UNKNOWN
polls=0
while [ "$state" = "UNKNOWN" ] && [ "$polls" -lt 12 ]; do
  sleep 5
  state=$(gh pr view "$pr_url" --json mergeable --jq .mergeable)
  polls=$((polls + 1))
done
if [ "$state" != "MERGEABLE" ]; then
  echo "publish-through-pr: $pr_url is $state and stays open for a person; rerun the complete workflow once $base is settled" >&2
  exit 1
fi

if ! gh pr merge "$pr_url" --squash --subject "$title" --body "" 2>"$tmp/publish-pr-merge.err"; then
  cat "$tmp/publish-pr-merge.err" >&2
  echo "::error title=The workflow token could not merge its pull request::$pr_url stays open for a person to merge. If $base also requires approvals or status checks, a workflow cannot supply them for its own pull request — relax that requirement for the GitHub Actions app or merge by hand." >&2
  exit 1
fi
git push origin --delete "$branch" >/dev/null 2>&1 || true

git fetch origin "$base"
merged=$(git rev-parse "origin/$base")
if [ "$(git rev-parse "origin/$base^{tree}")" != "$(git rev-parse 'HEAD^{tree}')" ]; then
  echo "::warning title=Merged tree differs from the verified tree::$base moved between verification and merge; the live-verification step decides whether the published edition still matches." >&2
fi
echo "publish-through-pr: merged $pr_url as $merged"

# A merge made with the workflow token does not trigger push workflows, so
# Site Check would never run on the merged head and a broken deploy on the
# base would go unnoticed (the calendar-shaped research tests did exactly
# that on 2026-09-02). workflow_dispatch is the documented exception, so ask
# for the run explicitly. The protected-scope guard compares against the
# merged head itself: this publication's diff is generated artifacts the
# workflow already verified, and the guard exists for pull requests by
# people. Best effort — the publication itself has already succeeded.
if gh workflow run site-check.yml --ref "$base" -f "scope_base=$merged" 2>"$tmp/publish-site-check.err"; then
  echo "publish-through-pr: dispatched site-check.yml on $base for $merged"
else
  cat "$tmp/publish-site-check.err" >&2
  echo "::warning title=Site Check was not dispatched for the merged head::$merged is published, but the workflow token could not dispatch site-check.yml on $base (it needs actions: write). Run it by hand from the Actions tab with scope_base=$merged." >&2
fi
echo "$merged"
