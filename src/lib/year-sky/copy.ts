/**
 * The words of "Your 2027 sky", one object per language. English lives here;
 * Spanish, Portuguese, French and Italian live in copy-{es,pt,fr,it}.ts and
 * register themselves with defineYearSkyWords when imported, so a page (and
 * its island) carries only the language it shows. Every reader falls back to
 * English for a language that has not registered. Engine-free.
 *
 * House rules for this copy: plain, warm and dry, in the register of
 * src/lib/interpretations.ts; no em or en dashes; no health, money, betting
 * or guarantees; nothing about tokens or markets.
 */
import type { CatalogLocale } from '../i18n/core';
import { BODY_ROLE } from '../compat';
import { transitLine } from '../transits';
import { PERSONAL_WORDS } from '../personal-calendar/words';
import type { MilestoneKind } from '../occasions/milestones';

export type YearAspect = 'conjunction' | 'square' | 'trine' | 'opposition';

export interface YearSkyWords {
  /** BCP 47 tag for dates. */
  dateLocale: string;
  pageTitle: string;
  pageDescription: string;
  heroTitle: string;
  heroLede: string;
  /** Shown without JavaScript, under the chooser. */
  noscript: string;
  chooserTitle: string;
  chooserSaved: string;
  savedLede: (name: string | null) => string;
  enterOther: string;
  useSaved: string;
  readMine: string;
  enterDetails: string;
  enterDetailsLede: string;
  readEntered: string;
  orGeneral: string;
  reading: string;
  cancel: string;
  error: string;
  savedRemoved: string;
  saveHint: string;
  saveChart: string;
  privacy: string;
  resultTitle: string;
  resultLede: string;
  briefTitle: string;
  allYearTitle: string;
  allYearLede: string;
  quietQuarter: string;
  unknownTime: string;
  quarterNames: readonly [string, string, string, string];
  monthNames: readonly string[];
  generalTitle: string;
  generalLede: string;
  generalInvite: string;
  generalInviteLink: string;
  generalCalendar: string;
  moreTitle: string;
  moreLinks: readonly { path: string; label: string }[];
  shareTitle: string;
  shareLede: string;
  shareSquare: string;
  shareStory: string;
  shareShared: string;
  shareSaved: string;
  cardNote: string;
  calendarTitle: string;
  calendarLede: string;
  calendarButton: string;
  calendarDone: string;
  calendarNote: string;
  calendarName: string;
  calendarExact: string;
  calendarMore: string;
  calendarForecast: string;
  confidenceNote: string;
  /** The card's headline; the year is drawn large beneath it. */
  cardHeadline: string;
  cardSun: string;
  cardMoon: string;
  cardRising: string;
  cardCount: (n: number) => string;
  cardQuiet: string;
  /** "Reading confidence NN%", exactly as reading-confidence.ts writes it. */
  confidence: (value: number) => string;
  /** A date in the edition year; another year is named. */
  day: (iso: string, year: number) => string;
  dayTime: (iso: string) => string;
  range: (fromIso: string, toIso: string, year: number) => string;
  list: (items: string[]) => string;
  signName: (slug: string) => string;
  planet: (body: string) => string;
  pointName: (point: string) => string;

  // ── The sky everyone shares ──────────────────────────────────────────
  eclipseTitle: (type: 'solar' | 'lunar', kind: string) => string;
  /** unseen: NASA's penumbral magnitude of an eclipse too slight to be seen (src/lib/nasa-lunar-eclipses.ts). */
  eclipseLine: (type: 'solar' | 'lunar', kind: string, degree: string, sign: string, unseen?: number) => string;
  retrogradeTitle: (planet: string) => string;
  retrogradeLine: (planet: string) => string;
  retrogradeDetail: (range: string, sign: string, shadow: string | null) => string;
  ingressTitle: (planet: string, sign: string) => string;
  ingressLine: (planet: string, sign: string, until: string) => string;
  stationRetrograde: string;
  /** Shown in place of a date for a window that opened the year before. */
  underWay: string;
  stationDirect: string;
  backgroundTitle: string;
  backgroundLine: (planet: string, signs: string) => string;
  /** One planet's signs through the year: [sign, until] pairs, the last open. */
  backgroundSigns: (spans: { sign: string; until: string | null }[]) => string;
  passLabel: (pass: number, count: number) => string;

