/**
 * Read-side adapter: committed fact catalogs → the typed events contract.
 *
 * Sources are the repository's verified data files only — sky.json,
 * eclipses.json, ingresses.json, and the monthly transits-YYYY-MM.json
 * catalogs — plus clearly labeled fixtures. The only derivation performed
 * here is formatting a committed instant through the site's own engine
 * (sign and degree at that instant), the same idiom the full-moon-calendar
 * and retrogrades pages already use. Nothing here invents an event.
 *
 * Build/server-side module: pages and tests import it; islands must not.
 */
import sky from '../../data/sky.json';
import eclipsesData from '../../data/eclipses.json';
import ingressesData from '../../data/ingresses.json';
import { bodyLongitude } from '../engine/full';
import type { BodyName } from '../engine/types';
import { degreeInSign, signForLongitude } from '../signs';
import {
  aspectId, aspectPath, eclipseId, eclipsePath, eventTitle,
  ingressId, ingressPath, isoDay, lunationId, lunationPath,
  moonNameForDate, retrogradeId, retrogradePath, stationId,
} from './format';
import { publishedEventById } from './publication';
import type { CatalogEvent, EventFacts, EventLink } from './types';
import { FIXTURE_EVENTS } from './fixtures';
import { interpretationFor } from './interpretations';

/** Planets whose ingresses and mutual aspects carry a standalone page. */
export const SLOW_BODIES = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;

const DAY_MS = 86_400_000;
const NEARBY_WINDOW_MS = 5 * DAY_MS;
const ECLIPSE_MATCH_MS = 6 * 3_600_000;

interface TransitMonth {
  month: string;
  ingresses: { planet: string; at: string; sign: string; retrograde: boolean }[];
  lunations: { type: string; at: string; sign: string; degree: number }[];
  stations: { planet: string; at: string; direction?: string }[];
  aspects: {
    a: string; b: string; type: string; orb: number; at: string;
    aSign: string; aDegree: number; bSign: string; bDegree: number;
  }[];
}

const transitMonths: TransitMonth[] = Object.entries(
  import.meta.glob('../../data/transits-*.json', { eager: true }),
)
  .map(([, module]) => (module as { default: TransitMonth }).default ?? (module as unknown as TransitMonth))
  .filter((month) => Boolean(month?.month))
  .sort((a, b) => a.month.localeCompare(b.month));

const transitSource = (month: string) => `transits-${month}.json` as const;

const anchor = (facts: EventFacts): number =>
  new Date(facts.at ?? facts.start ?? 0).getTime();

/** Lunations 2026–2027 from sky.json instants; sign/degree via the engine
 * at each committed instant; monthly catalogs are preferred when present. */
function lunationFacts(): EventFacts[] {
  const monthly = new Map<string, { record: TransitMonth['lunations'][number]; month: string }>();
  for (const month of transitMonths) {
    for (const record of month.lunations) {
      monthly.set(`${record.type}:${isoDay(record.at)}`, { record, month: month.month });
    }
  }

  const seenFullMonths = new Set<string>();
  return (sky.moons as { type: 'full' | 'new'; at: string }[]).map(({ type, at }) => {
    const catalog = monthly.get(`${type}:${isoDay(at)}`);
    const lon = bodyLongitude('Moon', new Date(catalog?.record.at ?? at));
    const sign = catalog?.record.sign ?? signForLongitude(lon).slug;
    const degree = catalog?.record.degree ?? degreeInSign(lon);
    let moonName: string | undefined;
    if (type === 'full') {
      const monthKey = at.slice(0, 7);
      moonName = moonNameForDate(at, seenFullMonths.has(monthKey));
      seenFullMonths.add(monthKey);
    }
    const base = {
      family: 'lunation' as const,
      subtype: type,
      at: catalog?.record.at ?? at,
      bodies: ['Moon', 'Sun'],
      signs: [sign],
      degree,
      longitude: lon,
      moonName,
      provenance: catalog
        ? { source: transitSource(catalog.month), derived: [] }
        : {
            source: 'sky.json' as const,
            generatedAt: sky.generatedAt,
            derived: ['sign and degree read from the engine at the committed instant'],
          },
    };
    return {
      ...base,
      id: lunationId(type, at),
      path: lunationPath(type, at),
      title: eventTitle(base),
    };
  });
}

