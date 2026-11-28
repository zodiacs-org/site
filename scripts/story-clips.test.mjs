import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLIP,
  CLIP_TIMELINE,
  STORIES,
  birthdaySample,
  captionFrom,
  clipSeconds,
  frameTimes,
  pairSample,
  planClips,
} from './build-story-clips.mjs';
import { END_CARD } from './build-end-card.mjs';

const root = resolve(import.meta.dirname, '..');

describe('the story clips for short videos', () => {
  it('runs 6 to 10 seconds at 1080 x 1920 and 30 fps, ending on the published end card', () => {
    expect(CLIP).toMatchObject({ width: END_CARD.width, height: END_CARD.height, fps: 30, endCard: END_CARD.video });
    expect(CLIP.endCardSeconds).toBe(END_CARD.seconds);
    expect(clipSeconds()).toBeGreaterThanOrEqual(6);
    expect(clipSeconds()).toBeLessThanOrEqual(10);
  });

  it('draws each frame from its time: the waiting figure, the story once, then a hold on the finished figure', () => {
    const story = 2360;
    const times = frameTimes(story);
    expect(times).toHaveLength(Math.round(CLIP_TIMELINE.story * CLIP.fps));
    const lead = Math.round(CLIP_TIMELINE.lead * CLIP.fps);
    expect(times.slice(0, lead + 1).every((t) => t === 0)).toBe(true);
    times.slice(1).forEach((t, index) => expect(t).toBeGreaterThanOrEqual(times[index]));
    expect(times[lead + 1]).toBeCloseTo(1000 / CLIP.fps, 6);
    expect(times.at(-1)).toBe(story);
    const held = times.length - times.indexOf(story);
    expect(held / CLIP.fps).toBeGreaterThanOrEqual(CLIP_TIMELINE.minHold);
  });

  it('refuses a story that has no motion or runs past the runtime\'s 2.6 s', () => {
    expect(() => frameTimes(0)).toThrow();
    expect(() => frameTimes(CLIP.storyLimitMs + 1)).toThrow();
    expect(() => frameTimes(CLIP.storyLimitMs)).not.toThrow();
  });

  it('keeps words out of the platform UI at the top and bottom', () => {
    expect(CLIP.safeTop).toBeGreaterThanOrEqual(220);
    expect(CLIP.safeBottom).toBeGreaterThanOrEqual(320);
  });

  it('renders every sign guide and one sample of each other story by default', () => {
    const plan = planClips();
    expect(plan.filter((clip) => clip.key === 'sign-guide')).toHaveLength(12);
    for (const key of Object.keys(STORIES)) expect(plan.some((clip) => clip.key === key), key).toBe(true);
    expect(new Set(plan.map((clip) => clip.name)).size).toBe(plan.length);
    expect(plan.find((clip) => clip.key === 'full-moon')).toMatchObject({ name: 'full-moon', path: '/full-moon-calendar/' });
  });

  it('takes more samples as arguments, spelled as the site spells its pages', () => {
    expect(planClips(['sign-guide:leo,virgo']).map((clip) => clip.path)).toEqual(['/leo/', '/virgo/']);
    expect(planClips(['compatibility:pisces-cancer'])[0]).toMatchObject({ name: 'compatibility-cancer-pisces', path: '/compatibility/cancer-pisces/' });
    expect(planClips(['birthday:march-21'])[0].path).toBe('/birthday/march-21/');
    expect(pairSample('leo-leo')).toBe('leo-leo');
    expect(birthdaySample('february-29')).toBe('february-29');
    expect(() => birthdaySample('february-30')).toThrow();
    expect(() => birthdaySample('march-05')).toThrow();
    expect(() => pairSample('aries-ophiuchus')).toThrow();
    expect(() => planClips(['sign-guide:ophiuchus'])).toThrow();
    expect(() => planClips(['full-moon:2027'])).toThrow();
    expect(() => planClips(['tarot'])).toThrow();
  });

  it('captions each figure with words its page already prints for it', async () => {
    const pages = {
      'sign-guide': 'src/components/guide/SunYearPlate.astro',
      compatibility: 'src/components/compat/PairAnglePlate.astro',
      horoscope: ['src/components/HoroscopeProgramPage.astro', 'src/components/HoroscopeWheelStory.astro'],
      'full-moon': 'src/components/sky/FullMoonYearPlate.astro',
      'mercury-retrograde': 'src/components/sky/MercuryYearPlate.astro',
      'rising-sign': 'src/pages/rising-sign/index.astro',
      birthday: ['src/pages/birthday/[slug].astro', 'src/components/birthday/BirthdayDial.astro'],
      'birth-chart': 'src/pages/birth-chart/index.astro',
    };
    expect(Object.keys(pages).sort()).toEqual(Object.keys(STORIES).sort());
    for (const [key, files] of Object.entries(pages)) {
      const source = (await Promise.all([files].flat().map((file) => readFile(resolve(root, file), 'utf8')))).join('\n');
      const story = STORIES[key];
      // The story's mark, figure and caption are all on the page that tells it.
      const mark = story.go.split(' ').at(-1).replace(/^\./u, '');
      expect(source, `${key} mark`).toContain(mark);
      for (const selector of story.figure) expect(source, `${key} figure`).toContain(selector.split(' ').at(-1).replace(/^\./u, ''));
      const caption = story.caption.split(' ').at(-1);
      expect(source, `${key} caption`).toContain(caption.startsWith('#') ? `id="${caption.slice(1)}"` : caption.replace(/^\./u, ''));
    }
  });

  it('takes a caption as printed, cut to its first sentence where asked, and refuses what a clip never shows', () => {
    expect(captionFrom('  How close each full Moon\n of 2026 comes ')).toBe('How close each full Moon of 2026 comes');
    expect(captionFrom('The sky at noon UTC on November 28, 2026, set on the Aries wheel. In colour: the Moon.', { sentences: 1 }))
      .toBe('The sky at noon UTC on November 28, 2026, set on the Aries wheel.');
    expect(() => captionFrom('')).toThrow();
    expect(() => captionFrom('Aries \u2014 the first sign')).toThrow();
    expect(() => captionFrom('Aries \u2013 Taurus')).toThrow();
    expect(() => captionFrom('Born at 6:12 am: Leo rising')).toThrow();
    expect(() => captionFrom('The Aries token')).toThrow();
    expect(() => captionFrom('word '.repeat(30))).toThrow();
  });
});
