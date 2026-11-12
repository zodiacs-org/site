import { describe, expect, it } from 'vitest';
import { RELEASED_LOCALES, localizePath, t } from './i18n';
import { TOOL_ICON_FOR_PATH } from './tool-icons';
import { LAUNCH_FLAGS, launchFlagOn, type LaunchFlag } from './launch-flags';
import {
  ALL_NAV_MORE,
  ALL_TOOL_CATALOG,
  FOOTER_TOOLS,
  NAV_MORE,
  NAV_TOOLS,
  navToolLabelHasEnglishCue,
  TOOL_CATALOG,
  TOOLS_HUB,
  visibleNavMore,
  visibleTools,
} from './nav-tools';

// A page behind a launch switch (src/lib/launch-flags.ts) adds its hub card
// and menu entry only while its switch is '1'. With every switch unset the
// counts are main's; each switched entry that is on adds one, so the numbers
// hold for any branch, any merge of them and any mix of switches.
type IsOn = (flag: LaunchFlag) => boolean;
const HUB_GROUPS = ['you', 'together', 'sky', 'year'] as const;
const MAIN_HUB = { you: 6, together: 6, sky: 6, year: 10 } as const;
const MAIN_HUB_LENGTH = 29;
const MAIN_NAV_MORE_LENGTH = 8;
const switchedOn = (entries: readonly { flag?: LaunchFlag }[], isOn: IsOn) => entries.filter((entry) => entry.flag !== undefined && isOn(entry.flag)).length;
const switchedHubCards = (isOn: IsOn, group?: string) => switchedOn(ALL_TOOL_CATALOG.filter((tool) => tool.hub && (group === undefined || tool.hub.group === group)), isOn);
const expectedGroups = (isOn: IsOn) => Object.fromEntries(HUB_GROUPS.map((group) => [group, MAIN_HUB[group] + switchedHubCards(isOn, group)]));
const groupCounts = (hub: readonly { group: string }[]) => Object.fromEntries(HUB_GROUPS.map((group) => [group, hub.filter((tool) => tool.group === group).length]));
const buildIsOn: IsOn = (flag) => launchFlagOn(flag);

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
    expect(TOOLS_HUB).toHaveLength(MAIN_HUB_LENGTH + switchedHubCards(buildIsOn));
    for (const tool of [...NAV_TOOLS, ...FOOTER_TOOLS, ...TOOLS_HUB]) {
      expect(catalogueHrefs.has(tool.href)).toBe(true);
    }
  });

  it('leads the tools hub with the birth chart and sorts the rest into four groups, one icon each', () => {
    expect(TOOLS_HUB.filter((tool) => tool.group === 'lead').map((tool) => tool.href)).toEqual(['/birth-chart/']);
    expect(TOOLS_HUB[0].href).toBe('/birth-chart/');
    expect(groupCounts(TOOLS_HUB)).toEqual(expectedGroups(buildIsOn));
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

describe('tools behind a launch switch', () => {
  const flagged = [...ALL_TOOL_CATALOG, ...ALL_NAV_MORE].filter((entry) => entry.flag !== undefined);
  const hubOf = (isOn: IsOn) => visibleTools(isOn).filter((tool): tool is typeof tool & { hub: NonNullable<typeof tool.hub> } => tool.hub !== undefined).map((tool) => tool.hub);
  // Every switch alone, every switch but one, all and none: the states a
  // merge of these branches can be built in.
  const states: [string, IsOn][] = [
    ['every switch off', () => false],
    ['every switch on', () => true],
    ...LAUNCH_FLAGS.map((only): [string, IsOn] => [`only ${only} on`, (flag) => flag === only]),
    ...LAUNCH_FLAGS.map((except): [string, IsOn] => [`every switch on but ${except}`, (flag) => flag !== except]),
  ];

  it('has switched entries, each with a known switch', () => {
    expect(flagged.length).toBeGreaterThan(0);
    for (const entry of flagged) expect(LAUNCH_FLAGS).toContain(entry.flag);
  });

  it.each(states)('with %s, lists exactly the unswitched entries and the switched ones that are on', (_state, isOn) => {
    expect(hubOf(isOn)).toHaveLength(MAIN_HUB_LENGTH + switchedHubCards(isOn));
    expect(groupCounts(hubOf(isOn))).toEqual(expectedGroups(isOn));
    expect(visibleNavMore(isOn)).toHaveLength(MAIN_NAV_MORE_LENGTH + switchedOn(ALL_NAV_MORE, isOn));
    for (const entry of ALL_TOOL_CATALOG) {
      expect(visibleTools(isOn).includes(entry)).toBe(entry.flag === undefined || isOn(entry.flag));
    }
    for (const entry of ALL_NAV_MORE) {
      expect(visibleNavMore(isOn).includes(entry)).toBe(entry.flag === undefined || isOn(entry.flag));
    }
  });

  it('builds the hub and the menu from the switches the build has on, and every hub card has an icon either way', () => {
    expect(visibleTools(() => true)).toEqual(ALL_TOOL_CATALOG);
    expect(visibleNavMore(() => true)).toEqual(ALL_NAV_MORE);
    expect(TOOL_CATALOG).toEqual(visibleTools(buildIsOn));
    expect(NAV_MORE).toEqual(visibleNavMore(buildIsOn));
    expect(NAV_MORE).toHaveLength(MAIN_NAV_MORE_LENGTH + switchedOn(ALL_NAV_MORE, buildIsOn));
    for (const tool of ALL_TOOL_CATALOG) {
      if (tool.flag && tool.hub) expect(TOOLS_HUB.some((card) => card.href === tool.href)).toBe(launchFlagOn(tool.flag));
    }
    for (const entry of ALL_NAV_MORE) {
      if (entry.flag) expect(NAV_MORE.some((item) => item.href === entry.href)).toBe(launchFlagOn(entry.flag));
    }
    const hrefs = (on: boolean) => visibleTools(() => on).map((tool) => tool.href);
    expect(hrefs(true)).toEqual(expect.arrayContaining(['/year-score/', '/birthday-report/']));
    expect(hrefs(false)).not.toContain('/year-score/');
    expect(hrefs(false)).not.toContain('/birthday-report/');
    for (const tool of ALL_TOOL_CATALOG) {
      if (tool.hub) expect(TOOL_ICON_FOR_PATH[tool.href]).toBeTruthy();
    }
  });

  it('keeps all eight locale labels on every menu entry, switched or not', () => {
    for (const entry of ALL_NAV_MORE) {
      expect(Object.keys(entry.label).sort()).toEqual(['en', 'es', 'fr', 'it', 'pt', 'ru', 'zh-hans', 'zh-hant']);
    }
  });
});
