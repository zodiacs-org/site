/**
 * Mercury's year, for the plate on the Mercury retrograde page
 * (src/components/sky/MercuryYearPlate.astro): the windows the page's table
 * lists, the calendar year (UTC) the plate shows, Mercury's longitude through
 * that year unwrapped so it climbs all year, and the drawing's geometry.
 *
 * The windows are sky.json's Mercury retrogrades, and their labels and
 * station positions are built here once, with the same formatters the table
 * used, so the table and the plate print the same strings. The longitude
 * comes in as a function (the page passes bodyLongitude from
 * src/lib/engine/full at build time), which keeps this module free of the
 * engine and of any clock.
 */
import { formatLongitude, signForLongitude, SIGNS } from './signs';
import { formatDate, formatShortDate } from './i18n/dates';

export interface RawRetrograde {
  planet: string;
  from: string;
  to: string | null;
  preShadowStart?: string | null;
  postShadowEnd?: string | null;
}

export type Longitude = (date: Date) => number;

export interface MercuryWindow {
  from: Date;
  to: Date | null;
  preShadowStart: Date | null;
  postShadowEnd: Date | null;
  /** The table's Window cell, e.g. "Feb 26, 2026 to Mar 20, 2026". */
  label: string;
  /** The table's "Stations retrograde at" cell. */
  stationRx: string;
  /** The table's "Stations direct at" cell, or null while the window has no end. */
  stationDirect: string | null;
}

const DAY = 86_400_000;

/** Every Mercury window in the sky data, with the table's strings. */
export function mercuryRetrogradeWindows(retrogrades: readonly RawRetrograde[], longitude: Longitude): MercuryWindow[] {
  return retrogrades
    .filter((r) => r.planet === 'Mercury')
    .map((r) => {
      const from = new Date(r.from);
      const to = r.to ? new Date(r.to) : null;
      const fmt = (d: Date) => formatShortDate('en', d);
      return {
        from,
        to,
        preShadowStart: r.preShadowStart ? new Date(r.preShadowStart) : null,
        postShadowEnd: r.postShadowEnd ? new Date(r.postShadowEnd) : null,
        label: `${fmt(from)} to ${to ? fmt(to) : 'ongoing'}`,
        stationRx: formatLongitude(longitude(from)),
        stationDirect: to ? formatLongitude(longitude(to)) : null,
      };
    });
}

/** The calendar year (UTC) of `now`, held inside the years the data covers. */
export function mercuryYearShown(now: Date, dataFrom: string, dataTo: string): number {
  const first = new Date(dataFrom).getUTCFullYear();
  const last = new Date(Date.parse(dataTo) - 1).getUTCFullYear();
  return Math.min(last, Math.max(first, now.getUTCFullYear()));
}

export interface YearWindow {
  window: MercuryWindow;
  /** The window's stations as instants (ms); `to` is the direct station. */
  from: number;
  to: number;
  shadowFrom: number | null;
  shadowTo: number | null;
  /** Mercury's longitude at each station, unwrapped onto the year's line. */
  lonRx: number;
  lonDirect: number;
  /** The signs the retrograde runs through, in zodiac order. */
  signs: string[];
  /** Days of this retrograde inside the year. */
  daysInYear: number;
}

export interface LinePoint { t: number; lon: number }

export interface MercuryYear {
  year: number;
  /** The span drawn (ms): the calendar year, held inside the data. */
  start: number;
  end: number;
  windows: YearWindow[];
  /** Mercury's unwrapped longitude, daily, plus every station and shadow edge in the span. */
  line: LinePoint[];
  /** Days retrograde inside the year, station to station. */
  retrogradeDays: number;
}

function unwrapNear(lon: number, near: number): number {
  let value = lon;
  while (value - near > 180) value -= 360;
  while (near - value > 180) value += 360;
  return value;
}

/**
 * The windows of one calendar year (every retrograde whose station-to-station
 * span overlaps it) and Mercury's line through the year. Returns null when
 * the year lies outside the data or holds no complete window data.
 */
