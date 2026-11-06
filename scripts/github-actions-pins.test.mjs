import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
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
});
