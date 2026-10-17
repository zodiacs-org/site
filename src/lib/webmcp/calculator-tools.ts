/**
 * The WebMCP tool each calculator page registers (Track A2): its name, what it does, and the input it takes. The
 * descriptors are small and ship in /assets/webmcp-register.js; a tool's calculation ships in
 * /assets/webmcp-calculators.js, which a page loads only when an agent calls the tool. Every calculation runs in the
 * browser, as the page's own does: nothing about the person is sent anywhere.
 *
 * A page's tool is found from its path, with any locale's prefix removed, so /es/moon-phase/ registers the same tool
 * as /moon-phase/. A page that embeds a calculator registers that calculator's tool too: each rising sign's profile,
 * each compatibility pair and each Life Path page. Descriptions are written for agents, in English, in every locale.
 */
export const CALCULATOR_RUNTIME_URL = '/assets/webmcp-calculators.js?v=calculators-1';

const LOCALE_PREFIX = /^\/(?:es|pt|fr|it|ru)(?=\/)/u;

// The slugs of the pages that embed a calculator, written out so this small bundle imports nothing. calculator-tools
// .test.ts holds them to the lists the pages are built from (SIGN_SLUGS in src/lib/signs.ts, pairSlug in
// src/lib/pair-slug.ts, LIFE_PATH_NUMBERS in src/data/numerology-pages.ts), and check-dist.mjs holds every built page
// with a calculator to its tool.
const SIGNS_IN_ORDER = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius',
  'capricorn', 'aquarius', 'pisces'];
const LIFE_PATH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];

// Calendar dates as the tools' readers take them (parseCivilDate in src/lib/time/civil-date.ts): each month's own
// days, and 29 February only in a leap year. calculator-tools.test.ts checks each pattern against its reader on every
// date in its range.
const MONTH_DAYS = '(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|02-(?:0[1-9]|1\\d|2[0-8]))';
const calendarDate = (years: string, leapYears: string) => `(?:${years}-${MONTH_DAYS}|${leapYears}-02-29)`;

// The pages' date fields run from 1800-01-01 through 2199-12-31; of those centuries' first years only 2000 is a leap
// year.
const DATE = {
  type: 'string',
  pattern: `^${calendarDate('(?:18|19|20|21)\\d{2}', '(?:(?:18|19|20|21)(?:0[48]|[2468][048]|[13579][26])|2000)')}$`,
  description: 'A Gregorian calendar date, YYYY-MM-DD, from 1800-01-01 through 2199-12-31.',
} as const;
const TIME = {
  type: 'string',
  pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$',
  description: 'The local clock time at the place, 24-hour HH:MM.',
} as const;
const PLACE = {
  type: 'object',
  description: 'The place\'s coordinates and its IANA time zone, such as Europe/Paris. Find them with zodiacs.search '
    + 'or a geocoder.',
  properties: {
    latitude: { type: 'number', minimum: -90, maximum: 90, description: 'Degrees north (negative south).' },
    longitude: { type: 'number', minimum: -180, maximum: 180, description: 'Degrees east (negative west).' },
    timeZone: { type: 'string', minLength: 1, maxLength: 64, description: 'IANA time zone name.' },
  },
  required: ['latitude', 'longitude', 'timeZone'],
  additionalProperties: false,
} as const;
const BIRTH = {
  type: 'object',
  description: 'A birth: its date, its local time when known, and its place. Without a time the pages read local noon.',
  properties: { date: DATE, time: TIME, place: PLACE },
  required: ['date', 'place'],
  additionalProperties: false,
} as const;
const TIMED_BIRTH = {
  ...BIRTH,
  description: 'A birth with its local time: its date, the time from the birth record, and its place.',
  required: ['date', 'time', 'place'],
} as const;
const HOUSE_SYSTEM = {
  type: 'string',
  enum: ['whole', 'placidus'],
  description: 'House system: whole sign (the pages\' default) or Placidus.',
} as const;
// Any year, 0000 through 9999, at a UTC clock time from 00:00 through 23:59, with seconds and milliseconds if given.
const INSTANT = {
  type: 'string',
  pattern: `^${calendarDate('\\d{4}', '(?:\\d{2}(?:0[48]|[2468][048]|[13579][26])|(?:[02468][048]|[13579][26])00)')}`
    + 'T(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d{1,3})?)?Z$',
  description: 'A UTC instant, ISO 8601 with Z, such as 2026-10-15T12:00:00Z.',
} as const;

const object = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object', properties, required, additionalProperties: false,
});

const CALCULATED = 'Calculated in the browser with the page\'s own code; nothing about the person is sent.';

export interface CalculatorToolDescriptor {
  name: string;
  /** The page's path without a locale prefix. */
  path: string;
  /** Other pages, without a locale prefix, that embed the same calculator and so register its tool. */
  alsoOn?: readonly string[];
  title: string;
  description: string;
  inputSchema: Readonly<Record<string, unknown>>;
}

