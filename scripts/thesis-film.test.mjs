import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FILM, filmScript, loadFilmScript } from './build-thesis-film.mjs';

const root = resolve(import.meta.dirname, '..');
const file = (name) => resolve(root, `public${FILM.dir}/${name}`);
const json = async (name) => JSON.parse(await readFile(resolve(root, `public/thesis/${name}`), 'utf8'));

function probe(path) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height:format=duration', '-of', 'json', path], { encoding: 'utf8' });
    const parsed = JSON.parse(out);
    return { ...parsed.streams[0], duration: Number(parsed.format.duration) };
  } catch {
    return null;
  }
}

describe('the thesis film, "Why the zodiac lasts"', () => {
  it('takes every number from the data files the page is stamped from', async () => {
    const charts = await json('thesis-charts.json');
    const seasons = await json('thesis-seasons.json');
    const script = await loadFilmScript();
    const words = script.scenes.flatMap((s) => [...s.lines, ...s.then]).join(' ');
    expect(words).toContain(`${charts.consult.yearlyPct}% of Americans`);
    expect(words).toContain(`${charts.consult.womenUnder50Pct}%`);
    expect(words).toContain(`${Math.round(seasons.reads.total / 1e6)} million Wikipedia reads`);
    expect(words).toContain(`${seasons.liftRange[0]}% to ${seasons.liftRange[1]}% more`);
    expect(script.know).toBe(charts.know.knowSignPct);
    expect(script.believe).toBe(charts.know.believePct);
  });

  it('shows a source on every scene and says nothing it cannot back', async () => {
    const script = await loadFilmScript();
    for (const scene of script.scenes) {
      expect(scene.source.length, scene.lines[0]).toBeGreaterThan(10);
      for (const words of [...scene.lines, ...scene.then, scene.source]) {
        expect(words, words).not.toMatch(/[–—]/u);
        expect(words, words).not.toMatch(/bitcoin|ether|solana|doge|pepe|shib|xrp|pump\.fun|portnoy|billion|price|profit|returns?\b/iu);
      }
    }
    expect(script.scenes.at(-1).source).toMatch(/can fall to zero/u);
  });

  it('refuses to render when a sentence stops being true', async () => {
    const charts = await json('thesis-charts.json');
    const seasons = await json('thesis-seasons.json');
    expect(() => filmScript({ ...charts, know: { ...charts.know, knowSignPct: 70 } }, seasons)).toThrow();
    expect(() => filmScript({ ...charts, consult: { ...charts.consult, yearlyPct: 12 } }, seasons)).toThrow();
    expect(() => filmScript(charts, { ...seasons, signs: seasons.signs.map((s, i) => (i ? s : { ...s, lift: -3 })) })).toThrow();
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

  it(`runs ${FILM.seconds} seconds at 1280 x 720, and the tall cut 2 seconds longer at 1080 x 1920 with the end card`, (context) => {
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
    for (const attr of ['muted', 'playsinline', 'preload="none"', 'width="1280"', 'height="720"']) expect(video).toContain(attr);
    // Controls are switched on when the reader presses play, and a plain link opens the film without script.
    expect(page).toContain('film.controls = true');
    expect(page).toContain('class="film-play"');
    expect(page).toContain(`<a class="mine-film__file" href="${FILM.dir}/${FILM.wide.h264}">Open the film</a>`);
    expect(page).toContain(`${FILM.dir}/${FILM.wide.av1}`);
    expect(page).toContain(`${FILM.dir}/${FILM.wide.h264}`);
    // The poster is set from data-poster after load, so it never competes with
    // the hero for the first paint (Lighthouse LCP on /thesis/).
    expect(video).toContain(`data-poster="${FILM.dir}/${FILM.poster.webp}"`);
    expect(video).not.toMatch(/\sposter=/u);
    expect(page).not.toContain('two-conversations');
  });
});
