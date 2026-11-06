/**
 * The 2027 sky everyone shares: the year's eclipses, retrogrades and slow
 * planet sign changes, read from the committed tables (eclipses.json,
 * sky.json, ingresses.json). Engine-free, so the page renders it at build time
 * and the island reuses it without loading the ephemeris.
 */
import type { CatalogLocale } from '../i18n/core';
import type { EclipseRecord } from '../upcoming';
import { yearSkyWords } from './copy';
import { EDITION_YEAR, inYear, yearWindow } from './edition';
import type { YearMoment } from './types';

export interface SkyRetrograde {
  planet: string;
  from: string;
  to: string;
  /** Null where the committed table could not bound the shadow. */
  preShadowStart: string | null;
  postShadowEnd: string | null;
}

export interface IngressWindowRecord {
  planet: string;
  sign: string;
  from: string;
  to: string;
}

export interface GeneralSkyInput {
  eclipses: readonly EclipseRecord[];
  retrogrades: readonly SkyRetrograde[];
  ingresses: readonly IngressWindowRecord[];
}

export interface BackgroundLine {
  planet: string;
  line: string;
}

export interface GeneralSky {
  year: number;
  moments: YearMoment[];
  background: BackgroundLine[];
  /** The retrogrades that touch the year, for the personal scan's stations. */
  retrogrades: SkyRetrograde[];
}

export const SLOW_PLANETS = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
const PLANET_ORDER = ['Mercury', 'Venus', 'Mars', ...SLOW_PLANETS];

/** The sign a planet is in at an instant, from the committed ingress windows. */
export function signAt(ingresses: readonly IngressWindowRecord[], planet: string, iso: string): string | null {
  const at = Date.parse(iso);
  return ingresses.find((w) => w.planet === planet && Date.parse(w.from) <= at && at < Date.parse(w.to))?.sign ?? null;
}

function overlaps(fromIso: string, toIso: string, year: number): boolean {
  const { from, to } = yearWindow(year);
  return Date.parse(toIso) >= from.getTime() && Date.parse(fromIso) < to.getTime();
}

function clampToYear(iso: string, year: number): string {
  const { from } = yearWindow(year);
  return Date.parse(iso) < from.getTime() ? from.toISOString() : iso;
}

export function generalSky(input: GeneralSkyInput, locale: CatalogLocale = 'en', year: number = EDITION_YEAR): GeneralSky {
  const w = yearSkyWords(locale);
  const moments: YearMoment[] = [];

  for (const e of input.eclipses) {
    if (!inYear(e.peak, year)) continue;
    moments.push({
      id: `eclipse-${e.peak}`,
      kind: 'eclipse',
      body: e.type === 'solar' ? 'Sun' : 'Moon',
      at: e.peak,
      title: w.eclipseTitle(e.type, e.kind),
      line: w.eclipseLine(e.type, e.kind, `${e.degree.toFixed(0)}°`, w.signName(e.sign)),
      detail: w.day(e.peak, year),
      confidence: null,
      weight: e.kind === 'penumbral' ? 2 : 3,
      dates: [{ at: e.peak, timed: true }],
    });
  }

  const retrogrades = input.retrogrades
    .filter((r) => overlaps(r.from, r.to, year))
    .sort((a, b) => a.from.localeCompare(b.from));
  for (const r of retrogrades) {
    const sign = signAt(input.ingresses, r.planet, r.from) ?? signAt(input.ingresses, r.planet, r.to);
    const directSign = signAt(input.ingresses, r.planet, r.to);
    const signs = sign && directSign && sign !== directSign
      ? w.list([w.signName(sign), w.signName(directSign)])
      : sign ? w.signName(sign) : '';
    moments.push({
      id: `retrograde-${r.planet}-${r.from}`,
      kind: 'retrograde',
      body: r.planet,
      at: clampToYear(r.from, year),
      ...(inYear(r.from, year) ? {} : { underWay: true }),
      endAt: r.to,
      title: w.retrogradeTitle(r.planet),
      line: w.retrogradeLine(r.planet),
      detail: w.retrogradeDetail(w.range(r.from, r.to, year), signs, r.preShadowStart && r.postShadowEnd ? w.range(r.preShadowStart, r.postShadowEnd, year) : null),
      confidence: null,
      weight: r.planet === 'Mercury' ? 2 : 1,
      dates: [
        ...(inYear(r.from, year) ? [{ at: r.from, label: w.stationRetrograde }] : []),
        ...(inYear(r.to, year) ? [{ at: r.to, label: w.stationDirect }] : []),
      ],
    });
  }

  for (const window of input.ingresses) {
    if (!(SLOW_PLANETS as readonly string[]).includes(window.planet) || !inYear(window.from, year)) continue;
    moments.push({
      id: `ingress-${window.planet}-${window.from}`,
      kind: 'ingress',
      body: window.planet,
      at: window.from,
      title: w.ingressTitle(window.planet, w.signName(window.sign)),
      line: w.ingressLine(window.planet, w.signName(window.sign), w.day(window.to, year)),
      detail: w.day(window.from, year),
      confidence: null,
      weight: 3,
      dates: [{ at: window.from }],
    });
  }

  const background = SLOW_PLANETS.map((planet) => {
    const windows = input.ingresses
      .filter((window) => window.planet === planet && overlaps(window.from, window.to, year))
      .sort((a, b) => a.from.localeCompare(b.from));
    const signs = w.backgroundSigns(windows.map((window, i) => ({
      sign: w.signName(window.sign),
      until: i < windows.length - 1 ? w.day(window.to, year) : null,
    })));
    return { planet, line: w.backgroundLine(planet, signs) };
  });

  moments.sort((a, b) => a.at.localeCompare(b.at)
    || PLANET_ORDER.indexOf(a.body) - PLANET_ORDER.indexOf(b.body));
  return { year, moments, background, retrogrades };
}
