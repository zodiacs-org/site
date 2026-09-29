import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { computeBodies, computeChart } from './engine/full';
import type { Chart } from './engine/types';
import { localDateEndpointsUtc } from './chart-date-certainty';
import { resolveLocalToUtc } from './time/localToUtc';
import { moonCandidates, moonCandidatesFromEndpoints, moonIsUncertain, moonLabel } from './moon-certainty';
import { chartSignature } from './chart-signature';
import { communicationRead } from './communication';
import { approachRead } from './approach';
import { approachCardContent, bigThreePlacements, communicationCardContent, signatureCardContent } from './share-card';
import { decodePositionsLink, encodePositionsLink } from './share-positions';
import { positionsReading } from './share-positions-reading';
import { buildSceneModel } from './scene/build';
import ReadingPath from '../islands/explorer/ReadingPath';
import Inspector from '../islands/explorer/Inspector';
import { PositionsOnlyResult } from '../islands/PositionsShareSurface';
import ChartShareDialog from '../islands/ChartShareDialog';
import ChartTour, { type ChartTourProps } from '../islands/explorer/tour/ChartTour';
import { deriveChapters, flattenStops } from './scene/chapters';

function unknownTimeChart(date = '1990-01-01', zone = 'Europe/London'): Chart {
  const endpoints = localDateEndpointsUtc(date, zone);
  const chart = computeChart({
    utc: resolveLocalToUtc(date, '12:00', zone).utc,
    timeKnown: false, houseSystem: 'whole', latitude: 51.5074, longitude: -0.1278,
  });
  chart.moonSignCandidates = moonCandidatesFromEndpoints(computeBodies(endpoints.start), computeBodies(endpoints.end));
  return chart;
}

function tourMarkup(chart: Chart, variant: ChartTourProps['variant'], initialStep = 0) {
  return render(h(ChartTour, {
    scene: buildSceneModel(chart), chart, locale: 'en', variant, initialStep, selection: null,
    loadEngine: () => import('./engine/full'), buildScene: buildSceneModel, renderInspector: () => null,
    topAspects: (aspects) => aspects, readAspect: () => 'Definitive aspect reading', readHouse: () => '',
    onSelect: () => {}, onAnnounce: () => {}, onVisual: () => {}, onEnsure: () => {}, onTrack: () => {},
    onSave: () => {}, shareLabel: 'Share', shareStatusLabel: 'Share', shareDisabled: true,
    onShare: () => {}, onExit: () => {}, returnFocus: () => {},
  }));
}

