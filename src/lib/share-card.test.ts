import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHART_SHEET_LAYOUT,
  CHART_SHEET_ASPECT_LEGEND,
  CHART_SHEET_ASPECT_SCOPE,
  SHARE_CARD_SCALE,
  SHARE_CARD_WORDMARK,
  approachCardContent,
  authoredSignatureForLocale,
  bigThreePlacements,
  chartCardFilename,
  chartCardReceipt,
  chartPreviewPlacement,
  chartSheetAspectOrb,
  chartSheetOrbLimits,
  chartSheetProvenanceLines,
  chartSheetSettings,
  communicationCardContent,
  dominantProfile,
  downloadPreparedChartCard,
  firstSentence,
  primaryShareCardVariant,
  shareCardTimeNotes,
  signatureCardContent,
  savePreparedChartCard,
  CHART_SHEET_ASPECT_SCOPE_NO_MOON,
  cardDegreeText,
  chartSheetContent,
  imageChart,
  imagePositions,
  prepareChartCard,
  timedImageChart,
} from './share-card';
import type { Chart } from './engine/types';
import { computeBodies, computeChart } from './engine/full';
import { decodePositionsLink, encodeSharedPositionsLink, wholeDegreeAngle } from './share-positions';
import { prepareLocalTime, resolveLocalToUtc } from './time/localToUtc';

const CHART = { engineVersion: '1.0.0' } as Chart;

