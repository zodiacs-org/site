/**
 * Naming, slugs, and reader-facing labels for the astrology-events surface.
 * Pure functions over EventFacts — no astronomy happens here.
 */
import { formatDate, formatShortDate, formatTime } from '../i18n/dates';
import { signBySlug } from '../signs';
import type { EventFacts } from './types';

/**
 * North American almanac tradition, keyed by month; the second full moon
 * inside one calendar month takes "Blue" instead. Mirrors the table on
 * /full-moon-calendar/ — keep the two in step (pinned by format.test.ts).
 */
export const MOON_MONTH_NAMES = [
  'Wolf', 'Snow', 'Worm', 'Pink', 'Flower', 'Strawberry',
  'Buck', 'Sturgeon', 'Corn', 'Hunter’s', 'Beaver', 'Cold',
] as const;

export function moonNameForDate(atIso: string, secondInMonth: boolean): string {
  if (secondInMonth) return 'Blue';
  return MOON_MONTH_NAMES[new Date(atIso).getUTCMonth()];
}

/** 'Buck' -> 'the Buck Moon', 'Blue' -> 'a blue moon'. */
export function moonNameLabel(name: string): string {
  return name === 'Blue' ? 'a blue moon' : `the ${name} Moon`;
}

export const isoDay = (iso: string) => iso.slice(0, 10);

