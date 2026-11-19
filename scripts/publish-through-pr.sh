#!/usr/bin/env bash
# Publish the current HEAD to a protected branch through a pull request.
#
# The protection rule on main requires changes to arrive through a pull
# request, so a workflow's direct push dies with GH006. This satisfies the
# rule literally instead of bypassing it: push HEAD to a short-lived publish
# branch, open a pull request, run the required checks, squash-merge it once
# they pass, and delete the branch. No bypass actor. It fails closed — leaving
# the pull request open for a person — when the token may not open pull
# requests (a repository Actions setting) or when a required check fails or
# cannot run.
#
# GitHub holds the pull_request checks of a pull request the workflow token
# opens until a person approves them, and the rule refuses the merge while
# they wait (#1128, 2026-11-19). So after pushing the publish branch, this
# hands the landing to the Site Publish workflow (site-publish.yml), which
# runs this same script from the default branch with the owner's token,
# scoped to the protected environment site-publish-production. If that
# token is not saved there, or the hand-off cannot start, it falls back to
# opening the pull request with the workflow token as before.
#
# Usage: publish-through-pr.sh <base-branch> <verified-base-sha> <title> [body]
# Prints the merged base-branch SHA as its last line of stdout.
#
# Land mode (Site Publish only): with PUBLISH_LAND_BRANCH and
# PUBLISH_LAND_HEAD set, the branch is already pushed; it is fetched as data,
# checked to sit at exactly that commit, and only opened, checked and merged.
set -euo pipefail

base="${1:?base branch}"
verified="${2:?verified base sha}"
title="${3:?pull request and commit title}"
body="${4:-Published through a pull request because the protection rule on \`${1}\` requires one. Generated and verified by the ${GITHUB_WORKFLOW:-local} workflow, run ${GITHUB_RUN_ID:-local}.}"

: "${GH_TOKEN:?GH_TOKEN is required}"
tmp="${RUNNER_TEMP:-/tmp}"

delete_branch() {
  gh api -X DELETE "repos/{owner}/{repo}/git/refs/heads/$branch" >/dev/null 2>&1 || true
}

# The artifacts on HEAD were verified against one exact base revision.
# Never land them on a revision the verifiers did not exercise.
git fetch origin "$base"
if [ "$(git rev-parse "origin/$base")" != "$verified" ]; then
  echo "publish-through-pr: $base advanced after verification; rerun the complete workflow" >&2
  exit 1
fi

if [ -n "${PUBLISH_LAND_BRANCH:-}" ]; then
  # Land mode: Site Publish, with the owner's token. Never run code from the
  # branch; only check that it holds exactly the commit that was handed over.
  branch="$PUBLISH_LAND_BRANCH"
  head_sha="${PUBLISH_LAND_HEAD:?PUBLISH_LAND_HEAD is required in land mode}"
  git fetch origin "refs/heads/$branch"
  if [ "$(git rev-parse FETCH_HEAD)" != "$head_sha" ]; then
    echo "::error title=The publication branch moved::$branch is not at the commit that was handed over ($head_sha); nothing was opened." >&2
    exit 1
  fi
  # A publication is one generated commit (plus, at most, the one-time scope
  # allowance) on the verified base, and changes only the generated data the
  # publishing workflows write. Renames are listed as both paths, so moving
  # a file out of its place counts as touching it.
  if ! git merge-base --is-ancestor "$verified" "$head_sha" \
    || [ "$(git rev-list --count "$verified..$head_sha")" -gt 2 ]; then
    echo "::error title=Not a publication::$branch is not one publication commit on $verified; nothing was opened." >&2
    exit 1
  fi
  outside=$(git diff --no-renames --name-only "$verified" "$head_sha" \
    | grep -vE '^(src/data/|public/assets/|public/registry/|docs/race-recaps/)' \
    | grep -vx '.github/phase1-scope-allowance.json' || true)
  if [ -n "$outside" ]; then
    echo "::error title=Not a publication::$branch changes files outside the generated publication data ($(tr '\n' ' ' <<<"$outside")); nothing was opened." >&2
    exit 1
  fi
else
slug=$(printf '%s' "$title" | tr -c 'A-Za-z0-9' '-' | tr -s '-' | sed 's/^-//; s/-$//' | tr 'A-Z' 'a-z' | cut -c1-48)
branch="publish/${slug}-${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}"

# Build & Check's protected-scope guard now runs on this pull request. When
# the only protected paths changed are the generated sign pages, carry the
# base-pinned one-time allowance a hand-carried edition carries; any other
# protected change gets none, and the guard holds the pull request for a person.
allowance=$(node scripts/write-sign-page-allowance.mjs "$verified")
if [ "$allowance" = "written" ]; then
  git add .github/phase1-scope-allowance.json
  git commit -q -m "Phase 1 scope: one-time allowance for the generated sign pages"
  echo "publish-through-pr: added the one-time scope allowance for the generated sign pages"
