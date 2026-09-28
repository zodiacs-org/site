import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeBodies, computeChart } from '../engine/full';
import { ENGINE_VERSION } from '../engine/types';
import { encodePositionsLink } from '../share-positions';
import type { SavedChart } from './schema';
import {
  cardMatchesChart,
  cardPositionsForChart,
  cardTokenFromHash,
  cardUrl,
  decodeCardLink,
  encodeCardLink,
  loadCardPositionsForChart,
  positionsForChart,
} from './card-link';
import { CIRCLE_KEY, MAX_CIRCLE, addCard, loadCircle, parseCircle, removeCircleEntry, renameCircleEntry } from './circle';

function savedChart(timeKnown = true): SavedChart {
  const chart = computeChart({
    utc: new Date('1992-03-09T07:45:00Z'),
    latitude: 48.8566,
    longitude: 2.3522,
    houseSystem: 'whole',
    timeKnown,
  });
  return {
    id: '5b1f1d4e-2f0c-4a53-9d1e-2d7f4b0c9a11',
    name: 'Pisces Sun · 1992-03-09',
    relationship: 'self',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    birth: { date: '1992-03-09', time: timeKnown ? '08:45' : null, timeKnown, place: null },
    summary: {
      engineVersion: ENGINE_VERSION,
      utcISO: '1992-03-09T07:45:00.000Z',
      houseSystem: 'whole',
      bodies: chart.bodies.map(({ body, lon, retrograde }) => ({ body, lon, retrograde })),
      angles: chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null,
      flags: [],
    },
  };
}

