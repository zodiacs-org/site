/**
 * Builders for every sky data API payload. Each one is a pure reshaping of
 * committed source data (src/data/daily.json, sky.json, eclipses.json, and
 * the monthly transits-YYYY-MM.json snapshots) plus fixed-template labels,
 * so the API can never disagree with the pages built from the same files.
 */
import { SIGNS } from '../signs';
import {
  API_BASE, API_ORIGIN, CONVENTIONS, PLANET_NAMES, PLANET_SLUGS,
  envelope, schemaUrl,
} from './meta';
import type { PlanetSlug } from './meta';
import {
  capitalize, formatDay, formatDayLong, formatClock, formatInstant, formatPosition,
  fullMoonNames, listPhrase, moonLabel, percent, plural, signGlyphOf, signNameOf,
} from './format';
import type {
  AspectSource, DailyBody, DailyEvent, DailyFacts, EclipseData, EclipseSource,
  IngressSource, LunationInstant, RetrogradeWindowSource, SkyApiSources, SkyData,
  StationSource, TransitMonth,
} from './types';

export const LUNATION_JOIN_TOLERANCE_MS = 60 * 1000;
export const STATION_JOIN_TOLERANCE_MS = 24 * 60 * 60 * 1000;
export const UPCOMING_WINDOW_DAYS = 60;
const DAY_MS = 86_400_000;

type Payload = Record<string, unknown>;

// ---- time helpers ------------------------------------------------------------

export function isoDay(value: string): string {
  return String(value).slice(0, 10);
}

export function yearWindow(year: number): { from: number; to: number } {
  return { from: Date.UTC(year, 0, 1), to: Date.UTC(year + 1, 0, 1) };
}

export function inYear(instant: string, year: number): boolean {
  const at = Date.parse(instant);
  const { from, to } = yearWindow(year);
  return at >= from && at < to;
}

function byAt<T extends { at: string }>(items: readonly T[]): T[] {
  return items.slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function after<T extends { at: string }>(items: readonly T[], instant: string): T[] {
  const cutoff = Date.parse(instant);
  return byAt(items).filter((item) => Date.parse(item.at) > cutoff);
}

function daysBetween(from: string, to: string): number {
  return Math.round(((Date.parse(to) - Date.parse(from)) / DAY_MS) * 10) / 10;
}

/** Calendar years whose twelve monthly transit snapshots are all committed. */
export function completeTransitYears(monthKeys: readonly string[]): number[] {
  const byYear = new Map<number, number>();
  for (const key of monthKeys) {
    const year = Number(key.slice(0, 4));
    byYear.set(year, (byYear.get(year) ?? 0) + 1);
  }
  return [...byYear.entries()]
    .filter(([, count]) => count === 12)
    .map(([year]) => year)
    .sort((a, b) => a - b);
}

/** The subset of years that a scan horizon covers in full. */
export function yearsWithin(years: readonly number[], from: string, to: string): number[] {
  const start = Date.parse(from);
  const end = Date.parse(to);
  return years.filter((year) => yearWindow(year).from >= start && yearWindow(year).to <= end);
}

export function dataVintage(sky: SkyData, eclipses: EclipseData): string {
  return [sky.generatedAt, eclipses.generatedAt].sort().at(-1) as string;
}

// ---- lunations ---------------------------------------------------------------

export interface LunationRecord {
  type: 'full' | 'new';
  at: string;
  sign?: string;
  signName?: string;
  degree?: number;
  name?: string;
  label: string;
}

/**
 * Sign and degree for a canonical sky.json lunation instant, taken from the
 * nearest monthly-snapshot record of the same type. The two generators agree
 * to within a minute; the tolerance exists so a record that straddles a UTC
 * day boundary can never silently lose its sign.
 */
export function joinLunationDetail(
  moon: LunationInstant,
  months: readonly TransitMonth[],
  tolerance = LUNATION_JOIN_TOLERANCE_MS,
): { sign: string; degree: number } | null {
  const target = Date.parse(moon.at);
  let best: { sign: string; degree: number } | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const month of months) {
    for (const lunation of month.lunations) {
      if (lunation.type !== moon.type) continue;
      const delta = Math.abs(Date.parse(lunation.at) - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = { sign: lunation.sign, degree: lunation.degree };
      }
    }
  }
  return best && bestDelta <= tolerance ? best : null;
}

export function lunationRecords(sky: SkyData, months: readonly TransitMonth[]): LunationRecord[] {
  const names = fullMoonNames(sky.moons);
  return byAt(sky.moons).map((moon) => {
    const detail = joinLunationDetail(moon, months);
    const name = moon.type === 'full' ? names.get(moon.at) : undefined;
    const phase = moon.type === 'full' ? 'Full Moon' : 'New Moon';
    const where = detail ? ` in ${signNameOf(detail.sign)}` : '';
    const suffix = name ? ` — ${moonLabel(name)}` : '';
    return {
      type: moon.type,
      at: moon.at,
      ...(detail ? { sign: detail.sign, signName: signNameOf(detail.sign), degree: detail.degree } : {}),
      ...(name ? { name } : {}),
      label: `${phase}${where}${suffix}`,
    };
  });
}

