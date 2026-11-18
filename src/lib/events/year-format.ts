/**
 * What an event page written to the reading style guide carries besides its
 * reading, in the format of the 2027 year pages (Mercury retrograde, full
 * moons, eclipses): each instant on five clocks, a line on where the times
 * come from, and questions answered from the event's own facts and mirrored
 * in FAQPage data. Pure functions over the catalog; every time in an answer
 * is an instant the catalog carries, read through src/world-times.
 */
import { formatDate } from '../i18n/dates';
import { formatLongitude, signBySlug } from '../signs';
import { isInvisiblePenumbral, penumbralMagnitude } from '../nasa-lunar-eclipses';
import { worldTimes, worldTimesSentence } from '../../world-times/world-times';
import { eventClock, eventDay, moonNameLabel, windowLabel } from './format';
import { SOLAR_ECLIPSE_VISIBILITY, lunarEclipseRegions } from './watch';
import type { CatalogEvent, EventFacts } from './types';

export interface ClockRow { label: string; at: Date }
export interface EventQuestion { q: string; a: string }

type Resolve = (id: string) => CatalogEvent | undefined;

const DAY_MS = 86_400_000;
const signName = (slug: string) => signBySlug(slug).name;
const monthDay = (iso: string) => formatDate('en', new Date(iso), { month: 'long', day: 'numeric', timeZone: 'UTC' });
const monthName = (iso: string) => formatDate('en', new Date(iso), { month: 'long', timeZone: 'UTC' });
const year = (iso: string) => iso.slice(0, 4);
/** "February 6", with the year only when it differs from the page's own. */
const dayNear = (iso: string, pageIso: string) => (year(iso) === year(pageIso) ? monthDay(iso) : eventDay(iso));
const listJoin = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const wholeDays = (fromIso: string, toIso: string) => Math.round((Date.parse(toIso) - Date.parse(fromIso)) / DAY_MS);
const opposite = (slug: string) => {
  const order = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  return order[(order.indexOf(slug) + 6) % 12];
};
const eclipseLabel = (facts: EventFacts) => `${facts.eclipseKind} ${facts.subtype} eclipse`;
const article = (word: string) => (/^[aeiou]/iu.test(word) ? 'an' : 'a');

/** The sign a retrograde starts in and the sign it ends in (the catalog lists them end first). */
function stationSigns(facts: EventFacts): { start: string; end: string } {
  const end = facts.signs[0];
  const start = facts.signs[facts.signs.length - 1];
  return { start, end };
}

/** The page's search description: the fact first, then what the page holds. */
export function guideDescription(facts: EventFacts): string {
  const cities = 'New York, London, Kolkata and Sydney';
  switch (facts.family) {
    case 'lunation': {
      const name = facts.subtype === 'full' ? (facts.moonName && facts.moonName !== 'Blue' ? `${facts.moonName} Moon` : 'full moon') : 'new moon';
      return `The ${name} is exact on ${eventDay(facts.at!)} at ${eventClock(facts.at!)}, in ${signName(facts.signs[0])}. The time in ${cities}, what astrologers read in it, and one thing to try.`;
    }
    case 'eclipse':
      return `${facts.eclipseKind!.replace(/^./u, (c) => c.toUpperCase())} ${facts.subtype} eclipse in ${signName(facts.signs[0])} on ${eventDay(facts.at!)}, peak ${eventClock(facts.at!)}. The peak in ${cities}, where it can be seen, and what astrologers read in it.`;
    case 'retrograde':
      return `${facts.bodies[0]} is retrograde ${windowLabel(facts.start!, facts.end ?? null)}, through ${facts.signs.map(signName).join(' and ')}. Both turns in UTC, ${cities}, the shadow dates, and one thing to try.`;
    default:
      return `${facts.bodies[0]} enters ${signName(facts.signs[0])} on ${eventDay(facts.at!)} at ${eventClock(facts.at!)}. The time in ${cities}, how long it stays, and what astrologers read in it.`;
  }
}

