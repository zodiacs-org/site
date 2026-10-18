import { describe, expect, it } from 'vitest';
import { RELEASED_LOCALES, localizePath, t } from './i18n';
import {
  FOOTER_TOOLS,
  NAV_TOOLS,
  navToolLabelHasEnglishCue,
  TOOL_CATALOG,
  TOOLS_HUB,
} from './nav-tools';

describe('NAV_TOOLS', () => {
  it.each(['es', 'pt', 'fr', 'it'] as const)('recognizes the existing %s Birthday language cue once', (locale) => {
    expect(navToolLabelHasEnglishCue(locale, 'birthday', t(locale, 'birthday'))).toBe(true);
    expect(navToolLabelHasEnglishCue(locale, 'birthday', 'Birthday')).toBe(false);
    expect(navToolLabelHasEnglishCue(locale, 'birthChart', t(locale, 'birthday'))).toBe(false);
  });

  it('does not suppress a cue for an unqualified or differently localized label', () => {
    expect(navToolLabelHasEnglishCue('en', 'birthday', t('en', 'birthday'))).toBe(false);
    expect(navToolLabelHasEnglishCue('ru', 'birthday', t('ru', 'birthday'))).toBe(false);
    expect(navToolLabelHasEnglishCue('pt', 'birthday', t('es', 'birthday'))).toBe(false);
  });

  it('keeps the requested eight tools in stable order', () => {
    expect(NAV_TOOLS.map((tool) => tool.href)).toEqual([
      '/birth-chart/',
      '/compatibility/',
      '/transits/',
      '/moon-sign/',
      '/rising-sign/',
      '/moon-phase/',
      '/saturn-return/',
      '/birthday/',
    ]);
  });

  it('resolves labels, one-line sublabels, and existing localized paths', () => {
    for (const locale of RELEASED_LOCALES) {
      for (const tool of NAV_TOOLS) {
        expect(t(locale, tool.label).trim()).not.toBe('');
        expect(tool.sublabel[locale]).not.toMatch(/[\r\n]/);
        expect(localizePath(locale, tool.href)).toMatch(/^\//);
      }
    }

    expect(localizePath('es', '/transits/')).toBe('/es/transits/');
    expect(localizePath('es', '/birthday/')).toBe('/birthday/');
    expect(localizePath('pt', '/transits/')).toBe('/pt/transits/');
    expect(localizePath('pt', '/birthday/')).toBe('/birthday/');
    expect(localizePath('fr', '/transits/')).toBe('/fr/transits/');
    expect(localizePath('fr', '/birthday/')).toBe('/birthday/');
    expect(localizePath('it', '/transits/')).toBe('/it/transits/');
    expect(localizePath('it', '/birthday/')).toBe('/birthday/');
  });

  it('derives the nav, footer, and tools hub from one href catalogue', () => {
    const catalogueHrefs = new Set(TOOL_CATALOG.map((tool) => tool.href));
    expect(catalogueHrefs.size).toBe(TOOL_CATALOG.length);
    expect(FOOTER_TOOLS.map((tool) => tool.href)).toEqual([
      '/birth-chart/',
      '/today/',
      '/compatibility/',
      '/moon-sign/',
      '/rising-sign/',
      '/moon-phase/',
      '/saturn-return/',
      '/transits/',
      '/retrogrades/',
    ]);
    expect(TOOLS_HUB).toHaveLength(28);
    for (const tool of [...NAV_TOOLS, ...FOOTER_TOOLS, ...TOOLS_HUB]) {
      expect(catalogueHrefs.has(tool.href)).toBe(true);
    }
  });

  it('leads the tools hub with the birth chart and sorts the rest into four groups, one icon each', () => {
    expect(TOOLS_HUB.filter((tool) => tool.group === 'lead').map((tool) => tool.href)).toEqual(['/birth-chart/']);
    expect(TOOLS_HUB[0].href).toBe('/birth-chart/');
    const counts = Object.fromEntries(['you', 'together', 'sky', 'year'].map((group) => [group, TOOLS_HUB.filter((tool) => tool.group === group).length]));
    expect(counts).toEqual({ you: 6, together: 6, sky: 6, year: 9 });
    expect(new Set(TOOLS_HUB.map((tool) => tool.icon)).size).toBe(TOOLS_HUB.length);
    for (const tool of TOOLS_HUB) {
      expect(tool.promise).not.toMatch(/[\r\n\u2013\u2014]/u);
      expect(tool.promise.length).toBeLessThanOrEqual(72);
    }
    expect(TOOLS_HUB.find((tool) => tool.href === '/birthday/')).toMatchObject({ group: 'you', icon: 'birthday' });
  });
  it('publishes lunar return only in the English tools hub', () => {
    expect(TOOLS_HUB.find((tool) => tool.href === '/lunar-return/')).toMatchObject({ group: 'year', icon: 'lunar-return' });
    expect([...NAV_TOOLS, ...FOOTER_TOOLS].some((tool) => tool.href === '/lunar-return/')).toBe(false);
    for (const locale of RELEASED_LOCALES) expect(localizePath(locale, '/lunar-return/')).toBe('/lunar-return/');
  });

  it('publishes numerology only in the English tools hub', () => {
    expect(TOOLS_HUB.find((tool) => tool.href === '/numerology/')).toMatchObject({ group: 'you', icon: 'numerology' });
    expect([...NAV_TOOLS, ...FOOTER_TOOLS].some((tool) => tool.href === '/numerology/')).toBe(false);
    for (const locale of RELEASED_LOCALES) expect(localizePath(locale, '/numerology/')).toBe('/numerology/');
  });

  it('links Today to released daily editions and preserves unreleased-language cues', () => {
    const today = FOOTER_TOOLS.find((tool) => tool.href === '/today/');
    expect(today?.localized).toBe(true);
    expect(today?.labels?.es).toBe('Hoy');
    expect(today?.labels?.pt).toBe('Hoje');
    for (const locale of ['es', 'pt'] as const) {
      expect(localizePath(locale, '/today/')).toBe(`/${locale}/today/`);
    }
    for (const locale of ['fr', 'it', 'ru'] as const) {
      expect(localizePath(locale, '/today/')).toBe('/today/');
      expect(today?.labels?.[locale]).toMatch(/anglais|inglese|английски/u);
    }
  });
});
