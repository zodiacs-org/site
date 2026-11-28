import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sky from '../data/sky.json';
import { bodyLongitude } from './engine/full';
import { formatLongitude } from './signs';
import { formatShortDate } from './i18n/dates';
import {
  LINE_MS, NARROW, WIDE, labelIsClear, mercuryRetrogradeWindows, mercuryYear, mercuryYearPlot, mercuryYearShown, windowLabelLines,
} from './mercury-year';

const lon = (d: Date) => bodyLongitude('Mercury', d);
const raw = sky.retrogrades as { planet: string; from: string; to: string | null; preShadowStart: string; postShadowEnd: string }[];
const windows = mercuryRetrogradeWindows(raw, lon);
const data = { from: sky.from, to: sky.to };
const first = new Date(sky.from).getUTCFullYear();
const last = new Date(Date.parse(sky.to) - 1).getUTCFullYear();
const years = Array.from({ length: last - first + 1 }, (_, i) => first + i);
const DAY = 86_400_000;

describe('mercuryRetrogradeWindows', () => {
  it('builds the table rows as the page always has: sky.json Mercury windows, short UTC dates, station positions', () => {
    const mercury = raw.filter((r) => r.planet === 'Mercury');
    expect(windows).toHaveLength(mercury.length);
    expect(windows.length).toBe(16);
    windows.forEach((w, i) => {
      const r = mercury[i];
      expect(w.from.toISOString()).toBe(r.from);
      expect(w.label).toBe(`${formatShortDate('en', new Date(r.from))} to ${formatShortDate('en', new Date(r.to!))}`);
      expect(w.stationRx).toBe(formatLongitude(bodyLongitude('Mercury', new Date(r.from))));
      expect(w.stationDirect).toBe(formatLongitude(bodyLongitude('Mercury', new Date(r.to!))));
    });
    expect(windows[0].label).toBe('Feb 26, 2026 to Mar 20, 2026');
  });

  it('is the source of the page table and the plate', () => {
    const page = readFileSync(new URL('../pages/mercury-retrograde/index.astro', import.meta.url), 'utf8');
    expect(page).toContain('mercuryRetrogradeWindows(');
    expect(page).toContain('<MercuryYearPlate');
  });
});

describe('mercuryYearShown', () => {
  it('takes the calendar year of now, held inside the data', () => {
    expect(mercuryYearShown(new Date('2026-11-26T12:00:00Z'), sky.from, sky.to)).toBe(2026);
    expect(mercuryYearShown(new Date('2028-01-01T00:00:00Z'), sky.from, sky.to)).toBe(2028);
    expect(mercuryYearShown(new Date('2025-06-01T00:00:00Z'), sky.from, sky.to)).toBe(first);
    expect(mercuryYearShown(new Date('2033-06-01T00:00:00Z'), sky.from, sky.to)).toBe(last);
  });
});

describe('mercuryYear', () => {
  it('uses exactly the table windows whose stations fall in or span the year', () => {
    for (const year of years) {
      const view = mercuryYear(year, windows, lon, data)!;
      const a = Date.UTC(year, 0, 1);
      const b = Date.UTC(year + 1, 0, 1);
      const expected = windows.filter((w) => w.from.getTime() < b && w.to!.getTime() > a);
      expect(view.windows.map((w) => w.window), String(year)).toEqual(expected);
    }
    const y2026 = mercuryYear(2026, windows, lon, data)!;
    expect(y2026.windows.map((w) => w.window.label)).toEqual([
      'Feb 26, 2026 to Mar 20, 2026', 'Jun 29, 2026 to Jul 23, 2026', 'Oct 24, 2026 to Nov 13, 2026',
    ]);
    expect(y2026.windows.map((w) => w.signs)).toEqual([['pisces'], ['cancer'], ['scorpio']]);
    expect(Math.round(y2026.retrogradeDays)).toBe(67);
    expect(mercuryYear(2025, windows, lon, data)).toBeNull();
    expect(mercuryYear(2031, windows, lon, data)).toBeNull();
  });

  it('draws one continuous line that turns on the station dates', () => {
    for (const year of years) {
      const view = mercuryYear(year, windows, lon, data)!;
      expect(view.line[0].t).toBe(Date.UTC(year, 0, 1));
      expect(view.line.at(-1)!.t).toBe(Date.UTC(year + 1, 0, 1));
      for (let i = 1; i < view.line.length; i += 1) {
        expect(view.line[i].t - view.line[i - 1].t).toBeLessThanOrEqual(DAY);
        expect(view.line[i].t).toBeGreaterThan(view.line[i - 1].t);
        expect(Math.abs(view.line[i].lon - view.line[i - 1].lon)).toBeLessThan(3);
      }
      // Turning points: where the line's direction changes.
      const turns: number[] = [];
      for (let i = 1; i < view.line.length - 1; i += 1) {
        const a = view.line[i].lon - view.line[i - 1].lon;
        const b = view.line[i + 1].lon - view.line[i].lon;
        if (a * b < 0) turns.push(view.line[i].t);
      }
      const stations = view.windows.flatMap((w) => [w.from, w.to]).filter((t) => t > view.start && t < view.end);
      expect(turns.length, String(year)).toBe(stations.length);
      turns.forEach((t, i) => expect(Math.abs(t - stations[i])).toBeLessThanOrEqual(DAY));
      // The station positions are the table's.
      for (const w of view.windows) {
        expect(formatLongitude(w.lonRx)).toBe(w.window.stationRx);
        expect(formatLongitude(w.lonDirect)).toBe(w.window.stationDirect);
      }
    }
  });
});

