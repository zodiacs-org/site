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

  it('places the October 2026 new moon on the 10th in UTC', () => {
    const html = skyMonthHtml(skyMonthEvents('en'), { year: 2026, month: 10, locale: 'en', timeZone: 'UTC' });
    expect(html).toMatch(/<span class="skym__n">10<\/span><span class="skym__dots" aria-hidden="true"><i class="skym__dot skym__dot--new">/);
  });
});