// ---- retrograde windows --------------------------------------------------------

export interface RetrogradeWindow {
  planet: string;
  from: string;
  to: string;
  preShadowStart: string | null;
  postShadowEnd: string | null;
  clippedStart: boolean;
  clippedEnd: boolean;
  stationRetrograde: string | null;
  stationDirect: string | null;
  stationRetrogradeSign: string | null;
  stationDirectSign: string | null;
  durationDays: number | null;
  label: string;
}

function nearestStation(
  planet: string,
  type: 'direct' | 'retrograde',
  at: string,
  months: readonly TransitMonth[],
): StationSource | null {
  const target = Date.parse(at);
  let best: StationSource | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const month of months) {
    for (const station of month.stations) {
      if (station.planet !== planet || station.type !== type) continue;
      const delta = Math.abs(Date.parse(station.at) - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = station;
      }
    }
  }
  return best && bestDelta <= STATION_JOIN_TOLERANCE_MS ? best : null;
}

/**
 * A retrograde window as the API publishes it. sky.json scans a fixed span,
 * so a window already in progress at the scan start (or still running at
 * its end) is truncated there; those boundaries are flagged rather than
 * presented as stations.
 */
export function normalizeWindow(
  window: RetrogradeWindowSource,
  sky: SkyData,
  months: readonly TransitMonth[],
): RetrogradeWindow {
  const clippedStart = window.from === sky.from;
  const clippedEnd = window.to === sky.to || window.to === sky.stationBoundaryScanTo;
  const retrograde = clippedStart ? null : nearestStation(window.planet, 'retrograde', window.from, months);
  const direct = clippedEnd ? null : nearestStation(window.planet, 'direct', window.to, months);
  const startSign = retrograde?.sign ?? null;
  const endSign = direct?.sign ?? null;

  let where = '';
  if (startSign && endSign) {
    where = startSign === endSign
      ? ` in ${signNameOf(startSign)}`
      : ` from ${signNameOf(startSign)} back into ${signNameOf(endSign)}`;
  } else if (startSign || endSign) {
    where = ` in ${signNameOf((startSign ?? endSign) as string)}`;
  }

  let range: string;
  if (clippedStart && clippedEnd) {
    range = `throughout ${formatDay(sky.from)} – ${formatDay(sky.to)} (both stations lie outside coverage)`;
  } else if (clippedStart) {
    range = `until ${formatDay(window.to)} (the retrograde station falls before coverage begins on ${formatDay(sky.from)})`;
  } else if (clippedEnd) {
    range = `from ${formatDay(window.from)} (the direct station falls after coverage ends)`;
  } else {
    range = `${formatDay(window.from)} – ${formatDay(window.to)}`;
  }

  return {
    planet: window.planet,
    from: window.from,
    to: window.to,
    preShadowStart: window.preShadowStart,
    postShadowEnd: window.postShadowEnd,
    clippedStart,
    clippedEnd,
    stationRetrograde: clippedStart ? null : window.from,
    stationDirect: clippedEnd ? null : window.to,
    stationRetrogradeSign: startSign,
    stationDirectSign: endSign,
    durationDays: clippedStart || clippedEnd ? null : daysBetween(window.from, window.to),
    label: `${window.planet} retrograde${where}, ${range}`,
  };
}

export function windowsFor(planet: string, sky: SkyData, months: readonly TransitMonth[]): RetrogradeWindow[] {
  return sky.retrogrades
    .filter((window) => window.planet === planet)
    .slice()
    .sort((a, b) => Date.parse(a.from) - Date.parse(b.from))
    .map((window) => normalizeWindow(window, sky, months));
}

export function activeWindows(sky: SkyData, months: readonly TransitMonth[], instant: string): RetrogradeWindow[] {
  const at = Date.parse(instant);
  return sky.retrogrades
    .filter((window) => Date.parse(window.from) <= at && at < Date.parse(window.to))
    .map((window) => normalizeWindow(window, sky, months));
}

// ---- labels ----------------------------------------------------------------------

const ASPECT_VERBS: Record<string, string> = {
  conjunction: 'conjunct',
  opposition: 'opposite',
};

export function aspectLabel(aspect: Pick<AspectSource, 'a' | 'b' | 'type'>): string {
  return `${aspect.a} ${ASPECT_VERBS[aspect.type] ?? aspect.type} ${aspect.b}`;
}