/** The instants the page prints, for the five-clock table. */
export function eventClockRows(facts: EventFacts): ClockRow[] {
  switch (facts.family) {
    case 'lunation':
      return [{ label: facts.subtype === 'full' ? 'Full moon, exact' : 'New moon, exact', at: new Date(facts.at!) }];
    case 'eclipse':
      return [{ label: 'Eclipse peak', at: new Date(facts.at!) }];
    case 'retrograde': {
      const planet = facts.bodies[0];
      const { start, end } = stationSigns(facts);
      return [
        ...(facts.preShadowStart ? [{ label: 'Shadow begins', at: new Date(facts.preShadowStart) }] : []),
        ...(facts.clamped ? [] : [{ label: `${planet} turns retrograde in ${signName(start)}`, at: new Date(facts.start!) }]),
        ...(facts.end ? [{ label: `${planet} turns direct in ${signName(end)}`, at: new Date(facts.end) }] : []),
        ...(facts.postShadowEnd ? [{ label: 'Shadow ends', at: new Date(facts.postShadowEnd) }] : []),
      ];
    }
    case 'ingress':
      return [{ label: `${facts.bodies[0]} enters ${signName(facts.signs[0])}`, at: new Date(facts.at!) }];
    case 'aspect':
      return [{ label: `Exact ${facts.aspectType}`, at: new Date(facts.at!) }];
    default:
      return [];
  }
}

/** Heading and one-line introduction for the five-clock table. */
export function eventClockHeading(facts: EventFacts): { title: string; lead: string; eventLabel: string; caption: string } {
  const cities = 'UTC, New York, London, Kolkata and Sydney';
  switch (facts.family) {
    case 'retrograde':
      return {
        title: 'Station times in five time zones',
        lead: 'Each turn at the minute it happens, on five clocks. The date moves with the zone: an evening in UTC is the next morning in Sydney.',
        eventLabel: 'Moment',
        caption: `${facts.title}: the stations and the shadow edges in ${cities}`,
      };
    case 'eclipse':
      return {
        title: 'The peak in five time zones',
        lead: 'One instant for the whole planet, on five clocks. Where the date differs from the UTC date, the table shows it.',
        eventLabel: 'Moment',
        caption: `${facts.title}: the peak in ${cities}`,
      };
    default:
      return {
        title: 'The time in five time zones',
        lead: 'One instant for the whole planet, on five clocks. Where the date differs from the UTC date, the table shows it.',
        eventLabel: 'Moment',
        caption: `${facts.title}: the exact time in ${cities}`,
      };
  }
}

/**
 * Where the page's times come from, in two sentences. `nasa` is false for an
 * event the NASA tables do not list, which then says it keeps the engine's
 * time instead of claiming NASA's.
 */
export function eventTimesLine(facts: EventFacts): string[] {
  const nasa = Boolean(facts.committed);
  const engine = 'This time comes from our own engine, which falls within a minute of NASA’s for the Sun and the Moon.';
  switch (facts.family) {
    case 'lunation':
      return [
        nasa
          ? 'This time comes from NASA JPL Horizons (the DE441 ephemeris): the instant the Moon’s longitude is exactly opposite the Sun’s, solved to the second and printed to the minute.'
          : engine,
        'The sign and the degree come from our own engine.',
      ];
    case 'eclipse':
      return [
        nasa
          ? `The peak is solved on NASA JPL Horizons (the DE441 ephemeris) and printed to the minute: the instant ${facts.subtype === 'lunar' ? 'the Moon is closest to the centre of Earth’s shadow' : 'the line from the Sun through the Moon passes closest to Earth’s centre'}.`
          : engine,
        'The sign and the degree come from our own engine, and the eclipse type is checked against NASA’s Five Millennium Canon of eclipses by Fred Espenak and Jean Meeus.',
      ];
    case 'retrograde':
      return [
        nasa
          ? 'Station and shadow times come from NASA JPL Horizons (the DE441 ephemeris), solved to the second and printed to the minute.'
          : 'These times come from our own engine. A planet at a station is barely moving, so they can be off by a few minutes.',
        'The degrees come from our own engine.',
      ];
    default:
      return [
        nasa
          ? 'This time comes from NASA JPL Horizons (the DE441 ephemeris), solved to the second and printed to the minute.'
          : engine,
      ];
  }
}

function dateMoveNote(at: string): string {
  const [utc, ...rest] = worldTimes(new Date(at));
  const moved = rest.filter((t) => t.ymd !== utc.ymd).map((t) => t.city);
  return moved.length === 0
    ? 'All five clocks agree on the date.'
    : `The calendar date is different in ${listJoin(moved)}.`;
}