export const CALCULATOR_TOOLS: readonly CalculatorToolDescriptor[] = Object.freeze([
  {
    name: 'zodiacs.birth_chart',
    path: '/birth-chart/',
    title: 'Birth chart',
    description: 'A birth chart, as this page calculates it: the Sun, Moon and rising signs; every body\'s sign, degree, '
      + 'house and motion; the angles, the house cusps and the aspects. Without a birth time it reads local noon, gives '
      + 'no angles or houses, and leaves the Moon\'s sign unverified. ' + CALCULATED,
    inputSchema: object({ ...BIRTH.properties, houseSystem: HOUSE_SYSTEM }, ['date', 'place']),
  },
  {
    name: 'zodiacs.moon_sign',
    path: '/moon-sign/',
    title: 'Moon sign',
    description: 'The Moon\'s sign at birth and the Moon\'s phase, as this page reads them. Without a birth time it '
      + 'reads local noon and does not name the sign, since the Moon may change sign during the day. ' + CALCULATED,
    inputSchema: BIRTH,
  },
  {
    name: 'zodiacs.rising_sign',
    path: '/rising-sign/',
    alsoOn: SIGNS_IN_ORDER.map((sign) => `/rising-sign/${sign}/`),
    title: 'Rising sign',
    description: 'The rising sign (ascendant) and the midheaven at birth, as this page calculates them. It needs the '
      + 'birth time. ' + CALCULATED,
    inputSchema: TIMED_BIRTH,
  },
  {
    name: 'zodiacs.big_three',
    path: '/big-three/',
    title: 'Big three',
    description: 'The Sun, Moon and rising signs, with their degrees, from a timed birth, as this page calculates them. '
      + CALCULATED,
    inputSchema: TIMED_BIRTH,
  },
  {
    name: 'zodiacs.compatibility',
    path: '/compatibility/',
    // Each pair's page names both signs in zodiac order.
    alsoOn: SIGNS_IN_ORDER.flatMap((first, index) => SIGNS_IN_ORDER.slice(index)
      .map((second) => `/compatibility/${first}-${second}/`)),
    title: 'Compatibility',
    description: 'Synastry between two people, as this page compares them: each person\'s Sun, Moon and rising signs, '
      + 'the eight contacts it ranks first (generational ones last), the count of each aspect, and the two charts\' '
      + 'element and modality balances. ' + CALCULATED,
    inputSchema: object({ first: BIRTH, second: BIRTH }, ['first', 'second']),
  },
  {
    name: 'zodiacs.transits',
    path: '/transits/',
    title: 'Transits',
    description: 'Transits to a birth chart, as this page shows them: the sky at an instant (now by default) and each '
      + 'transiting planet\'s aspect to a natal point within 3°. The transiting Moon is left out; without a birth time '
      + 'so is the natal Moon. ' + CALCULATED,
    inputSchema: object({ birth: BIRTH, at: INSTANT }, ['birth']),
  },
  {
    name: 'zodiacs.saturn_return',
    path: '/saturn-return/',
    title: 'Saturn return',
    description: 'Saturn returns, as this page finds them: natal Saturn, and each return season through the third '
      + 'with the date of every pass and whether it is past, active or upcoming. With a place the birth is read at '
      + 'the place\'s local time (noon without a time); without a place, at noon UTC. A time needs a place. '
      + CALCULATED,
    inputSchema: object({ date: DATE, time: TIME, place: PLACE }, ['date']),
  },
  {
    name: 'zodiacs.solar_return',
    path: '/solar-return/',
    title: 'Solar return',
    description: 'A solar return chart, as this page calculates it: the return in force now, or the one of a given year, '
      + 'cast at the birthplace or another place. Without a birth time the natal Sun is read at noon UTC and the chart '
      + 'has no houses or angles. ' + CALCULATED,
    inputSchema: object({
      birth: BIRTH,
      year: { type: 'integer', minimum: 1800, maximum: 2199, description: 'The return\'s year; omit for the return in force now.' },
      castPlace: { ...PLACE, description: 'Where to cast the return, if not the birthplace.' },
      houseSystem: HOUSE_SYSTEM,
    }, ['birth']),
  },
  {
    name: 'zodiacs.lunar_return',
    path: '/lunar-return/',
    title: 'Lunar return',
    description: 'The next lunar return chart after an instant (now by default), as this page calculates it, cast at '
      + 'the birthplace or another place. It needs a birth time that the local clock did not skip or repeat. '
      + CALCULATED,
    inputSchema: object({
      birth: TIMED_BIRTH,
      after: INSTANT,
      castPlace: { ...PLACE, description: 'Where to cast the return, if not the birthplace.' },
      houseSystem: HOUSE_SYSTEM,
    }, ['birth']),
  },
  {
    name: 'zodiacs.numerology',
    path: '/numerology/',
    alsoOn: LIFE_PATH_NUMBERS.map((number) => `/numerology/life-path/${number}/`),
    title: 'Numerology',
    description: 'Pythagorean numerology, as this page reckons it: Life Path, Birthday and Attitude from the birth '
      + 'date; Expression, Soul Urge, Personality and Maturity from the full birth name (Latin letters); karmic debts; '
      + 'and the personal year, month and day for a date (today by default). Without a name, the date numbers alone. '
      + CALCULATED,
    inputSchema: object({
      birthDate: DATE,
      fullName: { type: 'string', maxLength: 200, description: 'The full name at birth.' },
      today: { ...DATE, description: 'The date for the personal cycles, YYYY-MM-DD; omit for today.' },
    }, ['birthDate']),
  },
  {
    name: 'zodiacs.moon_phase',
    path: '/moon-phase/',
    title: 'Moon phase',
    description: 'The Moon\'s phase on a date, as this page shows it: the phase\'s name, how much of the disc is lit, the '
      + 'Moon\'s sign and degree, and the UTC instant read. Give a time and a place for that moment; without a time it '
      + 'reads noon (local noon at the place, or noon UTC), and without a place it reads the time as UTC. '
      + CALCULATED,
    inputSchema: object({ date: DATE, time: TIME, place: PLACE }, ['date']),
  },
  {
    name: 'zodiacs.baby_zodiac',
    path: '/baby-zodiac/',
    title: 'Baby zodiac',
    description: 'A due date\'s likely signs, as this page reads them: the Sun\'s sign (both, if it changes sign that '
      + 'day), the Moon\'s noon sign from three days before to three days after, and the planets retrograde that day '
      + 'while the site\'s retrograde table covers it. ' + CALCULATED,
    inputSchema: object({
      dueDate: {
        type: 'string',
        pattern: `^${calendarDate('(?:199\\d|20[01]\\d|202[0-8])', '(?:199[26]|20(?:0[048]|1[26]|2[048]))')}$`,
        description: 'The due date, YYYY-MM-DD, from 1990-01-01 through 2028-12-31.',
      },
    }, ['dueDate']),
  },
  {
    name: 'zodiacs.chart_twins',
    path: '/chart-twins/',
    title: 'Chart twins',
    description: 'Public figures in the site\'s directory who share a person\'s Sun sign, Moon sign or both, as this '
      + 'page matches them. The Sun counts only when the date settles it; the Moon needs a birth time. The calculation '
      + 'runs in the browser, which reads the public directory from this site; nothing about the person is sent.',
    inputSchema: BIRTH,
  },
  {
    name: 'zodiacs.group_chart',
    path: '/group-charts/',
    title: 'Group chart',
    description: 'A group\'s element roles, as this page assigns them: for each of three to eight people, the element '
      + 'most of their settled placements share (Sun, Mercury, Venus, Mars, and with a birth time the Moon and the '
      + 'rising sign), or a blend. ' + CALCULATED,
    inputSchema: object({
      people: {
        type: 'array',
        minItems: 3,
        maxItems: 8,
        items: object({
          name: { type: 'string', maxLength: 24, description: 'A name to show, as on the page (up to 24 characters); omit for "Person 1" and so on.' },
          birth: BIRTH,
        }, ['birth']),
      },
    }, ['people']),
  },
  {
    name: 'zodiacs.chart_pdf',
    path: '/astrologer-kit/',
    title: 'Chart PDF',
    description: 'The chart this page\'s PDF prints, as data: each body\'s sign, degree and motion; with a birth time, the '
      + 'angles and whole-sign house cusps; and the aspects (without a birth time, none of the Moon\'s). The page\'s own '
      + 'button makes the file. ' + CALCULATED,
    inputSchema: BIRTH,
  },
  {
    name: 'zodiacs.year_wrapped',
    path: '/your-sky-wrapped/',
    title: 'Your sky, wrapped',
    description: 'A year in review, as this page finds it: each exact Jupiter and Saturn conjunction, square and '
      + 'opposition that year to the natal Sun, and with a birth time to the Moon and the rising degree, with its UTC '
      + 'instant. ' + CALCULATED,
    inputSchema: object({
      birth: BIRTH,
      year: { type: 'integer', minimum: 1800, maximum: 2199, description: 'The year; omit for this year (UTC).' },
    }, ['birth']),
  },
]);

/** The calculator tool a page path registers, or null when the page has none. */
export function calculatorToolForPath(path: string): CalculatorToolDescriptor | null {
  const plain = path.replace(LOCALE_PREFIX, '');
  return CALCULATOR_TOOLS.find((tool) => tool.path === plain || tool.alsoOn?.includes(plain)) ?? null;
}
