import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDE_PROTOCOL_DRAFT_STATUS } from './types';

const ROOT = resolve(import.meta.dirname, '../../..');
const CONTRACT_ROOT = resolve(ROOT, 'src/lib/guide-protocol');
const GUIDE_SERVER_ROOT = resolve(ROOT, 'src/lib/guide-server');
const RUNTIME_EXTENSIONS = new Set(['.astro', '.js', '.jsx', '.mjs', '.ts', '.tsx']);

function relativePath(path: string): string {
  return path.slice(ROOT.length + 1).replaceAll('\\', '/');
}

function isGuideServerFile(path: string): boolean {
  return path === resolve(ROOT, 'api/guide.ts') || path.startsWith(`${GUIDE_SERVER_ROOT}/`);
}

async function runtimeFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (path === CONTRACT_ROOT) continue;
    if (entry.isDirectory()) files.push(...await runtimeFiles(path));
    else if (RUNTIME_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

describe('Guide draft runtime boundary', () => {
  it('keeps the protocol out of browser and legacy runtime graphs', async () => {
    expect(GUIDE_PROTOCOL_DRAFT_STATUS).toBe('ios_reconciliation_required');
    const imports: string[] = [];
    for (const root of [resolve(ROOT, 'src'), resolve(ROOT, 'api')]) {
      for (const file of await runtimeFiles(root)) {
        const source = await readFile(file, 'utf8');
        if (source.includes('guide-protocol')) {
          expect(isGuideServerFile(file)).toBe(true);
          imports.push(relativePath(file));
        }
      }
    }
    expect(imports.sort()).toEqual([
      'src/lib/guide-server/anthropic.ts',
      'src/lib/guide-server/handler.ts',
      'src/lib/guide-server/openai.ts',
      'src/lib/guide-server/safety.ts',
    ]);
    const ask = await readFile(resolve(ROOT, 'api/assistant.ts'), 'utf8');
    const websiteClient = await readFile(resolve(ROOT, 'src/lib/assistant/open-assistant.ts'), 'utf8');
    expect(`${ask}\n${websiteClient}`).not.toContain('guide-server');
  });

  it('preserves /ask/ as the only Guide-capable website route', async () => {
    const ask = await readFile(resolve(ROOT, 'src/pages/ask/index.astro'), 'utf8');
    expect(ask).toContain('path="/ask/"');
    expect(existsSync(resolve(ROOT, 'src/pages/guide'))).toBe(false);
  });

  it('confines the Guide kill switch and Claude credential name to the server graph', async () => {
    const violations: string[] = [];
    for (const root of [resolve(ROOT, 'src'), resolve(ROOT, 'api')]) {
      for (const file of await runtimeFiles(root)) {
        const source = await readFile(file, 'utf8');
        if (/PUBLIC_GUIDE_|GUIDE_KILL_SWITCH|GUIDE_ANTHROPIC_API_KEY/u.test(source)
          && !isGuideServerFile(file)) violations.push(relativePath(file));
      }
    }
    expect(violations).toEqual([]);
    const handler = await readFile(resolve(GUIDE_SERVER_ROOT, 'handler.ts'), 'utf8');
    expect(handler).toContain("env.GUIDE_ANTHROPIC_API_KEY");
    expect(handler).toContain("env.GUIDE_KILL_SWITCH === '1'");
    expect(handler).not.toContain('GUIDE_API_ENABLED');
    expect(handler).not.toContain('GUIDE_API_PREVIEW_ACK');
    expect(handler).not.toContain('GUIDE_PROVIDER_CALLS_ENABLED');
    expect(handler).not.toContain('PUBLIC_GUIDE_');
  });

  it('records the current iOS gateway as a reconciliation target, not a compatible wire', async () => {
    const contract = await readFile(resolve(ROOT, 'docs/GUIDE-PROTOCOL-DRAFT-V1.md'), 'utf8');
    expect(contract).toContain('https://github.com/zodiacs-org/zodiacs/pull/2');
    expect(contract).toContain('82726c8c1582fbad50f244c7490c2ec3891c7a5e');
    expect(contract).toContain('not wire-compatible');
    expect(contract).toContain('ios_reconciliation_required');
  });
});
