import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Resolves the document-level font stacks in tokens.css for a given <html>,
// so a page that passes stableTypography to Base keeps the faces its
// language needs. Only the selector forms tokens.css uses on the root are
// understood; any other form fails the test instead of being skipped.

type Root = { lang: string; attributes: string[] };
type Specificity = [number, number, number];

const FONT_VARIABLES = ['--font-serif', '--font-sans', '--font-mono'] as const;

function matchCompound(selector: string, root: Root): { matches: boolean; specificity: Specificity } {
  let rest = selector.trim();
  let matches = true;
  const specificity: Specificity = [0, 0, 0];
  while (rest.length) {
    let token: RegExpMatchArray | null;
    if ((token = rest.match(/^:root/u))) {
      specificity[1] += 1;
    } else if ((token = rest.match(/^html/u))) {
      specificity[2] += 1;
    } else if ((token = rest.match(/^\[([a-z-]+)\]/u))) {
      specificity[1] += 1;
      matches &&= root.attributes.includes(token[1]);
    } else if ((token = rest.match(/^\[lang='([a-z-]+)'\]/u))) {
      specificity[1] += 1;
      matches &&= root.lang === token[1];
    } else if ((token = rest.match(/^:lang\(([a-z-]+)\)/u))) {
      specificity[1] += 1;
      matches &&= root.lang === token[1] || root.lang.startsWith(`${token[1]}-`);
    } else if ((token = rest.match(/^:not\(((?:[^()]|\([^()]*\))+)\)/u))) {
      const inner = matchCompound(token[1], root);
      inner.specificity.forEach((value, index) => { specificity[index] += value; });
      matches &&= !inner.matches;
    } else if ((token = rest.match(/^:where\(((?:[^()]|\([^()]*\)|\((?:[^()]|\([^()]*\))*\))+)\)/u))) {
      matches &&= matchCompound(token[1], root).matches;
    } else {
      throw new Error(`Unsupported root selector: ${selector}`);
    }
    rest = rest.slice(token[0].length);
  }
  return { matches, specificity };
}

function compare(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

async function resolveStacks(root: Root): Promise<Record<string, string>> {
  const css = (await readFile(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//gu, '');
  const winners = new Map<string, { value: string; specificity: Specificity }>();
  for (const rule of css.matchAll(/(?<=^|\})\s*([^{}@]+?)\s*\{([^{}]*)\}/gu)) {
    for (const selector of rule[1].split(',').map((part) => part.trim())) {
      if (!/^(?::root|html)(?![\w-])/u.test(selector)) continue;
      const { matches, specificity } = matchCompound(selector, root);
      if (!matches) continue;
      for (const declaration of rule[2].matchAll(/(--font-(?:serif|sans|mono)):\s*([^;]+);/gu)) {
        const current = winners.get(declaration[1]);
        // Later rules win ties, as in the cascade.
        if (!current || compare(specificity, current.specificity) >= 0) {
          winners.set(declaration[1], { value: declaration[2].trim(), specificity });
        }
      }
    }
  }
  return Object.fromEntries(FONT_VARIABLES.map((name) => [name, winners.get(name)?.value.split(',')[0].trim() ?? '']));
}

describe('stable typography per language', () => {
  it('keeps the Cyrillic faces on a Russian page given stableTypography', async () => {
    const stacks = await resolveStacks({ lang: 'ru', attributes: ['data-stable-typography'] });
    expect(stacks).toEqual({
      '--font-serif': "'EB Garamond Cyrillic'",
      '--font-sans': "'Golos Text'",
      '--font-mono': "'JetBrains Mono Cyrillic'",
    });
    expect(stacks).toEqual(await resolveStacks({ lang: 'ru', attributes: [] }));
  });

  it('keeps the Russian local tier ahead of stable typography', async () => {
    expect(await resolveStacks({ lang: 'ru', attributes: ['data-stable-typography', 'data-local-typography'] }))
      .toEqual(await resolveStacks({ lang: 'ru', attributes: ['data-local-typography'] }));
    expect((await resolveStacks({ lang: 'ru', attributes: ['data-local-typography'] }))['--font-serif'])
      .toBe("'EB Garamond Fallback'");
  });

  it.each(['en', 'es', 'fr', 'it', 'pt'])('gives %s pages the optional Latin faces', async (lang) => {
    expect(await resolveStacks({ lang, attributes: ['data-stable-typography'] })).toEqual({
      '--font-serif': "'EB Garamond Phase1'",
      '--font-sans': "'Instrument Sans Phase1'",
      '--font-mono': "'JetBrains Mono Phase1'",
    });
    expect((await resolveStacks({ lang, attributes: [] }))['--font-serif']).toBe("'EB Garamond'");
    expect((await resolveStacks({ lang, attributes: ['data-stable-typography', 'data-local-typography'] }))['--font-serif'])
      .toBe("'EB Garamond Fallback'");
  });
});