describe('prepared image handoff', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const prepared = () => ({ blob: new Blob(['png'], { type: 'image/png' }), filename: 'zodiacs-solar-return-2024.png' });
  function setup(canShare: () => boolean = () => false, share = vi.fn()) {
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.stubGlobal('navigator', { canShare, share });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prepared-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.useFakeTimers();
    return { anchor, share };
  }

  it('explicit Save starts a download without opening native share and then releases its URL', () => {
    const { anchor, share } = setup(() => true);
    expect(downloadPreparedChartCard(prepared())).toBe('downloaded');
    expect(anchor.download).toBe('zodiacs-solar-return-2024.png');
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(share).not.toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prepared-image');
  });

  it('reaches native file sharing synchronously and sends only the prepared file', async () => {
    const { anchor, share } = setup(() => true, vi.fn().mockResolvedValue(undefined));
    const outcome = savePreparedChartCard(prepared());
    expect(share).toHaveBeenCalledExactlyOnceWith({ files: [expect.any(File)] });
    expect(Object.keys(share.mock.calls[0][0])).toEqual(['files']);
    expect(await outcome).toBe('shared');
    expect(anchor.click).not.toHaveBeenCalled();
  });

  it('keeps native cancellation neutral without downloading another copy', async () => {
    const { anchor } = setup(() => true, vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')));
    expect(await savePreparedChartCard(prepared())).toBe('cancelled');
    expect(anchor.click).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it.each(['unsupported', 'capability-error', 'share-error'])('retains download fallback after %s', async (kind) => {
    const { anchor } = setup(() => {
      if (kind === 'capability-error') throw new TypeError('File checks unavailable');
      return kind !== 'unsupported';
    }, vi.fn().mockRejectedValue(new Error('Share refused')));
    expect(await savePreparedChartCard(prepared())).toBe('downloaded');
    expect(anchor.click).toHaveBeenCalledOnce();
  });

  it('does not report a blocked click as downloaded and still releases its resources', () => {
    const { anchor } = setup();
    anchor.click.mockImplementation(() => { throw new Error('Download blocked'); });
    expect(() => downloadPreparedChartCard(prepared())).toThrow('Download blocked');
    expect(anchor.remove).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
});

describe('chartCardReceipt', () => {
  it('uses only the engine version by default', () => {
    const receipt = chartCardReceipt(CHART);

    expect(receipt).toBe('Engine 1.0.0');
    expect(receipt).not.toContain('1990');
    expect(receipt).not.toContain('08:30');
    expect(receipt).not.toContain('New York');
    expect(receipt).not.toContain('Alex');
  });

  it('uses the chart engine version rather than a hard-coded version', () => {
    expect(chartCardReceipt({ engineVersion: '2.4.1' })).toBe('Engine 2.4.1');
    expect(chartCardReceipt({ engineVersion: '2.4.1' }, 'es')).toBe('Motor 2.4.1');
  });
});

describe('chartCardFilename', () => {
  it('uses a generic full-chart filename with no input fields', () => {
    expect(chartCardFilename()).toBe('zodiacs-chart.png');
  });

  it('uses a private filename for the big-three card', () => {
    expect(chartCardFilename({ variant: 'big-three' })).toBe('zodiacs-big-three.png');
  });

  it('uses a generic filename for the communication card', () => {
    expect(chartCardFilename({ variant: 'communication' })).toBe('zodiacs-communication.png');
  });

  it('uses privacy-safe filenames for signature and approach cards', () => {
    expect(chartCardFilename({ variant: 'signature' })).toBe('zodiacs-chart-signature.png');
    expect(chartCardFilename({ variant: 'approach' })).toBe('zodiacs-how-to-approach-me.png');
  });

  it('uses the generic Reddit sheet filename', () => {
    expect(chartCardFilename({ variant: 'sheet' })).toBe('zodiacs-chart-sheet.png');
  });
});

describe('chart sheet formatting', () => {
  it('keeps the aspect header clear of the rotated planet labels', () => {
    expect(CHART_SHEET_LAYOUT.aspectGridY - CHART_SHEET_LAYOUT.sectionTitleY)
      .toBeGreaterThanOrEqual(200);
  });

  it('uses a readable site signature beside the profile image', () => {
    expect(CHART_SHEET_LAYOUT.brandFontSize).toBeGreaterThan(31);
    expect(CHART_SHEET_LAYOUT.brandIconSize).toBeGreaterThanOrEqual(80);
    expect(CHART_SHEET_LAYOUT.brandGap).toBe(0);
  });

  it('keeps the technical wheel strictly clear of the top-right logo box', () => {
    const brandBottom = CHART_SHEET_LAYOUT.brandWordmarkY
      + CHART_SHEET_LAYOUT.brandIconSize / 2;
    expect(CHART_SHEET_LAYOUT.wheelY - brandBottom).toBeGreaterThanOrEqual(8);
  });

  it('fits the enlarged wheel, sixteen placement rows, grid, and footer', () => {
    expect(CHART_SHEET_LAYOUT.wheelSize).toBeGreaterThan(1000);
    expect(CHART_SHEET_LAYOUT.tableTop + (15 * CHART_SHEET_LAYOUT.tableRowHeight) + 25)
      .toBeLessThan(CHART_SHEET_LAYOUT.footerY);
    expect(CHART_SHEET_LAYOUT.aspectGridY + (10 * CHART_SHEET_LAYOUT.aspectCellSize))
      .toBeLessThan(CHART_SHEET_LAYOUT.footerY);
  });

  it('carries rounded arcminutes into the next sign and wraps the zodiac', () => {
    expect(chartPreviewPlacement(29.999)).toMatchObject({ signSlug: 'taurus', degree: 0, minute: 0 });
    expect(chartPreviewPlacement(359.999)).toMatchObject({ signSlug: 'aries', degree: 0, minute: 0 });
  });

  it('stamps the configured house setting honestly', () => {
    expect(chartSheetSettings({ houses: { system: 'whole', cusps: [] } }))
      .toBe('Apparent geocentric · Tropical of date · Whole sign houses · True Node');
    expect(chartSheetSettings({ houses: { system: 'placidus', cusps: [] } }))
      .toBe('Apparent geocentric · Tropical of date · Placidus houses · True Node');
    expect(chartSheetSettings({ houses: null }))
      .toBe('Apparent geocentric · Tropical of date · No houses · True Node');
    expect(chartSheetSettings({ houses: null, input: { timeKnown: false } }))
      .toBe('Reference positions · Apparent geocentric · Tropical of date · No houses · True Node');
  });

  it('states aspect scope, limits, exact orb, and motion', () => {
    expect(CHART_SHEET_ASPECT_SCOPE).toBe('Major aspects · Sun–Pluto · Nodes & angles excluded');
    expect(CHART_SHEET_ASPECT_LEGEND).toContain('A applying');
    expect(chartSheetOrbLimits().join(' ')).toContain('☌ 10/8');
    expect(chartSheetOrbLimits().join(' ')).toContain('☍ 10/8');
    expect(chartSheetAspectOrb(2.783, true)).toBe('2°47′A');
    expect(chartSheetAspectOrb(0.01, false)).toBe('0°01′S');
  });

  it('keeps provenance private by default and becomes reproducible only on opt-in', () => {
    const chart = {
      input: {
        utc: new Date('1990-06-15T12:30:00.000Z'),
        latitude: 40.7128,
        longitude: -74.006,
        houseSystem: 'whole',
        timeKnown: true,
      },
      flags: ['dst-fold'],
    } as Chart;
    const details = {
      date: '1990-06-15',
      time: '08:30',
      timeKnown: true,
      city: 'New York',
      admin1: 'New York',
      country: 'United States',
      timezone: 'America/New_York',
    };
    expect(chartSheetProvenanceLines(chart, details)).toEqual(['Birth details hidden']);
    expect(chartSheetProvenanceLines(chart, details, false)).toEqual([
      '1990-06-15 · 08:30 local',
      'New York, United States',
      '40.7128°N · 74.0060°W · America/New_York',
      'Resolved UTC · 1990-06-15 12:30 UTC',
      'DST fold · earlier occurrence used',
    ]);
  });

  it('labels an unknown-time instant as a reference, never a birth UTC', () => {
    const chart = {
      input: {
        utc: new Date('1990-01-01T17:00:00.000Z'),
        latitude: 40.7128,
        longitude: -74.006,
        houseSystem: 'whole',
        timeKnown: false,
      },
      flags: ['no-time'],
    } as Chart;
    const lines = chartSheetProvenanceLines(chart, {
      date: '1990-01-01', time: '12:00', timeKnown: false,
      city: 'New York', country: 'United States', timezone: 'America/New_York',
    }, false);
    expect(lines[0]).toContain('Birth time unknown');
    expect(lines).toContain('Reference UTC · 1990-01-01 17:00 UTC');
    expect(lines.join(' ')).not.toContain('Resolved UTC');
  });

  it('states reference positions and Moon uncertainty without implying an angle', () => {
    expect(shareCardTimeNotes('en', { referenceTime: true, moonAmbiguous: true })).toEqual([
      'Reference positions · Birth time unknown',
      'My Moon may change signs without an exact birth time.',
    ]);
  });
});

describe('share-card content', () => {
  const chart = {
    bodies: [
      { body: 'Sun', lon: 12.5 },
      { body: 'Moon', lon: 48.25 },
      { body: 'Mercury', lon: 18 },
      { body: 'Venus', lon: 128 },
      { body: 'Mars', lon: 132 },
      { body: 'Jupiter', lon: 137 },
      { body: 'Saturn', lon: 14 },
      { body: 'Uranus', lon: 19 },
      { body: 'Neptune', lon: 22 },
      { body: 'Pluto', lon: 25 },
    ],
    angles: { asc: 185, mc: 95 },
  } as Chart;

  it('exports at a two-times retina scale', () => {
    expect(SHARE_CARD_SCALE).toBe(2);
  });

  it('pins the silver logo lockup to the protected bottom-right register', () => {
    expect(SHARE_CARD_WORDMARK).toEqual({ x: 1014, y: 1290, align: 'right' });
  });

  it('derives only placements selected for the big-three surface', () => {
    expect(bigThreePlacements(chart).map(({ kind, sign, degree }) => ({ kind, sign, degree })))
      .toEqual([
        { kind: 'sun', sign: 'Aries', degree: 12.5 },
        { kind: 'moon', sign: 'Taurus', degree: 18.25 },
        { kind: 'rising', sign: 'Libra', degree: 5 },
      ]);
  });

  it('computes dominant element and modality without personal input fields', () => {
    expect(dominantProfile(chart)).toEqual({ element: 'fire', modality: 'cardinal' });
  });

  it('builds a concise communication card from positions only', () => {
    const content = communicationCardContent({
      ...chart,
      engineVersion: '9.9.9',
      aspects: [
        { a: 'Mercury', b: 'Mars', type: 'square', orb: 0.5, applying: true },
      ],
    } as Chart);

    expect(content.title).toBe('How I communicate');
    expect(content.rows.map(({ body, sign, role }) => ({ body, sign, role }))).toEqual([
      { body: 'Mercury', sign: 'Aries', role: 'How you phrase things' },
      { body: 'Moon', sign: 'Taurus', role: 'What helps you feel heard' },
      { body: 'Mars', sign: 'Leo', role: 'How you handle friction' },
    ]);
    expect(content.rows.every(({ reading }) => firstSentence(reading) === reading)).toBe(true);
    expect(content.aspect).toMatch(/^Mercury square Mars/);
    expect(content.receipt).toBe('Engine 9.9.9');
    expect(JSON.stringify(content)).not.toMatch(/1990|08:30|New York|latitude|longitude/i);
  });

  it('builds a positive evidence-backed signature card from positions only', () => {
    const signatureChart = {
      ...chart,
      input: { utc: new Date('1990-06-15T08:30:00Z'), houseSystem: 'whole', timeKnown: true },
      aspects: [],
      engineVersion: '9.9.9',
    } as Chart;
    const content = signatureCardContent(signatureChart);

    expect(content.title).toBe('My chart signature');
    expect(content.signature).toMatchObject({
      kind: 'dignity',
      title: 'Sun in Aries',
      signSlugs: ['aries'],
    });
    expect(content.bigThree.map(({ kind }) => kind)).toEqual(['sun', 'moon', 'rising']);
    expect(content.notes).toEqual([]);
    expect(content.receipt).toBe('Engine 9.9.9');
    expect(JSON.stringify(content)).not.toMatch(/1990|08:30|New York|latitude|longitude|destiny|will happen/i);
  });

  it('keeps authored chart signatures English-only and selects localized structural primaries', () => {
    const signatureChart = {
      ...chart,
      input: { utc: new Date('1990-06-15T08:30:00Z'), houseSystem: 'whole', timeKnown: true },
      aspects: [],
      engineVersion: '9.9.9',
    } as Chart;

    expect(primaryShareCardVariant('en', true)).toBe('signature');
    expect(primaryShareCardVariant('en', false)).toBe('signature');
    expect(authoredSignatureForLocale(signatureChart, 'en')).toMatchObject({
      kind: 'dignity',
      title: 'Sun in Aries',
    });

    for (const locale of ['es', 'pt', 'fr', 'it'] as const) {
      expect(primaryShareCardVariant(locale, true)).toBe('big-three');
      expect(primaryShareCardVariant(locale, false)).toBe('full');
      expect(authoredSignatureForLocale(signatureChart, locale)).toBeNull();

      const content = signatureCardContent(signatureChart, locale);
      expect(content.signature).toBeNull();
      expect(JSON.stringify(content)).not.toContain('Sun in Aries');
      expect(JSON.stringify(content)).not.toContain('Your confidence grows when you take the lead');
    }
  });

  it('carries the reference-time and Moon-boundary receipts into a no-time signature', () => {
    const content = signatureCardContent({
      ...chart,
      angles: null,
      input: { utc: new Date('1990-01-01T12:00:00Z'), houseSystem: 'whole', timeKnown: false },
      aspects: [],
      engineVersion: '9.9.9',
    } as Chart, 'en', true);

    expect(content.bigThree.map(({ kind }) => kind)).toEqual(['sun', 'moon']);
    expect(content.notes).toEqual([
      'Reference positions · Birth time unknown',
      'My Moon may change signs without an exact birth time.',
    ]);
  });

  it('builds audience-facing approach content and carries Moon ambiguity', () => {
    const content = approachCardContent({
      ...chart,
      input: { utc: new Date('1990-06-15T08:30:00Z'), houseSystem: 'whole', timeKnown: true },
      aspects: [],
      engineVersion: '9.9.9',
    } as Chart, { moonAmbiguous: true });

    expect(content.title).toBe('How to approach me');
    expect(content.rows.map(({ body, role, sign }) => ({ body, role, sign }))).toEqual([
      { body: 'Rising', role: 'How to open', sign: 'Libra' },
      { body: 'Mercury', role: 'How to say it', sign: 'Aries' },
      { body: 'Moon', role: 'What builds trust', sign: 'Needs a birth time' },
    ]);
    expect(content.avoid).toMatchObject({
      body: 'Mars',
      role: 'What to avoid under pressure',
      sign: 'Leo',
    });
    expect(content.notes).toEqual(['My Moon may change signs without an exact birth time.']);
    expect(content.rows.every(({ reading }) => firstSentence(reading) === reading)).toBe(true);
    expect(JSON.stringify(content)).not.toMatch(/1990|08:30|New York|latitude|longitude/i);
  });

  it('makes a no-time approach card explicit instead of inventing a Rising sign', () => {
    const content = approachCardContent({
      ...chart,
      angles: null,
      input: { utc: new Date('1990-06-15T12:00:00Z'), houseSystem: 'whole', timeKnown: false },
      aspects: [],
      engineVersion: '9.9.9',
    } as Chart);

    expect(content.rows.map(({ body }) => body)).toEqual(['Mercury', 'Moon']);
    expect(content.notes).toEqual(['Birth time would add my Rising sign.', 'My Moon may change signs without an exact birth time.']);
    expect(content.rows.find(({ body }) => body === 'Moon')?.sign).toBe('Needs a birth time');
  });
});

/*
 * What a chart image shows while birth details are hidden. The chart sheet
 * printed "Birth details hidden" while drawing ASC, DSC, MC and IC to the
 * arcminute, Placidus house numbers and, for a chart without a birth time,
 * the Moon's aspects with their orbs to the arcminute: with a birth time that
 * put the birthplace in a box a few kilometres across, and without one the
 * orbs gave the instant of noon at the birthplace to within a minute, and so
 * its time zone or longitude. These check the data the renderer draws.
 */
describe('a chart image with birth details hidden', () => {
  const minutes = /\d{2}°\d{2}′/u;
  const timed = (houseSystem: 'whole' | 'placidus') => computeChart({
    utc: new Date('1987-03-14T05:42:00Z'), latitude: 45.764, longitude: 4.8357, houseSystem, timeKnown: true,
  });

  it('draws the angles only to the whole degree, as the link carries them, and leaves out Placidus houses', () => {
    const chart = timed('placidus');
    const drawn = timedImageChart(chart);
    // The wheel turns on these, and they are the link's own angles.
    const link = decodePositionsLink(encodeSharedPositionsLink({
      bodies: chart.bodies, angles: chart.angles, houseSystem: 'placidus', engineVersion: chart.engineVersion,
    })!)!;
    expect({ asc: drawn.angles!.asc, mc: drawn.angles!.mc }).toEqual(link.angles);
    expect(drawn.angles!.dsc).toBe((link.angles!.asc + 180) % 360);
    expect(drawn.angles!.ic).toBe((link.angles!.mc + 180) % 360);
    expect(drawn.houses).toBeNull();
    expect(drawn.input.latitude).toBeUndefined();
    expect(drawn.input.longitude).toBeUndefined();
    expect(drawn.bodies).toBe(chart.bodies);

    const content = chartSheetContent(drawn, { hideBirthDetails: true, housesLeftOut: true });
    expect(content.provenance).toEqual(['Birth details hidden']);
    const angleRows = content.rows.filter((row) => ['ASC', 'DSC', 'MC', 'IC'].includes(row.body));
    expect(angleRows.map((row) => row.text)).toEqual(['ASC', 'DSC', 'MC', 'IC'].map((label) => {
      const lon = chart.angles![label.toLowerCase() as 'asc' | 'dsc' | 'mc' | 'ic'];
      const within = Math.floor(lon % 30);
      return `${['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][Math.floor(lon / 30)]} ${String(within).padStart(2, '0')}°`;
    }));
    for (const row of angleRows) expect(row.text).not.toMatch(minutes);
    expect(content.rows.every((row) => row.house === null)).toBe(true);
    expect(content.settings).toBe('Apparent geocentric · Tropical of date · Placidus houses left out · True Node');
    // The bodies keep the arcminute, which gives the birth date and time, as the link does.
    expect(content.rows.find((row) => row.body === 'Moon')!.text).toMatch(minutes);

    // With birth details shown the sheet stays exact, with its Placidus houses.
    const shown = chartSheetContent(chart, { hideBirthDetails: false });
    expect(shown.rows.find((row) => row.body === 'ASC')!.text).toMatch(minutes);
    expect(shown.rows.every((row) => row.house !== null)).toBe(true);
  });

  it('rounds every angle the way the link does, at the edges of signs and of the zodiac too', () => {
    for (const lon of [0, 0.0004, 29.999, 30, 123.456, 359.4, 359.9996]) {
      const chart = { ...timed('whole'), angles: { asc: lon, mc: lon, dsc: 0, ic: 0 } };
      expect(timedImageChart(chart).angles).toMatchObject({ asc: wholeDegreeAngle(lon), mc: wholeDegreeAngle(lon) });
    }
  });

  it('keeps whole-sign houses, which follow from the ascendant’s sign', () => {
    const chart = timed('whole');
    const drawn = timedImageChart(chart);
    expect(drawn.houses).toEqual(chart.houses);
    const hidden = chartSheetContent(drawn, { hideBirthDetails: true });
    const shown = chartSheetContent(chart, { hideBirthDetails: false });
    expect(hidden.rows.map((row) => row.house)).toEqual(shown.rows.map((row) => row.house));
    expect(hidden.settings).toContain('Whole sign houses');
  });

  it('draws a chart without a birth time as the sky at 12:00 UTC on its date: the same image for every birthplace', async () => {
    const births = [
      { date: '1870-06-15', zone: 'America/New_York', lat: 42.89, lon: -78.88 },
      { date: '1870-06-15', zone: 'America/New_York', lat: 40.71, lon: -74.01 },
      { date: '1870-06-15', zone: 'Europe/Paris', lat: 48.39, lon: -4.49 },
      { date: '2000-04-11', zone: 'Asia/Kathmandu', lat: 27.72, lon: 85.32 },
      { date: '2000-04-11', zone: 'Australia/Adelaide', lat: -34.93, lon: 138.6 },
      { date: '2000-04-11', zone: 'Pacific/Pago_Pago', lat: -14.28, lon: -170.7 },
    ];
    const byDate = new Map<string, Set<string>>();
    const own = new Set<string>();
    for (const birth of births) {
      await prepareLocalTime(birth.date, birth.zone);
      const resolved = resolveLocalToUtc(birth.date, '12:00', birth.zone, { longitude: birth.lon });
      // As the calculator makes it: noon at the birthplace, the Moon's sign unknown.
      const chart = {
        ...computeChart({
          utc: resolved.utc, latitude: birth.lat, longitude: birth.lon,
          houseSystem: 'placidus', timeKnown: false, flags: resolved.flags,
        }),
        moonSignCandidates: [],
      };
      own.add(JSON.stringify(chartSheetContent(chart, { hideBirthDetails: true, moonAmbiguous: true })));
      const drawn = await imageChart(chart, birth.date);
      expect(drawn.input.utc.toISOString()).toBe(`${birth.date}T12:00:00.000Z`);
      expect(drawn.angles).toBeNull();
      expect(drawn.houses).toBeNull();
      expect(drawn.aspects.some((aspect) => aspect.a === 'Moon' || aspect.b === 'Moon')).toBe(false);
      const content = chartSheetContent(drawn, { hideBirthDetails: true, moonAmbiguous: true });
      expect(content.cells.some((cell) => cell.row === 'Moon' || cell.column === 'Moon')).toBe(false);
      expect(content.rows.find((row) => row.body === 'Moon')!.text).not.toMatch(minutes);
      expect(content.aspectScope).toBe(CHART_SHEET_ASPECT_SCOPE_NO_MOON);
      expect(content.settings).toBe('Reference positions at 12:00 UTC · Apparent geocentric · Tropical of date · No houses · True Node');
      // Everything the sheet and its wheel draw, keyed by date alone.
      const image = JSON.stringify({ content, bodies: drawn.bodies, aspects: drawn.aspects });
      if (!byDate.has(birth.date)) byDate.set(birth.date, new Set());
      byDate.get(birth.date)!.add(image);
    }
    expect([...byDate.values()].map((images) => images.size)).toEqual([1, 1]);
    // The chart's own noon at each birthplace drew a different sheet for each.
    expect(own.size).toBe(births.length);
    const chart = { ...timed('whole'), input: { ...timed('whole').input, timeKnown: false }, angles: null, houses: null };
    await expect(imageChart(chart)).rejects.toThrow('birth date');
    await expect(imageChart(chart, '2000-02-30')).rejects.toThrow('birth date');
  });

  it('draws the reading cards of a chart without a birth time from the same noon UTC sky', async () => {
    // They name only signs, but a sign can depend on when noon fell at the
    // birthplace: Mercury entered Scorpio at about 13:30 UTC on 28 September
    // 2000, after noon in Kathmandu (06:15 UTC) and before noon in Pago Pago
    // (23:00 UTC).
    const date = '2000-09-28';
    const own = new Set<string>();
    const drawn = new Set<string>();
    for (const birth of [
      { zone: 'Asia/Kathmandu', lat: 27.72, lon: 85.32 },
      { zone: 'Pacific/Pago_Pago', lat: -14.28, lon: -170.7 },
    ]) {
      await prepareLocalTime(date, birth.zone);
      const resolved = resolveLocalToUtc(date, '12:00', birth.zone, { longitude: birth.lon });
      const chart = {
        ...computeChart({
          utc: resolved.utc, latitude: birth.lat, longitude: birth.lon,
          houseSystem: 'whole', timeKnown: false, flags: resolved.flags,
        }),
        moonSignCandidates: [],
      };
      own.add(JSON.stringify([communicationCardContent(chart), approachCardContent(chart)]));
      const image = await imageChart(chart, date);
      drawn.add(JSON.stringify([communicationCardContent(image), approachCardContent(image)]));
      // prepareChartCard draws both from imageChart: without the date it stops before drawing.
      for (const variant of ['communication', 'approach'] as const) {
        await expect(prepareChartCard(chart, { variant })).rejects.toThrow('birth date');
      }
    }
    expect(own.size).toBe(2);
    expect(drawn.size).toBe(1);
    const [communication] = JSON.parse([...drawn][0]);
    expect(communication.rows.map(({ body, sign }: { body: string; sign: string }) => [body, sign]))
      .toEqual([['Mercury', 'Libra'], ['Moon', 'Needs a birth time'], ['Mars', 'Virgo']]);
  });

  it('gives the Big Three and placement cards the rising sign’s whole degree, and a chart without a birth time noon UTC', async () => {
    const chart = timed('placidus');
    const positions = await imagePositions({ bodies: chart.bodies, angles: chart.angles, engineVersion: chart.engineVersion });
    expect(positions.angles).toEqual({ asc: Math.floor(chart.angles!.asc) + 0.5, mc: Math.floor(chart.angles!.mc) + 0.5 });
    const rising = bigThreePlacements(positions).find((placement) => placement.kind === 'rising')!;
    expect(cardDegreeText('rising', rising.degree)).toBe(`${Math.floor(chart.angles!.asc % 30)}°`);
    expect(cardDegreeText('sun', 12.345)).toBe('12.3°');
    const untimed = await imagePositions({ bodies: chart.bodies, angles: null, engineVersion: chart.engineVersion }, '2000-04-11');
    expect(untimed.bodies).toEqual(computeBodies(new Date('2000-04-11T12:00:00Z')));
    expect(untimed.moonSignCandidates).toEqual([]);
    await expect(imagePositions({ bodies: chart.bodies, angles: null, engineVersion: chart.engineVersion })).rejects.toThrow('birth date');
  });
});
