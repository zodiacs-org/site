/**
 * What the shared compatibility and date cards show, worked out from a
 * checked share query (src/lib/share-results.ts). Pure: the renderer and the
 * link page draw from this model and nothing else.
 */
import { OCCASION_LABELS } from '../lib/occasions/kinds.js';
import {
  COMPATIBILITY_VERDICT_TEXT,
  OCCASION_SHARE_HEADLINES,
  OCCASION_VERDICT_TEXT,
  type CompatibilityShare,
  type OccasionShare,
  type ShareSign,
} from '../lib/share-results.js';
import { HUES } from './chart-preview-model.js';
import { returnText } from '../lib/return-visits/copy.js';
import { signBySlug } from '../lib/signs.js';
import { fullDate, plain } from '../ai-tools/card-kit/words.js';
import { MILESTONE_WORDS } from '../lib/occasions/milestone-words.js';
import { dayLabel } from '../ai-tools/horoscope/reading.js';
import type { HoroscopeWindow } from '../ai-tools/horoscope/window.js';
import { readingConfidence, readingConfidenceText } from '../ai-tools/reading-confidence.js';
import { CHINESE_ZODIAC_ANIMALS } from '../data/chinese-zodiac.js';
import {
  SKY_PLANETS,
  type BigThreeShare,
  type BirthdayShare,
  type ChartTwinsShare,
  type ChineseZodiacShare,
  type FamousChartShare,
  type HoroscopeShare,
  type InviteShare,
  type MilestoneShare,
  type ShareMilestoneKind,
  type SkyCalendarShare,
  type SkyEventKind,
  type SkyPlanet,
} from '../ai-tools/share-links.js';

/** The ring's colour where a sign is not known. */
export const NEUTRAL_HUE = '#C6CCDA';

const signName = (slug: ShareSign) => slug.charAt(0).toUpperCase() + slug.slice(1);
const SIGN_SLUGS: readonly string[] = Object.keys(HUES);
const isShareSign = (value: string): value is ShareSign => SIGN_SLUGS.includes(value);

export interface PreviewSign {
  slug: ShareSign | null;
  /** "Leo Sun", or a plain line where the sign is not known. */
  label: string;
  hue: string;
}

export interface CompatibilityCardModel {
  first: string;
  second: string;
  people: [PreviewSign, PreviewSign];
  score: number;
  verdict: string;
  areas: { label: string; value: number }[];
  ring: [string, string];
  /** For the page title and the image's alternative text. */
  title: string;
  summary: string;
  /** "Reading confidence 70%", from the link's own value; null on a link made before the label. */
  confidence: string | null;
}

export interface OccasionCardModel {
  names: string | null;
  headline: string;
  when: string;
  score: number;
  verdict: string;
  signs: PreviewSign[];
  ring: [string, string];
  title: string;
  summary: string;
  /** "Reading confidence 55%", from the link's own value; null on a link made before the label. */
  confidence: string | null;
}

function previewSign(slug: ShareSign | null, body: 'Sun' | 'Moon', unknown: string): PreviewSign {
  return slug
    ? { slug, label: `${signName(slug)} ${body}`, hue: HUES[slug] }
    : { slug: null, label: unknown, hue: NEUTRAL_HUE };
}

export function compatibilityCardModel(share: CompatibilityShare): CompatibilityCardModel {
  const first = share.a ?? 'Person A';
  const second = share.b ?? 'Person B';
  const people: [PreviewSign, PreviewSign] = [
    previewSign(share.aSun, 'Sun', 'Sun sign on the cusp'),
    previewSign(share.bSun, 'Sun', 'Sun sign on the cusp'),
  ];
  const verdict = COMPATIBILITY_VERDICT_TEXT[share.verdict];
  const areas = [
    { label: 'Attraction', value: share.attraction },
    { label: 'Communication', value: share.communication },
    { label: 'Stability', value: share.stability },
  ];
  return {
    first,
    second,
    people,
    score: share.score,
    verdict,
    areas,
    ring: [people[0].hue, people[1].hue],
    title: `${first} and ${second}: ${share.score}/100`,
    summary: `${verdict}. Attraction ${share.attraction}, communication ${share.communication}, long-term stability ${share.stability}.`,
    confidence: share.confidence === null ? null : readingConfidenceText(share.confidence),
  };
}

