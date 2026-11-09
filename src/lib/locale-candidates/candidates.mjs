// The five candidates for the site's next locale (Part 2 of the 2026-11
// locale expansion). Nothing here is published: no candidate is in LOCALES,
// no route, sitemap or hreflang names one, and a test holds that. The choice
// waits for Keyword Planner volumes (docs/visibility/keywords/).
//
// Facts only: codes, scripts, fonts and the Keyword Planner settings to
// measure with. No volumes, shares or market sizes are stated here.

export const LOCALE_CANDIDATES = Object.freeze([
  {
    code: 'de', name: 'German', nativeName: 'Deutsch', hreflang: 'de', intl: 'de-DE', dir: 'ltr', script: 'Latin',
    pathPrefix: '/de', keywordPlanner: { language: 'German', locations: 'Germany; Austria; Switzerland' },
    glyphSample: 'äöüßÄÖÜ',
    fonts: 'Covered by the current self-hosted Latin subsets.',
    notes: 'Formal "Sie" versus informal "du" is a register decision for the copy deck; horoscope media in German mostly use "Sie".',
  },
  {
    code: 'pl', name: 'Polish', nativeName: 'Polski', hreflang: 'pl', intl: 'pl-PL', dir: 'ltr', script: 'Latin',
    pathPrefix: '/pl', keywordPlanner: { language: 'Polish', locations: 'Poland' },
    glyphSample: 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
    fonts: 'Needs the latin-ext subsets of EB Garamond, Instrument Sans and JetBrains Mono (same families, self-hosted).',
    notes: 'Three plural forms (one, few, many) plus other; sign names decline by case.',
  },
  {
    code: 'tr', name: 'Turkish', nativeName: 'Türkçe', hreflang: 'tr', intl: 'tr-TR', dir: 'ltr', script: 'Latin',
    pathPrefix: '/tr', keywordPlanner: { language: 'Turkish', locations: 'Turkey' },
    glyphSample: 'çğıİöşüÇĞÖŞÜ',
    fonts: 'Needs the latin-ext subsets (ğ, ş, ı, İ); same families, self-hosted.',
    notes: 'Dotted and dotless i: casing must use toLocaleUpperCase("tr") and toLocaleLowerCase("tr").',
  },
  {
    code: 'ja', name: 'Japanese', nativeName: '日本語', hreflang: 'ja', intl: 'ja-JP', dir: 'ltr', script: 'Japanese (kana and kanji)',
    pathPrefix: '/ja', keywordPlanner: { language: 'Japanese', locations: 'Japan' },
    glyphSample: 'あア星座',
    fonts: 'Not covered. Needs a self-hosted Japanese family (subset per page or a system-font stack decision); the Chinese pages show how CJK is handled today.',
    notes: 'No spaces between words: the copy rules and word counts need a character-based measure, as coverage.mjs already does for Chinese.',
  },
  {
    code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', hreflang: 'hi', intl: 'hi-IN', dir: 'ltr', script: 'Devanagari',
    pathPrefix: '/hi', keywordPlanner: { language: 'Hindi', locations: 'India' },
    glyphSample: 'राशिफल',
    fonts: 'Not covered. Needs a self-hosted Devanagari family that pairs with the display serif.',
    notes: 'Much Indian astrology search is sidereal (Vedic) and some is in English or romanized Hindi; the site is tropical, so the keyword list needs reading with that in mind.',
  },
]);

export const CANDIDATE_CODES = Object.freeze(LOCALE_CANDIDATES.map((candidate) => candidate.code));

export function localeCandidate(code) {
  const found = LOCALE_CANDIDATES.find((candidate) => candidate.code === code);
  if (!found) throw new Error(`Not a locale candidate: ${code} (candidates: ${CANDIDATE_CODES.join(', ')})`);
  return found;
}
