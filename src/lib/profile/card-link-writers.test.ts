import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as cardLink from './card-link';

/*
 * Chart card links are no longer made (the 9 November 2026 audit,
 * Decision A): a card gives the birth date and time to the minute. The
 * reader stays so cards already sent still open, and encodeCardLink stays
 * only to make fixture tokens in tests. No page may call it, and nothing may
 * write a #card= link again.
 */
const root = resolve(process.cwd(), 'src');
const CODE = /\.(?:[cm]?[jt]sx?|astro|mdx)$/u;
const TEST = /\.test\.[cm]?[jt]sx?$/u;

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sources = walk(root)
  .filter((path) => CODE.test(path) && !TEST.test(path))
  .map((path) => ({ path: relative(root, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }));

describe('chart card link writers', () => {
  it('has no caller of the card link builder outside its own module', () => {
    const callers = sources
      .filter(({ path, text }) => path !== 'lib/profile/card-link.ts' && /\bencodeCardLink\b/u.test(text))
      .map(({ path }) => path);
    expect(callers).toEqual([]);
  });

  it('keeps every island and component free of card link writing', () => {
    const writers = sources
      .filter(({ path }) => path.startsWith('islands/') || path.startsWith('components/'))
      .filter(({ text }) => /\bencodeCardLink\b|\bcardUrl\s*\(|#card=\$\{|#\$\{CARD_FRAGMENT_KEY\}/u.test(text))
      .map(({ path }) => path);
    expect(writers).toEqual([]);
  });

  it('no longer exports a full card link builder', () => {
    expect('cardUrl' in cardLink).toBe(false);
  });

  it('still reads a card link someone already sent', () => {
    expect(cardLink.cardTokenFromHash('#card=c1.abc_-')).toBe('c1.abc_-');
    expect(typeof cardLink.decodeCardLink).toBe('function');
  });
});
