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

function markers(svg: string): { body: string; x: number; y: number; r: number }[] {
  return [...svg.matchAll(/data-preview-body="([^"]+)"><line[^>]*><\/line><circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/gu)]
    .map((match) => ({ body: match[1], x: Number(match[2]), y: Number(match[3]), r: Number(match[4]) }));
}

// The story mirrors Wheel's frame rather than importing it (Wheel.tsx is
// built into the pinned Chart Studio panel), so these read the frame back
// from the rendered image itself: its centre and ring radii from the first
// two ring circles, and each sign's start from the twelve boundary lines.
function frame(svg: string) {
  const rings = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="none" stroke="rgba\(198,204,218,0.16\)"/gu)]
    .map((match) => match.slice(1, 4).map(Number));
  const boundaries = [...svg.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)" stroke="rgba\(198,204,218,0.22\)"/gu)]
    .map((match) => ({ inner: { x: Number(match[1]), y: Number(match[2]) }, outer: { x: Number(match[3]), y: Number(match[4]) } }));
  const [cx, cy, rSigns] = rings[0];
  return { cx, cy, rSigns, rSignsIn: rings[1][2], boundaries };
}

const startOf = (d: string) => d.slice(1).split('A')[0].split(' ').map(Number);
const angleOf = (x: number, y: number, cx: number, cy: number) => Math.atan2(y - cy, x - cx);
const sameAngle = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

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
        // The veil covers the image's own marker, read from the image.
        expect(planet.r, planet.body).toBeGreaterThan(marker.r);
      }

      // The ring is the image's outer sign ring: same centre, same radius,
      // starting on the image's boundary line where the page's sign begins.
      const image = frame(svg);
      expect(image.boundaries).toHaveLength(12);
      const ringR = Number(story.ring.split('A')[1].split(' ')[0]);
      expect(ringR).toBeCloseTo(image.rSigns, 6);
      const [rx, ry] = startOf(story.ring);
      const own = image.boundaries[SIGNS.indexOf(sign)];
      expect(Math.hypot(rx - own.outer.x, ry - own.outer.y)).toBeLessThan(0.1);
      // The band covers the image's sign ring from inside its inner circle to
      // just outside its outer one.
      const inner = story.band.r - story.band.width / 2;
      const outer = story.band.r + story.band.width / 2;
      expect(inner).toBeLessThan(image.rSignsIn);
      expect(inner).toBeGreaterThan(image.rSignsIn - 10);
      expect(outer).toBeGreaterThan(image.rSigns);
      expect(outer).toBeLessThan(image.rSigns + 3);
      // Each sign veil starts on that sign's boundary line in the image,
      // the page's sign first and then in zodiac order.
      story.signs.forEach((veil, i) => {
        const line = image.boundaries[(SIGNS.indexOf(sign) + i) % 12];
        const [vx, vy] = startOf(veil.d);
        expect(Math.hypot(vx - image.cx, vy - image.cy)).toBeCloseTo(story.band.r, 1);
        const lineAngle = angleOf(line.outer.x, line.outer.y, image.cx, image.cy);
        expect(sameAngle(angleOf(vx, vy, image.cx, image.cy), lineAngle), `${sign.slug} veil ${i}`).toBeLessThan(0.002);
      });

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