  // ── Personal moments ─────────────────────────────────────────────────
  solarTitle: string;
  solarLine: string;
  solarDetail: (time: string) => string;
  milestoneTitle: (kind: MilestoneKind, index: number) => string;
  milestoneLine: (kind: MilestoneKind) => string;
  contactTitle: (planet: string, aspect: YearAspect, point: string) => string;
  contactLine: (planet: string, aspect: YearAspect, point: string) => string;
  exactOn: (dates: string) => string;
  passOf: (pass: number, count: number) => string;
  loopBefore: (year: number) => string;
  loopAfter: (year: number) => string;
  slowNote: string;
  eclipseHitTitle: (type: 'solar' | 'lunar', contact: 'conjunction' | 'opposition', point: string) => string;
  eclipseHitLine: (type: 'solar' | 'lunar', contact: 'conjunction' | 'opposition', point: string, degree: string, sign: string) => string;
  eclipseOrb: (orb: string) => string;
  retrogradeHitTitle: (planet: string, points: string[]) => string;
  retrogradeHitLine: (planet: string, points: string[]) => string;
  ingressSunTitle: (planet: string) => string;
  ingressRisingTitle: (planet: string) => string;
  ingressHouseTitle: (planet: string, house: number) => string;
  ingressPersonalLine: (planet: string, sign: string, house: number | null, ownSign: 'sun' | 'rising' | null) => string;
  backgroundHouseLine: (planet: string, sign: string, house: number, until: string | null) => string;
  /** Card lines carry no dates: a planet and a placement, nothing more. */
  cardContact: (planet: string, aspect: YearAspect, point: string) => string;
  cardEclipse: (point: string) => string;
  cardRetrograde: (planet: string, points: string[]) => string;
  cardMilestone: (kind: MilestoneKind) => string;
  cardIngress: (planet: string, house: number | null, ownSign: 'sun' | 'rising' | null) => string;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ORDINAL_EN = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const HOUSE_ORDINAL_EN = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What each house is about, by whole sign houses. No health, no money. */
const HOUSE_TOPIC_EN = [
  '',
  'how you show up and start things',
  'what you value and keep close',
  'talk, short trips, siblings and neighbours',
  'home, family and roots',
  'play, romance and making things',
  'daily work and routines',
  'partners and one-to-one ties',
  'closeness, trust and what you share',
  'travel, study and big ideas',
  'work, reputation and direction',
  'friends, groups and hopes',
  'rest, retreat and what happens out of view',
];

/** What each sign colours, in a few words. */
const SIGN_TOPIC_EN: Record<string, string> = {
  aries: 'starting things',
  taurus: 'comfort and steadiness',
  gemini: 'talk and ideas',
  cancer: 'home and family',
  leo: 'play and being seen',
  virgo: 'craft and useful work',
  libra: 'partners and fairness',
  scorpio: 'trust and depth',
  sagittarius: 'travel and big ideas',
  capricorn: 'work and standing',
  aquarius: 'friends and the future',
  pisces: 'rest and imagination',
};

const POINT_EN: Record<string, string> = { ASC: 'rising degree', MC: 'midheaven' };
const ROLE_EN: Record<string, string> = {
  ...BODY_ROLE,
  ASC: 'rising degree, the way you meet the world',
  MC: 'midheaven, your public direction',
};

const PLANET_TONE_EN: Record<string, string> = {
  Jupiter: 'about a year of growth',
  Saturn: 'about two and a half years of slow building',
  Uranus: 'about seven years of change',
  Neptune: 'more than a decade of dreaming',
  Pluto: 'two decades of deep change',
};

const RETROGRADE_LINE_EN: Record<string, string> = {
  Mercury: 'Plans, messages and travel want a second look. Finish, review and repair before you launch.',
  Venus: 'Old feelings and old tastes come back for review. A good stretch to mend rather than to start.',
  Mars: 'Energy turns inward. A long stretch for revising how you push, not for picking new fights.',
  Jupiter: 'Growth slows down to be checked. A season for finishing what the year started.',
  Saturn: 'Commitments get reviewed from the inside. Quiet work on foundations pays off later.',
  Uranus: 'The changes of recent years settle in, and you see which ones you meant.',
  Neptune: 'The fog lifts a little. Hopes get a gentle reality check.',
  Pluto: 'The deep work goes quiet and personal.',
};

const MILESTONE_CARD_EN: Record<MilestoneKind, string> = {
  'jupiter-return': 'My Jupiter return',
  'saturn-return': 'My Saturn return',
  'uranus-opposition': 'My Uranus opposition',
};

const ASPECT_TITLE_EN: Record<YearAspect, string> = {
  conjunction: 'crosses',
  square: 'squares',
  trine: 'trines',
  opposition: 'opposes',
};

const day = (iso: string, year: number) => {
  const d = new Date(iso);
  const base = `${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return d.getUTCFullYear() === year ? base : `${base}, ${d.getUTCFullYear()}`;
};

const list = (items: string[]) => items.length <= 1
  ? items.join('')
  : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const signName = (slug: string) => cap(slug);
const pointName = (point: string) => POINT_EN[point] ?? point;
const en: YearSkyWords = {
  dateLocale: 'en-US',
  pageTitle: 'Your 2027 Sky: The Year Ahead for Your Birth Chart',
  pageDescription: 'The eclipses, slow planets, retrogrades and returns of 2027 that touch your own birth chart, month by month, with a share card and a calendar file made on your device.',
  heroTitle: 'Your 2027 sky',
  heroLede: 'The big moments of 2027 that touch your own chart: eclipses, the slow planets, Venus and Mars over your Sun, your solar return, and the retrogrades that land on your placements. Everything is worked out in this browser.',
  noscript: 'Reading the year for your chart needs JavaScript. The shared sky below works without it.',
  chooserTitle: 'Read it for your chart',
  chooserSaved: 'Saved chart',
  savedLede: (name) => (name ? `From your saved chart, ${name}.` : 'Pick one of your saved charts.'),
  enterOther: 'Enter other birth details',
  useSaved: 'Use a saved chart',
  readMine: 'Read my 2027',
  enterDetails: 'Enter birth details',
  enterDetailsLede: 'Enter a birth date, time and place to read the year for that chart.',
  readEntered: 'Read my 2027',
  orGeneral: 'Or read the sky everyone shares.',
  reading: 'Reading the year…',
  cancel: 'Cancel',
  error: 'The year could not be worked out. Check the details and try again.',
  savedRemoved: 'That saved chart changed while the year was being read. Try again.',
  saveHint: 'Saving a chart lets you come back to this without typing again.',
  saveChart: 'Save a chart',
  privacy: 'The year is worked out on this device. Your birth details are not sent, stored or put in any link.',
  resultTitle: 'Your 2027',
  resultLede: 'The moments below are dated to the day in UTC. Slow planets stay close for weeks on either side of the exact date, so read each one as a season with a peak.',
  briefTitle: 'The year in brief',
  allYearTitle: 'All year long',
  allYearLede: 'Where the slow planets sit in your chart for the whole year, by whole sign houses from your rising sign.',
  quietQuarter: 'Nothing big touches your chart these months. The shared sky below still applies.',
  unknownTime: 'Without a birth time the chart is set for noon on the birth date, so dates can be a day out, and the Moon, rising degree and houses are left out.',
  quarterNames: ['January to March', 'April to June', 'July to September', 'October to December'],
  monthNames: MONTHS_EN,
  generalTitle: 'The 2027 sky everyone shares',
  generalLede: 'Five eclipses, the retrogrades, and where the slow planets spend the year. These dates are the same for everyone; what they touch depends on the chart.',
  generalInvite: 'Want to know which of these land on your chart?',
  generalInviteLink: 'Read it for your chart',
  generalCalendar: 'Put the shared sky in your calendar app',
  moreTitle: 'More on 2027',
  moreLinks: [
    { path: '/eclipses/2027/', label: 'The eclipses of 2027' },
    { path: '/mercury-retrograde/2027/', label: 'Mercury retrograde in 2027' },
    { path: '/full-moon-calendar/2027/', label: 'Full moons of 2027' },
    { path: '/sky-calendar/', label: 'Put the shared sky in your calendar app' },
    { path: '/solar-return/', label: 'Your solar return chart' },
    { path: '/transits/', label: 'Transit tracker, day by day' },
  ],
  shareTitle: 'Share your year',
  shareLede: 'The card shows signs and planets only: no name, no birth date, time or place, and no dates from your chart.',
  shareSquare: 'Share square card',
  shareStory: 'Share story card',
  shareShared: 'Shared.',
  shareSaved: 'Saved to your device.',
  cardNote: 'Made in this browser. The square card is 1080 × 1080 and the story card 1080 × 1920.',
  calendarTitle: 'Add 2027 to my calendar',
  calendarLede: 'One file with your moments and the shared sky, each with a reminder the day before. It is built in this browser and saved to your device; there is no link to subscribe to, because a link would have to carry your birth details.',
  calendarButton: 'Download the calendar file',
  calendarDone: 'Calendar file saved. Open it to add the events to your calendar app.',
  calendarNote: 'The file is called zodiacs-2027-sky.ics. Most calendar apps import it with a double tap or from their import menu.',
  calendarName: 'Zodiacs.org · My 2027 sky',
  calendarExact: 'Exact at {time} UTC.',
  calendarMore: 'More: {url}',
  calendarForecast: 'Dates are computed; what they mean is astrology’s forecast, not a guarantee.',
  confidenceNote: 'Each reading carries a reading confidence: how specific the chart details behind it are, not the odds that something happens.',
  cardHeadline: 'My sky in',
  cardSun: 'Sun',
  cardMoon: 'Moon',
  cardRising: 'Rising',
  cardCount: (n) => (n === 1 ? '1 moment touches my chart' : `${n} moments touch my chart`),
  cardQuiet: 'A quiet year for my chart',
  confidence: (value) => `Reading confidence ${value}%`,
  day,
  dayTime: (iso) => {
    const d = new Date(iso);
    return `${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCDate()} at ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  },
  range: (fromIso, toIso, year) => `${day(fromIso, year)} to ${day(toIso, year)}`,
  list,
  signName,
  planet: (body) => body,
  pointName,

