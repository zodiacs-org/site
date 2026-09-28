import { describe, expect, it } from 'vitest';
import {
  COMPATIBILITY_CARD_BRAND_LAYOUT,
  compatibilityHeadline,
  compatibilityPicturePeople,
  compatibilityPlacementLine,
  type CompatibilityCardPerson,
} from './compatibility-card';
import { computeBodies, computeChart } from './engine/full';
import { summarizePair } from './engine/synastry';
import { prepareLocalTime, resolveLocalToUtc } from './time/localToUtc';

describe('compatibility share card', () => {
  it('selects a deterministic headline from the computed aspect balance', () => {
    expect(compatibilityHeadline({ easeful: 4, charged: 2 })).toBe('Flow, with useful friction');
    expect(compatibilityHeadline({ easeful: 1, charged: 3 })).toContain('attention');
    expect(compatibilityHeadline({ easeful: 2, charged: 2 })).toContain('even exchange');
  });

  it('accepts placements and a chosen label, never birth inputs', () => {
    const person: CompatibilityCardPerson = {
      label: 'Person A',
      bodies: [{ body: 'Sun', lon: 12 }],
      asc: 42,
    };
    expect(Object.keys(person).sort()).toEqual(['asc', 'bodies', 'label']);
  });

  it('prints the rising sign only to its whole degree, as the two-chart link keeps it', () => {
    const person: CompatibilityCardPerson = {
      label: 'Person A',
      bodies: [{ body: 'Sun', lon: 12.6 }, { body: 'Moon', lon: 100.2 }],
      asc: 42.7,
    };
    // 42.7° rounded would be Taurus 13°, half a degree past what the link's 12.5° allows.
    expect(compatibilityPlacementLine(person)).toBe('Aries 13°  ·  Cancer 10°  ·  Taurus 12°');
    expect(compatibilityPlacementLine({ ...person, asc: null })).toBe('Aries 13°  ·  Cancer 10°  ·  —');
  });

  it('draws a person without a birth time as their link carries them: 12:00 UTC on the date, without the Moon', async () => {
    // That person's chart is noon at the birthplace. The picture printed its
    // Moon to the degree and the Moon's contacts to a tenth of one, which put
    // that noon within minutes, and so the time zone.
    const date = '2000-04-11';
    const partner: CompatibilityCardPerson = {
      label: 'Sam',
      bodies: computeBodies(new Date('1995-08-01T09:30:00Z')).map(({ body, lon }) => ({ body, lon })),
      asc: 123.4,
    };
    const noon = computeBodies(new Date(`${date}T12:00:00Z`))
      .filter(({ body }) => body !== 'Moon')
      .map(({ body, lon }) => ({ body, lon }));
    const own = new Set<string>();
    const pictures = new Set<string>();
    for (const birth of [
      { zone: 'Asia/Kathmandu', lat: 27.72, lon: 85.32 },
      { zone: 'Pacific/Pago_Pago', lat: -14.28, lon: -170.7 },
    ]) {
      await prepareLocalTime(date, birth.zone);
      const resolved = resolveLocalToUtc(date, '12:00', birth.zone, { longitude: birth.lon });
      const chart = computeChart({
        utc: resolved.utc, latitude: birth.lat, longitude: birth.lon,
        houseSystem: 'whole', timeKnown: false, flags: resolved.flags,
      });
      const person: CompatibilityCardPerson = {
        label: 'Maya', bodies: chart.bodies.map(({ body, lon }) => ({ body, lon })), asc: null, untimedDate: date,
      };
      const summary = summarizePair(person.bodies, partner.bodies);
      own.add(JSON.stringify([compatibilityPlacementLine(person), summary.aspects]));
      const drawn = await compatibilityPicturePeople(person, partner, summary);
      expect(drawn.a).toEqual({ label: 'Maya', bodies: noon, asc: null });
      expect(drawn.b).toBe(partner);
      expect(drawn.summary).toEqual(summarizePair(noon, partner.bodies));
      expect(drawn.summary.aspects.some((contact) => contact.a === 'Moon')).toBe(false);
      expect(compatibilityPlacementLine(drawn.a)).toMatch(/^\S+ \d+°  ·  —  ·  —$/u);
      pictures.add(JSON.stringify(drawn));
    }
    expect(own.size).toBe(2);
    expect(pictures.size).toBe(1);
    // Anyone else is drawn as given, and a date that is not one is refused.
    const given = summarizePair(partner.bodies, partner.bodies);
    const timed = { ...partner, label: 'Ana' };
    expect(await compatibilityPicturePeople(timed, partner, given)).toEqual({ a: timed, b: partner, summary: given });
    await expect(compatibilityPicturePeople({ ...timed, asc: null, untimedDate: '2000-02-30' }, partner, given))
      .rejects.toThrow('birth date');
  });

  it('keeps the logo above the occupied two-person footer', () => {
    expect(COMPATIBILITY_CARD_BRAND_LAYOUT.wordmarkX).toBe(1014);
    expect(COMPATIBILITY_CARD_BRAND_LAYOUT.centerY).toBe(76);
    expect(COMPATIBILITY_CARD_BRAND_LAYOUT.centerY
      + COMPATIBILITY_CARD_BRAND_LAYOUT.iconSize / 2).toBeLessThan(120);
  });
});