elif [ "$allowance" = "refused" ]; then
  echo "::warning title=Protected paths beyond the sign pages::This publication changes protected paths other than the generated sign pages, so no scope allowance is added and Build & Check will hold the pull request for a person." >&2
elif [ "$allowance" != "none" ]; then
  echo "publish-through-pr: the scope allowance writer gave no verdict (\"$allowance\"); nothing was published" >&2
  exit 1
fi

git push origin "HEAD:refs/heads/$branch"
head_sha=$(git rev-parse HEAD)

# Hand the landing to Site Publish, which opens the pull request with the
# owner's token so its checks run without waiting for approval. Returns 0
# once it merged, 2 to fall back to the workflow token, 1 on a failure that
# leaves the pull request for a person.
hand_off() {
  local default run_id="" conclusion="" url="" token_step deadline
  default=$(gh api "repos/{owner}/{repo}" --jq .default_branch 2>/dev/null) || return 2
  if [ "$base" != "$default" ]; then return 2; fi
  if ! gh workflow run site-publish.yml --ref "$default" -f "branch=$branch" -f "verified=$verified" \
    -f "head=$head_sha" -f "title=$title" -f "body=$body" 2>"$tmp/publish-handoff.err"; then
    cat "$tmp/publish-handoff.err" >&2
    echo "::warning title=Site Publish could not be started::Opening the publication pull request with the workflow token instead." >&2
    return 2
  fi
  echo "publish-through-pr: handed $branch to site-publish.yml"
  deadline=$(( $(date +%s) + ${PUBLISH_HANDOFF_TIMEOUT_MINUTES:-120} * 60 ))
  while :; do
    sleep 30
    if [ -z "$run_id" ]; then
      run_id=$(gh api "repos/{owner}/{repo}/actions/workflows/site-publish.yml/runs?event=workflow_dispatch&per_page=30" \
        --jq '.workflow_runs[] | [.id, .display_title] | @tsv' 2>/dev/null \
        | awk -F '\t' -v t="Publish $branch" '$2 == t { print $1; exit }') || run_id=""
    fi
    if [ -n "$run_id" ]; then
      read -r conclusion url < <(gh api "repos/{owner}/{repo}/actions/runs/$run_id" \
        --jq '[(if .status == "completed" then (.conclusion // "none") else "running" end), .html_url] | @tsv' 2>/dev/null || echo "running -")
      if [ "$conclusion" = "success" ]; then return 0; fi
      if [ "$conclusion" != "running" ]; then
        token_step=$(gh api "repos/{owner}/{repo}/actions/runs/$run_id/jobs" \
          --jq '[.jobs[].steps[]? | select(.name == "Check that the owner token is saved" or .name == "Check who asked") | select(.conclusion == "failure") | .name] | first // ""' 2>/dev/null || true)
        if [ -n "$token_step" ]; then
          echo "::warning title=Site Publish stopped at \"$token_step\"::$url. This publication pull request is opened with the workflow token instead, and its checks will wait for a person." >&2
          return 2
        fi
        echo "::error title=Site Publish did not land the publication::$conclusion: $url (the pull request for $branch, if one was opened, stays open for a person)." >&2
        return 1
      fi
    fi
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "::error title=Site Publish did not finish in time::${url:-no run found for $branch}; the publication stays for a person." >&2
      return 1
    fi
  done
}

if [ "${PUBLISH_HANDOFF:-1}" = "1" ]; then
  if hand_off; then handed=0; else handed=$?; fi
  if [ "$handed" -eq 0 ]; then
    git fetch origin "$base"
    # Report the merge commit itself, not wherever the base has moved since.
    merged=$(gh api "repos/{owner}/{repo}/pulls?state=closed&base=$base&head=${GITHUB_REPOSITORY_OWNER:-zodiacs-org}:$branch" \
      --jq '[.[] | select(.merged_at != null) | .merge_commit_sha] | first // empty' 2>/dev/null || true)
    if [ -z "$merged" ]; then merged=$(git rev-parse "origin/$base"); fi
    echo "publish-through-pr: Site Publish merged $branch; $base is at $merged"
    echo "$merged"
    exit 0
  fi
  if [ "$handed" -eq 1 ]; then exit 1; fi
fi
fi

if ! pr_url=$(gh pr create --base "$base" --head "$branch" --title "$title" --body "$body" 2>"$tmp/publish-pr-create.err"); then
  cat "$tmp/publish-pr-create.err" >&2
  if grep -qi "not permitted to create or approve pull requests" "$tmp/publish-pr-create.err"; then
    echo "::error title=The workflow token may not open pull requests::Enable Settings → Actions → General → Workflow permissions → \"Allow GitHub Actions to create and approve pull requests\" (or add a bypass actor for the pull-request rule on $base)." >&2
  fi
  delete_branch
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
required=()
while IFS= read -r context; do
  if [ -n "$context" ]; then required+=("$context"); fi
