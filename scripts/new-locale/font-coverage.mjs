// Which candidate locales the self-hosted fonts can already draw. Reads the
// Latin subsets in public/fonts and checks each candidate's glyph sample.
//   node scripts/new-locale/font-coverage.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { create } from 'fontkitten';
import { LOCALE_CANDIDATES } from '../../src/lib/locale-candidates/candidates.mjs';

const fontsDir = fileURLToPath(new URL('../../public/fonts/', import.meta.url));

export function fontCoverage() {
  const files = readdirSync(fontsDir).filter((name) => name.endsWith('.woff2') && name.includes('-latin-'));
  const fonts = files.map((name) => ({ name, font: create(readFileSync(`${fontsDir}${name}`)) }));
  return Object.fromEntries(LOCALE_CANDIDATES.map(({ code, glyphSample }) => {
    const missing = fonts.filter(({ font }) => [...glyphSample].some((ch) => !font.hasGlyphForCodePoint(ch.codePointAt(0))));
    return [code, { covered: missing.length === 0, missingIn: missing.map(({ name }) => name) }];
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [code, { covered, missingIn }] of Object.entries(fontCoverage())) {
    console.log(`${code}: ${covered ? 'covered by the current fonts' : `missing glyphs in ${missingIn.length} font files`}`);
  }
}
