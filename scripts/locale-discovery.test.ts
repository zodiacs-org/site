import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { signDates } from '../src/lib/signs';

const read = (path: string) => readFileSync(resolve(path), 'utf8');

describe('localized discovery surfaces', () => {
  it('gives localized Tools pages the shared larger H1 and second-level tool headings', () => {
    const heading = read('src/components/ToolsPageHeading.astro');
    const existingStyle = read('src/styles/base.css').match(/\.section-head h2\s*\{([^}]+)\}/u)?.[1];
    const headingStyle = heading.match(/\bh1\s*\{([^}]+)\}/u)?.[1];
    expect(heading).toContain('<h1><slot /></h1>');
    expect(headingStyle).toContain('font-size: clamp(36px, 5vw, 56px)');
    expect(headingStyle).toContain('font-family: var(--font-serif)');
    expect(headingStyle).not.toBe(existingStyle);
    for (const locale of ['es', 'pt', 'fr', 'it', 'ru']) {
      const page = read(`src/pages/${locale}/tools/index.astro`);
      expect(page.match(/<ToolsPageHeading>/gu)).toHaveLength(1);
      expect(page).toContain('<h2>{tool.title}</h2>');
      expect(page).not.toContain('<h3>');
    }
  });

  it('uses localized sign dates on both daily horoscope surfaces', () => {
    for (const locale of ['es', 'pt'] as const) {
      for (const route of ['index.astro', '[sign]/index.astro']) {
        const page = read(`src/pages/${locale}/horoscopes/${route}`);
        expect(page).toContain('{signDates(sign, locale)}');
        expect(page).not.toContain('{sign.dates}');
      }
    }
    expect(signDates('aries', 'es')).toBe('21 mar – 19 abr');
    expect(signDates('capricorn', 'es')).toBe('22 dic – 19 ene');
    expect(signDates('sagittarius', 'pt')).toBe('22 nov – 21 dez');
    expect(signDates('aquarius', 'pt')).toBe('20 jan – 18 fev');
  });

  it('labels the localized Today card for its sign edition, not saved-chart personalization', () => {
    for (const locale of ['es', 'pt']) {
      const page = read(`src/pages/${locale}/tools/index.astro`);
      const today = page.split('\n').find((line) => line.includes("href: '/today/'"));
      expect(today).toBeTruthy();
      expect(today).not.toContain('englishOnly: true');
      expect(today).not.toMatch(/ingl[eê]s/u);
      expect(today).toMatch(/doce signos solares|doze signos solares/u);
    }
  });

  it('describes the daily sign hub honestly instead of promising a direct monthly reading', () => {
    const links = {
      es: { action: 'elegir signo', daily: 'El cielo de hoy', longer: 'lecturas semanales y mensuales' },
      pt: { action: 'escolher signo', daily: 'O céu de hoje', longer: 'leituras semanais e mensais' },
      fr: { action: 'choisir un signe', daily: 'Le ciel du jour', longer: 'lectures de la semaine et du mois' },
      it: { action: 'scegliere un segno', daily: 'Il cielo di oggi', longer: 'letture della settimana e del mese' },
      ru: { action: 'выбрать знак — пока по-английски', daily: 'Сегодняшнее небо', longer: 'прогнозы на неделю и месяц' },
    };
    for (const [locale, expected] of Object.entries(links)) {
      const page = read(`src/pages/${locale}/tools/index.astro`);
      const entry = page.split('\n').find((line) => line.includes('href="/horoscopes/"'));
      expect(entry).toContain('hreflang="en"');
      expect(entry).toContain(expected.daily);
      expect(entry).toContain(expected.longer);
      expect(entry).toContain(`>${expected.action}</a>`);
      expect(entry).toContain(locale === 'ru'
        ? 'title="Материал пока доступен по-английски"'
        : 'title={englishOnly.aria}');
    }
    const hub = read('src/pages/horoscopes/index.astro');
    expect(hub).toContain('href={`/horoscopes/${sign.slug}/`}');
  });

  it('takes French and Italian forecast CTAs to the available edition with a visible language cue', () => {
    for (const locale of ['fr', 'it']) {
      const page = read(`src/pages/${locale}/index.astro`);
      expect(page).toContain(`href={localizePath('${locale}', '/horoscopes/')} hreflang="en"`);
      expect(page).toContain('{englishOnly?.suffix}</span>');
      expect(page).not.toContain(`href="/${locale}/horoscopes/"`);
    }
  });

  it('keeps the tour’s monthly forecast destination and English cue consistent', () => {
    const tour = read('src/islands/explorer/tour/ChartTour.tsx');
    expect(tour).toContain('`/horoscopes/${sunSign.slug}/monthly/`');
    expect(tour).toContain("hreflang={englishOnly ? 'en' : undefined}");
    expect(tour).toContain("{englishOnly && <small>{tourText(locale, 'quickHoroscopeEnglishNote')}</small>}");
  });
});