export function ingressLabel(ingress: IngressSource): string {
  return `${ingress.planet} enters ${signNameOf(ingress.sign)}${ingress.retrograde ? ' (retrograde)' : ''}`;
}

export function stationLabel(station: StationSource): string {
  return `${station.planet} stations ${station.type} in ${signNameOf(station.sign)}`;
}

export function eclipseLabel(eclipse: EclipseSource): string {
  return `${capitalize(eclipse.kind)} ${eclipse.type} eclipse in ${signNameOf(eclipse.sign)}`;
}

function eventLabel(event: DailyEvent): string {
  switch (event.kind) {
    case 'aspect':
      return aspectLabel(event as unknown as AspectSource);
    case 'ingress':
      return ingressLabel(event as unknown as IngressSource);
    case 'station':
      return stationLabel(event as unknown as StationSource);
    case 'lunation': {
      const lunation = event as unknown as { type: string; sign?: string };
      const phase = lunation.type === 'full' ? 'Full Moon' : 'New Moon';
      return lunation.sign ? `${phase} in ${signNameOf(lunation.sign)}` : phase;
    }
    default:
      return event.kind;
  }
}

function describeBody(body: DailyBody): Payload {
  return {
    ...body,
    signName: signNameOf(body.sign),
    glyph: signGlyphOf(body.sign),
    position: formatPosition(body.lon),
  };
}

function describeLunation(record: LunationRecord, from: string): Payload {
  return { ...record, daysAway: daysBetween(from, record.at), when: formatInstant(record.at) };
}

// ---- today -----------------------------------------------------------------------

export function buildToday(
  { daily, sky, months, generatedAt }: { daily: DailyFacts; sky: SkyData; months: readonly TransitMonth[]; generatedAt: string },
): Payload {
  const year = Number(daily.date.slice(0, 4));
  const lunations = lunationRecords(sky, months);
  const upcoming = after(lunations, daily.snapshotAt);
  const nextFull = upcoming.find((moon) => moon.type === 'full') ?? null;
  const nextNew = upcoming.find((moon) => moon.type === 'new') ?? null;
  const retrogrades = activeWindows(sky, months, daily.snapshotAt);
  const bodies = daily.bodies.map(describeBody);
  const sun = daily.bodies.find((body) => body.body === 'Sun');
  const moon = daily.bodies.find((body) => body.body === 'Moon');
  const retroNames = retrogrades.map((window) => window.planet);

  const sentences = [
    `${formatDayLong(daily.date)}, snapshot at ${formatClock(daily.snapshotAt)}.`,
    sun ? `The Sun is at ${formatPosition(sun.lon)}.` : '',
    moon
      ? `The Moon is ${daily.moon.phase.toLowerCase()}, ${percent(daily.moon.illumination)}% illuminated, at ${formatPosition(moon.lon)}.`
      : '',
    retroNames.length
      ? `${listPhrase(retroNames)} ${retroNames.length === 1 ? 'is' : 'are'} retrograde.`
      : 'No planets are retrograde.',
    nextNew ? `Next new moon: ${formatDay(nextNew.at)}${nextNew.signName ? ` in ${nextNew.signName}` : ''}.` : '',
    nextFull
      ? `Next full moon: ${formatDay(nextFull.at)}${nextFull.signName ? ` in ${nextFull.signName}` : ''}${nextFull.name ? ` (${moonLabel(nextFull.name)})` : ''}.`
      : '',
    daily.events.length ? `${plural(daily.events.length, 'exact event')} today: ${daily.events.map(eventLabel).join('; ')}.` : '',
  ].filter(Boolean);

  return {
    ...envelope('today', generatedAt),
    date: daily.date,
    snapshotAt: daily.snapshotAt,
    summary: sentences.join(' '),
    positions: CONVENTIONS.positions,
    bodies,
    moon: {
      ...daily.moon,
      illuminationPercent: percent(daily.moon.illumination),
      nextFullMoon: nextFull ? describeLunation(nextFull, daily.snapshotAt) : null,
      nextNewMoon: nextNew ? describeLunation(nextNew, daily.snapshotAt) : null,
    },
    retrogrades,
    eventsCoverage: daily.eventsCoverage,
    events: daily.events.map((event) => ({ ...event, label: eventLabel(event) })),
    about: {
      snapshot: 'Positions are computed for 12:00 UTC of the edition date (snapshotAt). Daily publication is scheduled from 00:00 UTC; delivery can be delayed. Check date before treating this as the current edition; generatedAt is the file build time.',
      ...CONVENTIONS,
      retrogradeWindows: 'retrogrades lists the windows active at the snapshot. from/to are the retrograde and direct station instants unless clippedStart/clippedEnd is true, in which case the scan boundary truncated the window and the real station lies outside coverage.',
      events: 'events are the exact instants of aspects, ingresses, stations, and lunations falling on this UTC date; eventsCoverage says whether the month\'s event data was complete.',
    },
    links: {
      upcoming: `${API_BASE}/sky/upcoming.json`,
      retrogradesThisYear: `${API_BASE}/retrogrades/${year}.json`,
      moonPhasesThisYear: `${API_BASE}/moon-phases/${year}.json`,
      planets: Object.fromEntries(PLANET_SLUGS.map((slug) => [slug, `${API_BASE}/planets/${slug}.json`])),
      signs: `${API_BASE}/signs.json`,
      markdown: `${API_BASE}/sky/today.md`,
    },
  };
}

