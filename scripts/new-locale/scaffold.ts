// Prepares, without publishing anything, the working files for one new
// locale: a UI catalog skeleton keyed from the English catalog, a glossary
// stub, a copy deck template and a checklist. Everything goes to
// docs/i18n/staging/<code>/; nothing under src/ is touched, so no route,
// sitemap or hreflang can name the locale until a later, reviewed change
// wires it in (docs/i18n/NEW-LOCALE-RUNBOOK.md).
//
//   npx vite-node --script scripts/new-locale/scaffold.ts de
//   npx vite-node --script scripts/new-locale/scaffold.ts de --out <dir>
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import en from '../../src/lib/i18n/ui/en';
import { SIGNS } from '../../src/lib/signs';
import { localeCandidate } from '../../src/lib/locale-candidates/candidates.mjs';

export function scaffoldFiles(code: string): Record<string, string> {
  const candidate = localeCandidate(code);
  const catalog = Object.fromEntries(Object.entries(en).map(([key, value]) => [key, { en: value, [code]: '' }]));
  const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node'];
  const aspects = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];
  const phases = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  const glossary = {
    locale: code,
    note: 'Fill each target with the term readers in this language use, as an astrologer writing natively would. Leave none blank before any page is written.',
    signs: Object.fromEntries(SIGNS.map((sign) => [sign.slug, { en: sign.name, target: '', cases: 'Fill grammatical cases if the language declines names (in, with, for).' }])),
    planets: Object.fromEntries(planets.map((name) => [name, ''])),
    aspects: Object.fromEntries(aspects.map((name) => [name, ''])),
    moonPhases: Object.fromEntries(phases.map((name) => [name, ''])),
    houses: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [String(index + 1), { ordinal: '', theme: '' }])),
    terms: Object.fromEntries(['birth chart', 'rising sign', 'Sun sign', 'house', 'retrograde', 'eclipse', 'compatibility', 'horoscope', 'Reading confidence NN%'].map((term) => [term, ''])),
  };
  const deck = `# ${candidate.name} copy deck (staging)

Locale \`${code}\`, path prefix \`${candidate.pathPrefix}\`, hreflang \`${candidate.hreflang}\`, Intl \`${candidate.intl}\`, ${candidate.dir.toUpperCase()}, ${candidate.script} script.

Status: staging only. Nothing in this folder is published or wired into the site.

## Rules carried over from every locale

- Written natively in ${candidate.nativeName}, never translated sentence by sentence.
- No em or en dashes. Use commas, colons, full stops or parentheses.
- No token, market or crypto words on consumer pages. The boundary scanner needs this language's terms added before the first page.
- No promises about fate, health, money or relationships. No betting, investment or medical advice.
- \`{token}\` placeholders stay byte-exact, and "Zodiacs.org" is never translated.
- Forecasts carry the reading confidence label in this language.

## Decisions for this language

- Register: ${candidate.notes}
- Fonts: ${candidate.fonts}
- Keyword Planner: language ${candidate.keywordPlanner.language}; locations ${candidate.keywordPlanner.locations}.

## Glossary

See \`glossary.json\` in this folder.
`;
  const checklist = `# ${candidate.name}: checklist from staging to release

Follow docs/i18n/NEW-LOCALE-RUNBOOK.md. Each step is its own draft PR.

- [ ] Keyword Planner volumes filled in docs/visibility/keywords/${code}.csv, and the locale chosen by Dias
- [ ] Glossary and copy deck filled and read by a native speaker
- [ ] Fonts: ${candidate.fonts}
- [ ] R0 foundation: LOCALES, LOCALE_META and the catalog (catalog.json becomes src/lib/i18n/ui/${code}.ts), with every route still absent
- [ ] Boundary scanner and copy rules extended with this language's banned terms
- [ ] R1 content: pages built behind the locale expansion record, noindex
- [ ] Native review of the sample sheet
- [ ] R2 release: records released in batches of 10 pages a week or fewer
`;
  return {
    'catalog.json': `${JSON.stringify(catalog, null, 2)}\n`,
    'glossary.json': `${JSON.stringify(glossary, null, 2)}\n`,
    'COPY-DECK.md': deck,
    'CHECKLIST.md': checklist,
  };
}

const isMain = process.argv[1]?.endsWith('scaffold.ts');
if (isMain) {
  const args = process.argv.slice(2);
  const code = args.find((arg) => !arg.startsWith('--'));
  if (!code) throw new Error('Usage: scaffold.ts <de|pl|tr|ja|hi> [--out <dir>]');
  const outIndex = args.indexOf('--out');
  const out = outIndex >= 0 ? args[outIndex + 1] : join('docs/i18n/staging', code);
  if (existsSync(join(out, 'catalog.json'))) throw new Error(`${out} already has a scaffold; edit it instead of overwriting`);
  mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(scaffoldFiles(code))) writeFileSync(join(out, name), text);
  console.log(`Scaffolded ${code} in ${out} (${Object.keys(en).length} catalog keys). Nothing is published.`);
}