const LONG_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "Saturday, 12 June 2027", built from parts: runtimes differ on the comma after the weekday. */
export function longDate(date: string): string {
  const parts = Object.fromEntries(LONG_DATE.formatToParts(new Date(`${date}T12:00:00Z`)).map((part) => [part.type, part.value]));
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
}

export function occasionCardModel(share: OccasionShare): OccasionCardModel {
  const when = share.place ? `${longDate(share.date)} in ${share.place}` : longDate(share.date);
  const signs = [
    previewSign(share.sun, 'Sun', 'Sun'),
    previewSign(share.moon, 'Moon', 'Moon'),
  ].filter((sign) => sign.slug !== null);
  const verdict = OCCASION_VERDICT_TEXT[share.verdict];
  const headline = OCCASION_SHARE_HEADLINES[share.occasion];
  const ring: [string, string] = [
    share.sun ? HUES[share.sun] : NEUTRAL_HUE,
    share.moon ? HUES[share.moon] : share.sun ? HUES[share.sun] : NEUTRAL_HUE,
  ];
  return {
    names: share.names,
    headline,
    when,
    score: share.score,
    verdict,
    signs,
    ring,
    title: `${share.names ? `${share.names}: ` : ''}${OCCASION_LABELS[share.occasion].replace(/ \(.*\)$/u, '')}, ${share.score}/100`,
    summary: `${verdict}. ${when}.`,
    confidence: share.confidence === null ? null : readingConfidenceText(share.confidence),
  };
}

// ── A birthday, the sky calendar and a horoscope (src/ai-tools/share-links.ts) ──
// Each model is checked against the site's own data, passed in, and is null
// when the link does not match it: a link can only show what the site says.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const sunOf = (slug: ShareSign): PreviewSign => ({ slug, label: `${signName(slug)} Sun`, hue: HUES[slug] });

/** One date in src/data/birthdays.json: a sign every year, or a cusp between two. */
export interface BirthdayDay { sign?: string; cusp?: { a: string; b: string } }

/**
 * The first of the people the site publishes who were born on a date, as the
 * date's birthday page lists them (src/lib/people.ts, peopleForBirthday: the
 * indexable people, oldest first), with their Sun sign.
 */
export interface FamousBirthday { name: string; slug: string; sun: string | null }

export interface BirthdayCardModel {
  /** "3 May" */
  label: string;
  /** "3 May birthdays", as the card and the date's page say it. */
  title: string;
  /** The date's page, /birthday/{slug}/. */
  slug: string;
  signs: PreviewSign[];
  /** "Taurus Sun", or "On the cusp of Aries and Taurus". */
  line: string;
  /** One plain sentence or two about the date's Sun, for the page and its description. */
  about: string;
  hue: string;
  /** The first famous person born on the date, when the site publishes one. */
  famous: FamousBirthday | null;
}

function signAbout(slug: ShareSign): string {
  const sign = signBySlug(slug);
  return `${cap(sign.element)}, ${sign.modality}, ruled by ${sign.ruler}. ${plain(sign.dates)}.`;
}

