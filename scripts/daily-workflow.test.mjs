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
    const [daily, snapshot, transits, seasonClose, weeklyRecap, publisher] = await Promise.all([
      read('.github/workflows/daily-horoscopes.yml'),
      read('.github/workflows/registry-market-snapshot.yml'),
      read('.github/workflows/transits-monthly.yml'),
      read('.github/workflows/race-season-close.yml'),
      read('.github/workflows/race-weekly-recap.yml'),
      read('scripts/publish-through-pr.sh'),
    ]);

    // The direct push stays the first attempt (the fast path if a bypass
    // actor is ever granted); GH006 — "changes must be made through a pull
    // request" — hands the same verified commit to the shared publisher,
    // which opens and squash-merges a pull request with the workflow token.
    // The Race workflows pushed straight to main with no fallback and failed
    // every run from 2026-08-31 (recap) and 2026-09-23 (season close).
    for (const [name, workflow] of Object.entries({ daily, snapshot, transits, seasonClose, weeklyRecap })) {
      expect(workflow, name).toContain('pull-requests: write');
      expect(workflow, name).toContain('actions: write');
      expect(workflow, name).toContain('GH_TOKEN: ${{ github.token }}');
      expect(workflow, name).toContain('if grep -q "GH006" "$RUNNER_TEMP/publish-push.err"; then');
      expect(workflow, name).toContain('bash scripts/publish-through-pr.sh');
    }
    for (const [name, workflow] of Object.entries({ seasonClose, weeklyRecap })) {
      expect(workflow, name).toContain('VERIFIED_BASE_SHA=$(git rev-parse HEAD)');
      expect(workflow, name).toContain('bash scripts/publish-through-pr.sh "$DEFAULT_BRANCH" "$VERIFIED_BASE_SHA"');
      expect(workflow, name).not.toMatch(/git push origin HEAD:\$\{\{/);
    }

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

    expect(workflow).toContain('timeout-minutes: 25');
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