const anywhereElse = 'For anywhere else, add or subtract your own offset from UTC.';

function lunationQuestions(event: CatalogEvent, resolve: Resolve): EventQuestion[] {
  const { facts, relations } = event;
  const at = facts.at!;
  const sign = facts.signs[0];
  const day = eventDay(at);
  const full = facts.subtype === 'full';
  const phase = full ? 'full moon' : 'new moon';
  const eclipse = relations.eclipse && resolve(relations.eclipse.id);
  const next = relations.next && resolve(relations.next.id);
  const questions: EventQuestion[] = [
    {
      q: `What time is the ${phase} on ${day}?`,
      a: `${worldTimesSentence(new Date(at))}. ${dateMoveNote(at)} A ${phase} is one instant for the whole planet, so only the clock reading changes. ${anywhereElse}`,
    },
    {
      q: `What sign is the ${monthName(at)} ${year(at)} ${phase} in?`,
      a: full
        ? `${signName(sign)}. ${facts.longitude !== undefined ? `The Moon stands at ${formatLongitude(facts.longitude)}, and the` : 'The'} Sun is opposite it in ${signName(opposite(sign))}.`
        : `${signName(sign)}. ${facts.longitude !== undefined ? `The Sun and the Moon meet at ${formatLongitude(facts.longitude)}.` : 'The Sun and the Moon meet there.'}`,
    },
  ];
  if (full && facts.moonName) {
    questions.push({
      q: `What is the ${monthName(at)} full moon called?`,
      a: facts.moonName === 'Blue'
        ? 'A blue moon: the second full moon inside one calendar month, counted in universal time.'
        : `${moonNameLabel(facts.moonName).replace(/^the/u, 'The')}, the North American almanac name for the full moon of ${monthName(at)}. The name belongs to the month, not to the sign.`,
    });
  }
  questions.push({
    q: `Is the ${monthDay(at)} ${phase} an eclipse?`,
    a: eclipse
      ? `Yes. It is also ${article(eclipse.facts.eclipseKind ?? '')} ${eclipseLabel(eclipse.facts)}. The eclipse peaks at ${worldTimesSentence(new Date(eclipse.facts.at!))}.${eclipse.facts.subtype === 'lunar' && isInvisiblePenumbral(eclipse.facts.at!, eclipse.facts.eclipseKind) ? ' The shading is too slight for any eye or camera to see.' : ''}`
      : `No. The Moon passes ${full ? 'above or below Earth’s shadow' : 'above or below the Sun'} this time, as it does at most ${phase}s.`,
  });
  if (full) {
    questions.push({
      q: 'How long does the full moon last?',
      a: 'The full moon itself is an instant, the minute in the table. To the eye the Moon looks full on the night before and the night after as well.',
    });
  }
  if (next?.facts.at) {
    questions.push({
      q: `When is the next ${phase}?`,
      a: `${eventDay(next.facts.at)}, in ${signName(next.facts.signs[0])}, at ${worldTimesSentence(new Date(next.facts.at))}.`,
    });
  }
  return questions;
}