export function birthdayCardModel(share: BirthdayShare, days: Readonly<Record<string, BirthdayDay>>, famous: FamousBirthday | null = null): BirthdayCardModel | null {
  const month = MONTH_NAMES[share.month - 1];
  const slug = `${month.toLowerCase()}-${share.day}`;
  const entry = days[slug];
  if (!entry) return null;
  const label = `${share.day} ${month}`;
  const base = { label, title: `${label} birthdays`, slug, famous };
  // A famous birthday joins the line: "Taurus Sun, like Audrey Hepburn" when
  // the line names the Sun sign they had, and a plain sentence otherwise, as
  // on a cusp date whose sign their birth year decided differently.
  const withFamous = (line: string, sign: ShareSign | null) => (!famous ? line
    : sign && famous.sun === sign ? `${line}, like ${famous.name}` : `${line}. ${famous.name} was born on this date`);
  const aboutFamous = famous ? ` ${famous.name} was born on this date.` : '';
  if (entry.sign && isShareSign(entry.sign)) {
    // A date off the cusp has the same sign every year; a link naming another is not about this date.
    if (share.sign && share.sign !== entry.sign) return null;
    return {
      ...base, signs: [sunOf(entry.sign)], line: withFamous(`${signName(entry.sign)} Sun`, entry.sign), hue: HUES[entry.sign],
      about: `People born on ${label} have the Sun in ${signName(entry.sign)}. ${signAbout(entry.sign)}${aboutFamous}`,
    };
  }
  const cusp = entry.cusp;
  if (!cusp || !isShareSign(cusp.a) || !isShareSign(cusp.b)) return null;
  const [a, b] = [cusp.a, cusp.b];
  if (share.sign) {
    if (share.sign !== a && share.sign !== b) return null;
    return {
      ...base, signs: [sunOf(share.sign)], line: withFamous(`${signName(share.sign)} Sun`, share.sign), hue: HUES[share.sign],
      about: `${label} sits on the cusp of ${signName(a)} and ${signName(b)}; for this birthday the Sun was in ${signName(share.sign)}. ${signAbout(share.sign)}${aboutFamous}`,
    };
  }
  return {
    ...base, signs: [sunOf(a), sunOf(b)], line: withFamous(`On the cusp of ${signName(a)} and ${signName(b)}`, null), hue: HUES[a],
    about: `On ${label} the Sun sits on the boundary between ${signName(a)} and ${signName(b)}, so the sign depends on the year and time of birth.${aboutFamous}`,
  };
}

/** The first famous person born on each month and day ("05-04"), from the AI tools' index of the people the site publishes, oldest first as the birthday pages list them. */
export function famousBirthdays(people: readonly { slug: string; name: string; gregorian: string; sun?: { sign: string | null } | null }[]): Map<string, FamousBirthday> {
  const firsts = new Map<string, FamousBirthday & { gregorian: string }>();
  for (const person of people) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(person.gregorian)) continue;
    const key = person.gregorian.slice(5);
    const known = firsts.get(key);
    if (!known || person.gregorian < known.gregorian) firsts.set(key, { name: person.name, slug: person.slug, sun: person.sun?.sign ?? null, gregorian: person.gregorian });
  }
  return new Map([...firsts].map(([key, person]) => [key, { name: person.name, slug: person.slug, sun: person.sun }]));
}

/** A sky calendar event, as the feed lists it in English (src/lib/return-visits/sky-calendar.ts). */
export interface SkyEvent { kind: SkyEventKind; planet: SkyPlanet | null; date: string; title: string; start: string; end: string | null }

export interface SkyData {
  moons: readonly { type: string; at: string }[];
  retrogrades: readonly { planet: string; from: string; to: string }[];
  eclipses: readonly { type: string; peak: string }[];
}

/** The feed's events from the same data, with English titles: new and full moons, eclipse peaks and retrograde windows. */
export function skyEvents(data: SkyData): SkyEvent[] {
  const day = (at: string) => new Date(at).toISOString().slice(0, 10);
  const iso = (at: string) => new Date(at).toISOString();
  const events: SkyEvent[] = [];
  for (const moon of data.moons) {
    if (moon.type !== 'new' && moon.type !== 'full') continue;
    events.push({ kind: `${moon.type}-moon`, planet: null, date: day(moon.at), title: returnText('en', moon.type === 'new' ? 'newMoon' : 'fullMoon'), start: iso(moon.at), end: null });
  }
  for (const eclipse of data.eclipses) {
    if (eclipse.type !== 'solar' && eclipse.type !== 'lunar') continue;
    events.push({ kind: `${eclipse.type}-eclipse`, planet: null, date: day(eclipse.peak), title: returnText('en', eclipse.type === 'solar' ? 'solarEclipse' : 'lunarEclipse'), start: iso(eclipse.peak), end: null });
  }
  for (const window of data.retrogrades) {
    const planet = window.planet.toLowerCase();
    if (!(SKY_PLANETS as readonly string[]).includes(planet)) continue;
    events.push({ kind: 'retrograde', planet: planet as SkyPlanet, date: day(window.from), title: returnText('en', 'retrogradeWindow', { planet: window.planet }), start: iso(window.from), end: iso(window.to) });
  }
  return events.sort((left, right) => left.start.localeCompare(right.start));
}