// ---- upcoming --------------------------------------------------------------------

export interface UpcomingEvent {
  kind: 'lunation' | 'ingress' | 'station' | 'eclipse' | 'aspect';
  at: string;
  when: string;
  daysAway: number;
  label: string;
  [key: string]: unknown;
}

function upcomingFrom(
  sources: Pick<SkyApiSources, 'sky' | 'eclipses' | 'months'>,
  instant: string,
): UpcomingEvent[] {
  const { sky, eclipses, months } = sources;
  // The event's own fields go first so the API's kind/at/when/daysAway/label
  // always win (an eclipse record carries its own `kind`, exposed as eclipseKind).
  const tagged = <T extends { at: string }>(kind: UpcomingEvent['kind'], item: T, label: string): UpcomingEvent => ({
    ...item,
    kind,
    at: item.at,
    when: formatInstant(item.at),
    daysAway: daysBetween(instant, item.at),
    label,
  });
  const events: UpcomingEvent[] = [
    ...lunationRecords(sky, months).map((record) => tagged('lunation', record, record.label)),
    ...months.flatMap((month) => month.ingresses).map((ingress) => tagged('ingress', { ...ingress, signName: signNameOf(ingress.sign) }, ingressLabel(ingress))),
    ...months.flatMap((month) => month.stations).map((station) => tagged('station', { ...station, signName: signNameOf(station.sign) }, stationLabel(station))),
    ...eclipses.eclipses.map(({ kind: eclipseKind, ...eclipse }) => tagged('eclipse', { ...eclipse, eclipseKind, at: eclipse.peak, signName: signNameOf(eclipse.sign) }, eclipseLabel({ ...eclipse, kind: eclipseKind }))),
    ...months.flatMap((month) => month.aspects).map((aspect) => tagged('aspect', { ...aspect }, aspectLabel(aspect))),
  ];
  return after(events, instant);
}

export function buildUpcoming(
  { daily, sky, eclipses, months, generatedAt, windowDays = UPCOMING_WINDOW_DAYS }:
  SkyApiSources & { generatedAt: string; windowDays?: number },
): Payload {
  const from = daily.snapshotAt;
  const to = new Date(Date.parse(from) + windowDays * DAY_MS).toISOString();
  const all = upcomingFrom({ sky, eclipses, months }, from);
  const within = all.filter((event) => Date.parse(event.at) <= Date.parse(to));
  const first = (predicate: (event: UpcomingEvent) => boolean) => all.find(predicate) ?? null;

  const mercury = windowsFor('Mercury', sky, months);
  const at = Date.parse(from);
  const mercuryCurrent = mercury.find((window) => Date.parse(window.from) <= at && at < Date.parse(window.to)) ?? null;
  const mercuryNext = mercury.find((window) => Date.parse(window.from) > at) ?? null;

  const nextByKind = {
    nextNewMoon: first((event) => event.kind === 'lunation' && event.type === 'new'),
    nextFullMoon: first((event) => event.kind === 'lunation' && event.type === 'full'),
    nextSolarEclipse: first((event) => event.kind === 'eclipse' && event.type === 'solar'),
    nextLunarEclipse: first((event) => event.kind === 'eclipse' && event.type === 'lunar'),
    nextIngress: first((event) => event.kind === 'ingress'),
    nextSunIngress: first((event) => event.kind === 'ingress' && event.planet === 'Sun'),
    nextStation: first((event) => event.kind === 'station'),
    mercuryRetrograde: { current: mercuryCurrent, next: mercuryNext },
  };

  const counts = Object.fromEntries(
    (['lunation', 'ingress', 'station', 'eclipse', 'aspect'] as const)
      .map((kind) => [kind, within.filter((event) => event.kind === kind).length]),
  );
  const headline = within.filter((event) => event.kind !== 'aspect').slice(0, 5);
  const summary = [
    `The ${windowDays} days from ${formatDay(from)} hold ${plural(counts.lunation, 'lunation')}, ${plural(counts.ingress, 'sign ingress', 'sign ingresses')}, ${plural(counts.station, 'station')}, ${plural(counts.eclipse, 'eclipse')}, and ${plural(counts.aspect, 'exact aspect')}.`,
    headline.length ? `Next: ${headline.map((event) => `${event.label} (${formatDay(event.at)})`).join('; ')}.` : '',
    mercuryCurrent
      ? `Mercury is retrograde now, ${mercuryCurrent.label}.`
      : mercuryNext ? `Next Mercury retrograde: ${mercuryNext.label}.` : '',
  ].filter(Boolean).join(' ');

  return {
    ...envelope('upcoming', generatedAt),
    from,
    to,
    windowDays,
    summary,
    counts,
    nextByKind,
    events: within,
    about: {
      window: 'events lists every lunation, sign ingress, station, eclipse peak, and exact aspect between from and to, in chronological order; eclipse events carry eclipseKind (total, annular, partial, penumbral). nextByKind looks past the window to the first occurrence of each kind.',
      ...CONVENTIONS,
      mercuryRetrograde: 'mercuryRetrograde.current is the window active at from, or null; next is the first window starting after it.',
    },
    links: {
      today: `${API_BASE}/sky/today.json`,
      markdown: `${API_BASE}/sky/upcoming.md`,
      signs: `${API_BASE}/signs.json`,
    },
  };
}