function eclipseQuestions(event: CatalogEvent, resolve: Resolve, all: readonly CatalogEvent[]): EventQuestion[] {
  const { facts, relations } = event;
  const at = facts.at!;
  const solar = facts.subtype === 'solar';
  const kind = facts.eclipseKind ?? 'partial';
  const label = eclipseLabel(facts);
  const unseen = !solar && isInvisiblePenumbral(at, kind);
  const magnitude = !solar && kind === 'penumbral' ? penumbralMagnitude(at) : null;
  const what: Record<string, string> = {
    'solar:total': 'A total solar eclipse: the Moon passes in front of the Sun and covers it completely for the places inside a narrow path.',
    'solar:annular': 'An annular solar eclipse: the Moon passes in front of the Sun but is too far from Earth to cover it all, so a bright ring stays visible.',
    'solar:partial': 'A partial solar eclipse: the Moon passes in front of part of the Sun.',
    'lunar:total': 'A total lunar eclipse: the full Moon passes completely into the dark centre of Earth’s shadow.',
    'lunar:partial': 'A partial lunar eclipse: part of the full Moon passes through the dark centre of Earth’s shadow.',
    'lunar:penumbral': 'A penumbral lunar eclipse: the full Moon passes through the faint outer part of Earth’s shadow and misses the dark centre.',
  };
  const regions = solar ? [] : lunarEclipseRegions(at);
  const where = solar
    ? SOLAR_ECLIPSE_VISIBILITY[at.slice(0, 10)]
    : unseen
      ? 'No one will see it. The Moon is up for half the world at the peak, but the shading is too slight to show.'
      : `Anyone with the Moon above the horizon at the peak. Roughly, that is ${listJoin(regions)}.${kind === 'penumbral' ? ' The shading is faint, and most people will not notice it.' : ''}`;
  const season = all
    .filter((other) => other.facts.family === 'eclipse' && other !== event
      && Math.abs(Date.parse(other.facts.at!) - Date.parse(at)) < 40 * DAY_MS)
    .sort((a, b) => a.facts.at!.localeCompare(b.facts.at!));
  const next = relations.next && resolve(relations.next.id);
  const following = all
    .filter((other) => other.facts.family === 'eclipse' && other.facts.at! > at)
    .sort((a, b) => a.facts.at!.localeCompare(b.facts.at!))[0];

  const questions: EventQuestion[] = [
    {
      q: `What time is the eclipse on ${eventDay(at)}?`,
      a: `It peaks at ${worldTimesSentence(new Date(at))}. ${dateMoveNote(at)} The peak is one instant for the whole planet. Whether you see the eclipse at that minute depends on where you stand, not on your clock.`,
    },
    {
      q: 'What kind of eclipse is it?',
      a: `${what[`${facts.subtype}:${kind}`]}${magnitude !== null ? ` NASA gives this one a penumbral magnitude of ${magnitude}.` : ''}`,
    },
  ];
  if (where) questions.push({ q: 'Where can it be seen?', a: where });
  questions.push({
    q: 'Which sign is the eclipse in?',
    a: `${signName(facts.signs[0])}${facts.longitude !== undefined ? `, with the ${solar ? 'Sun' : 'Moon'} at ${formatLongitude(facts.longitude)}` : ''}. ${solar ? 'A solar eclipse takes the sign that holds the Sun and the Moon together.' : `A lunar eclipse takes the sign that holds the Moon. The Sun is opposite it in ${signName(opposite(facts.signs[0]))}.`}`,
  });
  questions.push({
    q: 'Is it safe to look at?',
    a: solar
      ? 'Not without protection. Use eclipse glasses made to the ISO 12312-2 standard, or a pinhole projector. Only inside the path of a total eclipse, and only during the minutes of totality, is it safe to look with bare eyes.'
      : 'Yes. A lunar eclipse is safe to watch with bare eyes, binoculars or a telescope.',
  });
  if (season.length > 0) {
    questions.push({
      q: 'Which other eclipses come with it?',
      a: `Eclipses come two or three together, about two weeks apart. This one belongs with ${listJoin(season.map((other) => `the ${eclipseLabel(other.facts)} of ${dayNear(other.facts.at!, at)}`))}.`,
    });
  }
  if (following?.facts.at) {
    const sameKind = next && next.facts.at && next !== following
      ? ` The next ${facts.subtype} eclipse is the ${eclipseLabel(next.facts)} of ${eventDay(next.facts.at)}.`
      : '';
    questions.push({
      q: 'When is the next eclipse?',
      a: `The ${eclipseLabel(following.facts)} of ${eventDay(following.facts.at)}, in ${signName(following.facts.signs[0])}. It peaks at ${worldTimesSentence(new Date(following.facts.at))}.${sameKind}`,
    });
  }
  return questions;
}