const SHORT_DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const LONG_DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
/** "Sat 24 Oct" or "Saturday 24 October", built from parts: runtimes differ on the comma after the weekday. */
function dayWords(at: string, format: Intl.DateTimeFormat): string {
  const parts = Object.fromEntries(format.formatToParts(new Date(at)).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month}`;
}

export interface SkyCalendarCardModel {
  /** "Mercury retrograde" */
  title: string;
  /** "Sat 24 Oct to Fri 13 Nov", as the card says it. */
  span: string;
  /** "Saturday 24 October to Friday 13 November" */
  spanLong: string;
  /** "Mercury retrograde, Sat 24 Oct to Fri 13 Nov." */
  line: string;
}

export function skyCalendarCardModel(share: SkyCalendarShare, events: readonly SkyEvent[]): SkyCalendarCardModel | null {
  const event = events.find((candidate) => candidate.kind === share.kind && candidate.planet === share.planet && candidate.date === share.date);
  if (!event) return null;
  const span = event.end ? `${dayWords(event.start, SHORT_DAY)} to ${dayWords(event.end, SHORT_DAY)}` : dayWords(event.start, SHORT_DAY);
  const spanLong = event.end ? `${dayWords(event.start, LONG_DAY)} to ${dayWords(event.end, LONG_DAY)}` : dayWords(event.start, LONG_DAY);
  return { title: event.title, span, spanLong, line: `${event.title}, ${span}.` };
}

export interface HoroscopeCardModel {
  sign: PreviewSign;
  signName: string;
  /** "Horoscope for Saturday 17 October", "Love horoscope for …", "Horoscope for 12 to 18 October", "Horoscope for November 2026", "Horoscope for 2026". */
  kicker: string;
  /** "Leo horoscope for Saturday 17 October", for the page. */
  heading: string;
  /** The reading's line for the sign ("For Leo, …", or a month's or year's opening sentence), or the sign's dates when the reading is no longer kept. */
  line: string;
  /** The reading's first passage, when it is kept. */
  passage: string | null;
  /** "Reading confidence 40%": a Sun-sign reading's label, whenever the card quotes the reading. */
  confidence: string | null;
  hue: string;
}

/** The published monthly readings, as src/data/horoscope-months.json holds them. */
export interface PublishedMonths { months: Readonly<Record<string, Readonly<Record<string, { published: string; paragraphs: readonly string[] }>>>> }
/** The yearly readings the horoscope program publishes, as src/data/horoscope-program.json holds them. */
export interface PublishedYears {
  signs: readonly { sign: string; readings: Readonly<Record<string, { status: string; passages: readonly { heading?: string; text: string }[] } | undefined>> }[];
}

/** The longest opening a month's or year's card quotes; a longer first sentence gives way to the next one that fits. */
const PERIOD_LINE_MAX = 150;
const SIGN_READING_CONFIDENCE = readingConfidenceText(readingConfidence('sign'));
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/u).filter(Boolean);
/** A monthly reading is served from its first day, as the monthly page is; the earliest clock on Earth reaches it first (UTC+14). */
const servedBy = (published: string, now: Date) => Date.parse(`${published}T00:00:00+14:00`) <= now.getTime();

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const MONTH_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
function weekWords(from: string, through: string): string {
  const parts = (date: string) => Object.fromEntries(MONTH_DAY.formatToParts(new Date(`${date}T12:00:00Z`)).map((part) => [part.type, part.value]));
  const [start, end] = [parts(from), parts(through)];
  return start.month === end.month ? `${start.day} to ${end.day} ${end.month}` : `${start.day} ${start.month} to ${end.day} ${end.month}`;
}

/**
 * A shared horoscope: the published reading for the sign, day and focus, or
 * the week, from the horoscope window the assistant reads. It quotes the
 * reading's own line for the sign; the link never carries any text.
 */
export function horoscopeCardModel(
  share: HoroscopeShare,
  window: Pick<HoroscopeWindow, 'editions'>,
  periods: { months?: PublishedMonths; years?: PublishedYears; now?: Date } = {},
): HoroscopeCardModel | null {
  if (share.period === 'month' || share.period === 'year') return periodHoroscopeModel(share, periods);
  const name = signName(share.sign);
  const week = share.period === 'week';
  // A day or week after the latest the window holds has not been published yet, so there is nothing to share.
  const published = window.editions.map((edition) => (week ? edition.signs[share.sign].weekly.period.from : edition.anchorDate));
  const latest = published.length ? published.reduce((a, b) => (b > a ? b : a)) : null;
  if (!latest || share.date > latest) return null;
  const reading = week
    ? window.editions.map((edition) => edition.signs[share.sign].weekly).find((candidate) => candidate.period.from === share.date)
    : window.editions.find((edition) => edition.anchorDate === share.date)?.signs[share.sign][share.focus === 'general' ? 'today' : share.focus];
  const kept = reading && reading.status === 'publishable' ? reading : null;
  const text = kept ? kept.passages.map((passage) => passage.text).join(' ') : '';
  const quoted = new RegExp(`For ${name}, [^.!?]+[.!?]`, 'u').exec(text)?.[0];
  const when = week ? weekWords(share.date, kept?.period.through ?? addDays(share.date, 6)) : dayLabel(share.date);
  const focusWord = week || share.focus === 'general' ? '' : `${cap(share.focus)} `;
  return {
    sign: sunOf(share.sign),
    signName: name,
    kicker: `${focusWord}${focusWord ? 'horoscope' : 'Horoscope'} for ${when}`,
    heading: `${name} ${focusWord.toLowerCase()}horoscope for ${when}`,
    line: quoted ? plain(quoted) : plain(signBySlug(share.sign).dates),
    passage: kept?.passages[0] ? plain(kept.passages[0].text) : null,
    // A Sun-sign reading is read from the sign alone (src/ai-tools/reading-confidence.ts); a card that no longer quotes one shows no label.
    confidence: quoted ? SIGN_READING_CONFIDENCE : null,
    hue: HUES[share.sign],
  };
}

/**
 * A month's or year's horoscope: the reading the site publishes for the sign (the monthly page's text, served from
 * the month's first day, or the program's yearly reading), quoting its opening sentence. Null when the site does not
 * publish that reading, so a link can only show what the site says.
 */
function periodHoroscopeModel(share: HoroscopeShare, periods: { months?: PublishedMonths; years?: PublishedYears; now?: Date }): HoroscopeCardModel | null {
  const name = signName(share.sign);
  let paragraphs: readonly string[] | null = null;
  let when: string;
  if (share.period === 'month') {
    const month = share.date.slice(0, 7);
    const entry = periods.months?.months[month]?.[share.sign];
    if (entry && servedBy(entry.published, periods.now ?? new Date())) paragraphs = entry.paragraphs;
    when = `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
  } else {
    const year = share.date.slice(0, 4);
    const reading = periods.years?.signs.find((entry) => entry.sign === share.sign)?.readings[`yearly-${year}`];
    if (reading && reading.status === 'publishable') paragraphs = reading.passages.map((passage) => passage.text);
    when = year;
  }
  if (!paragraphs || paragraphs.length === 0) return null;
  const line = paragraphs.flatMap((paragraph) => sentences(plain(paragraph))).find((sentence) => sentence.length <= PERIOD_LINE_MAX);
  return {
    sign: sunOf(share.sign),
    signName: name,
    kicker: `Horoscope for ${when}`,
    heading: `${name} horoscope for ${when}`,
    line: line ?? plain(signBySlug(share.sign).dates),
    passage: plain(paragraphs[0]),
    confidence: line ? SIGN_READING_CONFIDENCE : null,
    hue: HUES[share.sign],
  };
}

