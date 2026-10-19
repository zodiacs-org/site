import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { END_CARD, END_CARD_TIMELINE, restingAngles, ringDepthTable } from './build-end-card.mjs';
import { TILTED_RING_DOTS, TILTED_RING_INKS } from '../src/lib/brand-lockup.mjs';

const root = resolve(import.meta.dirname, '..');

describe('the end card for short videos', () => {
  it('comes to rest as the lockup ring: each sign where the ring keeps it, Libra in front', () => {
    const angles = restingAngles();
    expect(angles.libra).toBe(90);
    expect(angles.aries).toBe(270);
    for (const [sign, angle] of Object.entries(angles)) {
      const phi = (angle * Math.PI) / 180;
      const dot = TILTED_RING_DOTS.find((row) => row.fill === TILTED_RING_INKS[sign]);
      expect(12 + 10 * Math.cos(phi), sign).toBeCloseTo(dot.cx, 1);
      expect(12 + 4 * Math.sin(phi), sign).toBeCloseTo(dot.cy, 1);
    }
  });

  it('sizes the dots by depth from the ring\'s own table, larger and brighter towards the front', () => {
    const table = ringDepthTable();
    expect(table[0]).toMatchObject({ depth: -1, r: 1.2, opacity: 0.45 });
    expect(table.at(-1)).toMatchObject({ depth: 1, r: 3.1, opacity: 1 });
    table.slice(1).forEach((row, index) => {
      expect(row.depth).toBeGreaterThan(table[index].depth);
      expect(row.r).toBeGreaterThan(table[index].r);
      expect(row.opacity).toBeGreaterThan(table[index].opacity);
    });
  });

  it('runs two seconds at 1080 x 1920 and holds the settled lockup for the last half second', () => {
    expect(END_CARD).toMatchObject({ width: 1080, height: 1920, fps: 60, seconds: 2 });
    const { fadeIn, spinEnd, moveStart, moveEnd, wordsStart, wordsEnd, settled } = END_CARD_TIMELINE;
    expect(fadeIn).toBeLessThan(moveStart);
    expect(moveStart).toBeLessThan(spinEnd);
    expect(spinEnd).toBeLessThan(moveEnd);
    expect(wordsStart).toBeLessThan(wordsEnd);
    expect(settled).toBe(Math.max(spinEnd, moveEnd, wordsEnd));
    expect(END_CARD.seconds - settled).toBeGreaterThanOrEqual(0.5);
  });

  it('commits the clip and its last frame', async () => {
    const video = await readFile(resolve(root, `public${END_CARD.video}`));
    expect(video.subarray(4, 8).toString('latin1')).toBe('ftyp');
    expect(video.includes(Buffer.from('avc1'))).toBe(true);
    expect(video.length).toBeLessThan(1024 * 1024);
    const poster = await sharp(await readFile(resolve(root, `public${END_CARD.poster}`))).metadata();
    expect(poster).toMatchObject({ format: 'png', width: 1080, height: 1920 });
  });
});
