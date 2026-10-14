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
      ['preview-api-smoke.yml', 'preview-smoke-production'],
      ['push-daily.yml', 'daily-push-production'],
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

  it('pins preview probes to the configured project and team hostname family', async () => {
    const smoke = await readFile(resolve(root, 'scripts/smoke-preview-functions.mjs'), 'utf8');
    expect(smoke).toContain('deploymentProjectId !== expectedProjectId');
    expect(smoke).toContain("/^zodiacs(?:-org)?-[a-z0-9-]+-zodiacsofficial\\.vercel\\.app$/u");
    expect(smoke).not.toContain("hostname.endsWith('.vercel.app')");
  });
});