// ── Chart twins, a famous chart and a life milestone (src/ai-tools/share-links.ts) ──

/** A person the site publishes, as the AI tools' index lists them (src/ai-tools/features/people-index.json). */
export interface IndexedPerson {
  slug: string;
  name: string;
  /** "Painter · Mexico · 1907–1954" */
  shortDescription: string;
  born: string;
  birthplace: string;
  sun: { sign: string; degree: number };
  moon: { sign: string | null; degree: number | null };
  lede: string;
}

export interface ChartTwinsCardModel {
  /** The Sun's disc, and the Moon's when it was compared. */
  signs: PreviewSign[];
  sun: ShareSign;
  /** "Taurus Sun, like Audrey Hepburn": the first twin, as the chat card names them first. */
  quote: string;
  /** "14 famous people share this Sun or Moon" */
  count: string;
  first: { name: string; slug: string };
  hue: string;
}

/**
 * The people who share a Sun or Moon sign, in the order the tool lists them:
 * src/lib/sharing/twins.ts, matchTwins (both signs first, then by name),
 * repeated here because the share function loads its modules as they are and
 * that one imports without file extensions; share-links.test.ts holds the two
 * to the same answer for every pair of signs.
 */
export function twinMatches(signs: { sun: string; moon: string | null }, people: readonly IndexedPerson[]): { person: IndexedPerson; sun: boolean; moon: boolean; count: 1 | 2 }[] {
  return people.flatMap((person) => {
    const sun = person.sun.sign === signs.sun;
    const moon = signs.moon !== null && person.moon.sign !== null && person.moon.sign === signs.moon;
    return sun || moon ? [{ person, sun, moon, count: (sun && moon ? 2 : 1) as 1 | 2 }] : [];
  }).sort((a, b) => b.count - a.count || a.person.name.localeCompare(b.person.name, 'en') || a.person.slug.localeCompare(b.person.slug));
}

