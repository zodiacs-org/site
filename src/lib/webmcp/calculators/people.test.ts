import { describe, expect, it } from 'vitest';
import { resolveForm, type SlotState } from '../../../islands/SynastryCalculator';
import * as engine from '../../engine/full';
import { findInterAspects, summarizePair } from '../../engine/synastry';
import type { Chart } from '../../engine/types';
import { calculateEntry, type ChartEntry } from '../../sharing/chart-entry';
import { sharingText } from '../../sharing/copy';
import { groupReading, validGroupSize } from '../../sharing/group';
import { TWIN_DIRECTORY } from '../../sharing/twin-directory';
import { matchTwins, twinSigns, type TwinMatch } from '../../sharing/twins';
import { signBySlug } from '../../signs';
import { TRANSIT_ORB } from '../../transits';
import { resolveLocalToUtc } from '../../time/localToUtc';
import { personNatal } from './chart';
import { BIRTHS, city } from './fixtures';
import type { Birth } from './input';
import { islandFunction, ref } from './island-code';
import {
  chartTwinsResult, compatibilityResult, DuplicatePersonError, groupChartResult, TRANSIT_BODIES, transitsResult,
} from './people';

// The refused untimed date is a chart-page rule; these pages read local noon without that check.
const PEOPLE = BIRTHS.filter(([label]) => label !== 'an untimed date the clock skipped');

const slot = (birth: Birth): SlotState => ({
  source: 'form', savedId: '', name: '', date: birth.date, time: birth.time ?? '', timeKnown: birth.time !== null,
  city: city(birth), link: null, positions: null,
} as unknown as SlotState);

const entry = (birth: Birth, name = ''): ChartEntry => ({
  id: 1, name, date: birth.date, time: birth.time ?? '', timeKnown: birth.time !== null, city: city(birth), calendar: 'gregorian',
});

describe('SynastryCalculator (/compatibility/)', () => {
  it.each(PEOPLE)('reads each person as the page does: %s', async (_label, birth) => {
    const shown = await resolveForm(slot(birth), 'Person A', async () => engine);
    const { chart } = await personNatal(birth);
    expect(chart.bodies).toEqual(shown.positions.bodies);
    expect(chart.angles?.asc ?? null).toBe(shown.asc);
    expect(chart.input.utc).toEqual(shown.computedUtc);
  });

  it('compares two people as the page does', async () => {
    for (let index = 0; index + 1 < PEOPLE.length; index += 1) {
      const [first, second] = [PEOPLE[index][1], PEOPLE[index + 1][1]];
      const [a, b] = [await resolveForm(slot(first), 'A', async () => engine), await resolveForm(slot(second), 'B', async () => engine)];
      const summary = summarizePair(a.bodies, b.bodies, 8);
      const result = await compatibilityResult(first, second);
      expect(result.topContacts.map(({ first: x, second: y, type }) => [x, y, type]))
        .toEqual(summary.top.map((contact) => [contact.a, contact.b, contact.type]));
      expect(result.topContacts.map((contact) => contact.orb)).toEqual(summary.top.map((contact) => Number(contact.orb.toFixed(4))));
      expect(result.contactCount).toBe(summary.aspects.length);
      expect(result.counts).toEqual(summary.counts);
      expect([result.easeful, result.charged]).toEqual([summary.easeful, summary.charged]);
      expect(result.elements).toEqual({ first: summary.elements.a, second: summary.elements.b });
      expect(result.modalities).toEqual({ first: summary.modalities.a, second: summary.modalities.b });
      expect(result.people[1].rising === null).toBe(second.time === null);
    }
  });
});

describe('TransitTracker (/transits/)', () => {
  const natalFromForm = islandFunction('TransitTracker.tsx', { function: 'natalFromForm' });
  const wheelFromChart = islandFunction('TransitTracker.tsx', { function: 'wheelFromChart' });
  const pageBodies = islandFunction('TransitTracker.tsx', { const: 'TRANSIT_BODIES' }, { value: true });
  const overlay = islandFunction('transit/TransitRing.tsx', { useMemo: 'overlayBase' });
  const at = new Date('2026-10-15T12:00:00Z');

  it('lists the sky bodies the page lists', () => {
    expect(TRANSIT_BODIES).toEqual(pageBodies({}));
  });

  it.each(PEOPLE)('finds the contacts the page draws: %s', async (_label, birth) => {
    const natal = natalFromForm({
      resolveLocalToUtc,
      wheelFromChart: (...args: unknown[]) => wheelFromChart({}, ...args),
    }, slot(birth), engine) as { minimal: Array<{ body: string; lon: number }> };
    const computeSky = (when: Date) => engine.computeBodies(when)
      .filter((body) => TRANSIT_BODIES.has(body.body))
      .map(({ body, lon, retrograde }) => ({ body, lon, retrograde }));
    // The ring's useMemo callback, called as useMemo calls it.
    const { sky, hits } = overlay({
      computeSky, when: at, natal, findInterAspects, TRANSIT_ORB, c: { skyRingLabel: '' },
      buildTransitOverlay: (_label: string, bodies: unknown, contacts: unknown) => ({ sky: bodies, hits: contacts }),
    }) as { sky: Array<{ body: string; lon: number }>; hits: Array<{ a: string; b: string; type: string; orb: number }> };
    const result = await transitsResult(birth, at);
    expect(result.sky.map((body) => body.body)).toEqual(sky.map((body) => body.body));
    expect(result.contacts.map(({ transiting, natal: point, type }) => [transiting, point, type]))
      .toEqual(hits.map((hit) => [hit.a, hit.b, hit.type]));
    expect(result.contacts.map((contact) => contact.orb)).toEqual(hits.map((hit) => Number(hit.orb.toFixed(4))));
    expect(result.contacts.every((contact) => contact.orb <= TRANSIT_ORB && contact.transiting !== 'Moon')).toBe(true);
    if (birth.time === null) expect(result.contacts.some((contact) => contact.natal === 'Moon')).toBe(false);
  });
});