/** 'July 29, 2026' — reader-facing UTC day. */
export function eventDay(iso: string): string {
  return formatDate('en', new Date(iso), {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

/** 'Wednesday, July 29, 2026'. */
export function eventDayLong(iso: string): string {
  return formatDate('en', new Date(iso), {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

/** '18:36 UTC' — the receipt clock. */
export function eventClock(iso: string): string {
  return `${formatTime('en', new Date(iso), {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  })} UTC`;
}

/** 'Jul 18 – Aug 11, 2026' for a cycle window (UTC days). */
export function windowLabel(fromIso: string, toIso: string | null): string {
  const from = formatShortDate('en', new Date(fromIso));
  if (!toIso) return `${from} to past the data horizon`;
  return `${from} to ${formatShortDate('en', new Date(toIso))}`;
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function signNameFor(slug: string): string {
  return signBySlug(slug).name;
}

/** Stable IDs and site-relative paths per family. */
export function lunationId(type: 'full' | 'new', atIso: string): string {
  return `${type}-moon-${isoDay(atIso)}`;
}
export function lunationPath(type: 'full' | 'new', atIso: string): string {
  return `/${type}-moon/${isoDay(atIso)}/`;
}
export function eclipseId(atIso: string): string {
  return `eclipse-${isoDay(atIso)}`;
}
export function eclipsePath(atIso: string): string {
  return `/eclipses/${isoDay(atIso)}/`;
}
export function retrogradeId(planet: string, fromIso: string): string {
  return `${planet.toLowerCase()}-retrograde-${isoDay(fromIso)}`;
}
export function retrogradePath(planet: string, fromIso: string): string {
  return `/${planet.toLowerCase()}-retrograde/${isoDay(fromIso)}/`;
}
export function ingressId(planet: string, sign: string, atIso: string): string {
  return `${planet.toLowerCase()}-enters-${sign}-${isoDay(atIso)}`;
}
export function ingressPath(planet: string, sign: string, atIso: string): string {
  return `/events/${ingressId(planet, sign, atIso)}/`;
}
export function aspectId(a: string, type: string, b: string, atIso: string): string {
  return `${a.toLowerCase()}-${type}-${b.toLowerCase()}-${isoDay(atIso)}`;
}
export function aspectPath(a: string, type: string, b: string, atIso: string): string {
  return `/events/${aspectId(a, type, b, atIso)}/`;
}
export function stationId(planet: string, direction: 'retrograde' | 'direct', atIso: string): string {
  return `${planet.toLowerCase()}-stations-${direction}-${isoDay(atIso)}`;
}

/** Reader-facing display title, unique because the day is included. */
export function eventTitle(facts: Omit<EventFacts, 'title' | 'path' | 'id'>): string {
  switch (facts.family) {
    case 'lunation': {
      const sign = signNameFor(facts.signs[0]);
      const day = eventDay(facts.at!);
      return facts.subtype === 'full'
        ? `Full moon in ${sign}, ${day}`
        : `New moon in ${sign}, ${day}`;
    }
    case 'eclipse': {
      const sign = signNameFor(facts.signs[0]);
      const body = facts.subtype === 'solar' ? 'solar' : 'lunar';
      return `${capitalize(facts.eclipseKind ?? 'partial')} ${body} eclipse in ${sign}, ${eventDay(facts.at!)}`;
    }
    case 'retrograde': {
      const from = new Date(facts.start!);
      const month = formatDate('en', from, { month: 'long', timeZone: 'UTC' });
      return `${facts.bodies[0]} retrograde, ${month} ${from.getUTCFullYear()}`;
    }
    case 'ingress': {
      return `${facts.bodies[0]} enters ${signNameFor(facts.signs[0])}, ${eventDay(facts.at!)}`;
    }
    case 'aspect': {
      const [a, b] = facts.bodies;
      return `${a} ${facts.aspectType} ${b}, ${eventDay(facts.at!)}`;
    }
    case 'station': {
      return `${facts.bodies[0]} stations ${facts.direction}, ${eventDay(facts.at!)}`;
    }
  }
}

/** Short family label for the hub timeline and family keys. */
export const FAMILY_LABEL: Record<string, string> = {
  lunation: 'Moon',
  eclipse: 'Eclipse',
  retrograde: 'Retrograde',
  ingress: 'Sign change',
  aspect: 'Alignment',
  station: 'Station',
};

/** One-line, fact-grounded timeline description (not interpretation). */
export function timelineLine(facts: EventFacts): string {
  switch (facts.family) {
    case 'lunation': {
      const sign = signNameFor(facts.signs[0]);
      if (facts.subtype === 'full') {
        const named = facts.moonName ? `${moonNameLabel(facts.moonName)}: ` : '';
        return `${capitalize(named)}the Moon stands opposite the Sun in ${sign}.`;
      }
      return `Sun and Moon meet in ${sign}; the month's quiet reset.`;
    }
    case 'eclipse':
      return facts.subtype === 'solar'
        ? `A new moon crosses the Sun's face in ${signNameFor(facts.signs[0])}.`
        : `A full moon passes through Earth's shadow in ${signNameFor(facts.signs[0])}.`;
    case 'retrograde':
      return `${facts.bodies[0]} appears to reverse through ${facts.signs.map(signNameFor).join(' and ')}.`;
    case 'ingress':
      return `${facts.bodies[0]} moves into ${signNameFor(facts.signs[0])}${facts.fromSign ? ` from ${signNameFor(facts.fromSign)}` : ''}.`;
    case 'aspect':
      return `${facts.bodies[0]} and ${facts.bodies[1]} reach an exact ${facts.aspectType}.`;
    case 'station':
      return facts.direction === 'retrograde'
        ? `${facts.bodies[0]} slows to a standstill and turns retrograde.`
        : `${facts.bodies[0]} stands still, then resumes forward motion.`;
  }
}

/** SEO title, unique per event ("… | Zodiacs.org" suffix added here). */
export function metaTitle(facts: EventFacts): string {
  switch (facts.family) {
    case 'lunation': {
      const sign = signNameFor(facts.signs[0]);
      const kind = facts.subtype === 'full' ? 'Full Moon' : 'New Moon';
      const named = facts.moonName && facts.moonName !== 'Blue'
        ? ` (${facts.moonName} Moon)`
        : facts.moonName === 'Blue' ? ' (Blue Moon)' : '';
      return `${kind} in ${sign}${named}, ${eventDay(facts.at!)}, Exact Time | Zodiacs.org`;
    }
    case 'eclipse': {
      const body = facts.subtype === 'solar' ? 'Solar' : 'Lunar';
      return `${capitalize(facts.eclipseKind ?? '')} ${body} Eclipse, ${eventDay(facts.at!)}, in ${signNameFor(facts.signs[0])} | Zodiacs.org`;
    }
    case 'retrograde': {
      const from = new Date(facts.start!);
      const month = formatDate('en', from, { month: 'long', timeZone: 'UTC' });
      return `${facts.bodies[0]} Retrograde ${month} ${from.getUTCFullYear()}: Dates, Signs, Meaning | Zodiacs.org`;
    }
    case 'ingress':
      return `${facts.bodies[0]} in ${signNameFor(facts.signs[0])}, Enters ${eventDay(facts.at!)} | Zodiacs.org`;
    case 'aspect':
      return `${facts.bodies[0]} ${capitalize(facts.aspectType ?? '')} ${facts.bodies[1]}, ${eventDay(facts.at!)} | Zodiacs.org`;
    case 'station':
      return `${facts.bodies[0]} Stations ${capitalize(facts.direction ?? '')}, ${eventDay(facts.at!)} | Zodiacs.org`;
  }
}

/** SEO description, unique per event (dates + facts included). */
export function metaDescription(facts: EventFacts): string {
  switch (facts.family) {
    case 'lunation': {
      const sign = signNameFor(facts.signs[0]);
      const when = `${eventDay(facts.at!)} at ${eventClock(facts.at!)}`;
      return facts.subtype === 'full'
        ? `The ${facts.moonName ? `${facts.moonName} Moon` : 'full moon'} is exact on ${when}, in ${sign}. What this full moon means, who feels it most, and the events around it.`
        : `The new moon in ${sign} is exact on ${when}. What this lunation opens, how to work with it, and the sky around it.`;
    }
    case 'eclipse': {
      const body = facts.subtype === 'solar' ? 'solar eclipse' : 'lunar eclipse';
      return `${capitalize(facts.eclipseKind ?? '')} ${body} in ${signNameFor(facts.signs[0])} on ${eventDay(facts.at!)}, peak ${eventClock(facts.at!)}. Meaning, visibility of the moment, and the eclipses around it.`;
    }
    case 'retrograde': {
      const window = windowLabel(facts.start!, facts.end ?? null);
      return `${facts.bodies[0]} is retrograde ${window}, through ${facts.signs.map(signNameFor).join(' and ')}. What this cycle reviews, its station dates, and how to read it calmly.`;
    }
    case 'ingress':
      return `${facts.bodies[0]} enters ${signNameFor(facts.signs[0])} on ${eventDay(facts.at!)} at ${eventClock(facts.at!)}. What changes with the sign shift and how long it lasts.`;
    case 'aspect':
      return `${facts.bodies[0]} and ${facts.bodies[1]} form an exact ${facts.aspectType} on ${eventDay(facts.at!)} at ${eventClock(facts.at!)}. What this alignment pairs and how to use it.`;
    case 'station':
      return `${facts.bodies[0]} stations ${facts.direction} on ${eventDay(facts.at!)} at ${eventClock(facts.at!)}. The turnaround moment of the cycle, explained.`;
  }
}
