import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FILM, FILM_WORDS } from './build-thesis-film.mjs';

const root = resolve(import.meta.dirname, '..');
const file = (name) => resolve(root, `public${FILM.dir}/${name}`);

function probe(path) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height:format=duration', '-of', 'json', path], { encoding: 'utf8' });
    const json = JSON.parse(out);
    return { ...json.streams[0], duration: Number(json.format.duration) };
  } catch {
    return null;
  }
}

describe('the thesis film, "Two conversations"', () => {
  it('says only ordinary words: no dash, no brand, no number', () => {
    const all = [FILM_WORDS.open, ...FILM_WORDS.jargon, ...FILM_WORDS.group, FILM_WORDS.ask, FILM_WORDS.close, FILM_WORDS.last];
    for (const words of all) {
      expect(words, words).not.toMatch(/[–—]/u);
      expect(words, words).not.toMatch(/\d/u);
      expect(words, words).not.toMatch(/bitcoin|ether|solana|doge|pepe|shib|xrp|pump|fomo|portnoy/iu);
    }
  });

  it('commits both cuts and the poster within their budgets', async () => {
    const sizes = {
      h264: (await stat(file(FILM.wide.h264))).size,
      av1: (await stat(file(FILM.wide.av1))).size,
      tall: (await stat(file(FILM.tall.h264))).size,
      webp: (await stat(file(FILM.poster.webp))).size,
      avif: (await stat(file(FILM.poster.avif))).size,
    };
    expect(sizes.h264).toBeLessThan(1.5 * 1024 * 1024);
    expect(sizes.av1).toBeLessThan(1.5 * 1024 * 1024);
    expect(sizes.tall).toBeLessThan(3 * 1024 * 1024);
    expect(sizes.webp).toBeLessThan(60 * 1024);
    expect(sizes.avif).toBeLessThan(60 * 1024);
    const head = (await readFile(file(FILM.wide.h264))).subarray(4, 8).toString('latin1');
    expect(head).toBe('ftyp');
  });

  it('runs 20 seconds at 1280 x 720, and the tall cut 22 seconds at 1080 x 1920 with the end card', (context) => {
    const wide = probe(file(FILM.wide.h264));
    if (!wide) return context.skip();
    expect(wide).toMatchObject({ codec_name: 'h264', width: 1280, height: 720 });
    expect(wide.duration).toBeCloseTo(FILM.seconds, 0);
    const av1 = probe(file(FILM.wide.av1));
    expect(av1).toMatchObject({ codec_name: 'av1', width: 1280, height: 720 });
    const tall = probe(file(FILM.tall.h264));
    expect(tall).toMatchObject({ codec_name: 'h264', width: 1080, height: 1920 });
    expect(tall.duration).toBeCloseTo(FILM.seconds + 2, 0);
  });

  it('sits on the page without loading before play', async () => {
    const page = await readFile(resolve(root, 'public/thesis/index.html'), 'utf8');
    const video = page.match(/<video class="thesis-film"[^>]*>/u)?.[0] ?? '';
    for (const attr of ['controls', 'muted', 'playsinline', 'preload="none"', 'width="1280"', 'height="720"']) expect(video).toContain(attr);
    expect(page).toContain(`${FILM.dir}/${FILM.wide.av1}`);
    expect(page).toContain(`${FILM.dir}/${FILM.wide.h264}`);
    expect(video).toContain(`${FILM.dir}/${FILM.poster.webp}`);
  });
});
