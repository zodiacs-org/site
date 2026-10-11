import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import programData from '../data/horoscope-program.json';
import receipt from '../data/daily-publication-manifest.json';
import type { HoroscopeProgram } from './horoscope-program';
import { pageReadingFromProgram } from './horoscope-page-data';
import {
  buildDailyContentManifest, dailyContentManifest, xCaption, xTextLength,
} from './daily-content-manifest';
import { findConsumerBoundaryViolations } from '../../scripts/consumer-boundary-lib.mjs';
import { consumerFacingText } from '../../scripts/consumer-copy-lib.mjs';
import { GET as todayGET, prerender as todayPrerender } from '../pages/content/today.json';
import { GET as datedGET, getStaticPaths, prerender as datedPrerender } from '../pages/content/[date].json';

const order = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const program = programData as HoroscopeProgram;
const manifest = buildDailyContentManifest('2026-10-12T07:30:00.000Z');
const banned = /\b(?:tokens?|coins?|buy(?:ing)?|prices?|pump(?:ing)?|moon[-\s]?shots?|to\s+the\s+moon|100x|crypto|hashtags?)\b/iu;

describe('daily content manifest', () => {
  it('publishes the versioned schema, edition date, timestamp, and receipt hash', () => {
    expect(manifest.schema).toBe('zodiacs.daily-content.v1');
    expect(manifest.date).toBe(receipt.date);
    expect(manifest.generatedAt).toBe('2026-10-12T07:30:00.000Z');
    expect(new Date(dailyContentManifest.generatedAt).toISOString()).toBe(dailyContentManifest.generatedAt);
    expect(manifest.source).toEqual({
      publicationCanonicalSha256: receipt.publication.canonicalSha256,
      url: 'https://zodiacs.org/horoscopes/',
    });
    expect(manifest.source.publicationCanonicalSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(manifest.signs.map(({ sign }) => sign)).toEqual(order);
  });

  it('copies each published first daily passage verbatim and builds only permitted captions', () => {
    for (const entry of manifest.signs) {
      const published = pageReadingFromProgram(program, entry.sign, 'today').sections[0].body;
      expect(entry.dailyLine).toBe(published);
      expect(entry.dailyLine).toBe(program.signs.find(({ sign }) => sign === entry.sign)!.readings.today.passages[0].text);
      expect(entry.name).toBe(entry.sign[0].toUpperCase() + entry.sign.slice(1));
      expect(entry.symbol).toBe(['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'][order.indexOf(entry.sign)]);
      expect(entry.captions.instagram).toBe(`${entry.name}: ${published}\n${entry.signPageUrl}`);
      const x = entry.captions.x;
      const excerpt = x.slice(`${entry.name}: `.length, -(`\n${entry.signPageUrl}`).length);
      expect(x.startsWith(`${entry.name}: `)).toBe(true);
      expect(x.endsWith(`\n${entry.signPageUrl}`)).toBe(true);
      expect(published.startsWith(excerpt.endsWith('…') ? excerpt.slice(0, -1) : excerpt)).toBe(true);
      expect(xTextLength(x.replace(entry.signPageUrl, '')) + 23).toBeLessThanOrEqual(280);
      for (const text of [entry.dailyLine, ...Object.values(entry.captions)]) {
        expect(text).not.toContain('—');
        expect(text).not.toMatch(banned);
        expect(text).not.toContain('#');
      }
    }
    // Reuse the site's consumer-boundary vocabulary and destination rules.
    expect(findConsumerBoundaryViolations(JSON.stringify(manifest), 'src/data/daily-content.json')).toEqual([]);
  });

  it('uses absolute production URLs for existing horoscope routes and pastel icons', () => {
    expect(existsSync(resolve('src/pages/horoscopes/index.astro'))).toBe(true);
    expect(existsSync(resolve('src/pages/horoscopes/[sign]/index.astro'))).toBe(true);
    for (const entry of manifest.signs) {
      expect(entry.signPageUrl).toBe(`https://zodiacs.org/horoscopes/${entry.sign}/`);
      expect(entry.iconUrl).toBe(`https://zodiacs.org/assets/zodiac-icons/400/${entry.sign}.webp`);
      for (const url of [entry.signPageUrl, entry.iconUrl, manifest.source.url]) {
        expect(new URL(url).origin).toBe('https://zodiacs.org');
      }
      expect(existsSync(resolve('public', new URL(entry.iconUrl).pathname.slice(1)))).toBe(true);
    }
    // The built-route checks run when validating the emitted endpoints below.
  });

  it('prerenders identical stable and dated responses with cache and CORS headers', async () => {
    expect(todayPrerender && datedPrerender).toBe(true);
    expect(getStaticPaths()).toEqual([{ params: { date: manifest.date } }]);
    const today = todayGET();
    expect(await today.json()).toEqual(dailyContentManifest);
    expect(await todayGET().text()).toBe(await datedGET().text());
    expect(today.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(today.headers.get('cache-control')).toBe('public, max-age=300, s-maxage=300');
    expect(today.headers.get('access-control-allow-origin')).toBe('*');
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(vercel.headers.find(({ source }: { source: string }) => source === '/content/:file(.*).json').headers).toEqual([
      { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=300' },
      { key: 'Access-Control-Allow-Origin', value: '*' },
    ]);
  });

  it('refuses mismatched editions, missing signs, withheld readings, and em-dashes', () => {
    const changed = () => structuredClone(program);
    const wrongDate = changed();
    wrongDate.anchorDate = '2000-01-01';
    expect(() => buildDailyContentManifest(undefined, wrongDate)).toThrow('edition date');
    const missing = changed();
    missing.signs.pop();
    expect(() => buildDailyContentManifest(undefined, missing)).toThrow('twelve distinct signs');
    const wrongPeriod = changed();
    wrongPeriod.signs[0].readings.today.period.from = '2000-01-01';
    expect(() => buildDailyContentManifest(undefined, wrongPeriod)).toThrow('UTC edition');
    const withheld = changed();
    withheld.signs[0].readings.today.status = 'insufficient-evidence';
    expect(() => buildDailyContentManifest(undefined, withheld)).toThrow('not publishable');
    const punctuation = changed();
    punctuation.signs[0].readings.today.passages[0].text += '—';
    expect(() => buildDailyContentManifest(undefined, punctuation)).toThrow('em-dashes');
  });

  it.runIf(process.env.ZODIACS_TEST_CONTENT_DIST === '1')('emits identical JSON files whose text and URLs resolve in the built site', () => {
    const stable = readFileSync('dist/content/today.json', 'utf8');
    expect(stable).toBe(readFileSync(`dist/content/${manifest.date}.json`, 'utf8'));
    const built = JSON.parse(stable);
    expect(built).toEqual(buildDailyContentManifest(built.generatedAt));
    expect(new Date(built.generatedAt).toISOString()).toBe(built.generatedAt);
    for (const entry of built.signs) {
      const pagePath = resolve('dist', new URL(entry.signPageUrl).pathname.slice(1), 'index.html');
      const html = readFileSync(pagePath, 'utf8');
      // EditionText renders a dated fallback in static HTML and retains the
      // verbatim daily wording for the browser's current-edition state.
      const currentEditionText = [...html.matchAll(/data-edition-current="([^"]*)"/gu)]
        .map((match) => consumerFacingText(`<p>${match[1]}</p>`));
      expect(currentEditionText).toContain(entry.dailyLine);
      expect(existsSync(resolve('dist', new URL(entry.iconUrl).pathname.slice(1)))).toBe(true);
    }
    expect(existsSync('dist/horoscopes/index.html')).toBe(true);
  });
});

describe('X caption limits', () => {
  const url = 'https://zodiacs.org/horoscopes/sagittarius/';
  it('preserves short text and prefers a complete sentence before the ellipsis', () => {
    expect(xCaption('Sagittarius', 'Keep it simple.', url)).toBe(`Sagittarius: Keep it simple.\n${url}`);
    expect(xCaption('Sagittarius', `Keep it simple. ${'Continue gently '.repeat(40)}`, url)).toBe(`Sagittarius: Keep it simple.…\n${url}`);
  });
  it('truncates at a word boundary when the first sentence exceeds the budget', () => {
    const text = 'Consider the next step '.repeat(40);
    const caption = xCaption('Sagittarius', text, url);
    const excerpt = caption.slice('Sagittarius: '.length, -(`\n${url}`).length);
    expect(excerpt).toMatch(/\S…$/u);
    expect(text.slice(excerpt.length - 1, excerpt.length)).toBe(' ');
    expect(xTextLength(caption.replace(url, '')) + 23).toBeLessThanOrEqual(280);
  });
  it('handles the exact limit and weighted Unicode without splitting a character', () => {
    const budget = 280 - 'Sagittarius: '.length - 1 - 23;
    expect(xCaption('Sagittarius', 'a'.repeat(budget), url)).toBe(`Sagittarius: ${'a'.repeat(budget)}\n${url}`);
    const caption = xCaption('Sagittarius', '静かな一歩 '.repeat(80), url);
    expect(xTextLength(caption.replace(url, '')) + 23).toBeLessThanOrEqual(280);
    expect(caption).toContain('…');
    expect(xTextLength('’…')).toBe(3);
  });
});
