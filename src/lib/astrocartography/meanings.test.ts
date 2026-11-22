import { describe, expect, it } from 'vitest';
import { computeAstrocartography, nearestLines } from '../../islands/astrocartography/compute';
import { under18 } from '../../islands/AstrocartographyMap';
import { forbiddenClaim } from '../../ai-tools/personal/shared';
import { executeAiTool } from '../../ai-tools/tools';
import { loadPlaceTable } from '../../ai-tools/features/place-table';
import { MINOR_NOTE } from '../../ai-tools/features/reading-guards';
import { astrocartographyCardModel } from '../../server/result-preview';
import { ACG_ANGLES, ACG_BODIES, NOTICEABLE_KM, type LineDistance } from './lines';
import {
  ACG_CONFIDENCE_TEXT, ANGLE_AREA, LINE_MEANING, MAP_PICTURE_HELP, clockChangeLimit, clockFoldLimit, clockGapLimit, formatLongitude, lineMeaning, angleArea,
  lineSentence, lineTable, placeLines,
} from './meanings';

const ON = { occasions: true, coverage: true, personal: true, now: () => new Date('2026-11-09T09:00:00Z'), placeTable: async () => loadPlaceTable() };
const ROMANCE = /love|attract|romant/iu;
/** The ticket's check, and relationships and partners, which a minor's reading also leaves out. */
const MINOR_CHECK = /love|attract|romant|relationship|partner/iu;
const CLOCK_FOLD_LIMIT = clockFoldLimit(60);
const NEW_YORK = { tz: 'America/New_York', lon: -74.01 };

