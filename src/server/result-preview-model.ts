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
import { plain } from '../ai-tools/card-kit/words.js';
import { dayLabel } from '../ai-tools/horoscope/reading.js';
import type { HoroscopeWindow } from '../ai-tools/horoscope/window.js';
import { SKY_PLANETS, type BirthdayShare, type HoroscopeShare, type SkyCalendarShare, type SkyEventKind, type SkyPlanet } from '../ai-tools/share-links.js';

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
  /** "Horoscope for Saturday 17 October", "Love horoscope for …", "Horoscope for 12 to 18 October". */
  kicker: string;
  /** "Leo horoscope for Saturday 17 October", for the page. */
  heading: string;
  /** The reading's line for the sign ("For Leo, …"), or the sign's dates when the reading is no longer kept. */
  line: string;
  /** The reading's first passage, when it is kept. */
  passage: string | null;
  hue: string;
}

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
export function horoscopeCardModel(share: HoroscopeShare, window: Pick<HoroscopeWindow, 'editions'>): HoroscopeCardModel | null {
  const name = signName(share.sign);
  // A day or week after the latest the window holds has not been published yet, so there is nothing to share.
  const published = window.editions.map((edition) => (share.week ? edition.signs[share.sign].weekly.period.from : edition.anchorDate));
  const latest = published.length ? published.reduce((a, b) => (b > a ? b : a)) : null;
  if (!latest || share.date > latest) return null;
  const reading = share.week
    ? window.editions.map((edition) => edition.signs[share.sign].weekly).find((candidate) => candidate.period.from === share.date)
    : window.editions.find((edition) => edition.anchorDate === share.date)?.signs[share.sign][share.focus === 'general' ? 'today' : share.focus];
  const kept = reading && reading.status === 'publishable' ? reading : null;
  const text = kept ? kept.passages.map((passage) => passage.text).join(' ') : '';
  const quoted = new RegExp(`For ${name}, [^.!?]+[.!?]`, 'u').exec(text)?.[0];
  const when = share.week ? weekWords(share.date, kept?.period.through ?? addDays(share.date, 6)) : dayLabel(share.date);
  const focusWord = share.week || share.focus === 'general' ? '' : `${cap(share.focus)} `;
  return {
    sign: sunOf(share.sign),
    signName: name,
    kicker: `${focusWord}${focusWord ? 'horoscope' : 'Horoscope'} for ${when}`,
    heading: `${name} ${focusWord.toLowerCase()}horoscope for ${when}`,
    line: quoted ? plain(quoted) : plain(signBySlug(share.sign).dates),
    passage: kept?.passages[0] ? plain(kept.passages[0].text) : null,
    hue: HUES[share.sign],
  };
}
