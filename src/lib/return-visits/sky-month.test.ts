import { describe, expect, it } from 'vitest';
import { skyMonthEvents } from './sky-month-events';
import { skyMonthHtml } from './sky-month';

describe('sky month view', () => {
  it('keeps the planet identifier on translated retrograde windows', () => {
    for (const locale of ['en', 'es', 'fr', 'ru'] as const) {
      const retros = skyMonthEvents(locale).filter((e) => e.kind === 'retro');
      expect(retros.length).toBeGreaterThan(0);
      expect(retros.every((e) => typeof e.planet === 'string')).toBe(true);
    }
  });

  it('draws Mercury, Venus and Mars bars in every locale, and no outer-planet bars', () => {
    for (const locale of ['en', 'es', 'fr'] as const) {
      const html = skyMonthHtml(skyMonthEvents(locale), { year: 2026, month: 10, locale, timeZone: 'UTC' });
      expect(html).toContain('--hue:var(--sign-libra)'); // Venus, retrograde from Oct 3
      expect(html).toContain('--hue:var(--sign-gemini)'); // Mercury, retrograde from Oct 24
      expect(html).not.toContain('skym__bar" style="--hue:var(--sign-scorpio)'); // Pluto
    }
  });

  it('writes each retrograde window as a range in words, without a dash', () => {
    const expected = {
      en: /<time datetime="[^"]+">Oct 3 to Nov 1[34]<\/time>/u,
      es: /<time datetime="[^"]+">del 3 oct al 1[34] nov<\/time>/u,
      fr: /<time datetime="[^"]+">du 3 oct\. au 1[34] nov\.<\/time>/u,
      it: /<time datetime="[^"]+">dal 3 ott al 1[34] nov<\/time>/u,
    } as const;
    for (const [locale, pattern] of Object.entries(expected) as [keyof typeof expected, RegExp][]) {
      const html = skyMonthHtml(skyMonthEvents(locale), { year: 2026, month: 10, locale, timeZone: 'UTC' });
      expect(html, locale).toMatch(pattern);
      expect(html.match(/<time datetime="[^"]+">[^<]*<\/time>/gu)!.join(''), locale).not.toMatch(/[–—]/u);
    }
  });

  it('elides the Italian article before the 1st, 8th and 11th, and uses со before the 2nd in Russian', () => {
    const window = (at: string, end: string) => [{ kind: 'retro' as const, at, end, label: 'Mercurio', planet: 'Mercury' }];
    const italian = skyMonthHtml(window('2026-10-01T12:00:00Z', '2026-11-08T12:00:00Z'), { year: 2026, month: 10, locale: 'it', timeZone: 'UTC' });
    expect(italian).toMatch(/>dall(?:'|&#39;)1 ott all(?:'|&#39;)8 nov<\/time>/u);
    const italianEleventh = skyMonthHtml(window('2026-10-11T12:00:00Z', '2026-11-20T12:00:00Z'), { year: 2026, month: 10, locale: 'it', timeZone: 'UTC' });
    expect(italianEleventh).toMatch(/>dall(?:'|&#39;)11 ott al 20 nov<\/time>/u);
    const russian = skyMonthHtml(window('2026-10-02T12:00:00Z', '2026-10-25T12:00:00Z'), { year: 2026, month: 10, locale: 'ru', timeZone: 'UTC' });
    expect(russian).toMatch(/>со 2 окт\. по 25 окт\.<\/time>/u);
  });

  it('places the October 2026 new moon on the 10th in UTC', () => {
    const html = skyMonthHtml(skyMonthEvents('en'), { year: 2026, month: 10, locale: 'en', timeZone: 'UTC' });
    expect(html).toMatch(/<span class="skym__n">10<\/span><span class="skym__dots" aria-hidden="true"><i class="skym__dot skym__dot--new">/);
  });
});