function retrogradeQuestions(event: CatalogEvent, resolve: Resolve): EventQuestion[] {
  const { facts, relations } = event;
  const planet = facts.bodies[0];
  const start = facts.start!;
  const end = facts.end ?? null;
  const signs = stationSigns(facts);
  const next = relations.next && resolve(relations.next.id);
  const month = `${monthName(start)} ${year(start)}`;
  const inside = planet === 'Mars'
    ? 'Earth, on the faster inside track, overtakes Mars'
    : `${planet}, on a faster inside track, overtakes Earth`;
  const questions: EventQuestion[] = [
    {
      q: `When is ${planet} retrograde in ${month}?`,
      a: end
        ? `From ${monthDay(start)} to ${dayNear(end, start)}${year(end) === year(start) ? `, ${year(start)}` : ''}. It turns retrograde at ${worldTimesSentence(new Date(start))}.`
        : `From ${eventDay(start)}. It turns retrograde at ${worldTimesSentence(new Date(start))}.`,
    },
  ];
  if (end) {
    questions.push({
      q: `When does ${planet} turn direct?`,
      a: `At ${worldTimesSentence(new Date(end))}. ${anywhereElse}`,
    });
    questions.push({
      q: `How long does this ${planet} retrograde last?`,
      a: `${wholeDays(start, end)} days from station to station.${facts.preShadowStart && facts.postShadowEnd ? ` Counting the shadow on both sides, ${planet} spends ${wholeDays(facts.preShadowStart, facts.postShadowEnd)} days on the same stretch of the zodiac.` : ''}`,
    });
  }
  questions.push({
    q: `Which signs does ${planet} move through?`,
    a: signs.start === signs.end
      ? `Only ${signName(signs.start)}. Both stations fall in that sign.`
      : `It turns retrograde in ${signName(signs.start)} and backs into ${signName(signs.end)}, where it turns direct.`,
  });
  if (facts.preShadowStart && facts.postShadowEnd) {
    questions.push({
      q: 'When is the shadow period?',
      a: `${planet} crosses the same degrees three times: forward, backward, then forward again. The shadow is the forward passes on each side. It begins on ${eventDay(facts.preShadowStart)}, when ${planet} first reaches the degree where it will later turn direct, and ends on ${eventDay(facts.postShadowEnd)}, when it passes the degree where it turned retrograde.`,
    });
  }
  questions.push({
    q: `Is ${planet} really moving backward?`,
    a: `No. Nothing about its orbit changes. ${inside}, and the view from a moving planet makes it look like a reversal.`,
  });
  if (next?.facts.start) {
    questions.push({
      q: `When is the next ${planet} retrograde?`,
      a: `${next.facts.end ? `${eventDay(next.facts.start)} to ${eventDay(next.facts.end)}` : `From ${eventDay(next.facts.start)}`}. It turns retrograde at ${worldTimesSentence(new Date(next.facts.start))}.`,
    });
  }
  return questions;
}

function ingressQuestions(event: CatalogEvent, resolve: Resolve): EventQuestion[] {
  const { facts, relations } = event;
  const planet = facts.bodies[0];
  const sign = signName(facts.signs[0]);
  const at = facts.at!;
  const next = relations.next && resolve(relations.next.id);
  const leaves = next?.facts.at;
  const questions: EventQuestion[] = [
    {
      q: `When does ${planet} enter ${sign}?`,
      a: `In ${year(at)}, at ${worldTimesSentence(new Date(at))}. ${dateMoveNote(at)} ${anywhereElse}`,
    },
  ];
  if (leaves) {
    questions.push({
      q: `How long does ${planet} stay in ${sign}?`,
      a: `Until ${eventDay(leaves)}, ${wholeDays(at, leaves)} days later, when it enters ${signName(next!.facts.signs[0])}.`,
    });
  }
  if (facts.fromSign) {
    questions.push({
      q: `Which sign does ${planet} leave?`,
      a: `${signName(facts.fromSign)}. A planet changes sign when it crosses one of the twelve 30 degree boundaries of the zodiac.`,
    });
  }
  questions.push({
    q: `Can I see ${planet} change sign?`,
    a: `No. The boundary between two signs is a line on the zodiac, not something in the sky. ${planet} looks the same the night before and the night after.`,
  });
  return questions;
}

/** The page's questions, each answered from the event's own facts. */
export function eventQuestions(
  event: CatalogEvent,
  resolve: Resolve,
  all: readonly CatalogEvent[],
): EventQuestion[] {
  switch (event.facts.family) {
    case 'lunation': return lunationQuestions(event, resolve);
    case 'eclipse': return eclipseQuestions(event, resolve, all);
    case 'retrograde': return retrogradeQuestions(event, resolve);
    case 'ingress': return ingressQuestions(event, resolve);
    default: return [];
  }
}
