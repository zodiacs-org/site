/**
 * "Your year ahead": one dated timeline for a saved chart, assembled
 * from the engine scan (lazy, cached — engine/year-scan.ts), the
 * committed ingress table, and the committed eclipse table. This module
 * is engine-free on purpose: it phrases and merges; it never computes
 * positions.
 */
import { transitLine } from './transits';
import { eclipseHits, eclipseHitLine, monthDay, type EclipseRecord } from './upcoming';
import type { ScanAspectEvent, YearScanResult } from './engine/year-scan';

export interface YearAheadEvent {
  /** ISO date the event lands (or opens). */
  at: string;
  /** Set when the event is a window rather than a day. */
  endAt?: string;
  line: string;
  receipt: string;
  kind: 'solar-return' | 'aspect' | 'ingress' | 'eclipse' | 'saturn-return';
  /** The event's primary body, for the leading receipt glyph. */
  body: string;
}

/** Cached year scan, one per chart id. */
export interface YearScanCache {
  engineVersion: string;
  computedAt: string;
  from: string;
  to: string;
  scan: YearScanResult;
}

export const YEAR_AHEAD_CACHE_KEY = 'zodiacs.yearahead.v1';

/** A cache is fresh for two weeks; after that the window has drifted enough to rescan. */
export function yearCacheFresh(cache: YearScanCache, engineVersion: string, now: Date): boolean {
  if (cache.engineVersion !== engineVersion) return false;
  return now.getTime() - new Date(cache.computedAt).getTime() < 14 * 86400_000;
}

// ── line composition ───────────────────────────────────────────────────

/** The ascendant is not in BODY_ROLE; its lines live here, same register. */
const ASC_LINE: Record<ScanAspectEvent['aspect'], Record<'Jupiter' | 'Saturn', string>> = {
  conjunction: {
    Jupiter: 'Jupiter crosses your rising degree. The outward year gets bigger: more room, more visibility, more yes.',
    Saturn: 'Saturn crosses your rising degree, a season of taking yourself more seriously, and being taken that way.',
  },
  square: {
    Jupiter: 'Jupiter squares your rising degree, growth that argues with the image you present; the fix is updating the image.',
    Saturn: 'Saturn squares your rising degree. Structure presses on how you show up; commitments want renegotiating.',
  },
  opposition: {
    Jupiter: 'Jupiter stands opposite your rising degree. The year grows through other people: partners, audiences, the ones across the table.',
    Saturn: 'Saturn stands opposite your rising degree. Relationships get weighed; what survives the audit is yours.',
  },
};

function aspectLine(e: ScanAspectEvent): string {
  if (e.natal === 'ASC') return ASC_LINE[e.aspect][e.body];
  return transitLine(e.body, e.aspect, e.natal);
}

function aspectReceipt(e: ScanAspectEvent): string {
  const when = e.from === e.to || monthDay(e.from) === monthDay(e.to)
    ? monthDay(e.from)
    : `${monthDay(e.from)} to ${monthDay(e.to)}`;
  const passes = e.passes > 1 ? ` · ${e.passes} exact passes` : '';
  return `${e.body} ${e.aspect} Natal ${e.natal} · ${when}${passes}`;
}

// ── event builders ─────────────────────────────────────────────────────

export function solarReturnEvents(scan: YearScanResult): YearAheadEvent[] {
  return scan.solarReturns.map((at) => {
    const d = new Date(at);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return {
      at,
      kind: 'solar-return' as const,
      body: 'Sun',
      line: 'Your solar return: the Sun back on its natal degree, the moment your birthday actually lands. The year resets here.',
      receipt: `solar return · ${monthDay(at)}, ${hh}:${mm} UTC`,
    };
  });
}

export function aspectEvents(scan: YearScanResult): YearAheadEvent[] {
  return scan.aspects.map((e) => ({
    at: e.from,
    ...(e.to !== e.from ? { endAt: e.to } : {}),
    kind: 'aspect' as const,
    body: e.body,
    line: aspectLine(e),
    receipt: aspectReceipt(e),
  }));
}