// ---- year files ------------------------------------------------------------------

/** The per-year families, as their directory names under /api/v1/. */
export const YEAR_FAMILIES = Object.freeze(['retrogrades', 'stations', 'ingresses', 'moon-phases', 'eclipses', 'aspects'] as const);
export type YearFamily = typeof YEAR_FAMILIES[number];

const camel = (name: string) => name.replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());

/**
 * The related files for one yearly payload: the index, the same family's
 * previous and next year, and the other families' files for the same year.
 * A link is present only when the API writes that file, so every link
 * resolves; `coverage` is the list of years each family is written for.
 */
export function yearLinks(family: YearFamily, year: number, coverage: Readonly<Record<YearFamily, readonly number[]>>): Payload {
  const fileUrl = (name: string, value: number) => `${API_BASE}/${name}/${value}.json`;
  const own = coverage[family];
  return {
    index: `${API_BASE}/index.json`,
    ...(own.includes(year - 1) ? { previousYear: fileUrl(family, year - 1) } : {}),
    ...(own.includes(year + 1) ? { nextYear: fileUrl(family, year + 1) } : {}),
    sameYear: Object.fromEntries(YEAR_FAMILIES
      .filter((name) => name !== family && coverage[name].includes(year))
      .map((name) => [camel(name), fileUrl(name, year)])),
  };
}

function yearEnvelope(name: string, year: number, generatedAt: string, note: string): Payload {
  return {
    ...envelope(name, generatedAt),
    year,
    coverage: { from: new Date(yearWindow(year).from).toISOString(), to: new Date(yearWindow(year).to).toISOString() },
    about: { year: note, ...CONVENTIONS },
  };
}

export function buildRetrogradeYear(sky: SkyData, months: readonly TransitMonth[], year: number, generatedAt: string): Payload {
  const { from, to } = yearWindow(year);
  const retrogrades = sky.retrogrades
    .filter((window) => Date.parse(window.from) < to && Date.parse(window.to) > from)
    .map((window) => normalizeWindow(window, sky, months));
  const perPlanet = new Map<string, number>();
  for (const window of retrogrades) perPlanet.set(window.planet, (perPlanet.get(window.planet) ?? 0) + 1);
  const summary = `${plural(retrogrades.length, 'retrograde window')} intersect ${year}: ${
    [...perPlanet.entries()].map(([planet, count]) => `${planet}${count > 1 ? ` ×${count}` : ''}`).join(', ')
  }. ${retrogrades.map((window) => window.label).join('; ')}.`;
  return {
    ...yearEnvelope('retrogrades', year, generatedAt,
      'Windows intersecting the year; a window crossing January 1 appears in both adjacent years. from/to are the retrograde and direct stations unless clippedStart/clippedEnd is true, in which case the scan boundary truncated the window and the real station lies outside coverage. preShadowStart/postShadowEnd are where the body first and last occupies the retrograde arc, when the scan resolved them.'),
    summary,
    retrogrades,
  };
}

export function buildIngressYear(months: readonly TransitMonth[], year: number, generatedAt: string): Payload {
  const ingresses = byAt(months
    .filter((month) => month.month.startsWith(`${year}-`))
    .flatMap((month) => month.ingresses))
    .map((ingress) => ({ ...ingress, signName: signNameOf(ingress.sign), label: ingressLabel(ingress) }));
  return {
    ...yearEnvelope('ingresses', year, generatedAt,
      'Every instant a body crosses into a new sign during the year. retrograde is true when it entered moving backward, so the same sign boundary can be crossed more than once.'),
    summary: `${plural(ingresses.length, 'sign ingress', 'sign ingresses')} in ${year}, from ${ingresses[0]?.label ?? '—'} (${formatDay(ingresses[0]?.at ?? '')}) to ${ingresses.at(-1)?.label ?? '—'} (${formatDay(ingresses.at(-1)?.at ?? '')}).`,
    ingresses,
  };
}