function eclipseFacts(): EventFacts[] {
  return (eclipsesData.eclipses as {
    type: 'solar' | 'lunar'; kind: EventFacts['eclipseKind']; peak: string;
    sign: string; lon: number; degree: number; obscuration: number; totalMinutes?: number;
  }[]).map((eclipse) => {
    const base = {
      family: 'eclipse' as const,
      subtype: eclipse.type,
      at: eclipse.peak,
      bodies: eclipse.type === 'solar' ? ['Moon', 'Sun'] : ['Moon', 'Sun'],
      signs: [eclipse.sign],
      degree: eclipse.degree,
      longitude: eclipse.lon,
      eclipseKind: eclipse.kind,
      obscuration: eclipse.obscuration,
      totalMinutes: eclipse.totalMinutes,
      provenance: { source: 'eclipses.json' as const, generatedAt: eclipsesData.generatedAt },
    };
    return {
      ...base,
      id: eclipseId(eclipse.peak),
      path: eclipsePath(eclipse.peak),
      title: eventTitle(base),
    };
  });
}

/** Planets with a standalone retrograde page family (the brief's set). */
export const RETRO_PAGE_PLANETS = ['Mercury', 'Venus', 'Mars'] as const;

interface RetroWindow {
  planet: string;
  from: string;
  to: string | null;
  preShadowStart?: string | null;
  postShadowEnd?: string | null;
  clamped: boolean;
}

const retroWindows: RetroWindow[] = (sky.retrogrades as {
  planet: string;
  from: string;
  to: string | null;
  preShadowStart?: string | null;
  postShadowEnd?: string | null;
}[])
  .map((window) => ({ ...window, clamped: window.from === sky.from }));

/**
 * Outer-planet cycles keep their editorial home in the /retrogrades/
 * tables — their catalog entries link straight to the matching table row
 * anchor instead of claiming a standalone page.
 */
function retroCyclePath(planet: string, fromIso: string): string {
  return (RETRO_PAGE_PLANETS as readonly string[]).includes(planet)
    ? retrogradePath(planet, fromIso)
    : `/retrogrades/#retrograde-${planet.toLowerCase()}-${isoDay(fromIso)}`;
}

function retrogradeFacts(): EventFacts[] {
  return retroWindows.map((window) => {
    const startLon = bodyLongitude(window.planet as BodyName, new Date(window.from));
    const endLon = window.to ? bodyLongitude(window.planet as BodyName, new Date(window.to)) : null;
    const signs = [...new Set([
      signForLongitude(startLon).slug,
      ...(endLon === null ? [] : [signForLongitude(endLon).slug]),
    ])];
    // The retrograde runs high-degree → low-degree; list signs in that order.
    signs.reverse();
    const base = {
      family: 'retrograde' as const,
      subtype: 'cycle',
      start: window.from,
      end: window.to,
      preShadowStart: window.preShadowStart ?? null,
      postShadowEnd: window.postShadowEnd ?? null,
      clamped: window.clamped,
      bodies: [window.planet],
      signs,
      degree: window.clamped ? undefined : degreeInSign(startLon),
      longitude: window.clamped ? undefined : startLon,
      provenance: {
        source: 'sky.json' as const,
        generatedAt: sky.generatedAt,
        derived: ['station signs and degrees read from the engine at the committed instants'],
      },
    };
    return {
      ...base,
      id: retrogradeId(window.planet, window.from),
      path: retroCyclePath(window.planet, window.from),
      title: eventTitle(base),
    };
  });
}

/** Station moments derived from the committed window boundaries — timeline
 * entries and cycle context, not standalone pages. */
