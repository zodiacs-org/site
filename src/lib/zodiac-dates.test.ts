import { describe, expect, it } from 'vitest';
import {
  INGRESS_GENERATED_AT,
  INGRESS_YEARS,
  ZODIAC_DATE_ROWS,
  ingressDisplayMinute,
  ingressIsoMinute,
} from './zodiac-dates';

describe('living correspondence chart data', () => {
  it('derives the current and next publication years from the committed receipt', () => {
    expect(INGRESS_GENERATED_AT).toBe('2026-10-07T14:49:40.658Z');
    expect(INGRESS_YEARS).toEqual([2026, 2027]);
  });

  it('covers every sign once in zodiac order with exact half-open ranges', () => {
    expect(ZODIAC_DATE_ROWS).toHaveLength(12);
    expect(ZODIAC_DATE_ROWS.map((row) => row.sign.slug)).toEqual([
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ]);
    expect(ZODIAC_DATE_ROWS.map((row) => row.longitudeRange)).toEqual([
      '0° ≤ λ < 30°',
      '30° ≤ λ < 60°',
      '60° ≤ λ < 90°',
      '90° ≤ λ < 120°',
      '120° ≤ λ < 150°',
      '150° ≤ λ < 180°',
      '180° ≤ λ < 210°',
      '210° ≤ λ < 240°',
      '240° ≤ λ < 270°',
      '270° ≤ λ < 300°',
      '300° ≤ λ < 330°',
      '330° ≤ λ < 360°',
    ]);
  });

  it('uses the exact committed Sun ingress instants for both years', () => {
    const aries = ZODIAC_DATE_ROWS[0];
    const pisces = ZODIAC_DATE_ROWS[11];

    expect(ingressIsoMinute(aries.ingressUtc[2026])).toBe('2026-03-20T14:45Z');
    expect(ingressIsoMinute(aries.ingressUtc[2027])).toBe('2027-03-20T20:24Z');
    expect(ingressIsoMinute(pisces.ingressUtc[2026])).toBe('2026-02-18T15:51Z');
    expect(ingressIsoMinute(pisces.ingressUtc[2027])).toBe('2027-02-18T21:33Z');
    expect(ingressDisplayMinute(aries.ingressUtc[2026])).toBe('2026-03-20 · 14:45 UTC');
  });

  it('keeps classical rulerships and hemisphere seasons explicit', () => {
    const scorpio = ZODIAC_DATE_ROWS.find((row) => row.sign.slug === 'scorpio');
    const aquarius = ZODIAC_DATE_ROWS.find((row) => row.sign.slug === 'aquarius');
    const pisces = ZODIAC_DATE_ROWS.find((row) => row.sign.slug === 'pisces');

    expect(scorpio).toMatchObject({
      modernRuler: 'Pluto',
      classicalRuler: 'Mars',
      northernSeason: 'Autumn',
      southernSeason: 'Spring',
    });
    expect(aquarius).toMatchObject({ modernRuler: 'Uranus', classicalRuler: 'Saturn' });
    expect(pisces).toMatchObject({ modernRuler: 'Neptune', classicalRuler: 'Jupiter' });
  });
});