export function buildMoonPhaseYear(sky: SkyData, months: readonly TransitMonth[], year: number, generatedAt: string): Payload {
  const lunations = lunationRecords(sky, months).filter((moon) => inYear(moon.at, year));
  const fulls = lunations.filter((moon) => moon.type === 'full');
  const blue = fulls.filter((moon) => moon.name === 'Blue');
  return {
    ...yearEnvelope('moon-phases', year, generatedAt,
      'Exact new and full moon instants. Full moons carry the traditional North American almanac name for their month; a second full moon in one UTC calendar month is named Blue.'),
    summary: `${plural(fulls.length, 'full moon')} and ${plural(lunations.length - fulls.length, 'new moon')} in ${year}${blue.length ? `, including ${plural(blue.length, 'blue moon')} (${blue.map((moon) => formatDay(moon.at)).join(', ')})` : ''}.`,
    lunations,
  };
}

export function buildEclipseYear(eclipseData: EclipseData, year: number, generatedAt: string): Payload {
  const eclipses = eclipseData.eclipses
    .filter((eclipse) => inYear(eclipse.peak, year))
    .map((eclipse) => ({ ...eclipse, signName: signNameOf(eclipse.sign), label: eclipseLabel(eclipse) }));
  return {
    ...yearEnvelope('eclipses', year, generatedAt,
      'Solar and lunar eclipses by the instant of greatest eclipse. obscuration is the fraction of the disc covered at maximum and is omitted where the source catalog does not resolve it; totalMinutes is the length of totality for total lunar eclipses.'),
    summary: `${plural(eclipses.length, 'eclipse')} in ${year}: ${eclipses.map((eclipse) => `${eclipse.label} on ${formatDay(eclipse.peak)}`).join('; ')}.`,
    eclipses,
  };
}

export function buildAspectYear(months: readonly TransitMonth[], year: number, generatedAt: string): Payload {
  const aspects = byAt(months
    .filter((month) => month.month.startsWith(`${year}-`))
    .flatMap((month) => month.aspects))
    .map((aspect) => ({ ...aspect, aSignName: signNameOf(aspect.aSign), bSignName: signNameOf(aspect.bSign), label: aspectLabel(aspect) }));
  return {
    ...yearEnvelope('aspects', year, generatedAt,
      'Exact aspects between the Sun and planets during the year: the instant the angular distance equals the aspect exactly (orb 0). Lunar aspects are not included.'),
    summary: `${plural(aspects.length, 'exact aspect')} in ${year}.`,
    aspects,
  };
}

export function buildStationYear(months: readonly TransitMonth[], year: number, generatedAt: string): Payload {
  const stations = byAt(months
    .filter((month) => month.month.startsWith(`${year}-`))
    .flatMap((month) => month.stations))
    .map((station) => ({ ...station, signName: signNameOf(station.sign), label: stationLabel(station) }));
  return {
    ...yearEnvelope('stations', year, generatedAt,
      'Every instant a planet stations — turns retrograde or direct — during the year, with its sign and degree at the station.'),
    summary: `${plural(stations.length, 'station')} in ${year}: ${stations.map((station) => `${station.label} (${formatDay(station.at)})`).join('; ')}.`,
    stations,
  };
}

// ---- planets -----------------------------------------------------------------------