function reencode(wire: unknown): string {
  const json = JSON.stringify(wire);
  const base64 = Buffer.from(json, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
  return `c1.${base64}`;
}

describe('chart card links', () => {
  it('round-trips a name and positions, and nothing else', () => {
    const chart = savedChart();
    const token = encodeCardLink({ chart: positionsForChart(chart), label: 'Maya' })!;
    const card = decodeCardLink(token)!;
    expect(card.label).toBe('Maya');
    expect(card.timeKnown).toBe(true);
    expect(card.chart.bodies).toHaveLength(12);
    const wire = JSON.parse(Buffer.from(token.slice(3), 'base64url').toString('utf8'));
    expect(Object.keys(wire).sort()).toEqual(['k', 'l', 'p']);
    expect(token).not.toContain('1992');
    expect(cardMatchesChart(card, positionsForChart(chart))).toBe(true);
    expect(cardMatchesChart(card, positionsForChart(savedChart(false)))).toBe(false);
    expect(cardMatchesChart(card, null)).toBe(false);
  });

  it('carries ASC and MC to the whole degree and every body to 0.001°', () => {
    const chart = savedChart();
    const token = encodeCardLink({ chart: positionsForChart(chart), label: 'Maya' })!;
    const card = decodeCardLink(token)!;
    const { asc, mc } = chart.summary.angles!;
    expect(card.chart.angles).toEqual({ asc: Math.floor(asc) + 0.5, mc: Math.floor(mc) + 0.5 });
    for (const row of card.chart.bodies) {
      const exact = chart.summary.bodies.find((body) => body.body === row.body)!.lon;
      expect(Math.abs(((row.lon - exact + 540) % 360) - 180)).toBeLessThanOrEqual(0.0005 + 1e-9);
    }
    // A card with exact angles is not one this site makes, so it is refused.
    const wire = JSON.parse(Buffer.from(token.slice(3), 'base64url').toString('utf8'));
    expect(decodeCardLink(reencode({ ...wire, p: encodePositionsLink(positionsForChart(chart)) }))).toBeNull();
  });

  it('makes a card without a birth time from the sky at 12:00 UTC on the birth date, not the chart’s own noon', async () => {
    // The saved chart's own positions stand for noon at the birthplace, an
    // instant that gives the place away; the card carries noon UTC instead.
    const chart = savedChart(false);
    const positions = (await loadCardPositionsForChart(chart))!;
    expect(positions.angles).toBeNull();
    const noonUtc = computeBodies(new Date('1992-03-09T12:00:00Z'));
    for (const row of positions.bodies) {
      expect(row.lon).toBe(noonUtc.find((body) => body.body === row.body)!.lon);
    }
    const asked: string[] = [];
    cardPositionsForChart(chart, (utc) => { asked.push(utc.toISOString()); return noonUtc; });
    expect(asked).toEqual(['1992-03-09T12:00:00.000Z']);
    const card = decodeCardLink(encodeCardLink({ chart: positions, label: 'Maya' })!)!;
    expect(card.timeKnown).toBe(false);
    // One's own card is still recognised, against the same noon-UTC positions.
    expect(cardMatchesChart(card, positions)).toBe(true);
    expect(cardMatchesChart(card, positionsForChart(chart))).toBe(false);
    // A chart with a birth time keeps its own positions.
    expect(await loadCardPositionsForChart(savedChart())).toEqual(positionsForChart(savedChart()));
  });

  it('gives no rising sign for a chart without a birth time', () => {
    // Older reference-time saves can still carry angles; they must not travel.
    const chart = { ...savedChart(false) };
    chart.summary = { ...chart.summary, angles: { asc: 12, mc: 100 } };
    expect(positionsForChart(chart).angles).toBeNull();
    const card = decodeCardLink(encodeCardLink({ chart: positionsForChart(chart), label: '' })!)!;
    expect(card).toMatchObject({ label: '', timeKnown: false });
    expect(card.chart.angles).toBeNull();
  });

  it('cleans the name on the way out', () => {
    const token = encodeCardLink({ chart: positionsForChart(savedChart()), label: ' Ma‮ya ' })!;
    expect(decodeCardLink(token)!.label).toBe('Ma ya');
  });

  it('refuses hostile or altered links', () => {
    const chart = savedChart();
    const token = encodeCardLink({ chart: positionsForChart(chart), label: 'Maya' })!;
    const wire = JSON.parse(Buffer.from(token.slice(3), 'base64url').toString('utf8'));
    expect(decodeCardLink(reencode(wire))).not.toBeNull();
    expect(decodeCardLink(reencode({ ...wire, n: 'x' }))).toBeNull();
    expect(decodeCardLink(reencode({ ...wire, k: false }))).toBeNull();
    expect(decodeCardLink(reencode({ ...wire, l: 'Ma‮ya' }))).toBeNull();
    expect(decodeCardLink(reencode({ ...wire, l: 'x'.repeat(25) }))).toBeNull();
    expect(decodeCardLink(reencode({ ...wire, p: 'nope' }))).toBeNull();
    expect(decodeCardLink(`${token}=`)).toBeNull();
    expect(decodeCardLink(`s1.${token.slice(3)}`)).toBeNull();
    expect(decodeCardLink('c1.' + 'A'.repeat(700))).toBeNull();
    expect(decodeCardLink(null as unknown as string)).toBeNull();
  });

  it('reads the token only from an exact card fragment', () => {
    expect(cardTokenFromHash('#card=c1.abc_-')).toBe('c1.abc_-');
    expect(cardTokenFromHash('#card=c1.abc&x=1')).toBeNull();
    expect(cardTokenFromHash('#p=2.abc')).toBeNull();
    expect(cardUrl('https://zodiacs.org', 'c1.abc')).toBe('https://zodiacs.org/profile/#card=c1.abc');
  });
});

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('cards kept with your people', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { dispatchEvent: () => true });
  });
  afterEach(() => vi.unstubAllGlobals());

  const card = (label: string, utc = '1992-03-09T07:45:00Z') => {
    const chart = computeChart({ utc: new Date(utc), latitude: 1, longitude: 2, houseSystem: 'whole', timeKnown: true });
    const token = encodeCardLink({
      chart: {
        bodies: chart.bodies,
        angles: chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null,
        houseSystem: 'whole',
        engineVersion: ENGINE_VERSION,
      },
      label,
    })!;
    return decodeCardLink(token)!;
  };

  it('keeps one entry per person and refreshes the name on a repeat', () => {
    expect(addCard(card('Maya'))).toBe('added');
    expect(addCard(card('Maya R'))).toBe('updated');
    expect(addCard(card(''))).toBe('updated');
    const [entry] = loadCircle();
    expect(loadCircle()).toHaveLength(1);
    expect(entry.name).toBe('Maya R');
    expect(renameCircleEntry(entry.id, 'Mom')).toBe(true);
    expect(loadCircle()[0].name).toBe('Mom');
    expect(removeCircleEntry(entry.id)).toBe(true);
    expect(storage.getItem(CIRCLE_KEY)).toBeNull();
  });

  it('stops at the cap', () => {
    for (let index = 0; index < MAX_CIRCLE; index += 1) {
      expect(addCard(card(`P${index}`, new Date(Date.UTC(1990, 0, 1 + index * 9)).toISOString()))).toBe('added');
    }
    expect(addCard(card('One more', '2001-06-01T00:00:00Z'))).toBe('full');
  });

  it('drops malformed or tampered entries from storage', () => {
    expect(addCard(card('Maya'))).toBe('added');
    const [entry] = JSON.parse(storage.getItem(CIRCLE_KEY)!);
    const tampered = [
      entry,
      { ...entry, id: 'not-an-id' },
      { ...entry, name: 'Ma‮ya' },
      { ...entry, extra: 1 },
      { ...entry, timeKnown: false },
      { ...entry, chart: { ...entry.chart, bodies: entry.chart.bodies.slice(1) } },
      'nonsense',
    ];
    expect(parseCircle(JSON.stringify(tampered))).toHaveLength(1);
    expect(parseCircle('{')).toEqual([]);
  });
});
