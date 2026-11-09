import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const generator = readFileSync(new URL('./build-build-report.mjs', import.meta.url), 'utf8');
const historical = readFileSync(new URL('../docs/build-report-2026-07-15/i18n-additions.md', import.meta.url), 'utf8');
const current = readFileSync(new URL('../i18n-additions.md', import.meta.url), 'utf8');

function generate(snapshot) {
  const root = mkdtempSync(join(tmpdir(), 'zodiacs-report-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'docs/build-report-2026-07-15'), { recursive: true });
    writeFileSync(join(root, 'scripts/build-build-report.mjs'), generator);
    writeFileSync(join(root, 'docs/build-report-2026-07-15/i18n-additions.md'), snapshot);
    writeFileSync(join(root, 'i18n-additions.md'), current);
    execFileSync(process.execPath, [join(root, 'scripts/build-build-report.mjs')], { stdio: 'pipe' });
    return readFileSync(join(root, 'BUILD-REPORT.md'), 'utf8');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('historical July build report', () => {
  it('reproduces the report with its pinned inventory even when the current inventory has grown', () => {
    expect(current.match(/^- `[^`]+`$/gm)).toHaveLength(608);
    const report = generate(historical);
    expect(report).toBe(readFileSync(new URL('../BUILD-REPORT.md', import.meta.url), 'utf8'));
    expect(report.slice(report.indexOf('# i18n additions\n'))).toBe(historical);
    expect(report).toContain('555/555 tests across 87 files');
    expect(report).toContain('1,824 Astro pages');
  });

  it.each([
    ['missing required key', (s) => s.replace('- `footerDisclosure`', '- `wrongKey`')],
    ['extra key', (s) => s + '\n- `extraKey`\n'],
    ['changed text with unchanged key count', (s) => s.replace('EN default:', 'Altered default:')],
    ['current inventory substituted for history', () => current],
  ])('refuses %s before producing a report', (_, change) => {
    expect(() => generate(change(historical))).toThrow();
  });
});