export function buildPlanet(
  { slug, daily, sky, months, generatedAt }:
  { slug: PlanetSlug; daily: DailyFacts; sky: SkyData; months: readonly TransitMonth[]; generatedAt: string },
): Payload {
  const name = PLANET_NAMES[slug];
  const body = daily.bodies.find((candidate) => candidate.body === name);
  if (!body) throw new Error(`Daily snapshot has no ${name}`);
  const applicable = slug !== 'sun' && slug !== 'moon';
  const windows = applicable ? windowsFor(name, sky, months) : [];
  const at = Date.parse(daily.snapshotAt);
  const current = windows.find((window) => Date.parse(window.from) <= at && at < Date.parse(window.to)) ?? null;
  const next = windows.find((window) => Date.parse(window.from) > at) ?? null;
  const nextIngress = after(months.flatMap((month) => month.ingresses).filter((ingress) => ingress.planet === name), daily.snapshotAt)[0] ?? null;
  const nextStation = after(months.flatMap((month) => month.stations).filter((station) => station.planet === name), daily.snapshotAt)[0] ?? null;

  const motion = !applicable
    ? ''
    : current
      ? ` and retrograde (${current.label})`
      : ' and direct';
  const summary = [
    `${name} is at ${formatPosition(body.lon)}${motion}.`,
    nextIngress ? `It next enters ${signNameOf(nextIngress.sign)} on ${formatInstant(nextIngress.at)}.` : '',
    applicable && !current && next ? `Its next retrograde: ${next.label}.` : '',
    applicable && current && nextStation ? `It stations ${nextStation.type} on ${formatInstant(nextStation.at)}.` : '',
  ].filter(Boolean).join(' ');

  return {
    ...envelope('planet', generatedAt),
    planet: name,
    slug,
    date: daily.date,
    snapshotAt: daily.snapshotAt,
    summary,
    now: describeBody(body),
    retrograde: {
      applicable,
      active: Boolean(current),
      current,
      next,
      windows,
    },
    nextIngress: nextIngress ? { ...nextIngress, signName: signNameOf(nextIngress.sign), label: ingressLabel(nextIngress), when: formatInstant(nextIngress.at) } : null,
    nextStation: nextStation ? { ...nextStation, signName: signNameOf(nextStation.sign), label: stationLabel(nextStation), when: formatInstant(nextStation.at) } : null,
    about: {
      ...CONVENTIONS,
      now: 'now is this body\'s position at snapshotAt, from the same daily snapshot as sky/today.json.',
      retrogradeWindows: 'retrograde.windows lists every window across the data horizon; current is the one active at snapshotAt, next the first one that starts after it. The Sun and Moon never retrograde (applicable false).',
    },
    links: {
      today: `${API_BASE}/sky/today.json`,
      upcoming: `${API_BASE}/sky/upcoming.json`,
      retrogradesThisYear: `${API_BASE}/retrogrades/${daily.date.slice(0, 4)}.json`,
    },
  };
}

// ---- signs -----------------------------------------------------------------------

export function buildSigns(
  { daily, months, generatedAt }: { daily: DailyFacts; months: readonly TransitMonth[]; generatedAt: string },
): Payload {
  const year = Number(daily.date.slice(0, 4));
  const sunIngresses = byAt(months.flatMap((month) => month.ingresses).filter((ingress) => ingress.planet === 'Sun'));
  const signs = SIGNS.map((sign) => {
    const occupants = daily.bodies.filter((body) => body.sign === sign.slug).map((body) => body.body);
    const startIndex = sunIngresses.findIndex((ingress) => ingress.sign === sign.slug && inYear(ingress.at, year));
    const start = startIndex >= 0 ? sunIngresses[startIndex] : null;
    const end = startIndex >= 0 ? sunIngresses[startIndex + 1] ?? null : null;
    return {
      slug: sign.slug,
      name: sign.name,
      glyph: sign.glyph,
      element: sign.element,
      modality: sign.modality,
      ruler: sign.ruler,
      ...(sign.classicRuler ? { classicRuler: sign.classicRuler } : {}),
      polarity: sign.polarity,
      house: sign.house,
      dates: sign.dates,
      essence: sign.essence,
      longitudeRange: { from: SIGNS.indexOf(sign) * 30, to: SIGNS.indexOf(sign) * 30 + 30 },
      sunSeason: start ? {
        year,
        from: start.at,
        to: end?.at ?? null,
        label: `The Sun is in ${sign.name} from ${formatInstant(start.at)}${end ? ` to ${formatInstant(end.at)}` : ''}`,
      } : null,
      occupantsNow: occupants,
      summary: `${sign.name} (${sign.glyph}) is a ${sign.modality} ${sign.element} sign ruled by ${sign.ruler}${sign.classicRuler ? ` (traditionally ${sign.classicRuler})` : ''}, ${sign.dates}. ${occupants.length ? `${listPhrase(occupants)} ${occupants.length === 1 ? 'is' : 'are'} in ${sign.name} on ${formatDay(daily.date)}.` : `No bodies are in ${sign.name} on ${formatDay(daily.date)}.`}`,
    };
  });
  return {
    ...envelope('signs', generatedAt),
    date: daily.date,
    snapshotAt: daily.snapshotAt,
    summary: `The twelve tropical signs with their elements, modalities, rulers, computed Sun seasons for ${year}, and which bodies occupy each sign at the ${formatDay(daily.date)} snapshot.`,
    signs,
    about: {
      sunSeason: 'sunSeason is the computed span the Sun spends in the sign this year, from its ingress instant to the next ingress; dates is the conventional calendar approximation.',
      longitudeRange: 'Each sign spans 30° of ecliptic longitude starting at longitudeRange.from.',
      occupantsNow: 'Bodies whose position at snapshotAt falls in the sign, from the same daily snapshot as sky/today.json.',
      ...CONVENTIONS,
    },
    links: {
      today: `${API_BASE}/sky/today.json`,
      guides: Object.fromEntries(SIGNS.map((sign) => [sign.slug, `${API_ORIGIN}/${sign.slug}/`])),
    },
  };
}