describe('mercuryYearPlot', () => {
  for (const layout of [WIDE, NARROW]) {
    it(`keeps every piece inside the plot and the data range (${layout.w} wide)`, () => {
      for (const year of years) {
        const view = mercuryYear(year, windows, lon, data)!;
        const plot = mercuryYearPlot(view, layout);
        // Retrograde strokes fall, direct strokes climb.
        for (const c of plot.chunks) {
          expect(c.from).toBeGreaterThanOrEqual(Math.max(view.start, Date.parse(sky.from)));
          expect(c.to).toBeLessThanOrEqual(Math.min(view.end, Date.parse(sky.to)));
          for (let i = 1; i < c.points.length; i += 1) {
            if (c.retro) expect(c.points[i].y).toBeGreaterThanOrEqual(c.points[i - 1].y);
            else expect(c.points[i].y).toBeLessThanOrEqual(c.points[i - 1].y);
          }
          for (const p of c.points) {
            expect(p.x).toBeGreaterThanOrEqual(layout.x0);
            expect(p.x).toBeLessThanOrEqual(layout.x1);
            expect(p.y).toBeGreaterThanOrEqual(layout.top);
            expect(p.y).toBeLessThanOrEqual(layout.bottom);
          }
        }
        // The line is continuous: each stroke begins where the last one ended.
        for (let i = 1; i < plot.chunks.length; i += 1) {
          expect(plot.chunks[i].from).toBe(plot.chunks[i - 1].to);
          expect(plot.chunks[i].points[0]).toEqual(plot.chunks[i - 1].points.at(-1));
        }
        expect(plot.chunks[0].from).toBe(view.start);
        expect(plot.chunks.at(-1)!.to).toBe(view.end);
        // Each retrograde is drawn as retrograde strokes, exactly station to station.
        const retroSpans = plot.chunks.filter((c) => c.retro).map((c) => [c.from, c.to]);
        for (const w of view.windows) {
          const inside = retroSpans.filter(([a, b]) => a >= w.from && b <= w.to);
          expect(inside[0][0]).toBe(Math.max(w.from, view.start));
          expect(inside.at(-1)![1]).toBe(Math.min(w.to, view.end));
        }
        // Constant time: each stroke's delay and duration are its share of the year.
        for (const c of plot.chunks) {
          expect(Math.abs(c.delay - ((c.from - view.start) / (view.end - view.start)) * LINE_MS)).toBeLessThanOrEqual(0.5);
          expect(c.to - c.from).toBeLessThanOrEqual(8 * DAY);
        }
        expect(plot.chunks.at(-1)!.delay + plot.chunks.at(-1)!.dur).toBeLessThanOrEqual(LINE_MS + 1);
        // Labels: inside the figure, clear of the line, the shadows and each other.
        plot.marks.forEach((m, i) => {
          expect(labelIsClear(plot, i), `${year} label ${i}`).toBe(true);
          expect(m.label.box.x).toBeGreaterThanOrEqual(layout.x0);
          expect(m.label.box.x + m.label.box.w).toBeLessThanOrEqual(layout.w);
          expect(m.label.box.y).toBeGreaterThanOrEqual(0);
          expect(m.label.lines.join(' ')).toBe(windowLabelLines(view.windows[i], false)[0]);
        });
        // Full sign bands, every one inside the plot.
        expect(plot.bands[0].yBottom).toBe(layout.bottom);
        expect(plot.bands.at(-1)!.yTop).toBe(layout.top);
      }
    });
  }

  it('labels each 2026 retrograde with the table dates', () => {
    const view = mercuryYear(2026, windows, lon, data)!;
    expect(mercuryYearPlot(view, WIDE).marks.map((m) => m.label.lines.join(' '))).toEqual([
      'Feb 26 to Mar 20', 'Jun 29 to Jul 23', 'Oct 24 to Nov 13',
    ]);
  });
});