describe('local-day Moon uncertainty', () => {
  it('retains both real London candidates even when the noon reference is already Pisces', () => {
    const chart = unknownTimeChart();
    expect(chart.bodies.find((body) => body.body === 'Moon')!.lon).toBeGreaterThan(330);
    expect(moonCandidates(chart)).toEqual(['aquarius', 'pisces']);
    expect(moonLabel(chart)).toBe('Aquarius / Pisces');
    expect(moonIsUncertain(chart)).toBe(true);
    expect(chart.angles).toBeNull();
    expect(chart.houses).toBeNull();
  });

  it('uses the local civil date rather than imposing the same candidates on every timezone', () => {
    const chart = unknownTimeChart('1990-01-01', 'America/Los_Angeles');
    expect(moonCandidates(chart)).toEqual(['pisces']);
    expect(moonIsUncertain(chart)).toBe(false);
  });

  it('keeps a stable unknown-time date eligible for its one Moon reading', () => {
    const chart = unknownTimeChart('1990-01-02');
    expect(moonCandidates(chart)).toEqual(['pisces']);
    expect(communicationRead(chart).moonSign).toBe('pisces');
    expect(approachRead(chart).moon?.sign).toBe('pisces');
  });

  it('does not infer another sign when endpoint data is absent', () => {
    const chart = unknownTimeChart();
    expect(moonCandidatesFromEndpoints([], chart.bodies)).toEqual([]);
    expect(moonCandidatesFromEndpoints(chart.bodies, [])).toEqual([]);
    delete chart.moonSignCandidates;
    expect(moonCandidates(chart)).toEqual([]);
    expect(moonLabel(chart)).toBe('Needs a birth time');
  });

  it('keeps the Moon share preview consistent with the uncertain exported identity', () => {
    const preview = (chart: Chart, moonAmbiguous = false) => render(h(ChartShareDialog, {
      chart, locale: 'en', mode: 'moon', card: 'idle', moonAmbiguous,
      onCardStateChange: () => {}, onClose: () => {},
    }));
    // Without a birth time the exported card is drawn from the sky at 12:00 UTC
    // and names the Moon's sign only once untimedMoonSign finds one it held all
    // that date in every time zone (t17 checks that in the browser), never the
    // local-day candidates: the preview and its button follow the card.
    const boundary = unknownTimeChart();
    expect(moonLabel(boundary)).toBe('Aquarius / Pisces');
    expect(preview(boundary)).toContain('Needs a birth time');
    expect(preview(boundary)).not.toContain('Aquarius / Pisces');
    expect(preview(boundary)).not.toContain('calc-share-dialog__placement-glyph');
    expect(preview(boundary)).toContain('Share this image');

    const stable = unknownTimeChart('1990-01-02');
    expect(moonLabel(stable)).toBe('Pisces');
    expect(preview(stable)).toContain('Needs a birth time');
    expect(preview(stable)).not.toContain('calc-share-dialog__placement-glyph');
    expect(preview(stable)).not.toContain('Share my Moon sign');
    delete stable.moonSignCandidates;
    expect(preview(stable, true)).toContain('Needs a birth time');
    expect(preview(stable, true)).not.toContain('calc-share-dialog__placement-glyph');
  });

  it('preserves the Pisces-to-Aries wrap as two alternatives', () => {
    expect(moonCandidatesFromEndpoints([{ body: 'Moon', lon: 359.99 }], [{ body: 'Moon', lon: 0.01 }]))
      .toEqual(['pisces', 'aries']);
  });

  it('carries evidence into the scene without moving any astronomical position', () => {
    const chart = unknownTimeChart();
    const scene = buildSceneModel(chart);
    expect(scene.moonSignCandidates).toEqual(['aquarius', 'pisces']);
    for (const body of scene.bodies) expect(body.lon).toBe(chart.bodies.find((source) => source.body === body.body)!.lon);
    const markup = render(h(Inspector, { scene, selection: { kind: 'body', body: 'Moon' }, onSelect: () => {}, locale: 'en' }));
    expect(markup).toContain('Aquarius / Pisces');
    expect(markup).toContain('Needs a birth time');
    expect(markup).not.toContain('How the sign shapes it');
  });

  it('offers both reading links and leaves uncertain Moon out of identity, aspects and totals', () => {
    const chart = unknownTimeChart();
    const placements = chart.bodies.filter((body) => !body.body.includes('Node')).map((body) => ({ ...body, house: null }));
    const markup = render(h(ReadingPath, {
      placements, topAspects: [{ a: 'Sun', b: 'Moon', type: 'sextile', orb: 0.1, applying: false }],
      weather: { elements: { fire: 0, earth: 0, air: 0, water: 10 }, modalities: { cardinal: 10, fixed: 0, mutable: 0 }, lines: ['Unverified ten-planet claim'] },
      risingLon: null, housesKnown: false, moonSignCandidates: chart.moonSignCandidates, onShowOnChart: () => {},
    }));
    expect(markup).toContain('Aquarius / Pisces');
    expect(markup).toContain('/learn/placements/moon-in-aquarius/');
    expect(markup).toContain('/learn/placements/moon-in-pisces/');
    expect(markup).not.toContain('Show on chart: Moon in Pisces');
    expect(markup).not.toContain('Sun sextile Moon');
    expect(markup).not.toContain('Unverified ten-planet claim');
    expect(markup).toContain('The Moon is left out of these totals');
  });

  it('keeps both identities in quick and full tour Moon stops', () => {
    const chart = unknownTimeChart();
    expect(tourMarkup(chart, 'quick')).toContain('Aquarius / Pisces');
    const chapters = deriveChapters(buildSceneModel(chart));
    const moonStop = flattenStops(chapters).findIndex((stop) => chapters[stop.chapter].id === 'big-three'
      && chapters[stop.chapter].subs[stop.sub]?.id === 'moon');
    expect(moonStop).toBeGreaterThan(-1);
    const markup = tourMarkup(chart, 'full', moonStop);
    expect(markup).toContain('Aquarius / Pisces');
    expect(markup).toContain('Needs a birth time');
    expect(markup).not.toContain('Your Moon in Pisces');
  });

  it('does not turn a reference Moon aspect into the tour’s personal reading', () => {
    const chart = unknownTimeChart();
    chart.aspects = [{ a: 'Sun', b: 'Moon', type: 'sextile', orb: 0.1, applying: false }];
    expect(tourMarkup(chart, 'quick', 2)).not.toContain('Definitive aspect reading');
    const scene = buildSceneModel(chart);
    const markup = render(h(Inspector, { scene, selection: { kind: 'aspect', a: 'Sun', b: 'Moon', type: 'sextile' }, onSelect: () => {}, locale: 'en' }));
    expect(markup).toContain('Aquarius / Pisces');
    expect(markup).not.toContain('How it works here');
    expect(markup).toContain('reference positions');
    expect(markup).not.toContain('12:00');
  });

  it('treats either sign as possible when selected in the inspector', () => {
    const scene = buildSceneModel(unknownTimeChart());
    for (const sign of ['aquarius', 'pisces'] as const) {
      const markup = render(h(Inspector, { scene, selection: { kind: 'sign', sign }, onSelect: () => {}, locale: 'en' }));
      expect(markup).toContain('Aquarius / Pisces');
      expect(markup).not.toContain('Moon uses this style in your chart');
    }
  });

  it('does not promote a reference Moon aspect, dignity or stellium into a signature', () => {
    const chart = unknownTimeChart();
    chart.bodies = chart.bodies.filter((body) => ['Sun', 'Moon'].includes(body.body)).map((body) => ({ ...body, lon: body.body === 'Sun' ? 65 : 45 }));
    chart.moonSignCandidates = ['aries', 'taurus'];
    chart.aspects = [{ a: 'Moon', b: 'Sun', type: 'conjunction', orb: 0.1, applying: false }];
    const signature = chartSignature(chart);
    expect(signature.kind).toBe('big-three');
    expect(signature.title).toContain('Aries / Taurus Moon');
    expect(signature.detail).toContain('need a birth time');
  });

  it('keeps both candidates in social identities without a definitive Moon advice line', () => {
    const chart = unknownTimeChart();
    expect(bigThreePlacements(chart).find((row) => row.kind === 'moon')).toMatchObject({ sign: 'Aquarius / Pisces', slug: '', uncertain: true });
    expect(signatureCardContent(chart).bigThree.find((row) => row.kind === 'moon')?.sign).toBe('Aquarius / Pisces');
    expect(communicationRead(chart).moonSign).toBeNull();
    expect(communicationRead(chart).aspects.every((aspect) => aspect.target !== 'Moon')).toBe(true);
    expect(communicationCardContent(chart).rows.find((row) => row.body === 'Moon')).toMatchObject({ sign: 'Aquarius / Pisces', reading: 'Needs a birth time' });
    expect(approachRead(chart).moon).toBeNull();
    expect(approachCardContent(chart).rows.find((row) => row.body === 'Moon')).toMatchObject({ sign: 'Aquarius / Pisces', reading: 'Needs a birth time' });
  });

  it('keeps the positions token unchanged and its receiver uncertainty unresolved', () => {
    const chart = unknownTimeChart();
    const token = encodePositionsLink({ bodies: chart.bodies, angles: chart.angles, houseSystem: 'whole', engineVersion: chart.engineVersion });
    expect(token).not.toBeNull();
    const received = decodePositionsLink(token!)!;
    expect(received).not.toHaveProperty('moonSignCandidates');
    expect(moonCandidates(received)).toEqual([]);
    expect(bigThreePlacements(received).find((row) => row.kind === 'moon')).toMatchObject({ sign: 'Needs a birth time', uncertain: true });
    expect(positionsReading(received).topAspects.every((aspect) => aspect.a !== 'Moon' && aspect.b !== 'Moon')).toBe(true);
    const markup = render(h(PositionsOnlyResult, { chart: received, locale: 'en' }));
    expect(markup).toContain('Moon · Needs a birth time');
    expect(markup).not.toContain('The Moon also changed signs that day');
    expect(markup).not.toContain('Aquarius / Pisces');
    const timed = computeChart({ ...chart.input, timeKnown: true });
    expect(moonCandidates(timed)).toHaveLength(1);
    expect(bigThreePlacements(timed).find((row) => row.kind === 'moon')).not.toHaveProperty('uncertain');
  });
});
