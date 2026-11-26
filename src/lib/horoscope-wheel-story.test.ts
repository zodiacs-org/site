import { describe, expect, it } from 'vitest';
import dailyData from '../data/daily.json';
import type { Daily } from './daily';
import { HOROSCOPE_WHEEL_SIZE, HOROSCOPE_WHEEL_STORY, horoscopeWheelStory, horoscopeWheelSvg } from './horoscope-wheel';
import { SIGNS } from './signs';

// The horoscope pages' wheel entrance is a veil laid over the published
// image, so its geometry must be the image's own: the same viewBox, the
// planet veils on the image's planet markers, the sign veils on the sign
// boundaries, and the whole pass inside the runtime's 2.6 s.

const daily = dailyData as Daily;

function markers(svg: string): { body: string; x: number; y: number }[] {
  return [...svg.matchAll(/data-preview-body="([^"]+)"><line[^>]*><\/line><circle cx="([\d.]+)" cy="([\d.]+)"/gu)]
    .map((match) => ({ body: match[1], x: Number(match[2]), y: Number(match[3]) }));
}

describe('horoscope wheel story', () => {
  for (const sign of SIGNS) {
    it(`lies on the ${sign.name} wheel image`, () => {
      const focus = ['Moon', 'Mercury'];
      const svg = horoscopeWheelSvg({ daily, signSlug: sign.slug, focus, label: 'x' });
      const story = horoscopeWheelStory({ daily, signSlug: sign.slug, focus });
      expect(svg).toContain(`viewBox="${story.viewBox}"`);
      expect(story.viewBox.split(' ').map(Number)[2]).toBe(HOROSCOPE_WHEEL_SIZE);

      const drawn = markers(svg);
      expect(drawn.map((m) => m.body)).toEqual(story.planets.map((p) => p.body));
      for (const planet of story.planets) {
        const marker = drawn.find((m) => m.body === planet.body)!;
        expect(Math.hypot(marker.x - planet.x, marker.y - planet.y), planet.body).toBeLessThan(0.1);
        expect(planet.r).toBeGreaterThan(13.86);
      }

      // The first sign veil starts at 9 o'clock, where the page's sign begins.
      expect(story.signs).toHaveLength(12);
      const [x0, y0] = story.signs[0].d.slice(1).split('A')[0].split(' ').map(Number);
      expect(x0).toBeCloseTo(210 - story.band.r, 1);
      expect(y0).toBeCloseTo(210, 1);
      expect(story.ring.startsWith('M10.5 210A')).toBe(true);
    });
  }

  it('plays the ring in zodiac order, the reading planets last, all inside 2.5 s', () => {
    const story = horoscopeWheelStory({ daily, signSlug: 'leo', focus: ['Moon', 'Mercury'] });
    const times = story.signs.map((s) => s.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    const plain = story.planets.filter((p) => !p.focus);
    const lit = story.planets.filter((p) => p.focus);
    expect(lit.map((p) => p.body)).toEqual(['Moon', 'Mercury']);
    expect(Math.max(...plain.map((p) => p.t))).toBeLessThan(HOROSCOPE_WHEEL_STORY.ring);
    expect(Math.min(...lit.map((p) => p.t))).toBeGreaterThanOrEqual(HOROSCOPE_WHEEL_STORY.focus);
    // 440 ms is each planet's own transition (HoroscopeWheelStory.astro).
    expect(Math.max(...story.planets.map((p) => p.t)) + 440).toBeLessThanOrEqual(HOROSCOPE_WHEEL_STORY.end);
  });

  it('holds no planet back when the reading draws on none', () => {
    const story = horoscopeWheelStory({ daily, signSlug: 'aries', focus: [] });
    expect(story.planets.every((p) => !p.focus && p.t < HOROSCOPE_WHEEL_STORY.ring)).toBe(true);
  });
});
