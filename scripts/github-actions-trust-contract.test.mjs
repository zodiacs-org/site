import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowsRoot = resolve(root, '.github/workflows');

async function workflows() {
  const names = (await readdir(workflowsRoot))
    .filter((name) => /\.ya?ml$/u.test(name))
    .sort();
  return Promise.all(names.map(async (name) => ({
    name,
    body: await readFile(resolve(workflowsRoot, name), 'utf8'),
  })));
}

describe('GitHub Actions trust boundaries', () => {
  it('never evaluates a privileged workflow from a deployed ref', async () => {
    const files = await workflows();
    for (const { name, body } of files) {
      expect(body, name).not.toMatch(/^\s*deployment_status\s*:/mu);
    }

    const preview = files.find(({ name }) => name === 'preview-api-smoke.yml')?.body ?? '';
    expect(preview).toContain('repository_dispatch:');
    expect(preview).toContain("- 'vercel.deployment.ready'");
    expect(preview).toContain("github.actor == 'vercel[bot]'");
    expect(preview).toContain("github.event.client_payload.environment == 'preview'");
    expect(preview).toContain('github.event.client_payload.project.id == vars.VERCEL_PROJECT_ID');
    expect(preview).toContain("github.event.client_payload.project.name == 'zodiacs-org'");
    expect(preview).toContain('environment: preview-smoke-production');
    expect(preview).toContain('ref: ${{ github.event.repository.default_branch }}');
    expect(preview).not.toContain('github.event.client_payload.git.sha');
  });

  it('runs every Vercel dispatch only for this project, on the default branch, without credentials', async () => {
    const dispatched = (await workflows()).filter(({ body }) => /^\s*repository_dispatch\s*:/mu.test(body));
    expect(dispatched.map(({ name }) => name)).toEqual(['indexnow-changes.yml', 'preview-api-smoke.yml']);
    for (const { name, body } of dispatched) {
      for (const [, type] of body.matchAll(/^\s*- '([^']+)'$/gmu)) expect(type, name).toMatch(/^vercel\.deployment\.[a-z]+$/u);
      expect(body, name).toContain("github.actor == 'vercel[bot]'");
      expect(body, name).toContain('github.event.client_payload.project.id == vars.VERCEL_PROJECT_ID');
      expect(body, name).toContain("github.event.client_payload.project.name == 'zodiacs-org'");
      expect(body, name).toMatch(/github\.event\.client_payload\.environment == '(?:preview|production)'/u);
      expect(body, name).toContain('ref: ${{ github.event.repository.default_branch }}');
      expect(body, name).toContain('persist-credentials: false');
      expect(body, name).not.toContain('github.event.client_payload.git.');
    }
  });

  it('scopes every Actions secret reference to its exact protected environment', async () => {
    const expected = new Map([
      ['account-deletion-receipt-cleanup.yml', 'account-cleanup-production'],
      ['compat-invite-sweep.yml', 'compatibility-invite-production'],
      ['daily-email.yml', 'daily-email-production'],
      ['db-backup.yml', 'database-backup-production'],
      ['pr-review.yml', 'pr-review-production'],
      ['preview-api-smoke.yml', 'preview-smoke-production'],
      ['push-daily.yml', 'daily-push-production'],
      ['site-publish.yml', 'site-publish-production'],
      ['weekly-digest.yml', 'weekly-digest-production'],
    ]);
    const files = await workflows();
    const secretBearing = files.filter(({ body }) => body.includes('secrets.'));

    expect(secretBearing.map(({ name }) => name).sort()).toEqual([...expected.keys()].sort());
    for (const { name, body } of secretBearing) {
      expect(body, name).toContain(`environment: ${expected.get(name)}`);
      expect(body, name).toContain('permissions:\n  contents: read');
    }
  });

  it('keeps the PR reviewer off untrusted code, author text and unbounded spend', async () => {
    const body = (await workflows()).find(({ name }) => name === 'pr-review.yml')?.body ?? '';
    expect(body).toContain('on:\n  pull_request:\n');
    expect(body).not.toMatch(/^\s*pull_request_target\s*:/mu);
    expect(body).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(body).toContain('persist-credentials: false');
    // Author-chosen text never reaches a script or the prompt through ${{ }}.
    expect(body).not.toMatch(/\$\{\{[^}]*(?:pull_request\.(?:title|body|head\.ref|head\.label)|github\.head_ref|label\.name|comment\.body)[^}]*\}\}/u);
    // No key: warn and stop green before any checkout or API call.
    expect(body).toMatch(/if \[ "\$HAS_KEY" != "true" \]; then\n\s+echo "run=false" >> "\$GITHUB_OUTPUT"\n.*\n\s+exit 0\n/u);
    // Spend guard: size skip, output tokens per reply, dollars per review.
    expect(body).toContain("MAX_LINES: ${{ vars.PR_REVIEW_MAX_LINES || '5000' }}");
    expect(body).toContain("MAX_FILES: ${{ vars.PR_REVIEW_MAX_FILES || '150' }}");
    expect(body).toContain("CLAUDE_CODE_MAX_OUTPUT_TOKENS: '16000'");
    expect(body).toContain("--max-budget-usd ${{ vars.PR_REVIEW_MAX_USD || '3' }}");
    expect(body).toContain('--max-turns 25');

    // Read only, enforced: anything off the allowed list is refused, not
    // auto-approved, and write and web tools are denied outright.
    expect(body).toContain('--permission-mode dontAsk');
    expect(body.match(/--permission-mode\b/gu)).toHaveLength(1);
    expect(body).not.toMatch(/bypassPermissions|acceptEdits|dangerously-skip-permissions/u);
    expect(body).toContain('--allowedTools "Read,Grep,Glob,Bash(gh pr diff:*),Bash(gh pr view:*),Bash(git log:*),Bash(git show:*)"');
    const denied = body.match(/--disallowedTools "([^"]+)"/u)?.[1].split(',') ?? [];
    for (const tool of ['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'WebFetch', 'WebSearch', 'Task', 'Agent']) {
      expect(denied, tool).toContain(tool);
    }

    // The monthly limit counts every run that was not skipped: short ones,
    // cancelled ones, and runs still queued or in progress at the same time.
    expect(body).toContain('--jq ".workflow_runs[] | select(.id != $RUN_ID and .conclusion != \\"skipped\\") | .id" | wc -l');
    expect(body).not.toContain('fromdateiso8601');
    expect(body).not.toContain('.status == \\"completed\\"');

    // The credential check reads the whole text in bash. A piped grep -q can
    // stop at the first match, fail the writer with SIGPIPE under pipefail
    // and let the text through.
    expect(body).not.toMatch(/\|\s*grep\b/u);
    const credRe = body.match(/^\s*cred_re='([^']+)'$/mu)?.[1] ?? '';
    expect(credRe).toContain('gh[pousr]_');
    const check = `[[ "$review"$'\\n'"$RESULT" =~ $cred_re ]]`;
    expect(body).toContain(check);
    const runCheck = (review, result) => spawnSync('bash', ['-e', '-o', 'pipefail', '-c', `cred_re='${credRe}'\n${check}`], {
      env: { PATH: process.env.PATH, review, RESULT: result },
    }).status;
    const padding = 'a'.repeat(120_000);
    expect(runCheck('ok', `{"review_markdown":"ghp_${'A'.repeat(36)} ${padding}"}`)).toBe(0);
    expect(runCheck('ok', `{"blockers":["${padding}","sk-ant-api03-${'b'.repeat(12)}"]}`)).toBe(0);
    expect(runCheck(`github_pat_${'c'.repeat(22)}`, '')).toBe(0);
    expect(runCheck('A clean review.', `{"review_markdown":"${padding}"}`)).toBe(1);
  });

  it('pins preview probes to the configured project and team hostname family', async () => {
    const smoke = await readFile(resolve(root, 'scripts/smoke-preview-functions.mjs'), 'utf8');
    expect(smoke).toContain('deploymentProjectId !== expectedProjectId');
    expect(smoke).toContain("/^zodiacs(?:-org)?-[a-z0-9-]+-zodiacsofficial\\.vercel\\.app$/u");
    expect(smoke).not.toContain("hostname.endsWith('.vercel.app')");
  });
});