export function mercuryYear(
  year: number,
  windows: readonly MercuryWindow[],
  longitude: Longitude,
  data: { from: string; to: string },
): MercuryYear | null {
  const start = Math.max(Date.UTC(year, 0, 1), Date.parse(data.from));
  const end = Math.min(Date.UTC(year + 1, 0, 1), Date.parse(data.to));
  if (!(end > start)) return null;
  const chosen = windows.filter((w) => w.to && w.from.getTime() < end && w.to.getTime() > start);
  if (chosen.length === 0) return null;

  // Daily samples plus every instant the drawing turns or changes treatment.
  const times = new Set<number>();
  for (let t = start; t < end; t += DAY) times.add(t);
  times.add(end);
  for (const w of chosen) {
    for (const d of [w.from, w.to, w.preShadowStart, w.postShadowEnd]) {
      const t = d?.getTime();
      if (t !== undefined && t > start && t < end) times.add(t);
    }
  }
  const sorted = [...times].sort((a, b) => a - b);
  const line: LinePoint[] = [];
  for (const t of sorted) {
    const raw = longitude(new Date(t));
    line.push({ t, lon: line.length ? unwrapNear(raw, line[line.length - 1].lon) : raw });
  }
  // Begin the line in the first sign band at or above 0 degrees.
  const shift = Math.floor(line[0].lon / 360) * 360;
  for (const p of line) p.lon -= shift;

  const lonAt = (t: number) => {
    const raw = longitude(new Date(t));
    if (t <= start) return unwrapNear(raw, line[0].lon);
    if (t >= end) return unwrapNear(raw, line[line.length - 1].lon);
    const hit = line.find((p) => p.t === t);
    if (hit) return hit.lon;
    const k = line.findIndex((p) => p.t > t);
    return unwrapNear(raw, line[k - 1].lon);
  };

  const yearWindows = chosen.map((w): YearWindow => {
    const from = w.from.getTime();
    const to = w.to!.getTime();
    const lonRx = lonAt(from);
    const lonDirect = lonAt(to);
    const signs: string[] = [];
    for (let s = Math.floor(lonDirect / 30); s <= Math.floor(lonRx / 30); s += 1) signs.push(SIGNS[((s % 12) + 12) % 12].slug);
    return {
      window: w,
      from,
      to,
      shadowFrom: w.preShadowStart?.getTime() ?? null,
      shadowTo: w.postShadowEnd?.getTime() ?? null,
      lonRx,
      lonDirect,
      signs,
      daysInYear: (Math.min(to, end) - Math.max(from, start)) / DAY,
    };
  });
  return {
    year,
    start,
    end,
    windows: yearWindows,
    line,
    retrogradeDays: yearWindows.reduce((sum, w) => sum + w.daysInYear, 0),
  };
}

// ---------------------------------------------------------------------------
// The drawing

export interface PlotLayout {
  w: number;
  h: number;
  /** The plot area: time runs x0 to x1, longitude bottom to top. */
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  /** Baseline of the month names. */
  monthY: number;
  /** Mono label size, and how a label may be set: on one line, or on two when one does not fit. */
  font: number;
  twoLine: boolean;
}

export const WIDE: PlotLayout = { w: 720, h: 470, x0: 96, x1: 708, top: 10, bottom: 430, monthY: 452, font: 11.5, twoLine: false };
export const NARROW: PlotLayout = { w: 340, h: 540, x0: 78, x1: 334, top: 8, bottom: 498, monthY: 520, font: 10.5, twoLine: true };

/** How long the line takes to cross the year, in ms. */
export const LINE_MS = 1500;
/** The longest stretch of the year one stroke covers, so each draws at a near-even pace. */
const CHUNK_MS = 8 * DAY;
/** Degrees kept clear above and below the line before the sign bands are rounded out. */
const HEADROOM = 6;

export interface Chunk {
  d: string;
  retro: boolean;
  /** When the stroke starts drawing and for how long (ms): its share of the year. */
  delay: number;
  dur: number;
  /** The span of time it covers (ms). */
  from: number;
  to: number;
  points: { x: number; y: number }[];
}

export interface Box { x: number; y: number; w: number; h: number }

export interface WindowMark {
  index: number;
  rx: { x: number; y: number } | null;
  direct: { x: number; y: number } | null;
  shadow: Box | null;
  label: { lines: string[]; x: number; y: number[]; anchor: 'start' | 'middle' | 'end'; box: Box };
}

export interface Band { lo: number; hi: number; sign: string; yTop: number; yBottom: number; yMid: number; hasRetrograde: boolean }