function stationFacts(): EventFacts[] {
  const stations: EventFacts[] = [];
  for (const window of retroWindows) {
    if (!window.clamped) {
      const lon = bodyLongitude(window.planet as BodyName, new Date(window.from));
      const base = {
        family: 'station' as const,
        subtype: 'retrograde',
        at: window.from,
        bodies: [window.planet],
        signs: [signForLongitude(lon).slug],
        degree: degreeInSign(lon),
        longitude: lon,
        direction: 'retrograde' as const,
        provenance: { source: 'sky.json' as const, generatedAt: sky.generatedAt },
      };
      stations.push({
        ...base,
        id: stationId(window.planet, 'retrograde', window.from),
        path: retroCyclePath(window.planet, window.from),
        title: eventTitle(base),
      });
    }
    if (window.to) {
      const lon = bodyLongitude(window.planet as BodyName, new Date(window.to));
      const base = {
        family: 'station' as const,
        subtype: 'direct',
        at: window.to,
        bodies: [window.planet],
        signs: [signForLongitude(lon).slug],
        degree: degreeInSign(lon),
        longitude: lon,
        direction: 'direct' as const,
        provenance: { source: 'sky.json' as const, generatedAt: sky.generatedAt },
      };
      stations.push({
        ...base,
        id: stationId(window.planet, 'direct', window.to),
        path: retroCyclePath(window.planet, window.from),
        title: eventTitle(base),
      });
    }
  }
  return stations;
}

/** Slow-planet ingresses inside the sky horizon, from the committed
 * occupancy windows (window start = ingress instant). */
function ingressFacts(): EventFacts[] {
  const windows = (ingressesData.windows as { planet: string; sign: string; from: string; to: string }[]);
  const horizonFrom = new Date(sky.from).getTime();
  const horizonTo = new Date(sky.to).getTime();
  const byPlanet = new Map<string, { sign: string; from: string; to: string }[]>();
  for (const window of windows) {
    if (!byPlanet.has(window.planet)) byPlanet.set(window.planet, []);
    byPlanet.get(window.planet)!.push(window);
  }
  const facts: EventFacts[] = [];
  for (const planet of SLOW_BODIES) {
    const occupancy = (byPlanet.get(planet) ?? [])
      .slice()
      .sort((a, b) => a.from.localeCompare(b.from));
    occupancy.forEach((window, index) => {
      const at = new Date(window.from).getTime();
      if (at < horizonFrom || at >= horizonTo) return;
      const retrograde = retroWindows.some((rx) =>
        rx.planet === planet
        && new Date(rx.from).getTime() <= at
        && (rx.to === null || at <= new Date(rx.to).getTime()));
      const base = {
        family: 'ingress' as const,
        subtype: retrograde ? 'retrograde-re-entry' : 'ingress',
        at: window.from,
        bodies: [planet],
        signs: [window.sign],
        fromSign: occupancy[index - 1]?.sign,
        provenance: { source: 'ingresses.json' as const, generatedAt: ingressesData.generatedAt },
      };
      facts.push({
        ...base,
        id: ingressId(planet, window.sign, window.from),
        path: ingressPath(planet, window.sign, window.from),
        title: eventTitle(base),
      });
    });
  }
  return facts;
}

/** Exact aspects between two slow bodies, from the committed monthly
 * catalogs. Personal-planet aspects stay on the daily surfaces. */
function aspectFacts(): EventFacts[] {
  const slow = new Set<string>(SLOW_BODIES);
  const facts: EventFacts[] = [];
  for (const month of transitMonths) {
    for (const aspect of month.aspects) {
      if (!slow.has(aspect.a) || !slow.has(aspect.b)) continue;
      if (aspect.orb !== 0) continue;
      const base = {
        family: 'aspect' as const,
        subtype: aspect.type,
        at: aspect.at,
        bodies: [aspect.a, aspect.b],
        signs: [aspect.aSign, aspect.bSign],
        degree: aspect.aDegree,
        aspectType: aspect.type,
        orb: 0 as const,
        provenance: { source: transitSource(month.month) },
      };
      facts.push({
        ...base,
        id: aspectId(aspect.a, aspect.type, aspect.b, aspect.at),
        path: aspectPath(aspect.a, aspect.type, aspect.b, aspect.at),
        title: eventTitle(base),
      });
    }
  }
  return facts;
}

/** Comparable key: which stream previous/next runs through. */
function comparableKey(facts: EventFacts): string {
  switch (facts.family) {
    case 'lunation': return `lunation:${facts.subtype}`;
    case 'eclipse': return `eclipse:${facts.subtype}`;
    case 'retrograde': return `retrograde:${facts.bodies[0]}`;
    case 'ingress': return `ingress:${facts.bodies[0]}`;
    case 'aspect': return `aspect:${facts.bodies.join(':')}:${facts.aspectType}`;
    case 'station': return `station:${facts.bodies[0]}:${facts.direction}`;
  }
}