/**
 * Chart twins, matched from the site's own directory as the tool matches
 * them, so the link names no one. Null when no one the site publishes shares
 * the signs.
 */
export function chartTwinsCardModel(share: ChartTwinsShare, people: readonly IndexedPerson[]): ChartTwinsCardModel | null {
  const matches = twinMatches({ sun: share.sun, moon: share.moon }, people);
  const first = matches[0];
  if (!first) return null;
  const shared = [first.sun ? `${signName(share.sun)} Sun` : '', first.moon && share.moon ? `${signName(share.moon)} Moon` : ''].filter(Boolean).join(' and ');
  const compared = share.moon ? 'Sun or Moon' : 'Sun';
  return {
    signs: [sunOf(share.sun), ...(share.moon ? [{ slug: share.moon, label: `${signName(share.moon)} Moon`, hue: HUES[share.moon] }] : [])],
    sun: share.sun,
    quote: `${shared}, like ${first.person.name}`,
    count: matches.length === 1 ? `One famous person shares this ${compared}` : `${matches.length} famous people share this ${compared}`,
    first: { name: first.person.name, slug: first.person.slug },
    hue: HUES[share.sun],
  };
}

export interface FamousChartCardModel {
  name: string;
  slug: string;
  sign: PreviewSign;
  /** "Cancer Sun at 13.5°", as the chat card leads with it. */
  sunLine: string;
  /** "Painter, born 6 July 1907": the card's first description and its birth date. */
  born: string;
  /** "Painter, born 6 July 1907 in Coyoacán", for the page. */
  bornIn: string;
  lede: string;
  hue: string;
}