  eclipseTitle: (type, kind) => `${cap(kind)} ${type} eclipse`,
  eclipseLine: (type, kind, degree, sign, unseen) => type === 'solar'
    ? `A new Moon with extra weight at ${degree} ${sign}. Astrologers read solar eclipses as beginnings that arrive sooner than planned.${kind === 'total' ? ' This one is total: the Moon covers the whole Sun along its path.' : ''}`
    : `A full Moon with extra weight at ${degree} ${sign}. Lunar eclipses are read as endings and clear-outs.${unseen ? ` This one is penumbral and so slight that no eye or camera will see it: NASA gives it a penumbral magnitude of ${unseen}.` : kind === 'penumbral' ? ' This one is penumbral, faint to the eye.' : ''}`,
  retrogradeTitle: (planet) => `${planet} retrograde`,
  retrogradeLine: (planet) => RETROGRADE_LINE_EN[planet] ?? `${planet} appears to move backwards for a while.`,
  retrogradeDetail: (range, sign, shadow) => `${range}${sign ? `, in ${sign}` : ''}.${shadow ? ` The shadow runs ${shadow}.` : ''}`,
  ingressTitle: (planet, sign) => `${planet} enters ${sign}`,
  ingressLine: (planet, sign, until) => `${planet} stays in ${sign} until ${until}: ${PLANET_TONE_EN[planet] ?? 'a long stretch'} pointed at ${SIGN_TOPIC_EN[sign.toLowerCase()] ?? sign}.`,
  stationRetrograde: 'turns retrograde',
  underWay: 'Under way as the year opens',
  stationDirect: 'turns direct',
  backgroundTitle: 'Where the slow planets spend 2027',
  backgroundLine: (planet, signs) => `${planet}: ${signs}.`,
  backgroundSigns: (spans) => spans.length === 1
    ? `${spans[0].sign} all year`
    : spans.map((span, i) => `${i === 0 ? '' : 'then '}${span.sign}${span.until ? ` until ${span.until}` : ''}`).join(', '),
  passLabel: (pass, count) => `pass ${pass} of ${count}`,

