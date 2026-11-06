/**
 * The personal half of "Your 2027 sky": the dates the worker found (scan.ts)
 * and the committed eclipse and ingress tables, phrased as moments for one
 * chart. Engine-free; it runs on the main thread and in the tests, and it
 * never reads a birth date, time or place, only longitudes.
 */
import type { CatalogLocale } from '../i18n/core';
import type { TransitContact } from '../engine/transit-scan-core';
import type { EclipseRecord } from '../upcoming';
import { readingConfidence, readingDetail, type ReadingDetail } from '../../ai-tools/reading-confidence';
import { settledSignIndex, signIndexOf } from '../profile/settled-signs';
import { SIGNS } from '../signs';
import { yearSkyWords, type YearAspect } from './copy';
import { EDITION_YEAR, inYear, yearWindow } from './edition';
import { SLOW_PLANETS, signAt, type IngressWindowRecord } from './general';
import type { YearSkyScan } from './scan';
import type { MomentDate, YearMoment } from './types';

const DAY = 86_400_000;
/**
 * Passes of one retrograde loop sit within this many days of each other;
 * the next round of the same contact comes later than that.
 */
const LOOP_GAP_DAYS: Record<string, number> = { Venus: 150, Mars: 260 };
const SLOW_LOOP_GAP_DAYS = 300;
/** An eclipse touches a placement within this many degrees, on it or across from it. */
export const ECLIPSE_ORB = 3;

/** The chart as the page holds it: longitudes only. */
export interface YearNatal {
  bodies: readonly { body: string; lon: number }[];
  asc: number | null;
  mc: number | null;
  timeKnown: boolean;
}

export interface PersonalYear {
  year: number;
  timeKnown: boolean;
  /** "Reading confidence" detail tier the chart allows. */
  detail: ReadingDetail;
  moments: YearMoment[];
  allYear: YearMoment[];
  /** The few largest moments, in date order. */
  highlights: YearMoment[];
  /** Signs the chart settles, for the card and its ring. */
  signs: { sun: string | null; moon: string | null; rising: string | null };
}

const norm = (lon: number) => ((lon % 360) + 360) % 360;
const separation = (a: number, b: number) => {
  const d = Math.abs(norm(a) - norm(b));
  return d > 180 ? 360 - d : d;
};

const SLOW_WEIGHT: Record<string, Record<YearAspect, number>> = {
  Jupiter: { conjunction: 5, opposition: 4, square: 4, trine: 3 },
  Saturn: { conjunction: 6, opposition: 5, square: 5, trine: 3 },
  Uranus: { conjunction: 6, opposition: 6, square: 5, trine: 4 },
  Neptune: { conjunction: 6, opposition: 5, square: 5, trine: 4 },
  Pluto: { conjunction: 6, opposition: 6, square: 5, trine: 4 },
};

/** Exact passes of one body, point and aspect, split into retrograde loops. */
export function loopsOf(contacts: readonly TransitContact[]): TransitContact[][] {
  const groups = new Map<string, TransitContact[]>();
  for (const contact of [...contacts].sort((a, b) => a.exactUtc.localeCompare(b.exactUtc))) {
    const key = `${contact.transitBody}|${contact.natalPoint}|${contact.aspect}`;
    const list = groups.get(key) ?? [];
    list.push(contact);
    groups.set(key, list);
  }
  const loops: TransitContact[][] = [];
  for (const list of groups.values()) {
    let current: TransitContact[] = [];
    for (const contact of list) {
      const last = current.at(-1);
      const gap = LOOP_GAP_DAYS[contact.transitBody] ?? SLOW_LOOP_GAP_DAYS;
      if (last && Date.parse(contact.exactUtc) - Date.parse(last.exactUtc) > gap * DAY) {
        loops.push(current);
        current = [];
      }
      current.push(contact);
    }
    if (current.length) loops.push(current);
  }
  return loops;
}

function settledSign(body: string, lon: number | undefined | null, timeKnown: boolean): string | null {
  if (lon == null) return null;
  const index = settledSignIndex(body, lon, timeKnown);
  return index === null ? null : SIGNS[index].slug;
}