/** A famous chart from the site's own directory; null for a slug it does not publish. */
export function famousChartCardModel(share: FamousChartShare, people: readonly IndexedPerson[]): FamousChartCardModel | null {
  const person = people.find((candidate) => candidate.slug === share.slug);
  if (!person || !isShareSign(person.sun.sign)) return null;
  const sun = person.sun.sign;
  const role = person.shortDescription.split(' · ')[0];
  const born = `${role}, born ${fullDate(person.born)}`;
  return {
    name: person.name,
    slug: person.slug,
    sign: sunOf(sun),
    sunLine: `${signName(sun)} Sun at ${person.sun.degree.toFixed(1)}°`,
    born,
    bornIn: `${born} in ${person.birthplace}`,
    lede: plain(person.lede),
    hue: HUES[sun],
  };
}

/** As the site's milestones page names them (src/islands/LifeMilestones.tsx): words to the eighth, then 9th, 10th … */
const ordinal = (n: number) => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][n - 1] ?? `${n}th`;
/** Each milestone wears the hue of the sign its planet rules, as the chat card does. */
const MILESTONE_SIGN: Readonly<Record<ShareMilestoneKind, ShareSign>> = { 'saturn-return': 'capricorn', 'jupiter-return': 'sagittarius', 'uranus-opposition': 'aquarius' };

export interface MilestoneCardModel {
  age: number;
  /** "First Saturn return", "Uranus opposition" */
  title: string;
  /** "First Saturn return, at 29" */
  heading: string;
  /**
   * What the milestone is, the same for everyone who reaches it: "Saturn comes back to its place at birth". A link
   * carries no dates, because the days of the passes lead back to the birth date.
   */
  line: string;
  about: string;
  hue: string;
}

const MILESTONE_LINE: Readonly<Record<ShareMilestoneKind, string>> = {
  'jupiter-return': 'Jupiter comes back to its place at birth',
  'saturn-return': 'Saturn comes back to its place at birth',
  'uranus-opposition': 'Uranus stands opposite its place at birth',
};

export function milestoneCardModel(share: MilestoneShare): MilestoneCardModel {
  const name = share.kind === 'uranus-opposition' ? MILESTONE_WORDS[share.kind].name : `${ordinal(share.index)} ${MILESTONE_WORDS[share.kind].name}`;
  const title = cap(name);
  return {
    age: share.age,
    title,
    heading: `${title}, at ${share.age}`,
    line: MILESTONE_LINE[share.kind],
    about: MILESTONE_WORDS[share.kind].about,
    hue: HUES[MILESTONE_SIGN[share.kind]],
  };
}

// ── The big three, the Chinese zodiac and an invitation (src/ai-tools/share-links.ts) ──

export interface BigThreeCardModel {
  sun: ShareSign;
  /** The signs the card's discs show: the Sun, then the Moon and rising sign when the link names them. */
  signs: PreviewSign[];
  /** The rows as the card sets them: "Leo Sun", "Aries Moon" or "Moon sign undetermined", and "Libra rising" when it is known. */
  rows: { slug: ShareSign | null; text: string }[];
  /** "Leo Sun, Aries Moon, Libra rising", for the page. */
  title: string;
  /** What the three are, and what the chart could not settle. */
  about: string;
  hue: string;
}