export interface IngressWindow {
  planet: string;
  sign: string;
  from: string;
  to: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Jupiter/Saturn sign changes inside the window, with a personal flag
 * when the sign is the chart's sun or rising sign. Committed-data only.
 */
export function ingressEvents(
  windows: IngressWindow[],
  sunSign: string,
  risingSign: string | null,
  from: Date,
  to: Date,
): YearAheadEvent[] {
  const out: YearAheadEvent[] = [];
  for (const w of windows) {
    if (w.planet !== 'Jupiter' && w.planet !== 'Saturn') continue;
    const start = new Date(w.from);
    if (start < from || start > to) continue;
    const yours =
      w.sign === sunSign
        ? ' That is your sun sign. The cycle starts again where your chart keeps its engine.'
        : risingSign && w.sign === risingSign
          ? ' That is your rising sign. The change shows up first in how you meet the world.'
          : '';
    const tone =
      w.planet === 'Jupiter'
        ? 'about a year of growth pointed there'
        : 'about two and a half years of slow structure built there';
    out.push({
      at: w.from,
      kind: 'ingress',
      body: w.planet,
      line: `${w.planet} enters ${cap(w.sign)} on ${monthDay(w.from)}, ${tone}.${yours}`,
      receipt: `${w.planet} → ${cap(w.sign)} · ${monthDay(w.from)}`,
    });
  }
  return out;
}

export function eclipseEvents(
  eclipses: EclipseRecord[],
  natal: { body: string; lon: number }[],
  from: Date,
  to: Date,
  orb = 3,
): YearAheadEvent[] {
  return eclipseHits(eclipses, natal, from, orb)
    .filter((h) => new Date(h.eclipse.peak) <= to)
    .map((h) => ({
      at: h.eclipse.peak,
      kind: 'eclipse' as const,
      body: h.eclipse.type === 'solar' ? 'Sun' : 'Moon',
      line: eclipseHitLine(h),
      receipt: `${h.eclipse.type} eclipse · ${monthDay(h.eclipse.peak)} · orb ${h.orb.toFixed(1)}°`,
    }));
}

const ORDINAL = ['', 'first', 'second', 'third', 'fourth'];

/** Saturn-return seasons that overlap the window. */
export function saturnSeasonEvents(
  seasons: { index: number; from: string; to: string }[],
  from: Date,
  to: Date,
): YearAheadEvent[] {
  return seasons
    .filter((s) => new Date(s.to) >= from && new Date(s.from) <= to)
    .map((s) => {
      const label = ORDINAL[s.index] ?? `${s.index}th`;
      const oneDay = monthDay(s.from) === monthDay(s.to);
      return {
        at: s.from,
        ...(oneDay ? {} : { endAt: s.to }),
        kind: 'saturn-return' as const,
        body: 'Saturn',
        line: oneDay
          ? `Your ${label} Saturn return lands around ${monthDay(s.from)}, the long audit of what you have built, in one clean pass.`
          : `Your ${label} Saturn return runs ${monthDay(s.from)} to ${monthDay(s.to)}, the long audit of what you have built, arriving in passes.`,
        receipt: `Saturn return ${s.index} · ${oneDay ? monthDay(s.from) : `${monthDay(s.from)} to ${monthDay(s.to)}`}`,
      };
    });
}

/**
 * The merged timeline, soonest first. Saturn-return seasons swallow the
 * bare "Saturn conjunction natal Saturn" aspect duplicates by nature of
 * the scan (year-scan only aspects Sun/Moon/ASC), so no dedup is needed.
 */
export function assembleYearAhead(parts: YearAheadEvent[][]): YearAheadEvent[] {
  return parts.flat().sort((a, b) => a.at.localeCompare(b.at));
}