function comparableReason(facts: EventFacts, direction: 'previous' | 'next'): string {
  const before = direction === 'previous';
  switch (facts.family) {
    case 'lunation':
      return before
        ? `The ${facts.subtype} moon before this one`
        : `The next ${facts.subtype} moon`;
    case 'eclipse':
      return before
        ? `The ${facts.subtype} eclipse before this one`
        : `The next ${facts.subtype} eclipse`;
    case 'retrograde':
      return before
        ? `${facts.bodies[0]}'s previous retrograde cycle`
        : `${facts.bodies[0]}'s next retrograde cycle`;
    case 'ingress':
      return before
        ? `${facts.bodies[0]}'s previous sign change`
        : `${facts.bodies[0]}'s next sign change`;
    case 'aspect':
      return before ? 'The previous exact hit of this pair' : 'The next exact hit of this pair';
    case 'station':
      return before ? 'The previous station' : 'The next station';
  }
}

const daysBetween = (a: EventFacts, b: EventFacts): number =>
  Math.round(Math.abs(anchor(a) - anchor(b)) / DAY_MS);

/** Plain-language reason a nearby event materially matters here. */
function nearbyReason(subject: EventFacts, other: EventFacts): string {
  const days = daysBetween(subject, other);
  const gap = days === 0 ? 'the same day' : days === 1 ? 'one day away' : `${days} days away`;
  switch (other.family) {
    case 'station':
      return other.direction === 'retrograde'
        ? `${other.bodies[0]} turns retrograde ${gap}. Its review colors this moment`
        : `${other.bodies[0]} turns direct ${gap}. A stalled thread starts moving`;
    case 'eclipse':
      return `The ${other.subtype} eclipse ${gap} makes this an eclipse-season moment`;
    case 'lunation':
      return other.subtype === 'full'
        ? `The full moon ${gap} brings this thread to light`
        : `The new moon ${gap} opens the next chapter of this story`;
    case 'ingress':
      return `${other.bodies[0]} changes sign ${gap}. The backdrop shifts with it`;
    case 'aspect':
      return `${other.bodies[0]} and ${other.bodies[1]} are exact ${gap}, part of the same sky`;
    case 'retrograde':
      return `${other.bodies[0]} is retrograde through this period`;
  }
}

export interface EventsCatalog {
  /** Every event, chronological, fixtures excluded. */
  events: CatalogEvent[];
  /** Events with a standalone page (fixtures excluded). */
  pages: CatalogEvent[];
  /** Labeled fixture events (template variants; never indexable). */
  fixtures: CatalogEvent[];
  byId: Map<string, CatalogEvent>;
  range: { from: string; to: string };
}

