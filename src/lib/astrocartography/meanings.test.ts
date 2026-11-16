import { describe, expect, it } from 'vitest';
import { computeAstrocartography } from '../../islands/astrocartography/compute';
import { under18 } from '../../islands/AstrocartographyMap';
import { forbiddenClaim } from '../../ai-tools/personal/shared';
import { executeAiTool } from '../../ai-tools/tools';
import { loadPlaceTable } from '../../ai-tools/features/place-table';
import { MINOR_NOTE } from '../../ai-tools/features/reading-guards';
import { astrocartographyCardModel } from '../../server/result-preview';
import { ACG_ANGLES, ACG_BODIES, NOTICEABLE_KM, type LineDistance } from './lines';
import {
  ACG_CONFIDENCE_TEXT, CLOCK_FOLD_LIMIT, CLOCK_GAP_LIMIT, LINE_MEANING, MAP_PICTURE_HELP, clockChangeLimit, formatLongitude, lineMeaning,
  lineSentence, lineTable, placeLines,
} from './meanings';

const ON = { occasions: true, coverage: true, personal: true, now: () => new Date('2026-11-09T09:00:00Z'), placeTable: async () => loadPlaceTable() };
const ROMANCE = /love|attract|romant/iu;
const NEW_YORK = { tz: 'America/New_York', lon: -74.01 };

describe('astrocartography readings for someone under 18 (ZOD-26)', () => {
  it('leave out love, attraction and romance on every line, on the page and in the tool sentence', () => {
    for (const body of ACG_BODIES) for (const angle of ACG_ANGLES) {
      expect(lineMeaning(body, angle, true)).not.toMatch(ROMANCE);
      expect(lineSentence(body, angle, true)).not.toMatch(ROMANCE);
      expect(forbiddenClaim(lineMeaning(body, angle, true))).toBeNull();
      // An adult keeps the traditional reading.
      expect(lineMeaning(body, angle)).toBe(LINE_MEANING[body][angle]);
    }
    expect(lineMeaning('Venus', 'DSC', true)).toBe('Places where friendships and good company come easily.');
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

  it('puts the reading confidence on the share card and story model', () => {
    for (const body of ACG_BODIES) for (const angle of ACG_ANGLES) expect(astrocartographyCardModel({ planet: body, angle, ref: null }).confidence).toBe('Reading confidence 70%');
    expect(ACG_CONFIDENCE_TEXT).toBe('Reading confidence 70%');
  });
});

describe('an astrocartography birth time the clocks repeated or skipped (ZOD-26)', () => {
  it('says so on the page for a fold and a gap, and nothing otherwise', async () => {
    const fold = await computeAstrocartography({ birthDate: '2021-11-07', birthTime: '01:30', place: NEW_YORK });
    expect(fold.flags).toContain('dst-fold');
    expect(clockChangeLimit(fold.flags)).toBe(CLOCK_FOLD_LIMIT);
    expect(CLOCK_FOLD_LIMIT).toBe('Clocks repeated that hour where you were born. This map uses the earlier pass; the later one would move every line 15 degrees east or west.');
    const gap = await computeAstrocartography({ birthDate: '2021-03-14', birthTime: '02:30', place: NEW_YORK });
    expect(clockChangeLimit(gap.flags)).toBe(CLOCK_GAP_LIMIT);
    const plain = await computeAstrocartography({ birthDate: '2021-11-07', birthTime: '03:30', place: NEW_YORK });
    expect(clockChangeLimit(plain.flags)).toBeNull();
  });

  it('puts the fold sentence in the tool limits', async () => {
    const fold = await executeAiTool('get_astrocartography', { birthDate: '1990-10-28', time: '01:30', zone: 'America/New_York' }, ON) as { ok: true; data: any };
    expect(fold.data.limits).toContain(CLOCK_FOLD_LIMIT);
    const plain = await executeAiTool('get_astrocartography', { birthDate: '1990-10-28', time: '03:30', zone: 'America/New_York' }, ON) as { ok: true; data: any };
    expect(plain.data.limits).not.toContain(CLOCK_FOLD_LIMIT);
    expect(plain.data.limits).not.toContain(CLOCK_GAP_LIMIT);
  });
});