/** The big three: the Sun, the Moon or that its sign is undetermined, and the rising sign only when it is known. */
export function bigThreeCardModel(share: BigThreeShare): BigThreeCardModel {
  const rows: BigThreeCardModel['rows'] = [
    { slug: share.sun, text: `${signName(share.sun)} Sun` },
    share.moon ? { slug: share.moon, text: `${signName(share.moon)} Moon` } : { slug: null, text: 'Moon sign undetermined' },
    ...(share.rising ? [{ slug: share.rising, text: `${signName(share.rising)} rising` }] : []),
  ];
  const unsettled = [
    ...(share.moon ? [] : ['The Moon changed sign on the birth day, so its sign needs the birth time.']),
    ...(share.rising ? [] : ['The rising sign needs the birth time and place.']),
  ];
  return {
    sun: share.sun,
    signs: [
      sunOf(share.sun),
      ...(share.moon ? [{ slug: share.moon, label: `${signName(share.moon)} Moon`, hue: HUES[share.moon] }] : []),
      ...(share.rising ? [{ slug: share.rising, label: `${signName(share.rising)} rising`, hue: HUES[share.rising] }] : []),
    ],
    rows,
    title: rows.map((row) => row.text).join(', '),
    about: ['The big three: the Sun sign, the Moon sign and the rising sign.', ...unsettled].join(' '),
    hue: HUES[share.sun],
  };
}

export interface ChineseZodiacCardModel {
  slug: string;
  /** "Horse" */
  name: string;
  /** "The Horse" */
  title: string;
  /** "Its element is fire, and Horse years are yang": the same for every year of the animal, so it names none. */
  detail: string;
  /** The animal's own element, from its Earthly Branch. */
  element: ChineseElement;
  /** The yin or yang of every year of the animal (a year's stem always shares its branch's). */
  yinYang: 'yin' | 'yang';
  /** Its Earthly Branch, such as 午. */
  branch: string;
  /** The animal's traditional associations, in the site's guide's words. */
  association: string;
  context: string;
}

type ChineseElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
/**
 * Each animal's own element, from its Earthly Branch: 子 water, 丑 earth, 寅 and 卯 wood, 辰 earth, 巳 and 午 fire,
 * 未 earth, 申 and 酉 metal, 戌 earth, 亥 water. A year's element comes from its Heavenly Stem and turns every two
 * years, so with the animal it would name the year in the sixty-year cycle; the animal's own names none.
 */
const CHINESE_BRANCH_ELEMENT: Readonly<Record<string, ChineseElement>> = Object.freeze({
  rat: 'water', ox: 'earth', tiger: 'wood', rabbit: 'wood', dragon: 'earth', snake: 'fire',
  horse: 'fire', goat: 'earth', monkey: 'metal', rooster: 'metal', dog: 'earth', pig: 'water',
});

/**
 * The Chinese zodiac: the animal, its own element and the yin or yang of its years (the Rat's and every second
 * animal's after it yang, the others yin), never a year: the card is the same for every year of the animal.
 */
export function chineseZodiacCardModel(share: ChineseZodiacShare): ChineseZodiacCardModel | null {
  const animal = CHINESE_ZODIAC_ANIMALS.find((entry) => entry.slug === share.animal);
  const element = animal ? CHINESE_BRANCH_ELEMENT[animal.slug] : undefined;
  if (!animal || !element) return null;
  const yinYang = animal.position % 2 === 1 ? 'yang' : 'yin';
  return {
    slug: animal.slug, name: animal.name, title: `The ${animal.name}`,
    detail: `Its element is ${element}, and ${animal.name} years are ${yinYang}`,
    element, yinYang, branch: animal.branch, association: animal.association, context: animal.context,
  };
}

export interface InviteCardModel {
  signs: PreviewSign[];
  /** "Leo and Aries. Two birth charts, read together." */
  line: string;
  /** The first sign's hue, for the kicker. */
  hue: string;
  /** The Sun sign the ring brings to the front: the inviting person's, when known. */
  front: ShareSign | null;
}

/** An invitation to compare charts: the Sun signs it names, and nothing else about either person. */
export function inviteCardModel(share: InviteShare): InviteCardModel {
  const signs = [share.sun, share.partner].filter((slug): slug is ShareSign => slug !== null).map(sunOf);
  const names = signs.length === 2 ? `${signName(signs[0].slug!)} and ${signName(signs[1].slug!)}` : `${signName(signs[0].slug!)} Sun`;
  return { signs, line: `${names}. Two birth charts, read together.`, hue: signs[0].hue, front: share.sun };
}