export function personalYear(
  scan: YearSkyScan,
  natal: YearNatal,
  tables: { eclipses: readonly EclipseRecord[]; ingresses: readonly IngressWindowRecord[] },
  locale: CatalogLocale = 'en',
): PersonalYear {
  const w = yearSkyWords(locale);
  const year = scan.year ?? EDITION_YEAR;
  const { from } = yearWindow(year);
  const timeKnown = natal.timeKnown;
  const detail = readingDetail({ hasDate: true, hasTime: timeKnown, hasPlace: true });
  const confidence = (tight: boolean) => readingConfidence(detail, tight);
  const lonOf = (body: string) => natal.bodies.find((b) => b.body === body)?.lon;
  const asc = timeKnown ? natal.asc : null;
  const mc = timeKnown ? natal.mc : null;
  const signs = {
    sun: settledSign('Sun', lonOf('Sun'), timeKnown),
    moon: timeKnown ? settledSign('Moon', lonOf('Moon'), true) : null,
    rising: asc != null ? SIGNS[signIndexOf(asc)].slug : null,
  };
  const days = (dates: string[]) => w.list(dates.map((at) => w.day(at, year)));
  const moments: YearMoment[] = [];

  // Solar return: timed, to the minute.
  for (const at of scan.solarReturns) {
    moments.push({
      id: `solar-return-${at}`,
      kind: 'solar-return',
      body: 'Sun',
      at,
      title: w.solarTitle,
      line: w.solarLine,
      detail: w.solarDetail(w.dayTime(at)),
      confidence: confidence(true),
      weight: 3,
      dates: [{ at, timed: true }],
    });
  }

  // Jupiter and Saturn returns, the Uranus opposition.
  const milestoneGroups = new Map<string, YearSkyScan['milestones']>();
  for (const pass of scan.milestones) {
    const key = `${pass.kind}-${pass.index}`;
    milestoneGroups.set(key, [...(milestoneGroups.get(key) ?? []), pass]);
  }
  for (const [key, passes] of milestoneGroups) {
    const first = passes[0];
    const total = first.passCount;
    moments.push({
      id: `milestone-${key}-${first.at}`,
      kind: 'milestone',
      body: first.kind === 'jupiter-return' ? 'Jupiter' : first.kind === 'saturn-return' ? 'Saturn' : 'Uranus',
      at: first.at,
      ...(passes.length > 1 ? { endAt: passes.at(-1)!.at } : {}),
      title: w.milestoneTitle(first.kind, first.index),
      line: w.milestoneLine(first.kind),
      detail: [w.exactOn(days(passes.map((p) => p.at))), total > passes.length ? w.passOf(first.pass, total) : ''].filter(Boolean).join(' '),
      confidence: confidence(true),
      weight: 7,
      dates: passes.map((p) => ({ at: p.at, ...(total > 1 ? { label: w.passLabel(p.pass, total) } : {}) })),
      card: w.cardMilestone(first.kind),
    });
  }

  // Jupiter to Pluto on the Sun, Moon, rising degree and midheaven.
  for (const loop of loopsOf(scan.slow)) {
    const inside = loop.filter((contact) => inYear(contact.exactUtc, year));
    if (!inside.length) continue;
    const { transitBody: planet, natalPoint: point } = loop[0];
    const aspect = loop[0].aspect as YearAspect;
    const before = loop.filter((contact) => Date.parse(contact.exactUtc) < from.getTime());
    const after = loop.filter((contact) => !inYear(contact.exactUtc, year) && Date.parse(contact.exactUtc) >= from.getTime());
    const detailParts = [w.exactOn(days(inside.map((c) => c.exactUtc)))];
    if (before.length) detailParts.push(w.loopBefore(new Date(before[0].exactUtc).getUTCFullYear()));
    if (after.length) detailParts.push(w.loopAfter(new Date(after.at(-1)!.exactUtc).getUTCFullYear()));
    detailParts.push(w.slowNote);
    moments.push({
      id: `slow-${planet}-${aspect}-${point}-${inside[0].exactUtc}`,
      kind: 'slow',
      body: planet,
      at: inside[0].exactUtc,
      ...(inside.length > 1 ? { endAt: inside.at(-1)!.exactUtc } : {}),
      title: w.contactTitle(planet, aspect, point),
      line: w.contactLine(planet, aspect, point),
      detail: detailParts.join(' '),
      confidence: confidence(true),
      weight: (SLOW_WEIGHT[planet]?.[aspect] ?? 3) + (point === 'Sun' || point === 'ASC' ? 0.5 : 0),
      dates: inside.map((contact) => ({
        at: contact.exactUtc,
        ...(loop.length > 1 ? { label: w.passLabel(loop.indexOf(contact) + 1, loop.length) } : {}),
      })),
      card: w.cardContact(planet, aspect, point),
    });
  }

  // Venus and Mars over the Sun.
  for (const loop of loopsOf(scan.passes)) {
    const inside = loop.filter((contact) => inYear(contact.exactUtc, year));
    if (!inside.length) continue;
    const planet = loop[0].transitBody;
    moments.push({
      id: `pass-${planet}-${inside[0].exactUtc}`,
      kind: 'pass',
      body: planet,
      at: inside[0].exactUtc,
      ...(inside.length > 1 ? { endAt: inside.at(-1)!.exactUtc } : {}),
      title: w.contactTitle(planet, 'conjunction', 'Sun'),
      line: w.contactLine(planet, 'conjunction', 'Sun'),
      detail: [w.exactOn(days(inside.map((c) => c.exactUtc))), loop.length > inside.length ? w.passOf(loop.indexOf(inside[0]) + 1, loop.length) : ''].filter(Boolean).join(' '),
      confidence: confidence(true),
      weight: planet === 'Mars' ? 2 + (loop.length > 1 ? 1.5 : 0) : 2,
      dates: inside.map((contact) => ({
        at: contact.exactUtc,
        ...(loop.length > 1 ? { label: w.passLabel(loop.indexOf(contact) + 1, loop.length) } : {}),
      })),
      card: w.cardContact(planet, 'conjunction', 'Sun'),
    });
  }

  // Eclipses within three degrees of a placement, on it or across from it.
  const eclipsePoints = [
    ...['Sun', ...(timeKnown ? ['Moon'] : []), 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
      .flatMap((body) => { const lon = lonOf(body); return lon == null ? [] : [{ body, lon }]; }),
    ...(asc != null ? [{ body: 'ASC', lon: asc }] : []),
    ...(mc != null ? [{ body: 'MC', lon: mc }] : []),
  ];
  for (const e of tables.eclipses) {
    if (!inYear(e.peak, year)) continue;
    let best: { body: string; orb: number; contact: 'conjunction' | 'opposition' } | null = null;
    for (const point of eclipsePoints) {
      const conj = separation(e.lon, point.lon);
      const opp = 180 - conj;
      const orb = Math.min(conj, opp);
      if (orb <= ECLIPSE_ORB && (!best || orb < best.orb)) best = { body: point.body, orb, contact: conj <= opp ? 'conjunction' : 'opposition' };
    }
    if (!best) continue;
    const degree = `${e.degree.toFixed(0)}°`;
    moments.push({
      id: `eclipse-hit-${e.peak}`,
      kind: 'eclipse-hit',
      body: e.type === 'solar' ? 'Sun' : 'Moon',
      at: e.peak,
      title: w.eclipseHitTitle(e.type, best.contact, best.body),
      line: w.eclipseHitLine(e.type, best.contact, best.body, degree, w.signName(e.sign)),
      detail: `${w.day(e.peak, year)}. ${w.eclipseOrb(best.orb.toFixed(1))}`,
      confidence: confidence(best.orb < 1),
      weight: 5 + (best.orb < 1 ? 1 : 0) + (e.kind === 'penumbral' ? -1 : 0),
      dates: [{ at: e.peak, timed: true }],
      replaces: `eclipse-${e.peak}`,
      card: w.cardEclipse(best.body),
    });
  }

  // Mercury, Venus and Mars retrogrades that loop over a placement.
  const loopPoints = [
    ...['Sun', ...(timeKnown ? ['Moon'] : []), 'Mercury', 'Venus', 'Mars']
      .flatMap((body) => { const lon = lonOf(body); return lon == null ? [] : [{ body, lon }]; }),
    ...(asc != null ? [{ body: 'ASC', lon: asc }] : []),
  ];
  for (const station of scan.stations) {
    const arc = norm(station.retroLon - station.directLon);
    const hit = loopPoints.filter((point) => norm(point.lon - station.directLon) <= arc).map((point) => point.body);
    if (!hit.length) continue;
    const dates: MomentDate[] = [
      ...(inYear(station.from, year) ? [{ at: station.from, label: w.stationRetrograde }] : []),
      ...(inYear(station.to, year) ? [{ at: station.to, label: w.stationDirect }] : []),
    ];
    moments.push({
      id: `retrograde-hit-${station.planet}-${station.from}`,
      kind: 'retrograde-hit',
      body: station.planet,
      at: inYear(station.from, year) ? station.from : from.toISOString(),
      ...(inYear(station.from, year) ? {} : { underWay: true }),
      endAt: station.to,
      title: w.retrogradeHitTitle(station.planet, hit),
      line: w.retrogradeHitLine(station.planet, hit),
      detail: w.retrogradeDetail(
        w.range(station.from, station.to, year),
        w.signName(SIGNS[signIndexOf(station.retroLon)].slug),
        station.preShadowStart && station.postShadowEnd ? w.range(station.preShadowStart, station.postShadowEnd, year) : null,
      ),
      confidence: confidence(true),
      weight: station.planet === 'Mercury' ? 3 : 4,
      dates,
      replaces: `retrograde-${station.planet}-${station.from}`,
      card: w.cardRetrograde(station.planet, hit),
    });
  }

  // Slow planets changing sign: into your Sun sign, your rising sign or a new house.
  const ascIndex = asc != null ? signIndexOf(asc) : null;
  const houseOf = (slug: string) => (ascIndex === null ? null : ((SIGNS.findIndex((s) => s.slug === slug) - ascIndex + 12) % 12) + 1);
  for (const window of tables.ingresses) {
    if (!(SLOW_PLANETS as readonly string[]).includes(window.planet) || !inYear(window.from, year)) continue;
    const ownSign = window.sign === signs.sun ? 'sun' as const : window.sign === signs.rising ? 'rising' as const : null;
    const house = houseOf(window.sign);
    if (!house && !ownSign) continue;
    const sign = w.signName(window.sign);
    moments.push({
      id: `ingress-personal-${window.planet}-${window.from}`,
      kind: 'ingress-personal',
      body: window.planet,
      at: window.from,
      title: ownSign === 'sun' ? w.ingressSunTitle(window.planet) : ownSign === 'rising' ? w.ingressRisingTitle(window.planet) : w.ingressHouseTitle(window.planet, house!),
      line: w.ingressPersonalLine(window.planet, sign, house, ownSign),
      detail: w.day(window.from, year),
      confidence: confidence(false),
      weight: (window.planet === 'Jupiter' ? 4 : 5) + (ownSign ? 1 : 0),
      dates: [{ at: window.from }],
      replaces: `ingress-${window.planet}-${window.from}`,
      card: w.cardIngress(window.planet, house, ownSign),
    });
  }

  // All year: the house each slow planet holds from 1 January.
  const allYear: YearMoment[] = [];
  if (ascIndex !== null) {
    for (const planet of SLOW_PLANETS) {
      const start = from.toISOString();
      const sign = signAt(tables.ingresses, planet, start);
      if (!sign) continue;
      const window = tables.ingresses.find((x) => x.planet === planet && x.sign === sign && Date.parse(x.from) <= from.getTime() && from.getTime() < Date.parse(x.to))!;
      const until = inYear(window.to, year) ? w.day(window.to, year) : null;
      allYear.push({
        id: `all-year-${planet}`,
        kind: 'ingress-personal',
        body: planet,
        at: start,
        title: planet,
        line: w.backgroundHouseLine(planet, w.signName(sign), houseOf(sign)!, until),
        detail: '',
        confidence: confidence(false),
        weight: 0,
        dates: [],
        allYear: true,
      });
    }
  }

  moments.sort((a, b) => a.at.localeCompare(b.at) || b.weight - a.weight);
  const highlights = [...moments]
    .filter((moment) => moment.card)
    .sort((a, b) => b.weight - a.weight || a.at.localeCompare(b.at))
    .slice(0, 4)
    .sort((a, b) => a.at.localeCompare(b.at));
  return { year, timeKnown, detail, moments, allYear, highlights, signs };
}