describe('ChartTwins (/chart-twins/)', () => {
  const compute = islandFunction('ChartTwins.tsx', { function: 'compute' });

  it.each(PEOPLE)('matches the directory as the page does: %s', async (_label, birth) => {
    const state: { result: { chart: Chart; signs: { sun: string | null; moon: string | null }; matches: TwinMatch[] } | null; error: string } = {
      result: null, error: '',
    };
    await compute({
      engine: async () => engine, loadModule: async () => ({}), calculateEntry, entry: entry(birth), locale: 'en',
      directory: TWIN_DIRECTORY, twinSigns, matchTwins, generation: ref(0), resultRef: ref(null),
      setResult: (value: typeof state.result) => { state.result = value; },
      setError: (value: string) => { state.error = value; },
      requestAnimationFrame: () => 0, calculationError: (_error: unknown, _locale: string, fallback: string) => fallback,
    }, { preventDefault() {} });
    expect(state.error).toBe('');
    const result = await chartTwinsResult(birth, TWIN_DIRECTORY);
    const name = (slug: string | null) => (slug === null ? null : signBySlug(slug).name);
    expect([result.sunSign, result.moonSign]).toEqual([name(state.result!.signs.sun), name(state.result!.signs.moon)]);
    expect(result.matches.map((match) => match.page)).toEqual(state.result!.matches.map((match) => `https://zodiacs.org/people/${match.person.slug}/`));
    expect(result.matches.map((match) => match.shares)).toEqual(state.result!.matches.map((match) => (
      match.count === 2 ? 'sun-and-moon' : match.sun ? 'sun' : 'moon')));
    if (birth.time === null) expect(result.moonSign).toBeNull();
  });
});

describe('GroupCharts (/group-charts/)', () => {
  const compute = islandFunction('GroupCharts.tsx', { function: 'compute' });
  const members = PEOPLE.slice(0, 5).map(([, birth], index) => ({ name: index === 2 ? '' : `Synthetic ${index + 1}`, birth }));

  it('reads each person\'s role as the page does', async () => {
    const state: { results: Array<{ name: string; reading: ReturnType<typeof groupReading> }> | null; error: string } = { results: null, error: '' };
    await compute({
      entries: members.map((member) => entry(member.birth, member.name)), validGroupSize, engine: async () => engine,
      loadModule: async () => ({}), calculateEntry, groupReading, locale: 'en', s: sharingText, generation: ref(0),
      resultRef: ref(null), prepare: async () => undefined,
      setResults: (value: typeof state.results) => { state.results = value; },
      setError: (value: string) => { state.error = value; },
      requestAnimationFrame: () => 0, calculationError: (_error: unknown, _locale: string, fallback: string) => fallback,
    }, { preventDefault() {} });
    expect(state.error).toBe('');
    const result = await groupChartResult(members.map((member, index) => ({
      name: member.name.trim() || `Person ${index + 1}`, birth: member.birth,
    })));
    expect(result.people.map((person) => person.name)).toEqual(state.results!.map((row) => row.name));
    expect(result.people.map((person) => [person.role, person.counts])).toEqual(state.results!.map((row) => [row.reading.role, row.reading.counts]));
    expect(result.people.map((person) => person.placements.map((placement) => placement.body)))
      .toEqual(state.results!.map((row) => row.reading.placements.map((placement) => placement.body)));
  });

  it('refuses the same person twice, as the page does', async () => {
    const twice = [members[0], members[1], { ...members[0] }];
    await expect(groupChartResult(twice)).rejects.toBeInstanceOf(DuplicatePersonError);
    const state = { error: '' };
    await compute({
      entries: twice.map((member) => entry(member.birth, member.name)), validGroupSize, engine: async () => engine,
      loadModule: async () => ({}), calculateEntry, groupReading, locale: 'en', s: sharingText, generation: ref(0),
      setError: (value: string) => { state.error = value; },
      calculationError: (_error: unknown, _locale: string, fallback: string) => fallback,
    }, { preventDefault() {} });
    expect(state.error).toBe(sharingText('en', 'groupError'));
  });
});
