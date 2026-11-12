// Locks the image and control name fixes from the alt-and-forms audit
// (A1 to A5): decorative glyphs and pictures stay out of accessible names,
// and an image beside its own visible words does not say them again.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import LearningPath from '../islands/LearningPath';
import NumerologyCalculator from '../islands/NumerologyCalculator';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(tsx|astro)$/u.test(name)) out.push(path);
  }
  return out;
}

// The text a screen reader would take from rendered markup: aria-hidden
// subtrees (flat spans here) and tags removed.
function spokenText(markup: string): string {
  return markup
    .replace(/<(span|svg)\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/gu, '')
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gu, ' $1 ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const ARROWS = /[↗→↑↓⇄⧉]/u;

describe('decorative orb glyphs (A1)', () => {
  it('hides every .orb span in source from the accessible name', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(ROOT, 'src'))) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/<span\s+class="orb[^"]*"[^>]*>/gu)) {
        if (!/\baria-hidden=/u.test(match[0])) {
          offenders.push(`${relative(ROOT, file)}: ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the arrow out of a rendered submit button name', () => {
    const markup = render(h(NumerologyCalculator, {}));
    const button = markup.match(/<button\b[^>]*type="submit"[^>]*>[\s\S]*?<\/button>/u)?.[0];
    expect(button).toBeTruthy();
    expect(button).toMatch(ARROWS);
    const name = spokenText(button!);
    expect(name.length).toBeGreaterThan(0);
    expect(name).not.toMatch(ARROWS);
  });
});

describe('Learn lesson links (A2)', () => {
  it('names each lesson link by its title, not by the painting', () => {
    const markup = render(h(LearningPath, {}));
    const links = [...markup.matchAll(/<a\b[^>]*class="learning-step__action lesson"[^>]*>[\s\S]*?<\/a>/gu)]
      .map((match) => match[0]);
    expect(links).toHaveLength(5);
    for (const link of links) {
      expect(link).toMatch(/<span class="lesson__art" aria-hidden="true">/u);
      const title = link.match(/<span class="lesson__t">([^<]+)/u)?.[1]?.trim();
      expect(title).toBeTruthy();
      expect(spokenText(link).startsWith(title!)).toBe(true);
    }
  });
});

describe('/sdk/ sign icons (A3)', () => {
  const sdk = read('public/sdk/index.html');

  it('gives sign icons beside a visible sign name an empty alt', () => {
    const icons = [...sdk.matchAll(/<img src="\.\.\/assets\/sdk\/zodiac-icons\/circle\/[a-z]+\.png" alt="([^"]*)"/gu)];
    expect(icons).toHaveLength(28);
    for (const icon of icons) expect(icon[1]).toBe('');
  });

  it('does not label the plain hero art div', () => {
    expect(sdk).toMatch(/<div class="hero__art">/u);
  });
});

describe('figures that carry a caption (A4, A5)', () => {
  it('leaves the second sign art on a sign page to its caption', () => {
    const page = read('src/pages/[sign]/index.astro');
    expect(page).toMatch(/<ArtFrame\s+sign=\{sign\.slug\}\s+alt=""\s+class="guide-history__detail"/u);
    expect(page).toContain('alt={`Star map of ${sign.name}`}');
  });

  it('keeps the horoscope sky wheel alt from repeating its caption', () => {
    const page = read('src/components/HoroscopeProgramPage.astro');
    const alt = page.match(/class="hz-cta__wheel hz-wheel">[\s\S]*?alt=\{`([^`]*)`\}/u)?.[1];
    expect(alt).toBe('Sky wheel counted from ${sign.name} as the first house');
    expect(alt).not.toContain('noon UTC');
  });
});
