import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');

describe('daily publication operations', () => {
  it('cannot skip exact-live verification or discovery on a no-op recovery run', async () => {
    const workflow = await read('.github/workflows/daily-horoscopes.yml');
    const commit = workflow.indexOf('- name: Commit if changed');
    const live = workflow.indexOf('- name: Require exact edition in production');
    const indexNow = workflow.indexOf('- name: Notify IndexNow');
    const receipt = workflow.indexOf('- name: Write immutable operation receipt');

    expect(commit).toBeGreaterThan(-1);
    expect(live).toBeGreaterThan(commit);
    expect(indexNow).toBeGreaterThan(live);
    expect(receipt).toBeGreaterThan(indexNow);
    expect(workflow.slice(live, indexNow)).not.toMatch(/\n\s+if:/);
    expect(workflow.slice(indexNow, receipt)).not.toMatch(/\n\s+if:/);
    expect(workflow).not.toContain("steps.commit.outputs.committed == 'true'");
    expect(workflow).toContain('ref: ${{ github.event.repository.default_branch }}');
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('VERIFIED_BASE_SHA=$(git rev-parse HEAD)');
    expect(workflow).toContain('remote_sha=$(git rev-parse "origin/$DEFAULT_BRANCH")');
    expect(workflow).toContain('if [ "$remote_sha" != "$VERIFIED_BASE_SHA" ]; then');
    expect(workflow).toContain('rerun the complete workflow');
    expect(workflow).not.toContain('git rebase');
    expect(workflow).not.toContain('for attempt in 1 2 3; do');
    expect(workflow).toContain('git push origin "HEAD:$DEFAULT_BRANCH"');
  });

  it('publishes through a pull request when the protected branch refuses a direct push', async () => {
    const [daily, snapshot, transits, seasonClose, weeklyRecap, pulse, publisher, signPages] = await Promise.all([
      read('.github/workflows/daily-horoscopes.yml'),
      read('.github/workflows/registry-market-snapshot.yml'),
      read('.github/workflows/transits-monthly.yml'),
      read('.github/workflows/race-season-close.yml'),
      read('.github/workflows/race-weekly-recap.yml'),
      read('.github/workflows/pulse-refresh.yml'),
      read('scripts/publish-through-pr.sh'),
      read('scripts/build-sign-pages.mjs'),
    ]);

    // The direct push stays the first attempt (the fast path if a bypass
    // actor is ever granted); GH006 — "changes must be made through a pull
    // request" — hands the same verified commit to the shared publisher,
    // which opens and squash-merges a pull request with the workflow token.
    // The Race workflows pushed straight to main with no fallback and failed
    // every run from 2026-08-31 (recap) and 2026-09-23 (season close); Pulse
    // Refresh's bare `git push` failed every Monday from 2026-08-31.
    for (const [name, workflow] of Object.entries({ daily, snapshot, transits, seasonClose, weeklyRecap, pulse })) {
      expect(workflow, name).toContain('pull-requests: write');
      expect(workflow, name).toContain('actions: write');
      expect(workflow, name).toContain('GH_TOKEN: ${{ github.token }}');
      // The owner's token never reaches a publishing workflow; Site Publish holds it.
      expect(workflow, name).not.toContain('secrets.');
      expect(workflow, name).toContain('if grep -q "GH006" "$RUNNER_TEMP/publish-push.err"; then');
      expect(workflow, name).toContain('bash scripts/publish-through-pr.sh');
    }
    for (const [name, workflow] of Object.entries({ seasonClose, weeklyRecap, pulse })) {
      expect(workflow, name).toContain('DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}');
      expect(workflow, name).toContain('VERIFIED_BASE_SHA=$(git rev-parse HEAD)');
      expect(workflow.indexOf('VERIFIED_BASE_SHA=$(git rev-parse HEAD)'), name).toBeLessThan(
        workflow.indexOf('git commit -m'),
      );
      expect(workflow, name).toContain('git push origin "HEAD:$DEFAULT_BRANCH" 2>"$RUNNER_TEMP/publish-push.err"');
      expect(workflow, name).toContain('bash scripts/publish-through-pr.sh "$DEFAULT_BRANCH" "$VERIFIED_BASE_SHA"');
      expect(workflow, name).not.toMatch(/git push origin HEAD:\$\{\{/);
      expect(workflow, name).not.toMatch(/^\s*git push\s*$/m);
      expect(workflow, name).toContain('ref: ${{ github.event.repository.default_branch }}');
      expect(workflow, name).toMatch(/^concurrency:\n  group: .+\n  cancel-in-progress: false$/m);
      expect(workflow, name).toMatch(/^    timeout-minutes: \d+$/m);
    }

    // The Registry catalogue pages bake pulse.json and the market snapshot,
    // and Site Check's legacy-wing drift gate rebuilds them, so a workflow
    // that publishes either must regenerate the pages (which import sharp,
    // hence npm ci) and commit them together with the data. Every publisher
    // of those pages shares one queue, so none verifies against a base that
    // another is about to move.
    expect(signPages).toContain("readFile(resolve(root, 'public/assets/pulse.json')");
    for (const [name, workflow] of Object.entries({ daily, snapshot, pulse })) {
      const install = workflow.indexOf('run: npm ci');
      const pages = workflow.indexOf('node scripts/build-sign-pages.mjs');
      expect(install, name).toBeGreaterThan(-1);
      expect(pages, name).toBeGreaterThan(install);
      expect(workflow, name).toContain('group: daily-publication-');
    }
    for (const [name, workflow] of Object.entries({ snapshot, pulse })) {
      expect(workflow.indexOf('node scripts/build-sign-pages.mjs'), name).toBeLessThan(
        workflow.indexOf('git add $FILES'),
      );
      expect(workflow, name).toMatch(/FILES="[^"\n]* public\/registry"/);
    }
    expect(pulse.indexOf('run: node scripts/build-pulse.mjs')).toBeLessThan(
      pulse.indexOf('run: node scripts/build-sign-pages.mjs'),
    );
    expect(pulse).toContain('FILES="public/assets/pulse.json public/registry"');
    expect(pulse).toContain('group: daily-publication-${{ github.event.repository.default_branch }}');

    // A Trophy Hall engraving still waiting in its pull request means main is
    // behind; opening a second one could engrave the same season twice.
    const guard = seasonClose.indexOf('select(.title | startswith("Trophy Hall: engrave"))');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(seasonClose.indexOf('git push origin "HEAD:$DEFAULT_BRANCH"'));
    expect(seasonClose).toContain('git commit -m "Trophy Hall: engrave ${ENGRAVED:-the newly closed season}"');
    expect(seasonClose).toContain('ENGRAVED: ${{ steps.close.outputs.engraved }}');
    expect(daily).toContain('bash scripts/publish-through-pr.sh "$DEFAULT_BRANCH" "$VERIFIED_BASE_SHA"');
    expect(daily).toContain('echo "commit_sha=$(git rev-parse "origin/$DEFAULT_BRANCH")" >> "$GITHUB_OUTPUT"');

    expect(publisher).toContain('set -euo pipefail');
    expect(publisher).toContain('advanced after verification; rerun the complete workflow');
    expect(publisher).toContain('gh pr create --base "$base" --head "$branch"');
    expect(publisher).toContain('gh pr merge "$pr_url" --squash');
    // A token-made merge triggers no push workflow, so the publisher asks for
    // Site Check on the merged head itself (workflow_dispatch is the exception).
    expect(publisher).toContain('gh workflow run site-check.yml --ref "$base" -f "scope_base=$merged"');
    // A token-made pull request triggers no pull_request workflows, so the
    // checks main requires never started (blocked from 2026-11-15). The
    // publisher dispatches them on its own branch and merges only when every
    // required check on that exact head has passed.
    expect(publisher).toContain(".protection.required_status_checks.contexts[]?");
    expect(publisher).toContain('node scripts/write-sign-page-allowance.mjs "$verified"');
    expect(publisher.indexOf('write-sign-page-allowance.mjs')).toBeLessThan(publisher.indexOf('git push origin "HEAD:refs/heads/$branch"'));
    expect(publisher).toContain('gh workflow run site-check.yml --ref "$branch" -f "scope_base=$verified"');
    expect(publisher).toContain('gh workflow run sitemap-dates.yml --ref "$branch" -f "base=$verified" -f "head=$head_sha"');
    expect(publisher).toContain('commits/$head_sha/check-runs');
    expect(publisher.indexOf('all required checks passed')).toBeLessThan(publisher.indexOf('gh pr merge "$pr_url" --squash'));
    // A refused merge whose pull_request checks wait for approval says so.
    expect(publisher).toContain('select(.conclusion == "action_required")');
    expect(publisher).toContain('SITE_PUBLISH_APP_KEY');
    // Every copy of a required check must pass, and the merge is pinned to the head.
    expect(publisher).toContain('select(.status != "completed")');
    expect(publisher).toContain('--match-head-commit "$head_sha"');
    // The landing is handed to Site Publish (#1128, 2026-11-19), and falls back to
    // the workflow token only when Site Publish stops at a gate or cannot get the App's token.
    expect(publisher).toContain('gh workflow run site-publish.yml --ref "$default"');
    expect(publisher).toContain('"Check that the publishing key is saved" or .name == "Check who asked" or .name == "Get the publishing app\'s token"');
    expect(publisher.indexOf('hand_off()')).toBeLessThan(publisher.indexOf('gh pr create'));
    // In land mode the branch is data: it must sit at exactly the handed-over commit.
    expect(publisher).toContain('if [ "$(git rev-parse FETCH_HEAD)" != "$head_sha" ]; then');
    // ...and be one publication on the verified base that touches only generated data.
    expect(publisher).toContain('git merge-base --is-ancestor "$verified" "$head_sha"');
    expect(publisher).toContain('git diff --no-renames --name-only "$verified" "$head_sha"');
    expect(publisher).toContain("grep -vE '^((src/data|public/assets|public/registry|docs/race-recaps)/.*\\.(json|md)|public/registry/.*\\.html)$'");
    expect(publisher).toContain("grep -vx '.github/phase1-scope-allowance.json'");
    // A re-run attempt gets its own branch, so it never reads an earlier attempt's Site Publish run.
    expect(publisher).toContain('${GITHUB_RUN_ID:-$$}-${GITHUB_RUN_ATTEMPT:-1}');

    const sitePublish = await read('.github/workflows/site-publish.yml');
    expect(sitePublish).toContain('environment: site-publish-production');
    expect(sitePublish).toContain('permissions:\n  contents: read');
    expect(sitePublish).toContain("if: github.ref == format('refs/heads/{0}', github.event.repository.default_branch)");
    expect(sitePublish).toContain('ref: ${{ github.event.repository.default_branch }}');
    expect(sitePublish).toContain('persist-credentials: false');
    expect(sitePublish).toContain('[[ "$BRANCH" =~ ^publish/[a-z0-9-]+$ ]]');
    // Each key appears in exactly two places: the presence check and the step that uses it.
    expect(sitePublish.split('secrets.SITE_PUBLISH_TOKEN').length - 1).toBe(2);
    expect(sitePublish.split('secrets.SITE_PUBLISH_APP_KEY').length - 1).toBe(2);
    expect(sitePublish).toContain('GH_TOKEN: ${{ steps.app.outputs.token || secrets.SITE_PUBLISH_TOKEN }}');
    // The App's token is minted after the trusted checkout, by trusted code, with no third-party action.
    expect(sitePublish.indexOf('persist-credentials: false')).toBeLessThan(sitePublish.indexOf('run: bash scripts/github-app-token.sh'));
    const appToken = await read('scripts/github-app-token.sh');
    expect(appToken).toContain('permissions: {contents: "write", pull_requests: "write", actions: "write", checks: "read"}');
    expect(appToken).toContain('repositories: [$repo]');
    expect(appToken).toContain('echo "::add-mask::$token"');
    expect(appToken).toContain("trap 'rm -f \"$key\"' EXIT");
    // No input is expanded straight into a shell line.
    for (const line of sitePublish.split('\n').filter((l) => /^\s*(run:|\[|if \[)/u.test(l))) {
      expect(line).not.toContain('${{');
    }
    expect(publisher).toContain('Allow GitHub Actions to create and approve pull requests');
    expect(publisher).not.toContain('--admin');
    expect(publisher).not.toContain('git rebase');
  });

  it('declares the daily and Monday-weekly publication boundary at 00:00 UTC', async () => {
    const [workflow, pageData, hub, plan, setup] = await Promise.all([
      read('.github/workflows/daily-horoscopes.yml'),
      read('src/lib/horoscope-page-data.ts'),
      read('src/pages/horoscopes/index.astro'),
      read('PLAN.md'),
      read('SETUP.md'),
    ]);

    expect(workflow).toContain('- cron: "0 0 * * *" # daily, 00:00 UTC');
    expect(workflow).not.toMatch(/cron:\s*["'](?:[1-9]|[1-5]\d)\s+0\s+\*\s+\*\s+\*["']/);
    expect(workflow).toContain('npm run editorial:horoscopes:build -- --date "$TARGET_DATE"');
    for (const [name, source] of Object.entries({ pageData, hub, plan, setup })) {
      expect(source, name).not.toContain('00:15 UTC');
      expect(source, name).not.toContain('T00:15:00.000Z');
    }
    expect(pageData).toContain('`${program.anchorDate}T00:00:00.000Z`');
    expect(hub).toContain('`${program.anchorDate}T00:00:00.000Z`');
  });

  it('bounds network waits and preserves auditable success and failure evidence', async () => {
    const [workflow, liveVerifier] = await Promise.all([
      read('.github/workflows/daily-horoscopes.yml'),
      read('scripts/verify-live-daily.mjs'),
    ]);

    // Room for the required checks the publisher waits on (Build & Check alone
    // runs about an hour) before it may merge its own pull request.
    expect(workflow).toContain('timeout-minutes: 150');
    expect(workflow).toContain('signal: AbortSignal.timeout(15_000)');
    expect(liveVerifier).toContain('signal: AbortSignal.timeout(15_000)');
    expect(workflow).toContain("schema: 'zodiacs.daily-operation-receipt.v2'");
    expect(workflow).toContain('horoscopeProgramSha256: canonicalSha256(horoscopeProgram)');
    expect(liveVerifier).toContain('production horoscope program is not the committed program');
    expect(liveVerifier).toContain('/api/v1/sky/today.json');
    expect(liveVerifier).toContain('sky data API is missing the open CORS header');
    expect(liveVerifier).toContain('not the committed ${localManifest.date} edition');
    expect(workflow).toContain(
      'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2',
    );
    expect(workflow).toContain('retention-days: 90');
    expect(workflow).toContain('- name: Record daily-publication incident');
    expect(workflow).toContain("if: github.event_name == 'schedule' && success()");
    expect(workflow).toContain("if: github.event_name == 'schedule' && failure()");
  });
});