done < <(gh api "repos/{owner}/{repo}/branches/$base" --jq '.protection.required_status_checks.contexts[]?' 2>"$tmp/publish-protection.err" \
  || { sleep 10; gh api "repos/{owner}/{repo}/branches/$base" --jq '.protection.required_status_checks.contexts[]?' 2>"$tmp/publish-protection.err"; } \
  || echo "::warning title=Required checks unknown::Could not read the protection summary of $base ($(tr '\n' ' ' <"$tmp/publish-protection.err")); merging without waiting, which the rule will refuse if it requires checks." >&2)

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
    # One failed read must not end an hour-long wait: retry until the deadline.
    if ! runs=$(gh api --paginate "repos/{owner}/{repo}/commits/$head_sha/check-runs?per_page=100" \
      --jq '.check_runs[] | {id, name, status, conclusion, html_url}' | jq -s '.'); then
      if [ "$(date +%s)" -ge "$deadline" ]; then
        echo "::error title=Required checks could not be read::$pr_url stays open for a person." >&2
        exit 1
      fi
      echo "publish-through-pr: reading the check runs failed; retrying" >&2
      sleep 30
      continue
    fi
    waiting=()
    failed=()
    # With the owner's token each required check runs twice on this head:
    # from the pull request itself and from the dispatch. Wait for every copy
    # and require every copy to pass, so nothing merges past a failed one.
    for context in "${required[@]}"; do
      copies=$(jq -c --arg name "$context" '[.[] | select(.name == $name)]' <<<"$runs")
      bad=$(jq -r '[.[] | select(.status == "completed" and (.conclusion | IN("success", "skipped", "neutral") | not))] | first // empty | .conclusion + ": " + .html_url' <<<"$copies")
      if [ -n "$bad" ]; then
        failed+=("$context ($bad)")
      elif [ "$(jq 'length' <<<"$copies")" -eq 0 ] || [ "$(jq '[.[] | select(.status != "completed")] | length' <<<"$copies")" -gt 0 ]; then
        waiting+=("$context")
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

  # The wait took about an hour. The artifacts were verified against one exact
  # base revision, so never squash them onto a base that moved meanwhile.
  git fetch origin "$base"
  if [ "$(git rev-parse "origin/$base")" != "$verified" ]; then
    gh pr close "$pr_url" --comment "Not merged: $base moved while the required checks ran, so this package no longer sits on the base it was verified against. Run the publishing workflow again." >/dev/null 2>&1 || true
    delete_branch
    echo "::error title=The base moved while the checks ran::$base advanced after verification, so $pr_url was closed unmerged; run the complete workflow again." >&2
    exit 1
  fi
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

if ! gh pr merge "$pr_url" --squash --match-head-commit "$head_sha" --subject "$title" --body "" 2>"$tmp/publish-pr-merge.err"; then
  cat "$tmp/publish-pr-merge.err" >&2
  # A pull request opened with the workflow token gets its own pull_request
  # check runs, and GitHub holds them for a person to approve. While they
  # wait, the rule refuses the merge even though the dispatched copies of
  # the same checks passed (2026-11-19, #1128). Say so plainly.
  gated=$(gh api "repos/{owner}/{repo}/actions/runs?head_sha=$head_sha&event=pull_request&per_page=50" \
    --jq '[.workflow_runs[] | select(.conclusion == "action_required") | .name] | unique | join(", ")' 2>/dev/null || true)
  if [ -n "$gated" ]; then
    echo "::error title=The pull request's own checks are waiting for approval::$pr_url stays open for a person. GitHub holds its pull_request checks ($gated) for approval because the workflow token opened it, and refuses the merge while they wait. Save a fine-grained token for this repository (Contents, Pull requests and Actions read and write; Checks and Metadata read) as the SITE_PUBLISH_TOKEN secret of the site-publish-production environment so Site Publish opens publications as the owner, or approve the checks and merge this one by hand." >&2
    exit 1
  fi
  echo "::error title=The publication pull request could not be merged::$pr_url stays open for a person to merge. Check what the protection rule on $base still requires (the error above says what GitHub refused) and merge by hand." >&2
  exit 1
fi
delete_branch

git fetch origin "$base"
merged=$(git rev-parse "origin/$base")
if [ "$(git rev-parse "origin/$base^{tree}")" != "$(git rev-parse "$head_sha^{tree}")" ]; then
  echo "::warning title=Merged tree differs from the verified tree::$base moved between verification and merge; the live-verification step decides whether the published edition still matches." >&2
fi
echo "publish-through-pr: merged $pr_url as $merged"

# A merge made with the workflow token does not trigger push workflows, so
# without this dispatch Site Check would never run on the merged head (a merge
# with the owner's token does trigger it; the two runs share one concurrency
# group) and a broken deploy on the
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