// ---- index ------------------------------------------------------------------------

export interface IndexEntry {
  path: string;
  description: string;
  updates: string;
  schema: string;
}

export interface DocumentEntry {
  path: string;
  description: string;
  contentType: string;
}

export function buildIndex(
  { transitYears, skyYears, eclipseYears, dailyDate, vintage, generatedAt, schemaNames }:
  { transitYears: number[]; skyYears: number[]; eclipseYears: number[]; dailyDate: string; vintage: string; generatedAt: string; schemaNames: readonly string[] },
): Payload {
  const perYear = (family: string, schema: string, description: string, years: number[]): IndexEntry[] => years.map((year) => ({
    path: `/api/v1/${family}/${year}.json`,
    description: `${description} · ${year}`,
    updates: 'when the underlying yearly data is refreshed',
    schema: schemaUrl(schema),
  }));
  const daily = 'daily, scheduled from 00:00 UTC; delivery can be delayed, so check the payload edition date';
  const endpoints: IndexEntry[] = [
    { path: '/api/v1/sky/today.json', description: "Today's positions, moon phase, active retrogrades, next lunations, and exact sky events, with a plain-language summary", updates: daily, schema: schemaUrl('today') },
    { path: '/api/v1/sky/upcoming.json', description: `The next ${UPCOMING_WINDOW_DAYS} days of lunations, ingresses, stations, eclipses, and exact aspects, plus the next occurrence of each kind`, updates: daily, schema: schemaUrl('upcoming') },
    { path: '/api/v1/signs.json', description: 'The twelve signs: element, modality, rulers, computed Sun seasons, and current occupants', updates: daily, schema: schemaUrl('signs') },
    ...PLANET_SLUGS.map((slug) => ({
      path: `/api/v1/planets/${slug}.json`,
      description: `${PLANET_NAMES[slug]}: current position, retrograde status and windows, next ingress and station`,
      updates: daily,
      schema: schemaUrl('planet'),
    })),
    ...perYear('retrogrades', 'retrogrades', 'Retrograde windows with stations, shadow boundaries, and clipping flags', skyYears),
    ...perYear('stations', 'stations', 'Every station (turning retrograde or direct) with sign and degree', transitYears),
    ...perYear('ingresses', 'ingresses', 'Every planetary sign ingress', transitYears),
    ...perYear('moon-phases', 'moon-phases', 'New and full moon instants with signs and traditional names', skyYears),
    ...perYear('eclipses', 'eclipses', 'Solar and lunar eclipse peaks', eclipseYears),
    ...perYear('aspects', 'aspects', 'Exact planetary aspects', transitYears),
  ];
  const documents: DocumentEntry[] = [
    { path: '/api/v1/llms.txt', description: 'The guide for AI agents: every endpoint, every field, and which file answers which question', contentType: 'text/plain' },
    { path: '/api/v1/openapi.json', description: 'OpenAPI 3.1 description of the API with embedded JSON Schemas', contentType: 'application/json' },
    { path: '/api/v1/sky/today.md', description: "Today's sky rendered as Markdown", contentType: 'text/markdown' },
    { path: '/api/v1/sky/upcoming.md', description: 'The upcoming events rendered as Markdown', contentType: 'text/markdown' },
    ...schemaNames.map((name) => ({
      path: `/api/v1/schema/${name}.v1.json`,
      description: `JSON Schema (draft 2020-12) for zodiacs.sky-api.${name}.v1 payloads`,
      // What the host actually sends for a .json file; scripts/sky-api-headers.test.mjs holds the two together.
      contentType: 'application/json',
    })),
  ];
  return {
    ...envelope('index', generatedAt),
    api: `${API_BASE}/`,
    summary: `Free sky data as static JSON: today's sky and the next ${UPCOMING_WINDOW_DAYS} days, ten planet files, the twelve signs, and per-year retrogrades, stations, ingresses, moon phases, eclipses, and aspects for ${transitYears[0]}–${transitYears.at(-1)}. CC BY 4.0, no key, open CORS. Start with ${API_BASE}/llms.txt.`,
    versioning: CONVENTIONS.versioning,
    coverage: {
      dailyDate,
      years: { from: transitYears[0], to: transitYears.at(-1) },
      dataVintage: vintage,
    },
    endpoints,
    documents,
    about: CONVENTIONS,
    links: {
      guide: `${API_BASE}/llms.txt`,
      openapi: `${API_BASE}/openapi.json`,
      today: `${API_BASE}/sky/today.json`,
      upcoming: `${API_BASE}/sky/upcoming.json`,
    },
  };
}