export interface Plot {
  layout: PlotLayout;
  chunks: Chunk[];
  bands: Band[];
  months: { label: string; x: number }[];
  ticks: number[];
  marks: WindowMark[];
  /** The longitude span drawn, in whole sign bands. */
  lonMin: number;
  lonMax: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (t: number) => formatDate('en', new Date(t), { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** The in-figure label's text: "Feb 26 to Mar 20", one line or two. */
export function windowLabelLines(w: YearWindow, twoLine: boolean): string[] {
  const a = shortDay(w.from);
  const b = shortDay(w.to);
  return twoLine ? [a, `to ${b}`] : [`${a} to ${b}`];
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function mercuryYearPlot(view: MercuryYear, layout: PlotLayout): Plot {
  const { start, end } = view;
  const lons = [...view.line.map((p) => p.lon), ...view.windows.flatMap((w) => [w.lonRx, w.lonDirect])];
  // Whole sign bands, with room above and below the line for a label.
  const lonMin = Math.floor((Math.min(...lons) - HEADROOM) / 30) * 30;
  const lonMax = Math.ceil((Math.max(...lons) + HEADROOM) / 30) * 30;
  const X = (t: number) => layout.x0 + ((Math.min(end, Math.max(start, t)) - start) / (end - start)) * (layout.x1 - layout.x0);
  const Y = (lon: number) => layout.bottom - ((lon - lonMin) / (lonMax - lonMin)) * (layout.bottom - layout.top);
  const n = (v: number) => Number(v.toFixed(1));
  const isRetro = (t0: number, t1: number) => view.windows.some((w) => t0 >= w.from && t1 <= w.to);

  // Split the line at every station, then into strokes of at most CHUNK_MS.
  const chunks: Chunk[] = [];
  let current: { pts: LinePoint[]; retro: boolean } | null = null;
  const stations = new Set(view.windows.flatMap((w) => [w.from, w.to]));
  for (let i = 1; i < view.line.length; i += 1) {
    const p = view.line[i - 1];
    const q = view.line[i];
    const retro = isRetro(p.t, q.t);
    if (!current || current.retro !== retro || q.t - current.pts[0].t > CHUNK_MS) {
      if (current) chunks.push(toChunk(current.pts, current.retro));
      current = { pts: [p], retro };
    }
    current.pts.push(q);
    if (stations.has(q.t)) { chunks.push(toChunk(current.pts, current.retro)); current = null; }
  }
  if (current && current.pts.length > 1) chunks.push(toChunk(current.pts, current.retro));

  function toChunk(pts: LinePoint[], retro: boolean): Chunk {
    const points = pts.map((p) => ({ x: n(X(p.t)), y: n(Y(p.lon)) }));
    const from = pts[0].t;
    const to = pts[pts.length - 1].t;
    return {
      d: `M${points.map((p) => `${p.x} ${p.y}`).join('L')}`,
      retro,
      delay: Math.round(((from - start) / (end - start)) * LINE_MS),
      dur: Math.max(1, Math.round(((to - from) / (end - start)) * LINE_MS)),
      from,
      to,
      points,
    };
  }

  const bands: Band[] = [];
  for (let lo = lonMin; lo < lonMax; lo += 30) {
    const sign = signForLongitude(lo + 15).slug;
    bands.push({
      lo,
      hi: lo + 30,
      sign,
      yTop: n(Y(lo + 30)),
      yBottom: n(Y(lo)),
      yMid: n(Y(lo + 15)),
      hasRetrograde: view.windows.some((w) => w.lonDirect < lo + 30 && w.lonRx > lo),
    });
  }

  const year = new Date(start).getUTCFullYear();
  const monthStarts = Array.from({ length: 13 }, (_, i) => Date.UTC(year, i, 1)).filter((t) => t >= start && t <= end);
  const ticks = monthStarts.map((t) => n(X(t)));
  const months = monthStarts.slice(0, -1).map((t, i) => ({ label: MONTHS[new Date(t).getUTCMonth()], x: n((X(t) + X(monthStarts[i + 1])) / 2) }));

  // Every point of the line, the shadow boxes and the station dots are obstacles for the labels.
  const linePts = chunks.flatMap((c) => c.points);
  const marksBase = view.windows.map((w, index) => {
    const rx = w.from >= start && w.from <= end ? { x: n(X(w.from)), y: n(Y(w.lonRx)) } : null;
    const direct = w.to >= start && w.to <= end ? { x: n(X(w.to)), y: n(Y(w.lonDirect)) } : null;
    let shadow: Box | null = null;
    if (w.shadowFrom !== null && w.shadowTo !== null) {
      const x = X(w.shadowFrom);
      const x2 = X(w.shadowTo);
      shadow = { x: n(x), y: n(Y(w.lonRx)), w: n(x2 - x), h: n(Y(w.lonDirect) - Y(w.lonRx)) };
    }
    return { w, index, rx, direct, shadow };
  });
  const placed: Box[] = [];
  const PAD = 3.5;
  const charW = layout.font * 0.6;
  const lineH = layout.font + 3;
  const shadows = marksBase.flatMap((o) => (o.shadow ? [o.shadow] : []));
  const marks: WindowMark[] = marksBase.map((m) => {
    // The retrograde stretch as drawn: from its station retrograde (top) to
    // its station direct (bottom), clipped to the year.
    const sx0 = X(m.w.from);
    const sx1 = X(m.w.to);
    const sTop = Y(m.w.lonRx);
    const sBottom = Y(m.w.lonDirect);
    const obstacles = [...placed, ...shadows];
    const clear = (b: Box) => {
      if (b.x < layout.x0 + 2 || b.x + b.w > layout.w - 2 || b.y < 0 || b.y + b.h > layout.bottom - 2) return false;
      const grown = { x: b.x - PAD, y: b.y - PAD, w: b.w + 2 * PAD, h: b.h + 2 * PAD };
      if (linePts.some((p) => p.x >= grown.x && p.x <= grown.x + grown.w && p.y >= grown.y && p.y <= grown.y + grown.h)) return false;
      return !obstacles.some((o) => overlaps(grown, o));
    };
    let best: { score: number; label: WindowMark['label'] } | null = null;
    const variants = layout.twoLine ? [windowLabelLines(m.w, false), windowLabelLines(m.w, true)] : [windowLabelLines(m.w, false)];
    variants.forEach((lines, v) => {
      const tw = Math.max(...lines.map((l) => l.length)) * charW;
      const th = lines.length * lineH;
      // Centred on the stretch and just above it is best; the further the
      // label has to move, and moving below or onto two lines, cost more.
      for (let cx = sx0 - 120; cx <= sx1 + 120; cx += 3) {
        for (let top = sTop - 80; top <= sBottom + 60; top += 3) {
          const box = { x: cx - tw / 2, y: top - 2, w: tw, h: th + 1 };
          const dx = Math.max(0, Math.abs(cx - (sx0 + sx1) / 2) - (sx1 - sx0) / 2);
          const above = top + th <= sTop;
          const dy = above ? sTop - (top + th) : Math.max(0, top - sBottom);
          const score = dx + dy * 1.4 + (above ? 0 : 14) + v * 30;
          if (best && score >= best.score) continue;
          if (!clear(box)) continue;
          best = {
            score,
            label: {
              lines,
              x: n(cx),
              y: lines.map((_, i) => n(top + layout.font * 0.8 + i * lineH)),
              anchor: 'middle',
              box: { x: n(box.x), y: n(box.y), w: n(box.w), h: n(box.h) },
            },
          };
        }
      }
    });
    if (!best) throw new Error(`No clear place for the label of the ${m.w.window.label} retrograde`);
    const label = (best as { label: WindowMark['label'] }).label;
    placed.push(label.box);
    return { index: m.index, rx: m.rx, direct: m.direct, shadow: m.shadow, label };
  });

  return { layout, chunks, bands, months, ticks, marks, lonMin, lonMax };
}

/** Whether a label sits clear of the line, the shadow boxes and the other labels (for the tests). */
export function labelIsClear(plot: Plot, index: number, pad = 3): boolean {
  const b = plot.marks[index].label.box;
  const grown = { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad };
  const hitsLine = plot.chunks.some((c) => c.points.some((p) => p.x >= grown.x && p.x <= grown.x + grown.w && p.y >= grown.y && p.y <= grown.y + grown.h));
  const hitsBox = plot.marks.some((m) => m.shadow && overlaps(grown, m.shadow));
  const hitsLabel = plot.marks.some((m, i) => i !== index && overlaps(b, m.label.box));
  return !hitsLine && !hitsBox && !hitsLabel;
}
