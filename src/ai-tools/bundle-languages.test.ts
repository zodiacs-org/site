import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

// The hosted and local runtimes are Node bundles, built outside Vite. The
// Russian copy asks import.meta.env.SSR which half it runs in; left
// undefined in the bundle, every Russian sky calendar answer threw and came
// back as calculation-failed (19 October 2026). This runs the generated
// bundles themselves in each language the tools offer, and checks that a
// Cyrillic name reaches the share link.
for (const [name, path] of [
  ['HTTP', 'api/_ai/runtime.mjs'],
  ['stdio', 'plugins/zodiacs-developer/mcp/server.mjs'],
] as const) it(`answers the sky calendar in every language and keeps a Cyrillic name from the ${name} bundle`, async () => {
  const directory = await mkdtemp(join(root, 'node_modules/.ai-languages-'));
  try {
    let source = await readFile(join(root, path), 'utf8');
    expect(source).not.toContain('import.meta.env');
    if (name === 'stdio') {
      const start = source.indexOf('var pending = [];');
      const end = source.indexOf('// Calculations are synchronous;');
      expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
      source = source.slice(0, start) + source.slice(end);
    }
    source += '\nexport { executeAiTool };\n';
    await writeFile(join(directory, 'bundle.mjs'), source);
    await writeFile(join(directory, 'run.mjs'), `
import assert from 'node:assert/strict';
import { executeAiTool } from './bundle.mjs';
for (const language of ['en', 'es', 'pt', 'fr', 'it', 'ru']) {
  const result = await executeAiTool('get_sky_calendar', { language }, { occasions: true, now: () => new Date('2026-10-19T16:00:00Z') });
  assert.equal(result.ok, true, language + ': ' + JSON.stringify(result.error));
  assert.equal(result.data.language, language);
  assert.ok(result.data.next.length > 0, language);
}
const russian = await executeAiTool('get_sky_calendar', { language: 'ru' }, { occasions: true, now: () => new Date('2026-10-19T16:00:00Z') });
assert.match(russian.data.next[0].title, /[\\u0400-\\u04FF]/u);
// A Russian name stays on the share link, which the preview now draws in EB Garamond's Cyrillic.
const pair = await executeAiTool('get_compatibility', { a: { name: 'Анна', birthDate: '1994-08-21' }, b: { name: 'Иван', birthDate: '1992-03-02' } }, { occasions: true });
assert.equal(pair.ok, true, JSON.stringify(pair.error));
const shared = new URL(pair.data.shareUrl).searchParams;
assert.equal(shared.get('a'), 'Анна'); assert.equal(shared.get('b'), 'Иван');
console.log('every language answered');
`);
    const run = spawnSync(process.execPath, [join(directory, 'run.mjs')], { encoding: 'utf8', timeout: 60000 });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('every language answered');
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 65000);
