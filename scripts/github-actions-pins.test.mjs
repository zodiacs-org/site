import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowsDirectory = resolve(root, '.github', 'workflows');
// Composite actions kept in this repository call external actions too.
const actionsDirectory = resolve(root, '.github', 'actions');
const immutableCommit = /^[0-9a-f]{40}$/iu;

function externalActionUse(line) {
  const match = /^\s*(?:-\s*)?uses:\s*["']?([^\s#"']+)/u.exec(line);
  if (!match || match[1].startsWith('./')) return null;
  return match[1];
}

async function yamlFiles(directory, pattern, options = {}) {
  const files = await readdir(directory, options).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  return files.filter((file) => pattern.test(basename(file))).sort().map((file) => resolve(directory, file));
}

describe('GitHub Actions supply chain', () => {
  it('pins every external action to an immutable commit SHA', async () => {
    const files = [
      ...await yamlFiles(workflowsDirectory, /\.ya?ml$/u),
      ...await yamlFiles(actionsDirectory, /^action\.ya?ml$/u, { recursive: true }),
    ];
    const violations = [];
    let externalActionCount = 0;

    for (const file of files) {
      const lines = (await readFile(file, 'utf8')).split('\n');
      lines.forEach((line, index) => {
        const actionUse = externalActionUse(line);
        if (!actionUse) return;
        externalActionCount += 1;
        const separator = actionUse.lastIndexOf('@');
        const ref = separator >= 0 ? actionUse.slice(separator + 1) : '';
        if (!immutableCommit.test(ref)) {
          violations.push(`${relative(root, file)}:${index + 1} ${actionUse}`);
        }
      });
    }

    expect(externalActionCount).toBeGreaterThan(0);
    expect(violations, 'mutable external action references').toEqual([]);
  });

  // Dependabot reads .github/workflows by default, but a composite action's
  // pins only when its directory is listed.
  it('lists every composite action directory for Dependabot', async () => {
    const dependabot = await readFile(resolve(root, '.github', 'dependabot.yml'), 'utf8');
    // Only the github-actions entry counts: from its line to the next entry.
    const actionsEntry = dependabot
      .split(/^\s*-\s*package-ecosystem:/mu)
      .find((entry) => /^\s*["']?github-actions["']?\s*(?:#.*)?$/u.test(entry.split('\n')[0])) ?? '';
    const listed = new Set([...actionsEntry.matchAll(/^\s*-\s*["']?(\/[^\s"'#]*)["']?\s*(?:#.*)?$/gmu)]
      .map((match) => match[1]));
    const unlisted = (await yamlFiles(actionsDirectory, /^action\.ya?ml$/u, { recursive: true }))
      .map((file) => `/${relative(root, dirname(file)).split(sep).join('/')}`)
      .filter((directory) => !listed.has(directory));
    expect(unlisted, 'composite action directories missing from dependabot.yml').toEqual([]);
  });
});
