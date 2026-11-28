import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BIRTHDAY_DATE_FONT_OUTPUT,
  BIRTHDAY_DATE_FONT_SOURCE,
  birthdayDateCodepoints,
  birthdayDateLabels,
  unicodeRange,
} from './build-birthday-date-font.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = () => readFile(resolve(root, 'src/pages/birthday/[slug].astro'), 'utf8');
const subsetUrl = `/${BIRTHDAY_DATE_FONT_OUTPUT.replace(/^public\//u, '')}`;

// Rebuild with `node scripts/build-birthday-date-font.mjs` (fontTools 4.69.1,
// Brotli 1.2.1) and update this digest in the same commit.
const SUBSET_SHA256 = '28eaec49aed78f0da173323f99da7b95490bd86a8371729783425cd44a40d27a';

describe('birthday title date face', () => {
  it('covers every date the birthday pages print', async () => {
    const labels = await birthdayDateLabels();
    expect(labels).toHaveLength(366);
    expect(labels).toContain('February 29');
    expect(labels).toContain('September 30');
    expect(String.fromCodePoint(...await birthdayDateCodepoints())).toBe(' 0123456789ADFJMNOSabceghilmnoprstuvy');
  });

  it('pins the deterministic subset', async () => {
    const [subset, full] = await Promise.all([
      readFile(resolve(root, BIRTHDAY_DATE_FONT_OUTPUT)),
      readFile(resolve(root, BIRTHDAY_DATE_FONT_SOURCE)),
    ]);
    expect(subset.subarray(0, 4).toString('ascii')).toBe('wOF2');
    expect(subset.byteLength).toBeLessThan(full.byteLength / 3);
    expect(createHash('sha256').update(subset).digest('hex')).toBe(SUBSET_SHA256);
  });

  it('declares the subset as an optional face limited to those code points, ahead of the full italic', async () => {
    const source = await page();
    const face = source.match(/@font-face\s*\{[^}]*\}/u)?.[0] ?? '';
    expect(face).toContain(`url('${subsetUrl}') format('woff2')`);
    expect(face).toContain('font-style: italic;');
    expect(face).toContain('font-display: optional;');
    expect(face).toContain(`unicode-range: ${unicodeRange(await birthdayDateCodepoints())};`);
    expect(source).toMatch(/\.bday-title em\s*\{\s*font-family: 'EB Garamond Birthday Date', var\(--font-serif\);/u);
  });

  it('preloads the subset, ahead of the hero art, instead of the full italic', async () => {
    const source = await page();
    const hint = `<link slot="head" rel="preload" href="${subsetUrl}" as="font" type="font/woff2" crossorigin`;
    expect(source).toContain(hint);
    expect(source.indexOf(hint)).toBeLessThan(source.indexOf('as="image"'));
    expect(source).not.toMatch(/rel="preload" href="\/fonts\/eb-garamond-latin-400-italic\.woff2"/u);
  });
});