describe('astrocartography readings for someone under 18 (ZOD-26)', () => {
  it('leave out love, attraction and romance on every line, on the page and in the tool sentence', () => {
    for (const body of ACG_BODIES) for (const angle of ACG_ANGLES) {
      const meaning = lineMeaning(body, angle, true);
      if (meaning !== null) expect(meaning).not.toMatch(MINOR_CHECK);
      expect(lineSentence(body, angle, true)).not.toMatch(MINOR_CHECK);
      if (meaning !== null) expect(forbiddenClaim(meaning)).toBeNull();
      // An adult keeps the traditional reading.
      expect(lineMeaning(body, angle)).toBe(LINE_MEANING[body][angle]);
    }
    expect(lineMeaning('Venus', 'ASC', true)).toBe('Places where ease and warmth come more readily, and you tend to feel at home in yourself.');
    expect(lineMeaning('Neptune', 'DSC', true)).toBe('Places where other people can seem larger than life; keep a clear head about who is who.');
    expect(lineMeaning('Venus', 'DSC', true)).toBe('Places where friendships and good company come easily.');
    // A Descendant reading about partners or relationships is left out, with no words in its place.
    for (const body of ['Sun', 'Moon', 'Mercury', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Pluto'] as const) expect(lineMeaning(body, 'DSC', true), body).toBeNull();
    // The Descendant's own area ("partners and close collaborators") goes too; the other angles keep theirs.
    expect(lineSentence('Saturn', 'DSC', true)).toBe('Saturn Descendant line (Saturn setting).');
    expect(lineSentence('Saturn', 'DSC')).toContain(ANGLE_AREA.DSC);
    expect(angleArea('DSC', true)).toBeNull();
    expect(angleArea('MC', true)).toBe(ANGLE_AREA.MC);
    const rows: LineDistance[] = [{ body: 'Venus', angle: 'DSC', km: 120, side: 'east' }, { body: 'Neptune', angle: 'DSC', km: 400, side: null }, { body: 'Venus', angle: 'ASC', km: 700, side: 'west' }];
    expect(JSON.stringify(placeLines(rows, true))).not.toMatch(ROMANCE);
    expect(JSON.stringify(placeLines(rows, false))).toMatch(ROMANCE);
  });

  it('come from the tool for a minor, with the note, for places near the lines that change', async () => {
    const result = await executeAiTool('get_astrocartography', { birthDate: '2010-05-03', time: '08:30', zone: 'Europe/London', cities: ['Lisbon', 'Delhi', 'Honolulu'] }, ON) as { ok: true; data: any };
    expect(result.ok).toBe(true);
    const touched = result.data.cities.flatMap((city: any) => city.closest).filter((row: any) => (row.planet === 'Venus' && (row.angle === 'ASC' || row.angle === 'DSC')) || (row.planet === 'Neptune' && row.angle === 'DSC'));
    expect(touched.length).toBeGreaterThan(0);
    expect(result.data.limits).toContain(MINOR_NOTE);
    expect(JSON.stringify({ ...result.data, limits: [] })).not.toMatch(ROMANCE);
  });

  it('show a minor no line text that fails the check, over every place on a 15 degree grid, on the page and in the tool', async () => {
    const result = await executeAiTool('get_astrocartography', { birthDate: '2010-05-03', time: '08:30', zone: 'Europe/London', cities: ['Lisbon', 'Delhi', 'Honolulu', 'Cape Town', 'Nairobi'] }, ON) as { ok: true; data: any };
    const toolText = result.data.cities.flatMap((city: any) => [city.summary, ...city.closest.map((row: any) => row.line)]);
    for (const text of toolText) expect(text).not.toMatch(MINOR_CHECK);
    expect(JSON.stringify({ ...result.data, limits: [] })).not.toMatch(MINOR_CHECK);
    const map = await computeAstrocartography({ birthDate: '2010-05-03', birthTime: '08:30', place: { tz: 'Europe/London', lon: -0.13 } });
    let seen = 0;
    for (let lat = -75; lat <= 75; lat += 15) for (let lon = -180; lon < 180; lon += 15) {
      const reading = placeLines(nearestLines({ lat, lon }, map), true);
      for (const row of reading.rows) { seen += 1; if (row.meaning) expect(row.meaning).not.toMatch(MINOR_CHECK); }
      if (reading.far) expect(reading.far).not.toMatch(MINOR_CHECK);
    }
    expect(seen).toBeGreaterThan(300);
  });

  it('take the age on the person\'s own clock, as get_personal_day does', async () => {
    // 20:00 UTC on 9 Nov 2026 is already 10 Nov in Bangkok: an 18th birthday on 10 Nov has arrived there, not in London.
    const late = { ...ON, now: () => new Date('2026-11-09T20:00:00Z') };
    const args = { birthDate: '2008-11-10', time: '08:30', zone: 'Europe/London' };
    const there = await executeAiTool('get_astrocartography', { ...args, currentZone: 'Asia/Bangkok' }, late) as { ok: true; data: any };
    expect(there.data.limits).not.toContain(MINOR_NOTE);
    const home = await executeAiTool('get_astrocartography', args, late) as { ok: true; data: any };
    expect(home.data.limits).toContain(MINOR_NOTE);
    // Without a current location the answer says which clock today was read on, as get_personal_day does.
    expect(home.data.limits).toContain('Today is read on the birthplace clock (Europe/London) because no current location was given.');
    expect(there.data.limits.some((entry: string) => entry.startsWith('Today is read'))).toBe(false);
  });

  it('keeps the under-18 reading until the birthday after leap day', async () => {
    expect(under18('2010-03-01', new Date(2028, 1, 29, 12))).toBe(true);
    const result = await executeAiTool('get_astrocartography', { birthDate: '2010-03-01', time: '08:30', zone: 'UTC' },
      { ...ON, now: () => new Date('2028-02-29T12:00:00Z') });
    expect(result).toMatchObject({ ok: true, data: { limits: expect.arrayContaining([MINOR_NOTE]) } });
  });

  it('are taken on the page by the device clock', () => {
    const now = new Date(2026, 10, 9, 12);
    expect(under18('2008-11-10', now)).toBe(true);
    expect(under18('2008-11-09', now)).toBe(false);
  });
});

describe('the astrocartography map in words (ZOD-26)', () => {
  it('lists where each Midheaven and lower-heaven line runs', () => {
    expect(formatLongitude(66.71)).toBe('66.7° E');
    expect(formatLongitude(-73.94)).toBe('73.9° W');
    expect(formatLongitude(-0.02)).toBe('0.0° E');
    expect(formatLongitude(180)).toBe('180.0° E');
    expect(lineTable([{ body: 'Sun', mc: 66.71, ic: -113.29, asc: [], dsc: [] }])).toEqual([{ planet: 'Sun', mc: '66.7° E', ic: '113.3° W' }]);
  });

  it('gives a far place one sentence without a reading, and rounds distances to 10 km', () => {
    const far = placeLines([{ body: 'Venus', angle: 'DSC', km: 3012.4, side: 'east' }, { body: 'Mars', angle: 'MC', km: 3400, side: null }]);
    expect(far).toEqual({ far: `No line within ${NOTICEABLE_KM} km; the nearest is the Venus Descendant line, 3,010 km.`, rows: [] });
    const near = placeLines([{ body: 'Mars', angle: 'MC', km: 134.6, side: 'west' }, { body: 'Moon', angle: 'IC', km: 1004, side: null }]);
    expect(near.far).toBeNull();
    expect(near.rows.map((row) => row.distance)).toEqual(['130 km west', '1,000 km']);
  });

  it('says what a picture of the whole map gives away', () => {
    expect(MAP_PICTURE_HELP).toBe("A picture of this map shows where your lines run, which is enough to work out your birth date and time. To share, use a single line's card instead.");
  });

  it('gives the share card the under-18 reading, since a card carries no age', () => {
    expect(astrocartographyCardModel({ planet: 'Venus', angle: 'DSC', ref: null }).line).toBe('Places where friendships and good company come easily.');
    expect(astrocartographyCardModel({ planet: 'Saturn', angle: 'DSC', ref: null }).line).toBeNull();
    for (const body of ACG_BODIES) for (const angle of ACG_ANGLES) {
      const model = astrocartographyCardModel({ planet: body, angle, ref: null });
      expect(`${model.title} ${model.detail} ${model.line ?? ''}`).not.toMatch(MINOR_CHECK);
    }
  });

  it('puts the reading confidence on the share card and story model', () => {
    for (const body of ACG_BODIES) for (const angle of ACG_ANGLES) expect(astrocartographyCardModel({ planet: body, angle, ref: null }).confidence).toBe('Reading confidence 70%');
    expect(ACG_CONFIDENCE_TEXT).toBe('Reading confidence 70%');
  });
});

describe('an astrocartography birth time the clocks repeated or skipped (ZOD-26)', () => {
  it('says so on the page for a fold and a gap, and nothing otherwise', async () => {
    const fold = await computeAstrocartography({ birthDate: '2021-11-07', birthTime: '01:30', place: NEW_YORK });
    expect(fold.flags).toContain('dst-fold');
    expect(clockChangeLimit(fold.flags, fold.jumpMinutes)).toBe(CLOCK_FOLD_LIMIT);
    expect(CLOCK_FOLD_LIMIT).toBe('Clocks repeated that hour where you were born. This map uses the earlier pass; the later one would move every line 15 degrees east or west.');
    const gap = await computeAstrocartography({ birthDate: '2021-03-14', birthTime: '02:30', place: NEW_YORK });
    expect(clockChangeLimit(gap.flags, gap.jumpMinutes)).toBe('That clock time did not exist where you were born: clocks jumped forward. This map uses the time one hour later.');
    const plain = await computeAstrocartography({ birthDate: '2021-11-07', birthTime: '03:30', place: NEW_YORK });
    expect(clockChangeLimit(plain.flags, plain.jumpMinutes)).toBeNull();
  });

  it('fills in the real size of the change: half an hour and 7.5 degrees on Lord Howe Island', async () => {
    const lordHowe = { tz: 'Australia/Lord_Howe', lon: 159.08 };
    const gap = await computeAstrocartography({ birthDate: '2010-10-03', birthTime: '02:15', place: lordHowe });
    expect(gap.jumpMinutes).toBe(30);
    expect(clockChangeLimit(gap.flags, gap.jumpMinutes)).toBe('That clock time did not exist where you were born: clocks jumped forward. This map uses the time 30 minutes later.');
    const fold = await computeAstrocartography({ birthDate: '1987-03-15', birthTime: '01:30', place: lordHowe });
    expect(clockChangeLimit(fold.flags, fold.jumpMinutes)).toBe('Clocks repeated that time where you were born. This map uses the earlier pass; the later one would move every line 7.5 degrees east or west.');
    const tool = await executeAiTool('get_astrocartography', { birthDate: '1987-03-15', time: '01:30', zone: 'Australia/Lord_Howe' }, ON) as { ok: true; data: any };
    expect(tool.data.limits).toContain(clockFoldLimit(30));
    expect(clockGapLimit(120)).toContain('2 hours later');
  });

  it('says nothing for a change under a minute, and rounds to whole minutes', async () => {
    // Amsterdam, 1 July 1937: the offset moved by 28 seconds, flagged as a gap.
    const amsterdam = await computeAstrocartography({ birthDate: '1937-07-01', birthTime: '00:00', place: { tz: 'Europe/Amsterdam', lon: 4.9 } });
    expect(amsterdam.flags).toContain('dst-gap');
    expect(amsterdam.jumpMinutes).toBeLessThan(1);
    expect(clockChangeLimit(amsterdam.flags, amsterdam.jumpMinutes)).toBeNull();
    const tool = await executeAiTool('get_astrocartography', { birthDate: '1937-07-01', time: '00:00', zone: 'Europe/Amsterdam' }, ON) as { ok: true; data: any };
    expect(tool.data.limits.some((entry: string) => /clock time|Clocks repeated|minutes later/u.test(entry))).toBe(false);
    expect(clockChangeLimit(['dst-gap'], 29.6)).toBe(clockGapLimit(30));
    expect(clockChangeLimit(['dst-fold'], 60.4)).toBe(clockFoldLimit(60));
    expect(clockChangeLimit(['dst-fold'], 0.4)).toBeNull();
  });

  it('says "one minute" for a change that rounds to a single minute', () => {
    // Moscow, 3 July 1916 and St John's, 30 March 1935: offset changes of under 90 seconds.
    expect(clockGapLimit(1)).toContain('the time one minute later');
    expect(clockChangeLimit(['dst-gap'], 0.6)).toBe(clockGapLimit(1));
    expect(clockChangeLimit(['dst-gap'], 1.4)).not.toMatch(/\b1 minutes\b/u);
  });

  it.each([
    ['2021-11-07', '01:30', CLOCK_FOLD_LIMIT],
    ['2021-03-14', '02:30', 'That clock time did not exist where you were born: clocks jumped forward. This map uses the time one hour later.'],
  ])('reports the New York clock change only when the birth is old enough for a reading', async (birthDate, time, notice) => {
    const args = { birthDate, time, zone: 'America/New_York' };
    expect(await executeAiTool('get_astrocartography', args, ON)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    const result = await executeAiTool('get_astrocartography', args, { ...ON, now: () => new Date('2036-01-02T12:00:00Z') });
    expect(result).toMatchObject({ ok: true, data: { limits: expect.arrayContaining([notice, MINOR_NOTE]) } });
  });

  it('puts the fold sentence in the tool limits', async () => {
    const fold = await executeAiTool('get_astrocartography', { birthDate: '1990-10-28', time: '01:30', zone: 'America/New_York' }, ON) as { ok: true; data: any };
    expect(fold.data.limits).toContain(CLOCK_FOLD_LIMIT);
    const plain = await executeAiTool('get_astrocartography', { birthDate: '1990-10-28', time: '03:30', zone: 'America/New_York' }, ON) as { ok: true; data: any };
    expect(plain.data.limits).not.toContain(CLOCK_FOLD_LIMIT);
    expect(plain.data.limits.some((entry: string) => entry.startsWith('That clock time'))).toBe(false);
  });
});

describe('astrocartography readings and money', () => {
  // The owner's rule: no line is read as a money, earnings or income forecast for a place.
  const MONEY = /earn|income|money|salary|wage|wealth|rich|prosper|financ|profit|pay rise|promotion/iu;

  it('read no line, for an adult or someone under 18, as a place for earnings', () => {
    for (const body of ACG_BODIES) for (const angle of ACG_ANGLES) for (const minor of [false, true]) {
      const text = `${lineSentence(body, angle, minor)} ${lineMeaning(body, angle, minor) ?? ''}`;
      expect(text, `${body} ${angle}${minor ? ' under 18' : ''}`).not.toMatch(MONEY);
      expect(text, `${body} ${angle}`).not.toMatch(/[\u2013\u2014]/u);
      const card = astrocartographyCardModel({ planet: body, angle, ref: null });
      expect(`${card.title} ${card.detail} ${card.line ?? ''}`, `${body} ${angle} card`).not.toMatch(MONEY);
    }
  });

  it('keeps the Venus and Jupiter Midheaven lines on work and standing, as the page and the tool give them', async () => {
    expect(LINE_MEANING.Venus.MC).toBe('Traditionally good for work in the arts, design, beauty and diplomacy, and for being liked in public; often read as a place where work feels more pleasant and goes more smoothly.');
    expect(LINE_MEANING.Jupiter.MC).toBe('Traditionally one of the best lines for career growth and a good name: a place where work opens up, mentors are generous and your horizons widen.');
    const answer = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['New York', 'Lisbon', 'Tokyo', 'Sydney', 'Lima'] }, ON);
    expect(answer.ok).toBe(true);
    expect(JSON.stringify(answer)).not.toMatch(MONEY);
  });
});