  solarTitle: PERSONAL_WORDS.en.solarTitle,
  solarLine: 'The Sun comes back to the exact degree it held when you were born. Astrologers read the chart for this moment as the shape of your year ahead.',
  solarDetail: (time) => `Exact on ${time}.`,
  milestoneTitle: (kind, index) => kind === 'uranus-opposition'
    ? 'Your Uranus opposition'
    : `Your ${ORDINAL_EN[index] ?? `${index}th`} ${PERSONAL_WORDS.en.milestones[kind].name}`,
  milestoneLine: (kind) => PERSONAL_WORDS.en.milestones[kind].about,
  contactTitle: (planet, aspect, point) => `${planet} ${ASPECT_TITLE_EN[aspect]} your ${pointName(point)}`,
  contactLine: (planet, aspect, point) => point in POINT_EN
    ? transitLine(planet, aspect, point).replace(`your natal ${point}`, `your ${ROLE_EN[point]}`)
    : transitLine(planet, aspect, point),
  exactOn: (dates) => `Exact on ${dates}.`,
  passOf: (pass, count) => `Pass ${pass} of ${count}.`,
  loopBefore: (year) => `The loop began in ${year}.`,
  loopAfter: (year) => `The loop ends in ${year}.`,
  slowNote: PERSONAL_WORDS.en.slowNote,
  eclipseHitTitle: (type, contact, point) => `A ${type} eclipse ${contact === 'conjunction' ? 'lands on' : 'lands across from'} your ${pointName(point)}`,
  eclipseHitLine: (type, contact, point, degree, sign) => {
    const role = ROLE_EN[point] ?? point.toLowerCase();
    const where = contact === 'conjunction' ? `on your ${role}` : `across from your ${role}`;
    return type === 'solar'
      ? `The eclipse at ${degree} ${sign} falls ${where}. Read it as a door opening there: something starts, sooner than you planned.`
      : `The eclipse at ${degree} ${sign} falls ${where}. Read it as a clear-out: something there reaches its natural end, and you get the room back.`;
  },
  eclipseOrb: (orb) => `${orb}° from exact.`,
  retrogradeHitTitle: (planet, points) => `${planet} retrograde goes back over your ${list(points.map(pointName))}`,
  retrogradeHitLine: (planet, points) => {
    const names = list(points.map(pointName));
    const roles = list(points.map((point) => (ROLE_EN[point] ?? point.toLowerCase()).split(',')[0]));
    if (planet === 'Mercury') return `Mercury crosses your ${names} three times: forward, back and forward again. Talks and plans that touch your ${roles} get a second draft.`;
    if (planet === 'Venus') return `Venus crosses your ${names} three times. Old feelings and old tastes around your ${roles} come back for review.`;
    return `${planet} crosses your ${names} three times. Your ${roles} ${points.length > 1 ? 'get' : 'gets'} a long workout: slower first, then stronger.`;
  },
  ingressSunTitle: (planet) => `${planet} enters your Sun sign`,
  ingressRisingTitle: (planet) => `${planet} enters your rising sign`,
  ingressHouseTitle: (planet, house) => `${planet} moves into your ${HOUSE_ORDINAL_EN[house]} house`,
  ingressPersonalLine: (planet, sign, house, ownSign) => {
    const tone = PLANET_TONE_EN[planet] ?? 'a long stretch';
    const parts = [`${planet} moves into ${sign}`];
    if (house) parts.push(`, your ${HOUSE_ORDINAL_EN[house]} house by whole sign houses: ${tone} around ${HOUSE_TOPIC_EN[house]}.`);
    else parts.push(`: ${tone} pointed at ${SIGN_TOPIC_EN[sign.toLowerCase()] ?? sign}.`);
    if (ownSign === 'sun') parts.push(' It is your Sun sign, so the cycle starts again where your chart keeps its engine.');
    if (ownSign === 'rising') parts.push(' It is your rising sign, so the change shows first in how you meet the world.');
    return parts.join('');
  },
  backgroundHouseLine: (planet, sign, house, until) => `${planet} ${until ? `is in ${sign} until ${until}` : `spends the year in ${sign}`}, your ${HOUSE_ORDINAL_EN[house]} house by whole sign houses: ${PLANET_TONE_EN[planet] ?? 'a long stretch'} around ${HOUSE_TOPIC_EN[house]}.`,
  cardContact: (planet, aspect, point) => `${planet} ${ASPECT_TITLE_EN[aspect]} my ${pointName(point)}`,
  cardEclipse: (point) => `An eclipse on my ${pointName(point)}`,
  cardRetrograde: (planet, points) => `${planet} retrograde over my ${list(points.map(pointName))}`,
  cardMilestone: (kind) => MILESTONE_CARD_EN[kind],
  cardIngress: (planet, house, ownSign) => ownSign === 'sun'
    ? `${planet} in my Sun sign`
    : ownSign === 'rising'
      ? `${planet} in my rising sign`
      : `${planet} in my ${HOUSE_ORDINAL_EN[house ?? 0] ?? ''} house`,
};

const WORDS: Partial<Record<CatalogLocale, YearSkyWords>> = { en };

/** Called once by each language's copy module (copy-es.ts and the rest). */
export function defineYearSkyWords(locale: CatalogLocale, words: YearSkyWords): YearSkyWords {
  WORDS[locale] = words;
  return words;
}

/** The edition's words; English until a language's module has registered. */
export function yearSkyWords(locale: CatalogLocale = 'en'): YearSkyWords {
  return WORDS[locale] ?? en;
}

/** Locales with their own words and route: English and the four translations. */
export const YEAR_SKY_LOCALES = ['en', 'es', 'pt', 'fr', 'it'] as const satisfies readonly CatalogLocale[];
export type YearSkyLocale = typeof YEAR_SKY_LOCALES[number];