function buildCatalog(): EventsCatalog {
  const pageFacts: EventFacts[] = [
    ...lunationFacts(),
    ...eclipseFacts(),
    ...retrogradeFacts(),
    ...ingressFacts(),
    ...aspectFacts(),
  ];
  const stationEvents = stationFacts();
  const all = [...pageFacts, ...stationEvents].sort((a, b) => anchor(a as EventFacts) - anchor(b as EventFacts));

  // Previous/next comparable chains, chronological within each stream.
  const streams = new Map<string, EventFacts[]>();
  for (const facts of all) {
    const key = comparableKey(facts);
    if (!streams.has(key)) streams.set(key, []);
    streams.get(key)!.push(facts);
  }

  const linkFor = (facts: EventFacts, reason: string): EventLink => ({ id: facts.id, reason });

  // Stations render on their cycle's page; outer-planet cycles live in the
  // /retrogrades/ tables. Everything else owns a standalone page.
  const hasPage = (facts: EventFacts): boolean =>
    facts.family !== 'station'
    && !(facts.family === 'retrograde'
      && !(RETRO_PAGE_PLANETS as readonly string[]).includes(facts.bodies[0]));

  const events: CatalogEvent[] = all.map((facts) => {
    const stream = streams.get(comparableKey(facts))!;
    const index = stream.indexOf(facts);
    const previous = index > 0 ? stream[index - 1] : undefined;
    const next = index < stream.length - 1 ? stream[index + 1] : undefined;

    // Eclipse ↔ lunation pairing (a solar eclipse is a new moon; a lunar
    // eclipse is a full moon) within six hours of the same instant.
    let lunation: EventLink | undefined;
    let eclipse: EventLink | undefined;
    if (facts.family === 'eclipse') {
      const wanted = facts.subtype === 'solar' ? 'new' : 'full';
      const match = all.find((other) => other.family === 'lunation'
        && other.subtype === wanted
        && Math.abs(anchor(other) - anchor(facts)) <= ECLIPSE_MATCH_MS);
      if (match) lunation = linkFor(match, facts.subtype === 'solar'
        ? 'This eclipse is that day\'s new moon, crossing the Sun'
        : 'This eclipse is that day\'s full moon, entering Earth\'s shadow');
    }
    if (facts.family === 'lunation') {
      const wanted = facts.subtype === 'new' ? 'solar' : 'lunar';
      const match = all.find((other) => other.family === 'eclipse'
        && other.subtype === wanted
        && Math.abs(anchor(other) - anchor(facts)) <= ECLIPSE_MATCH_MS);
      if (match) eclipse = linkFor(match, facts.subtype === 'new'
        ? 'This new moon is also a solar eclipse. The fuller story is there'
        : 'This full moon is also a lunar eclipse. The fuller story is there');
    }

    // Nearby: dated moments within the window, closest first, capped at
    // three, never the event itself or its own stations. Retrograde CYCLES
    // are excluded — their stations are the precise nearby moments, and a
    // cycle's span-start would only ever duplicate its own station row.
    // The paired eclipse/lunation already has its cross-reference card, so
    // it never repeats here.
    const paired = new Set([lunation?.id, eclipse?.id].filter(Boolean));
    const nearby = all
      .filter((other) => other !== facts)
      .filter((other) => other.family !== 'retrograde')
      .filter((other) => !paired.has(other.id))
      .filter((other) => !(other.family === 'station' && facts.family === 'retrograde' && other.bodies[0] === facts.bodies[0]))
      .filter((other) => Math.abs(anchor(other) - anchor(facts)) <= NEARBY_WINDOW_MS)
      .sort((a, b) => Math.abs(anchor(a) - anchor(facts)) - Math.abs(anchor(b) - anchor(facts)))
      .slice(0, 3)
      .map((other) => linkFor(other, nearbyReason(facts, other)));

    // Stations point back to their cycle page.
    let cycle: EventLink | undefined;
    if (facts.family === 'station') {
      const window = retroWindows.find((rx) => rx.planet === facts.bodies[0]
        && (rx.from === facts.at || rx.to === facts.at));
      if (window) {
        cycle = {
          id: retrogradeId(facts.bodies[0], window.from),
          reason: 'The retrograde cycle this station belongs to',
        };
      }
    }

    const interpretation = interpretationFor(facts);
    const published = publishedEventById.get(facts.id);
    // The committed publication receipt is the only indexing allowlist. A
    // matching ID alone is insufficient: if a fact changes, verification must
    // regenerate and review the receipt before that page can remain public.
    const indexEligible = Boolean(
      interpretation
      && published
      && published.path === facts.path
      && published.title === facts.title
      && published.anchor === (facts.at ?? facts.start),
    );

    return {
      facts,
      relations: {
        previous: previous && hasPage(previous)
          ? linkFor(previous, comparableReason(facts, 'previous'))
          : undefined,
        next: next && hasPage(next)
          ? linkFor(next, comparableReason(facts, 'next'))
          : undefined,
        nearby,
        lunation,
        eclipse,
        cycle,
      },
      interpretation,
      indexEligible,
      lastModified: indexEligible ? published?.lastModified : facts.provenance.generatedAt,
    };
  });

  const fixtures: CatalogEvent[] = FIXTURE_EVENTS.map((fixture) => ({
    ...fixture,
    indexEligible: false,
    fixture: true,
  }));

  const byId = new Map<string, CatalogEvent>();
  for (const event of [...events, ...fixtures]) byId.set(event.facts.id, event);

  return {
    events,
    pages: events.filter((event) => hasPage(event.facts)),
    fixtures,
    byId,
    range: { from: sky.from, to: sky.to },
  };
}

let cached: EventsCatalog | null = null;

/** The unified events catalog (memoized per build). */
export function eventsCatalog(): EventsCatalog {
  if (!cached) cached = buildCatalog();
  return cached;
}
