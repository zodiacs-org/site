/*
 * The aspect-pattern and explorer section images print values to 0.001° or
 * losslessly (pattern orbs, the chart shape's gaps and spans). Drawn from the
 * chart itself, a chart with a birth time before standard time gave its UTC
 * instant's seconds, and so the birthplace's longitude in strips, and a chart
 * without a birth time gave its noon at the birthplace, and so the time zone.
 * They are now drawn from the chart an image draws (chart-image-sky), which
 * shows no more than the chart's link.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { buildAspectPatternModel, selectedPatternCard } from './aspect-pattern-model';
import { buildChartContext } from './chart-context';
import { chartForImage } from './chart-image-sky';
import { computeChart } from './engine/full';
import { prepareLocalTime, resolveLocalToUtc } from './time/localToUtc';
import { CONTEXT_SECTIONS, contextSectionLines } from '../islands/explorer/chart-context-copy';

const buffalo = { date: '1870-06-15', time: '14:30', zone: 'America/New_York', lat: 42.8864, lon: -78.8784 };
const chartAt = (ms: number) => computeChart({
  utc: new Date(ms), latitude: buffalo.lat, longitude: buffalo.lon, houseSystem: 'whole', timeKnown: true, flags: ['lmt'],
});
const patternCard = async (chart: ReturnType<typeof chartAt>, drawn = true) => {
  const sky = drawn ? await chartForImage({ chart }) : chart;
  const model = buildAspectPatternModel({ context: 'natal', points: sky.bodies, aspects: sky.aspects, timeKnown: true, sourceKey: 'fixture' });
  return selectedPatternCard(model, 't-square:Moon,Uranus,Neptune:apex:Neptune');
};
const contextLines = async (chart: ReturnType<typeof computeChart>, birthDate?: string) => {
  const drawn = await chartForImage({ chart, birthDate });
  const model = buildChartContext({
    bodies: drawn.bodies, timeKnown: chart.input.timeKnown, moonSignCandidates: drawn.moonSignCandidates,
    angles: drawn.angles, houses: drawn.houses,
  });
  return CONTEXT_SECTIONS.flatMap((section) => contextSectionLines(model, section, 'en'));
};

beforeAll(async () => {
  await prepareLocalTime(buffalo.date, buffalo.zone);
  for (const zone of ['Asia/Kathmandu', 'Pacific/Pago_Pago']) await prepareLocalTime('2013-06-15', zone);
});

describe('pattern and explorer images of a chart with a birth time before standard time', () => {
  it('print a pattern’s lossless orbs at the whole minute: one image for every instant in it', async () => {
    const truth = resolveLocalToUtc(buffalo.date, buffalo.time, buffalo.zone, { longitude: buffalo.lon }).utc;
    expect(truth.toISOString()).toBe('1870-06-15T19:45:31.000Z');
    const minute = Date.parse('1870-06-15T19:46:00Z');
    const images = new Set<string>();
    for (let offset = -30_000; offset < 30_000; offset += 5_000) {
      const card = await patternCard(chartAt(minute + offset));
      expect(card).not.toBeNull();
      images.add(JSON.stringify([card!.receipt, card!.points]));
    }
    expect(images.size).toBe(1);
    // The page keeps the chart's own orbs; the image does not carry them.
    const page = await patternCard(chartAt(truth.getTime()), false);
    expect(JSON.stringify(page!.receipt)).not.toBe(JSON.stringify((await patternCard(chartAt(truth.getTime())))!.receipt));
  });

  it('print the chart shape and every other section at the whole minute', async () => {
    const minute = Date.parse('1870-06-15T19:46:00Z');
    const images = new Set<string>();
    for (let offset = -30_000; offset < 30_000; offset += 7_500) images.add(JSON.stringify(await contextLines(chartAt(minute + offset))));
    expect(images.size).toBe(1);
  });
});

describe('explorer images of a chart without a birth time', () => {
  it('show the sky at 12:00 UTC on the date: the same lines for every birthplace', async () => {
    const pages = new Set<string>();
    const images = new Set<string>();
    for (const place of [{ zone: 'Asia/Kathmandu', lat: 27.72, lon: 85.32 }, { zone: 'Pacific/Pago_Pago', lat: -14.28, lon: -170.7 }]) {
      const resolved = resolveLocalToUtc('2013-06-15', '12:00', place.zone, { longitude: place.lon });
      const chart = {
        ...computeChart({ utc: resolved.utc, latitude: place.lat, longitude: place.lon, houseSystem: 'whole', timeKnown: false, flags: resolved.flags }),
        moonSignCandidates: [],
      };
      pages.add(JSON.stringify(CONTEXT_SECTIONS.flatMap((section) => contextSectionLines(buildChartContext({
        bodies: chart.bodies, timeKnown: false, moonSignCandidates: [], angles: chart.angles, houses: chart.houses,
      }), section, 'en'))));
      images.add(JSON.stringify(await contextLines(chart, '2013-06-15')));
    }
    expect(pages.size).toBe(2);
    expect(images.size).toBe(1);
  });
});
