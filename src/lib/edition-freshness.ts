const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/** The locales whose daily pages carry an edition, each with its dated wording below. */
export type EditionLocale = 'en' | 'es' | 'pt' | 'fr' | 'it';

/**
 * The same Intl locales as LOCALE_META in src/lib/i18n/core.ts, so a dated
 * label reads exactly like the date the page already prints. Kept here
 * rather than imported: the drives load this file in plain Node.
 */
const EDITION_INTL_LOCALE: Record<EditionLocale, string> = { en: 'en-US', es: 'es-419', pt: 'pt-BR', fr: 'fr-FR', it: 'it-IT' };

function parsedUtcDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
}

export function utcDate(now: Date = new Date()): string {
  if (Number.isNaN(now.getTime())) throw new Error('invalid current date');
  return now.toISOString().slice(0, 10);
}

export function isCurrentUtcEdition(editionDate: string, now: Date = new Date()): boolean {
  return parsedUtcDate(editionDate) !== null && editionDate === utcDate(now);
}

export function editionDateLabel(editionDate: string, locale: EditionLocale = 'en'): string {
  const parsed = parsedUtcDate(editionDate);
  if (!parsed) return editionDate;
  const label = new Intl.DateTimeFormat(EDITION_INTL_LOCALE[locale], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
  // pt-BR writes the first of a month as "1º de novembro", as formatDate in
  // src/lib/i18n/dates.ts does for the date the page prints.
  if (locale === 'pt') return label.replace(/(^|\D)1 de (?=\p{L})/u, '$11º de ');
  // French and Italian write the first of a month as an ordinal: "1er novembre", "1° novembre".
  if (locale === 'fr') return label.replace(/^1 (?=\p{L})/u, '1er ');
  if (locale === 'it') return label.replace(/^1 (?=\p{L})/u, '1° ');
  return label;
}

/**
 * One dating rule: the relative wording to find and its dated form, where
 * `{date}` stands for the edition's date label. Rules apply in order, so a
 * fixed phrase comes before the single word it contains.
 */
export type EditionRule = readonly [pattern: RegExp, replacement: string];

const ENGLISH_RULES: readonly EditionRule[] = [
  [/\bToday[’']s\b/gu, 'The {date} edition’s'],
  [/\btoday[’']s\b/gu, 'the {date} edition’s'],
  [/\bToday,/gu, 'For the {date} edition,'],
  [/\bToday\b/gu, 'The {date} edition'],
  [/\bas of today\b/gu, 'as of {date}'],
  [/\b(for|from|on|until|through|since|before|after|by) today\b/gu, '$1 {date}'],
  [/\btoday\b/gu, 'on {date}'],
];

// The Spanish and Portuguese daily pages say "hoy" and "hoje" in their own
// copy and in the reading templates of src/lib/i18n/daily-reading.ts. Each
// rule is one reviewed phrase with its dated form written whole, and nothing
// else is dated: a "hoy" or "hoje" that no rule names stays as it is, and
// tests/edition-dated-drive.mjs fails on it. The phrases, their review and
// the forms considered are in docs/platform/evidence/edition-dated-locales-20261012/.
const SPANISH_SIGNS = 'Aries|Tauro|Géminis|Cáncer|Leo|Virgo|Libra|Escorpio|Sagitario|Capricornio|Acuario|Piscis';
const PORTUGUESE_SIGNS = 'Áries|Touro|Gêmeos|Câncer|Leão|Virgem|Libra|Escorpião|Sagitário|Capricórnio|Aquário|Peixes';

const SPANISH_RULES: readonly EditionRule[] = [
  [/^(\s*)Hoy(\s*)$/gu, '$1El cielo del {date}$2'],
  [new RegExp(`^(\\s*)(${SPANISH_SIGNS}) hoy(\\s*)$`, 'gu'), '$1$2, {date}$3'],
  [new RegExp(`\\bHoróscopo de (${SPANISH_SIGNS}) de hoy\\b`, 'gu'), 'Horóscopo de $1 del {date}'],
  [/^(\s*)La Luna pasa hoy por\b/gu, '$1El {date}, la Luna pasa por'],
  [/\bentra hoy en tu (\S+) casa\b/gu, 'entra en tu $1 casa el {date}'],
  [/\balcanza hoy su punto exacto\b/gu, 'alcanza su punto exacto el {date}'],
  [/\bLeer hoy →/gu, 'Lectura del {date} →'],
  [/\bUn cielo tranquilo hoy\./gu, 'Un cielo tranquilo el {date}.'],
  [/\bHoróscopos de hoy\b/gu, 'Horóscopos del {date}'],
  [/\bcielo de hoy\b/gu, 'cielo del {date}'],
];

const PORTUGUESE_RULES: readonly EditionRule[] = [
  [/^(\s*)Hoje(\s*)$/gu, '$1O céu de {date}$2'],
  [new RegExp(`^(\\s*)(${PORTUGUESE_SIGNS}) hoje(\\s*)$`, 'gu'), '$1$2 em {date}$3'],
  [new RegExp(`\\bHoróscopo de (${PORTUGUESE_SIGNS}) de hoje\\b`, 'gu'), 'Horóscopo de $1 de {date}'],
  [/^(\s*)A Lua passa hoje por\b/gu, '$1Em {date}, a Lua passa por'],
  [/\bentra hoje na sua (\S+(?: \S+)?) casa\b/gu, 'entra na sua $1 casa em {date}'],
  [/\bchega hoje ao ponto exato\b/gu, 'chega ao ponto exato em {date}'],
  [/\bLer hoje →/gu, 'Leitura de {date} →'],
  [/\bUm céu tranquilo hoje\./gu, 'Um céu tranquilo em {date}.'],
  [/\bHoróscopos de hoje\b/gu, 'Horóscopos de {date}'],
  [/\bcéu de hoje\b/gu, 'céu de {date}'],
];

// The French and Italian daily pages (the 2026-11 locale expansion, held
// until released) say "aujourd’hui" and "oggi" in their copy and in the
// reading templates of src/lib/i18n/daily-reading.ts. The reviewed phrases
// come first, each with its dated form whole; a last rule dates any other
// occurrence, so no relative word survives the dated window. Italian
// articles before 8 and 11 are elided by fillEditionDate.
const FRENCH_SIGNS = 'Bélier|Taureau|Gémeaux|Cancer|Lion|Vierge|Balance|Scorpion|Sagittaire|Capricorne|Verseau|Poissons';
const ITALIAN_SIGNS = 'Ariete|Toro|Gemelli|Cancro|Leone|Vergine|Bilancia|Scorpione|Sagittario|Capricorno|Acquario|Pesci';

const FRENCH_RULES: readonly EditionRule[] = [
  [/^(\s*)Aujourd’hui(\s*)$/gu, '$1Le ciel du {date}$2'],
  [new RegExp(`^(\\s*)(${FRENCH_SIGNS}) aujourd’hui(\\s*)$`, 'gu'), '$1$2, {date}$3'],
  [/^(\s*)La Lune traverse aujourd’hui\b/gu, '$1Le {date}, la Lune traverse'],
  [/\bentre aujourd’hui dans ta\b/gu, 'entre le {date} dans ta'],
  [/\bdevient exact aujourd’hui\b/gu, 'devient exact le {date}'],
  [/\bLire aujourd’hui →/gu, 'Lecture du {date} →'],
  [/\bUn ciel calme aujourd’hui\./gu, 'Un ciel calme le {date}.'],
  [/\bd’aujourd’hui\b/gu, 'du {date}'],
  [/^(\s*)Aujourd’hui,/gu, '$1Le {date},'],
  [/\bAujourd’hui\b/gu, 'Le {date}'],
  [/\baujourd’hui\b/gu, 'le {date}'],
];

const ITALIAN_RULES: readonly EditionRule[] = [
  [/^(\s*)Oggi(\s*)$/gu, '$1Il cielo del {date}$2'],
  [new RegExp(`^(\\s*)(${ITALIAN_SIGNS}) oggi(\\s*)$`, 'gu'), '$1$2, {date}$3'],
  [/^(\s*)La Luna attraversa oggi\b/gu, '$1Il {date} la Luna attraversa'],
  [/\bdi oggi\b/gu, 'del {date}'],
  [/^(\s*)Oggi,/gu, '$1Il {date},'],
  [/\bOggi\b/gu, 'Il {date}'],
  [/\boggi\b/gu, 'il {date}'],
];

const FRENCH_TITLE_RULES: readonly EditionRule[] = [
  [/\baujourd’hui, /gu, 'du '],
];

const ITALIAN_TITLE_RULES: readonly EditionRule[] = [
  [/ di oggi, /gu, ' del '],
  [/ oggi, /gu, ' del '],
  [/ del (8|11) /gu, ' dell’$1 '],
];

// The tab titles of the Spanish and Portuguese daily pages say "hoy" and
// "hoje" beside the edition's date, so in the dated window the title loses
// the relative word and keeps the date it already names. English titles
// name only their date. Reviewed with the rules above.
const SPANISH_TITLE_RULES: readonly EditionRule[] = [
  [/^(\s*)Hoy(?: —|,|:) el cielo del /gu, '$1El cielo del '],
  [/^(\s*)Horóscopos de hoy(?: —|,|:) /gu, '$1Horóscopos del '],
  [new RegExp(`^(\\s*)Horóscopo de (${SPANISH_SIGNS}) hoy, `, 'gu'), '$1Horóscopo de $2 del '],
];

const PORTUGUESE_TITLE_RULES: readonly EditionRule[] = [
  [/^(\s*)Hoje(?: —|,|:) o céu de /gu, '$1O céu de '],
  [/^(\s*)Horóscopos de hoje(?: —|,|:) /gu, '$1Horóscopos de '],
  [new RegExp(`^(\\s*)Horóscopo de (${PORTUGUESE_SIGNS}) hoje, `, 'gu'), '$1Horóscopo de $2 de '],
];

/**
 * Put the date label into a replacement. Italian alone elides its article
 * before 8 and 11 ("dell’8", "l’11"); Spanish keeps "del 8".
 */
function fillEditionDate(replacement: string, label: string, locale: EditionLocale): string {
  const filled = replacement.replaceAll('{date}', label);
  if (locale !== 'it') return filled;
  return filled
    .replace(/\b(d|D)el (8|11) /gu, '$1ell’$2 ')
    .replace(/(^|\s|\$\d)(i|I)l (8|11) /gu, (_, lead, article, day) => `${lead}${article === 'I' ? 'L' : 'l'}’${day} `);
}

function applyEditionRules(value: string, rules: readonly EditionRule[], label: string, locale: EditionLocale): string {
  return rules.reduce((text, [pattern, replacement]) => (
    text.replace(pattern, fillEditionDate(replacement, label, locale))
  ), value);
}

/**
 * Convert relative current-day language into an explicit archival label.
 * The dated form is also the server/no-JavaScript fallback; the browser only
 * restores the relative wording after proving that the edition is current.
 * English, for EditionText and the islands; `datedEditionTextIn` takes a locale.
 */
export function datedEditionText(value: string, editionDate: string): string {
  return applyEditionRules(value, ENGLISH_RULES, editionDateLabel(editionDate), 'en');
}

/** The dating rules for a locale's daily pages, or null where it has none. */
export function editionRules(locale: string): readonly EditionRule[] | null {
  if (locale === 'en') return ENGLISH_RULES;
  if (locale === 'es') return SPANISH_RULES;
  if (locale === 'pt') return PORTUGUESE_RULES;
  if (locale === 'fr') return FRENCH_RULES;
  if (locale === 'it') return ITALIAN_RULES;
  return null;
}

/**
 * The rules as EditionFreshnessGuard inlines them for one page: pattern
 * source, flags and the replacement with the edition's date already in it.
 */
export function inlineEditionRules(locale: EditionLocale, editionDate: string): [string, string, string][] {
  const label = editionDateLabel(editionDate, locale);
  return (editionRules(locale) ?? []).map(([pattern, replacement]) => (
    [pattern.source, pattern.flags, fillEditionDate(replacement, label, locale)]
  ));
}

export function datedEditionTextIn(locale: EditionLocale, value: string, editionDate: string): string {
  return applyEditionRules(value, editionRules(locale) ?? [], editionDateLabel(editionDate, locale), locale);
}

/** The rules for a daily page's tab title; none for English, whose titles name only their date. */
export function editionTitleRules(locale: string): readonly EditionRule[] {
  if (locale === 'es') return SPANISH_TITLE_RULES;
  if (locale === 'pt') return PORTUGUESE_TITLE_RULES;
  if (locale === 'fr') return FRENCH_TITLE_RULES;
  if (locale === 'it') return ITALIAN_TITLE_RULES;
  return [];
}

/** The tab title rules as EditionFreshnessGuard inlines them: pattern source, flags, replacement. */
export function inlineEditionTitleRules(locale: string): [string, string, string][] {
  return editionTitleRules(locale).map(([pattern, replacement]) => [pattern.source, pattern.flags, replacement]);
}

export function datedEditionTitleIn(locale: string, title: string): string {
  return editionTitleRules(locale).reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), title);
}

export function millisecondsUntilNextUtcDay(now: Date = new Date()): number {
  if (Number.isNaN(now.getTime())) throw new Error('invalid current date');
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, next - now.getTime() + 1_000);
}
