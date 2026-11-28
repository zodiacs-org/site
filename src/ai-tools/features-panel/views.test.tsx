import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executeAiTool, type AiDependencies } from '../tools';
import { loadPlaceTable } from '../features/place-table';
import { createAiServer } from '../server';
import { FEATURES_URI } from '../contracts';
import { Nameplate } from '../card-kit/parts';
import { FeaturesBridge } from './bridge';
import {
  AstrocartographyCard,
  FeatureCopyCard,
  GoodDaysCard,
  NumerologyCard,
  PersonalDayCard,
  RetrogradeCard,
  SolarReturnCard,
  VedicSignsCard,
  YearScoreCard,
  cardWords,
  clockLabelFor,
  repeatedClockOffset,
  tryClipboardWrite,
  zoneRangeLabel,
  type ToolLink,
} from './views';

const NOW = new Date('2026-11-09T09:00:00Z');
const ALL_ON: AiDependencies = {
  occasions: true,
  coverage: true,
  yearScore: true,
  solarReturn: true,
  numerology: true,
  goodDays: true,
  personal: true,
  now: () => NOW,
  placeTable: async () => loadPlaceTable(),
  sitePageOn: () => true,
};

const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

beforeAll(() => {
  (globalThis as unknown as Record<string, unknown>).FEATURES_ICONS = Object.fromEntries(SIGNS.map((slug) => [slug, `data:image/webp;base64,${slug}`]));
  (globalThis as unknown as Record<string, unknown>).CARD_ART = Object.fromEntries([
    ...SIGNS.map((slug) => [slug, `https://zodiacs.org/assets/sign-art/${slug}-1200.avif`]),
    ['milestones-hero', 'https://zodiacs.org/assets/card-art/milestones-hero-720.webp'],
    ['sky-calendar-hero', 'https://zodiacs.org/assets/card-art/sky-calendar-hero-720.webp'],
  ]);
});

afterAll(() => {
  delete (globalThis as unknown as Record<string, unknown>).FEATURES_ICONS;
  delete (globalThis as unknown as Record<string, unknown>).CARD_ART;
});

function assertBrandedCard(html: string, name: string, secrets: string[] = []) {
  expect(html, `${name} nameplate`).toContain('aria-label="Zodiacs.org"');
  expect(html, `${name} dashes`).not.toMatch(/[\u2013\u2014]/u);
  expect(html, `${name} ref=chatgpt link`).toContain('ref=chatgpt');
  // Strip nameplate and HTML tags so visible copy checks enforce DESIGN.md (no middle-dot separators, raw zone IDs, ISO dates, or money/health wording).
  const visible = html.replace(/<a class="nameplate"[\s\S]*?<\/a>/u, '').replace(/<[^>]+>/gu, ' ');
  expect(visible, `${name} middle-dot separator`).not.toContain(' · ');
  expect(visible, `${name} raw IANA zone ID`).not.toMatch(/\b(?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Za-z_]+\b/u);
  expect(visible, `${name} raw ISO date`).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/u);
  expect(visible, `${name} money, health, or trading wording`).not.toMatch(/\b(?:money|health|healing|healers?|physicians?|dividends|profits|settle pay|first sales|trad(?:e[sd]?|ing)(?!-off))\b/iu);
  for (const secret of secrets) {
    expect(html, `${name} leaked ${secret}`).not.toContain(secret);
  }
}

function extractCopyText(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = extractCopyText(child);
      if (found !== null) return found;
    }
    return null;
  }
  const vnode = node as { type?: unknown; props?: { text?: string; children?: unknown } };
  if (vnode.type === FeatureCopyCard && typeof vnode.props?.text === 'string') return vnode.props.text;
  return extractCopyText(vnode.props?.children);
}

describe('features-panel cards for the seven feature funnels (eight tools)', () => {
  it('renders all eight branded cards with Zodiacs nameplate, ?ref=chatgpt CTAs, no dashes, and no birth details', async () => {
    const birth = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };
    const secrets = ['1990-05-03', '1990', '05-03', '08:30', '40.42'];

    const acg = await executeAiTool('get_astrocartography', { ...birth, cities: ['Lisbon'] }, ALL_ON, { ref: 'chatgpt' });
    expect(acg.ok).toBe(true);
    if (!acg.ok) throw new Error('acg failed');
    const acgHtml = render(h(AstrocartographyCard, { data: acg.data as never, links: acg.links as ToolLink[] }));
    assertBrandedCard(acgHtml, 'AstrocartographyCard', secrets);
    expect(acgHtml).toContain('Open interactive world map');

    const vedic = await executeAiTool('get_vedic_signs', birth, ALL_ON, { ref: 'chatgpt' });
    expect(vedic.ok).toBe(true);
    if (!vedic.ok) throw new Error('vedic failed');
    const vedicHtml = render(h(VedicSignsCard, { data: vedic.data as never, links: vedic.links as ToolLink[] }));
    assertBrandedCard(vedicHtml, 'VedicSignsCard', secrets);
    expect(vedicHtml).toContain('Open Vedic signs');
    const vedicFoldAt = vedicHtml.indexOf('<details class="fold"');
    const vedicBeforeFold = vedicHtml.slice(0, vedicFoldAt);
    const vedicInsideFold = vedicHtml.slice(vedicFoldAt);
    expect(vedicBeforeFold).not.toContain('Your Moon sign (rashi) is');
    expect(vedicBeforeFold).not.toContain('Your Vedic Sun is in');
    expect(vedicBeforeFold).not.toContain('Your lagna (rising sign) is');
    expect(vedicInsideFold).toContain('Sidereal reading');
    expect(vedicInsideFold).toContain('Your Moon sign (rashi) is');
    expect(vedicInsideFold).toContain('Your Vedic Sun is in');
    expect(vedicInsideFold).toContain('Your lagna (rising sign) is');

    const year = await executeAiTool('get_year_score', birth, ALL_ON, { ref: 'chatgpt' });
    expect(year.ok).toBe(true);
    if (!year.ok) throw new Error('year failed');
    const yearHtml = render(h(YearScoreCard, { data: year.data as never, links: year.links as ToolLink[] }));
    assertBrandedCard(yearHtml, 'YearScoreCard', secrets);
    expect(yearHtml).toContain('out of 10');

    const sr = await executeAiTool('get_solar_return', birth, ALL_ON, { ref: 'chatgpt' });
    expect(sr.ok).toBe(true);
    if (!sr.ok) throw new Error('sr failed');
    const srHtml = render(h(SolarReturnCard, { data: sr.data as never, links: sr.links as ToolLink[] }));
    assertBrandedCard(srHtml, 'SolarReturnCard', ['1990', '08:30', '40.42', 'Europe/Madrid']);
    expect(srHtml).toContain('birthplace clock');
    expect(srHtml).toContain('Open solar return');

    const gd = await executeAiTool('find_good_days', { goal: 'contract', from: '2027-01-15', to: '2027-03-31', zone: 'Europe/London', birthDate: '1990-05-03' }, ALL_ON, { ref: 'chatgpt' });
    expect(gd.ok).toBe(true);
    if (!gd.ok) throw new Error('gd failed');
    const gdHtml = render(h(GoodDaysCard, { data: gd.data as never, links: gd.links as ToolLink[] }));
    assertBrandedCard(gdHtml, 'GoodDaysCard', secrets);
    expect(gdHtml).toContain('Open good day finder');

    const retro = await executeAiTool('get_retrograde_for_me', birth, ALL_ON, { ref: 'chatgpt' });
    expect(retro.ok).toBe(true);
    if (!retro.ok) throw new Error('retro failed');
    const retroHtml = render(h(RetrogradeCard, { data: retro.data as never, links: retro.links as ToolLink[] }));
    assertBrandedCard(retroHtml, 'RetrogradeCard', [...secrets, 'Europe/Madrid']);
    expect(retroHtml).toContain('birthplace clock');
    expect(retroHtml).toContain('Open retrogrades for you');

    const day = await executeAiTool('get_personal_day', birth, ALL_ON, { ref: 'chatgpt' });
    expect(day.ok).toBe(true);
    if (!day.ok) throw new Error('day failed');
    const dayHtml = render(h(PersonalDayCard, { data: day.data as never, links: day.links as ToolLink[] }));
    assertBrandedCard(dayHtml, 'PersonalDayCard', [...secrets, 'Europe/Madrid']);
    expect(dayHtml).toContain('birthplace clock');
    expect(dayHtml).toContain('Open Your Day');

    const num = await executeAiTool('get_numerology', { birthDate: '1979-08-17', name: 'Philippa Quennell' }, ALL_ON, { ref: 'chatgpt' });
    expect(num.ok).toBe(true);
    if (!num.ok) throw new Error('num failed');
    const numHtml = render(h(NumerologyCard, { data: num.data as never, links: num.links as ToolLink[] }));
    assertBrandedCard(numHtml, 'NumerologyCard', ['1979-08-17', '1979', 'Philippa', 'Quennell']);
    expect(numHtml).toContain('Numerology, separate from astrology');
    expect(numHtml).not.toMatch(/reading confidence/iu);
    expect(numHtml).toContain('Open numerology calculator');
    // DESIGN.md:213-214: core date numbers stay within the three-tile limit and name numbers appear once in their section.
    const tilesMatch = numHtml.match(/<dl class="tiles"[^>]*>([\s\S]*?)<\/dl>/u);
    expect(tilesMatch).toBeTruthy();
    expect(tilesMatch![1].match(/<div><dt>/gu)?.length).toBe(2);
    expect(tilesMatch![1]).not.toMatch(/Expression|Soul Urge|Personality/u);
    expect(numHtml.match(/<dt>Expression \d+<\/dt>/gu)?.length).toBe(1);
    expect(numHtml.match(/<dt>Soul Urge \d+<\/dt>/gu)?.length).toBe(1);
    expect(numHtml.match(/<dt>Personality \d+<\/dt>/gu)?.length).toBe(1);

    // NumerologyCard omits the `birthday` karmic-debt carrier so birth days 13/14/16/19 are never revealed on the card.
    const numDay13 = await executeAiTool('get_numerology', { birthDate: '1990-05-13' }, ALL_ON, { ref: 'chatgpt' });
    expect(numDay13.ok).toBe(true);
    if (!numDay13.ok) throw new Error('numDay13 failed');
    const numDay13Data = numDay13.data as { karmicDebts: { number: number; carriedBy: string[] }[] };
    expect(numDay13Data.karmicDebts.some((debt) => debt.number === 13 && debt.carriedBy.includes('birthday'))).toBe(true);
    const numDay13Html = render(h(NumerologyCard, { data: numDay13.data as never, links: numDay13.links as ToolLink[] }));
    assertBrandedCard(numDay13Html, 'NumerologyCard (day 13)', ['1990-05-13', '1990']);
    expect(numDay13Html).not.toContain('Karmic debt 13');
    expect(numDay13Html).not.toContain('(birthday)');
    // When a karmic debt is carried by both `birthday` and another position, only the non-birthday position is displayed.
    const numSharedDebt = structuredClone(numDay13.data) as { karmicDebts: { number: number; carriedBy: string[]; reading: string }[] };
    numSharedDebt.karmicDebts = [{ number: 13, carriedBy: ['birthday', 'lifePath'], reading: 'Work patiently.' }];
    const numSharedDebtHtml = render(h(NumerologyCard, { data: numSharedDebt as never, links: numDay13.links as ToolLink[] }));
    expect(numSharedDebtHtml).toContain('Karmic debt 13</strong> (Life Path)');
    expect(numSharedDebtHtml).not.toContain('birthday');
  }, 60_000);

  it('keeps draw_tarot excluded from the features panel and advertises inline-only display mode', async () => {
    // Only tarot enabled (no other feature flags): features resource must NOT be registered.
    const tarotOnly = createAiServer({ occasions: true, coverage: true, tarot: true });
    const tarotResources = (tarotOnly as unknown as { _registeredResources?: Record<string, unknown> })._registeredResources ?? {};
    expect(Object.keys(tarotResources)).not.toContain(FEATURES_URI);

    // When a feature tool is enabled, the features resource advertises inline-only display mode and clipboardWrite permission in both resource metadata and panel bridge.
    const withPersonal = createAiServer({ occasions: true, coverage: true, personal: true });
    const resources = (withPersonal as unknown as {
      _registeredResources?: Record<string, {
        metadata?: { _meta?: Record<string, unknown> };
        readCallback: () => Promise<{ contents: { text: string; _meta?: Record<string, unknown> }[] }> | { contents: { text: string; _meta?: Record<string, unknown> }[] };
      }>;
    })._registeredResources ?? {};
    expect((resources[FEATURES_URI].metadata?._meta?.ui as Record<string, unknown>)?.permissions).toEqual({ clipboardWrite: {} });
    const entry = await resources[FEATURES_URI].readCallback();
    const content = entry.contents[0];
    expect((content._meta as Record<string, unknown>)['openai/ui']).toEqual({ availableDisplayModes: ['inline'], preferredDisplayMode: 'inline' });
    expect(((content._meta as Record<string, unknown>).ui as Record<string, unknown>)?.permissions).toEqual({ clipboardWrite: {} });
    expect(content.text).toContain('availableDisplayModes:["inline"]');
    expect(content.text).not.toContain('availableDisplayModes:["inline","fullscreen"]');
    expect(content.text).toContain('copy-fallback');
    expect(content.text).toContain('overflow-wrap:anywhere');
    expect(content.text).toContain('milestones-hero-720.webp');
    expect(content.text).toContain('sky-calendar-hero-720.webp');
    expect(content.text).not.toContain('milestones-hero-1200.webp');
    expect(content.text).not.toContain('sky-calendar-hero-light-1200.webp');

    // Clipboard write helper succeeds when allowed and falls back cleanly when denied or unavailable.
    expect(await tryClipboardWrite('hello', { writeText: async () => {} })).toBe(true);
    expect(await tryClipboardWrite('hello', { writeText: async () => { throw new Error('denied'); } })).toBe(false);
    expect(await tryClipboardWrite('hello', undefined)).toBe(false);

    // Swati Moon Vedic card stays free of financial wording.
    const swati = await executeAiTool('get_vedic_signs', { birthDate: '2000-01-01', time: '12:00', zone: 'UTC', latitude: 28.61, longitude: 77.21 }, ALL_ON, { ref: 'chatgpt' });
    expect(swati.ok).toBe(true);
    if (!swati.ok) throw new Error('swati failed');
    const swatiHtml = render(h(VedicSignsCard, { data: swati.data as never, links: swati.links as ToolLink[] }));
    expect(swatiHtml).toContain('Swati');
    expect(swatiHtml).not.toMatch(/\b(?:trade|earnings?|wealth)\b/iu);
  });

  it('shows ambiguous astrocartography place choices, post-shadow retrograde titles, and daily lead contacts on Your Day', async () => {
    // Ambiguous city lookup renders candidate labels directly on the card.
    const ambig = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', cities: ['Springfield'] }, ALL_ON, { ref: 'chatgpt' });
    expect(ambig.ok).toBe(true);
    if (!ambig.ok) throw new Error('ambig failed');
    const ambigHtml = render(h(AstrocartographyCard, { data: ambig.data as never, links: ambig.links as ToolLink[] }));
    expect(ambigHtml).toContain('Places to clarify');
    expect(ambigHtml).toContain('Springfield');
    const ambigData = ambig.data as { ambiguous: { places: { label: string }[] }[] };
    for (const place of ambigData.ambiguous[0].places) expect(ambigHtml).toContain(place.label);

    // Post-shadow retrograde uses post-shadow title, not "Next:".
    const postShadow = await executeAiTool('get_retrograde_for_me', { birthDate: '1990-05-03', planets: ['Mercury'], currentZone: 'UTC' }, { ...ALL_ON, now: () => new Date('2026-11-18T12:00:00Z') }, { ref: 'chatgpt' });
    expect(postShadow.ok).toBe(true);
    if (!postShadow.ok) throw new Error('postShadow failed');
    const psData = postShadow.data as { periods: { status: string }[] };
    expect(psData.periods[0].status).toBe('post-shadow');
    const psHtml = render(h(RetrogradeCard, { data: postShadow.data as never, links: postShadow.links as ToolLink[] }));
    expect(psHtml).toContain('Mercury post-shadow');
    expect(psHtml).not.toContain('Next: Mercury retrograde');

    // Your Day leads with the strongest daily ('today') contact matching theme, even when a background contact outscores it.
    const day = await executeAiTool('get_personal_day', { birthDate: '1990-05-03', time: '08:30', zone: 'UTC', currentZone: 'UTC', date: '2026-11-09' }, ALL_ON, { ref: 'chatgpt' });
    expect(day.ok).toBe(true);
    if (!day.ok) throw new Error('day failed');
    const dayData = day.data as { contacts: { group: string; title: string }[]; theme: string };
    const dailyLead = dayData.contacts.find((c) => c.group === 'today')!;
    const dayHtml = render(h(PersonalDayCard, { data: day.data as never, links: day.links as ToolLink[] }));
    expect(dayData.theme).toContain(dailyLead.title);
    expect(dayHtml).toContain(`<p class="verdict">${dailyLead.title}</p>`);

    // When all planets are direct, RetrogradeCard picks the earliest upcoming station (Venus on Oct 3 before Mercury on Oct 24).
    const directRetro = await executeAiTool('get_retrograde_for_me', { birthDate: '1990-05-03', currentZone: 'UTC' }, { ...ALL_ON, now: () => new Date('2026-08-20T12:00:00Z') }, { ref: 'chatgpt' });
    expect(directRetro.ok).toBe(true);
    if (!directRetro.ok) throw new Error('directRetro failed');
    const directHtml = render(h(RetrogradeCard, { data: directRetro.data as never, links: directRetro.links as ToolLink[] }));
    expect(directHtml).toContain('Next: Venus retrograde');

    // Post-shadow next loop dates use the selected clock (17:36 UTC on Feb 9, 2027 is Wed 10 Feb 2027 in Asia/Bangkok).
    const bangkokPs = await executeAiTool('get_retrograde_for_me', { birthDate: '1990-05-03', planets: ['Mercury'], currentZone: 'Asia/Bangkok' }, { ...ALL_ON, now: () => new Date('2026-11-18T12:00:00Z') }, { ref: 'chatgpt' });
    expect(bangkokPs.ok).toBe(true);
    if (!bangkokPs.ok) throw new Error('bangkokPs failed');
    const bangkokHtml = render(h(RetrogradeCard, { data: bangkokPs.data as never, links: bangkokPs.links as ToolLink[] }));
    expect(bangkokHtml).toContain('Wed 10 Feb 2027');

    // When a personal tool's page flag is OFF, neither CTA nor copied text hardcodes the disabled page path.
    const dayOff = await executeAiTool('get_personal_day', { birthDate: '1990-05-03', currentZone: 'UTC' }, { ...ALL_ON, sitePageOn: () => false }, { ref: 'chatgpt' });
    expect(dayOff.ok).toBe(true);
    if (!dayOff.ok) throw new Error('dayOff failed');
    const dayOffHtml = render(h(PersonalDayCard, { data: dayOff.data as never, links: dayOff.links as ToolLink[] }));
    expect(dayOffHtml).not.toContain('/your-day');

    // When PUBLIC_ASTROCARTOGRAPHY_ENABLED is off (pageUrl is null), the card does not invite users to an unavailable interactive map.
    const acgOff = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid' }, { ...ALL_ON, sitePageOn: () => false }, { ref: 'chatgpt' });
    expect(acgOff.ok).toBe(true);
    if (!acgOff.ok) throw new Error('acgOff failed');
    const acgOffProps = { data: acgOff.data as never, links: acgOff.links as ToolLink[] };
    const acgOffHtml = render(h(AstrocartographyCard, acgOffProps));
    expect(acgOffHtml).not.toMatch(/interactive world map/iu);
    expect(acgOffHtml).toContain('Open birth chart on Zodiacs');
    expect(acgOffHtml).toContain('These longitudes can be used to work out your birth date and time.');
    // Copied astrocartography reading without cities must NOT include multi-planet MC/IC longitudes that could reconstruct birth timing.
    const acgOffCopy = extractCopyText(AstrocartographyCard(acgOffProps));
    expect(acgOffCopy).toBeTruthy();
    expect(acgOffCopy).not.toMatch(/\bMC\s+\d+\.\d+°/u);
    expect(acgOffCopy).not.toMatch(/\bIC\s+\d+\.\d+°/u);

    // Your Day uses the requested date in headings and separates daily contacts from background transits.
    const futureDay = await executeAiTool('get_personal_day', { birthDate: '1990-05-03', time: '08:30', zone: 'UTC', currentZone: 'UTC', date: '2026-12-01' }, ALL_ON, { ref: 'chatgpt' });
    expect(futureDay.ok).toBe(true);
    if (!futureDay.ok) throw new Error('futureDay failed');
    const futureDayData = futureDay.data as { dayLabel: string; contacts: { group: string }[] };
    const futureDayHtml = render(h(PersonalDayCard, { data: futureDay.data as never, links: futureDay.links as ToolLink[] }));
    expect(futureDayHtml).toContain(`The Moon on ${futureDayData.dayLabel}`);
    expect(futureDayHtml).not.toContain('The Moon today');
    expect(futureDayHtml).not.toContain("Today's contacts");
    if (futureDayData.contacts.some((c) => c.group === 'today')) {
      expect(futureDayHtml).toContain(`Contacts on ${futureDayData.dayLabel}`);
    }
    if (futureDayData.contacts.some((c) => c.group === 'background')) {
      expect(futureDayHtml).toContain('In the background');
    }

    // VedicSignsCard keeps two decimal places so a 29.99 deg placement never rounds up to 30.0 deg.
    const vedic = await executeAiTool('get_vedic_signs', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 }, ALL_ON, { ref: 'chatgpt' });
    expect(vedic.ok).toBe(true);
    if (!vedic.ok) throw new Error('vedic failed');
    const vedicEdge = structuredClone(vedic.data) as {
      moon: { degree: number | null } | null;
      sun: { degree: number | null } | null;
      rising: { degree: number | null } | null;
    };
    if (vedicEdge.moon) vedicEdge.moon.degree = 29.99;
    if (vedicEdge.sun) vedicEdge.sun.degree = 29.98;
    if (vedicEdge.rising) vedicEdge.rising.degree = 29.97;
    const vedicEdgeHtml = render(h(VedicSignsCard, { data: vedicEdge as never, links: vedic.links as ToolLink[] }));
    expect(vedicEdgeHtml).toContain('29.99°');
    expect(vedicEdgeHtml).toContain('29.98°');
    expect(vedicEdgeHtml).toContain('29.97°');
    expect(vedicEdgeHtml).not.toContain('30.0°');

    // A cusp-uncertain Vedic Sun keeps the default brand ring, surfaces the boundary note, and suppresses the single-sign share action.
    const vedicCusp = structuredClone(vedic.data) as {
      sun: { cusp?: boolean } | null;
      limits: string[];
      shareUrl: string | null;
    };
    if (vedicCusp.sun) vedicCusp.sun.cusp = true;
    vedicCusp.limits = ['The sidereal Sun sits right on the boundary between Aries (Mesha) and Taurus (Vrishabha), so a small difference in birth time or ayanamsa convention can place it in either sign.'];
    vedicCusp.shareUrl = 'https://zodiacs.org/share/vedic-signs/?s=aries&a=lahiri&ref=chatgpt';
    const vedicCuspHtml = render(h(VedicSignsCard, { data: vedicCusp as never, links: vedic.links as ToolLink[] }));
    expect(vedicCuspHtml).toContain(render(h(Nameplate, { front: null })));
    expect(vedicCuspHtml).toContain('(on boundary)');
    expect(vedicCuspHtml).toContain('sidereal Sun sits right on the boundary');
    expect(vedicCuspHtml).not.toContain('Share your Vedic Sun');
    const vedicCuspFoldAt = vedicCuspHtml.indexOf('<details class="fold"');
    expect(vedicCuspHtml.slice(0, vedicCuspFoldAt)).toContain('Provisional near a boundary (Sun)');
    expect(vedicCuspHtml.slice(0, vedicCuspFoldAt)).not.toContain('sidereal Sun sits right on the boundary');
    expect(vedicCuspHtml.slice(vedicCuspFoldAt)).toContain('sidereal Sun sits right on the boundary');

    // VedicSignsCard explains polar rising unavailability instead of asking for inputs already given, and prompts only for missing inputs.
    const vedicPole = await executeAiTool('get_vedic_signs', { birthDate: '1990-05-03', time: '08:30', zone: 'UTC', latitude: 90, longitude: 0 }, ALL_ON, { ref: 'chatgpt' });
    expect(vedicPole.ok).toBe(true);
    if (!vedicPole.ok) throw new Error('vedicPole failed');
    const vedicPoleHtml = render(h(VedicSignsCard, { data: vedicPole.data as never, links: vedicPole.links as ToolLink[] }));
    assertBrandedCard(vedicPoleHtml, 'VedicSignsCard (polar)', ['1990-05-03', '08:30']);
    const vedicPoleBeforeFold = vedicPoleHtml.slice(0, vedicPoleHtml.indexOf('<details class="fold"'));
    expect(vedicPoleBeforeFold).toContain('undefined at a geographic pole');
    expect(vedicPoleBeforeFold).not.toMatch(/add (?:a )?birth/iu);

    const vedicNoPlace = await executeAiTool('get_vedic_signs', { birthDate: '1990-05-03', time: '08:30', zone: 'UTC' }, ALL_ON, { ref: 'chatgpt' });
    expect(vedicNoPlace.ok).toBe(true);
    if (!vedicNoPlace.ok) throw new Error('vedicNoPlace failed');
    const vedicNoPlaceHtml = render(h(VedicSignsCard, { data: vedicNoPlace.data as never, links: vedicNoPlace.links as ToolLink[] }));
    expect(vedicNoPlaceHtml.slice(0, vedicNoPlaceHtml.indexOf('<details class="fold"'))).toContain('add a birthplace for rising');
    expect(vedicNoPlaceHtml.slice(0, vedicNoPlaceHtml.indexOf('<details class="fold"'))).not.toContain('add birth time');

    const vedicNoTime = await executeAiTool('get_vedic_signs', { birthDate: '1990-05-03', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 }, ALL_ON, { ref: 'chatgpt' });
    expect(vedicNoTime.ok).toBe(true);
    if (!vedicNoTime.ok) throw new Error('vedicNoTime failed');
    const vedicNoTimeHtml = render(h(VedicSignsCard, { data: vedicNoTime.data as never, links: vedicNoTime.links as ToolLink[] }));
    expect(vedicNoTimeHtml.slice(0, vedicNoTimeHtml.indexOf('<details class="fold"'))).toContain('add a birth time for rising');
    expect(vedicNoTimeHtml.slice(0, vedicNoTimeHtml.indexOf('<details class="fold"'))).not.toContain('add birth time and place');

    // A polar rising-sign jump or rapid sweep explains birth-time sensitivity at that latitude rather than ayanamsa boundary wording.
    const vedicPolarJump = structuredClone(vedic.data) as {
      rising: { cusp?: boolean } | null;
      limits: string[];
    };
    if (vedicPolarJump.rising) vedicPolarJump.rising.cusp = true;
    vedicPolarJump.limits = ['At this latitude the rising sign (lagna) jumps abruptly near this birth time, so a small difference in birth time can place it on the opposite side of the zodiac.'];
    const vedicPolarJumpHtml = render(h(VedicSignsCard, { data: vedicPolarJump as never, links: vedic.links as ToolLink[] }));
    const vedicPolarJumpBeforeFold = vedicPolarJumpHtml.slice(0, vedicPolarJumpHtml.indexOf('<details class="fold"'));
    expect(vedicPolarJumpBeforeFold).toContain('highly sensitive to birth time at this latitude');
    expect(vedicPolarJumpBeforeFold).not.toContain('ayanamsa can move it');
    expect(vedicPolarJumpBeforeFold).not.toContain('near a boundary');

    // Your Day still displays a reading-confidence label even when there are zero contacts that day.
    const emptyDay = structuredClone(dayOff.data) as { contacts: unknown[]; timeKnown: boolean; placed: boolean };
    emptyDay.contacts = [];
    emptyDay.timeKnown = false;
    emptyDay.placed = false;
    const emptyDayHtml = render(h(PersonalDayCard, { data: emptyDay as never, links: dayOff.links as ToolLink[] }));
    expect(emptyDayHtml).toContain('Reading confidence 55%');

    // YearScoreCard uses rangeWorthShowing so a 0.3 span like 5.0 to 5.3 (5.3 - 5 = 0.2999999999999998) is still displayed.
    const yearBase = await executeAiTool('get_year_score', { birthDate: '1990-05-03' }, ALL_ON, { ref: 'chatgpt' });
    expect(yearBase.ok).toBe(true);
    if (!yearBase.ok) throw new Error('yearBase failed');
    const yearFloat = structuredClone(yearBase.data) as { scoreRange: { low: number; high: number } | null };
    yearFloat.scoreRange = { low: 5, high: 5.3 };
    const yearFloatProps = { data: yearFloat as never, links: yearBase.links as ToolLink[] };
    const yearFloatHtml = render(h(YearScoreCard, yearFloatProps));
    expect(yearFloatHtml).toContain('5.0 to 5.3');
    const yearFloatCopy = extractCopyText(YearScoreCard(yearFloatProps));
    expect(yearFloatCopy).toContain('Birth-day range: 5.0 to 5.3');

    // Directory public figures with conflicting birthplace notes (e.g. Sundar Pichai) keep the disagreement note without naming birth cities on the card or in copy text.
    const yearFigure = await executeAiTool('get_year_score', { person: 'Sundar Pichai' }, { ...ALL_ON, yearScorePeople: true }, { ref: 'chatgpt' });
    expect(yearFigure.ok).toBe(true);
    if (!yearFigure.ok) throw new Error('yearFigure failed');
    const yearFigureProps = { data: yearFigure.data as never, links: yearFigure.links as ToolLink[] };
    const yearFigureHtml = render(h(YearScoreCard, yearFigureProps));
    assertBrandedCard(yearFigureHtml, 'YearScoreCard (Sundar Pichai)', ['Madurai', 'Chennai', 'India']);
    expect(yearFigureHtml).toContain('Sources disagree on the birthplace');
    const yearFigureCopy = extractCopyText(YearScoreCard(yearFigureProps));
    expect(yearFigureCopy).toBeTruthy();
    expect(yearFigureCopy).toContain('Sources disagree on the birthplace');
    expect(yearFigureCopy).not.toMatch(/Madurai|Chennai|India/iu);

    // Untimed Kiritimati birth near a sign change (1999-05-21): natal Sun is Taurus while 12:00 UTC estimate sits in Gemini.
    // Card uses neutral verdict and marks the Sun row as a 12:00 UTC estimate instead of claiming conflicting signs.
    const kiritimatiSr = await executeAiTool('get_solar_return', { birthDate: '1999-05-21', zone: 'Pacific/Kiritimati' }, ALL_ON, { ref: 'chatgpt' });
    expect(kiritimatiSr.ok).toBe(true);
    if (!kiritimatiSr.ok) throw new Error('kiritimatiSr failed');
    const kiritimatiHtml = render(h(SolarReturnCard, { data: kiritimatiSr.data as never, links: kiritimatiSr.links as ToolLink[] }));
    expect(kiritimatiHtml).toContain('<p class="verdict">Your birthday year</p>');
    expect(kiritimatiHtml).not.toContain('Taurus solar return');
    expect(kiritimatiHtml).not.toContain('Share your return');
    expect(kiritimatiHtml).toMatch(/<a class="primary"[^>]*>Open solar return/u);
    expect(kiritimatiHtml).toContain('(12:00 UTC estimate)');

    // Untimed sign-change birth date (1990-03-20, data.sun === null): Sun placement is marked as a 12:00 UTC estimate and headline meta qualifies the date as approximate.
    const cuspSr = await executeAiTool('get_solar_return', { birthDate: '1990-03-20' }, ALL_ON, { ref: 'chatgpt' });
    expect(cuspSr.ok).toBe(true);
    if (!cuspSr.ok) throw new Error('cuspSr failed');
    const cuspSrProps = { data: cuspSr.data as never, links: cuspSr.links as ToolLink[] };
    const cuspSrHtml = render(h(SolarReturnCard, cuspSrProps));
    expect(cuspSrHtml).toContain('<p class="verdict">Your birthday year</p>');
    expect(cuspSrHtml).toContain('(12:00 UTC estimate)');
    expect(cuspSrHtml.slice(0, cuspSrHtml.indexOf('<details class="fold"'))).toContain('within a day without birth time');
    const cuspSrCopy = extractCopyText(SolarReturnCard(cuspSrProps));
    expect(cuspSrCopy).toContain('Around ');
    expect(cuspSrCopy).toContain('within a day without birth time');

    // When public feature flags are off, Year Ahead Score, Good Days, and Solar Return omit disabled destinations instead of linking to 404s.
    const PUBLIC_OFF: AiDependencies = { ...ALL_ON, sitePageOn: () => false };

    const yearOff = await executeAiTool('get_year_score', { birthDate: '1990-05-03' }, PUBLIC_OFF, { ref: 'chatgpt' });
    expect(yearOff.ok).toBe(true);
    if (!yearOff.ok) throw new Error('yearOff failed');
    const yearOffHtml = render(h(YearScoreCard, { data: yearOff.data as never, links: yearOff.links as ToolLink[] }));
    expect(yearOffHtml).not.toContain('/year-score');
    expect(yearOffHtml).not.toContain('/share/year-score');
    expect(yearOffHtml).toContain('https://zodiacs.org/transits/?ref=chatgpt');

    const yearMissingOff = await executeAiTool('get_year_score', { person: 'Somebody Unlisted' }, { ...PUBLIC_OFF, yearScorePeople: true }, { ref: 'chatgpt' });
    expect(yearMissingOff.ok).toBe(true);
    if (!yearMissingOff.ok) throw new Error('yearMissingOff failed');
    const yearMissingOffHtml = render(h(YearScoreCard, { data: yearMissingOff.data as never, links: yearMissingOff.links as ToolLink[] }));
    expect(yearMissingOffHtml).not.toContain('/year-score');
    expect(yearMissingOffHtml).toContain('https://zodiacs.org/transits/?ref=chatgpt');

    const gdOff = await executeAiTool('find_good_days', { goal: 'contract', from: '2027-01-15', to: '2027-02-15', zone: 'Europe/London' }, PUBLIC_OFF, { ref: 'chatgpt' });
    expect(gdOff.ok).toBe(true);
    if (!gdOff.ok) throw new Error('gdOff failed');
    const gdOffHtml = render(h(GoodDaysCard, { data: gdOff.data as never, links: gdOff.links as ToolLink[] }));
    expect(gdOffHtml).not.toContain('/good-days');
    expect(gdOffHtml).toContain('https://zodiacs.org/void-of-course-moon/?ref=chatgpt');
    expect(gdOffHtml).toContain('https://zodiacs.org/retrogrades/?ref=chatgpt');
    expect(gdOffHtml.match(/href="[^"]*void-of-course-moon/gu)?.length).toBe(1);

    const srOff = await executeAiTool('get_solar_return', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 }, PUBLIC_OFF, { ref: 'chatgpt' });
    expect(srOff.ok).toBe(true);
    if (!srOff.ok) throw new Error('srOff failed');
    const srOffHtml = render(h(SolarReturnCard, { data: srOff.data as never, links: srOff.links as ToolLink[] }));
    expect(srOffHtml).toContain('https://zodiacs.org/solar-return/?ref=chatgpt');
    expect(srOffHtml).not.toContain('/share/solar-return');
    expect(srOffHtml).not.toContain('Share your return');

    // When the featured retrograde period has no share URL, RetrogradeCard does not label another planet's share link as "Share this retrograde".
    const retro2025 = await executeAiTool('get_retrograde_for_me', { birthDate: '1990-05-03', currentZone: 'UTC' }, { ...ALL_ON, now: () => new Date('2025-05-06T12:00:00Z') }, { ref: 'chatgpt' });
    expect(retro2025.ok).toBe(true);
    if (!retro2025.ok) throw new Error('retro2025 failed');
    const retro2025Data = retro2025.data as { periods: { planet: string; status: string; shareUrl: string | null }[] };
    expect(retro2025Data.periods.some((period) => period.shareUrl !== null)).toBe(true);
    const retro2025Html = render(h(RetrogradeCard, { data: retro2025.data as never, links: retro2025.links as ToolLink[] }));
    expect(retro2025Html).toContain('Venus post-shadow');
    expect(retro2025Html).not.toContain('Share this retrograde');

    // GoodDaysCard shows all ranked days BEFORE the fold (<details class="fold">) and preserves all avoid dates (up to 8).
    const gdMany = await executeAiTool('find_good_days', { goal: 'contract', from: '2027-01-15', to: '2027-07-15', zone: 'Europe/London', count: 5 }, ALL_ON, { ref: 'chatgpt' });
    expect(gdMany.ok).toBe(true);
    if (!gdMany.ok) throw new Error('gdMany failed');
    const gdManyData = gdMany.data as { best: { date: string }[]; avoid: { date: string }[] };
    expect(gdManyData.best.length).toBe(5);
    expect(gdManyData.avoid.length).toBeGreaterThan(6);
    const gdManyHtml = render(h(GoodDaysCard, { data: gdMany.data as never, links: gdMany.links as ToolLink[] }));
    assertBrandedCard(gdManyHtml, 'GoodDaysCard (many)');
    const foldAt = gdManyHtml.indexOf('<details class="fold"');
    const beforeFold = gdManyHtml.slice(0, foldAt);
    expect(beforeFold).toContain('<ol class="best-days">');
    expect(beforeFold.match(/class="ring ring-small"/gu)?.length).toBe(5);
    // Every avoid date returned by the tool appears inside the Days to avoid list (none silently dropped at 6).
    const avoidSection = gdManyHtml.slice(gdManyHtml.indexOf('Days to avoid'));
    expect(avoidSection.match(/\/100<\/span>/gu)?.length).toBe(gdManyData.avoid.length);

    // SolarReturnCard strips money and health wording (e.g. Saturn in Taurus/Scorpio, Virgo ascendant, 2nd/6th/8th houses) without altering the tool response.
    const srBase = await executeAiTool('get_solar_return', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 }, ALL_ON, { ref: 'chatgpt' });
    expect(srBase.ok).toBe(true);
    if (!srBase.ok) throw new Error('srBase failed');
    const srSensitive = structuredClone(srBase.data) as { themes: { kind: string; title: string; line: string; basis: string }[] };
    srSensitive.themes = [
      { kind: 'saturn', title: 'Saturn in Taurus', line: "The year's serious work is money, possessions and the patience to build value slowly.", basis: 'Saturn in Taurus' },
      { kind: 'saturn', title: 'Saturn in Scorpio', line: "The year's serious work is shared money, trust and the hard conversations that settle them.", basis: 'Saturn in Scorpio' },
      { kind: 'rising', title: 'Virgo rising', line: "The year leads with maintenance: health, systems, the backlog you've been stepping over. Unglamorous fixes pay this year's best dividends.", basis: 'Return ascendant in Virgo' },
      { kind: 'sun-house', title: 'Sun in the 2nd house', line: 'A resources year: money, skills, and what your work is actually worth in practical terms.', basis: 'Return Sun in house 2' },
      { kind: 'sun-house', title: 'Sun in the 6th house', line: "A working year: routines, health, the craft of the everyday. The body keeps this year's minutes; read them.", basis: 'Return Sun in house 6' },
    ];
    const srSensitiveProps = { data: srSensitive as never, links: srBase.links as ToolLink[] };
    const srSensitiveHtml = render(h(SolarReturnCard, srSensitiveProps));
    assertBrandedCard(srSensitiveHtml, 'SolarReturnCard (card-safe)');
    expect(cardWords(srSensitive.themes[0].line)).not.toMatch(/\bmoney\b/iu);
    expect(cardWords(srSensitive.themes[1].line)).not.toMatch(/\bmoney\b/iu);
    expect(cardWords(srSensitive.themes[2].line)).not.toMatch(/\b(?:health|dividends)\b/iu);
    expect(cardWords(srSensitive.themes[3].line)).not.toMatch(/\bmoney\b/iu);
    expect(srSensitiveHtml).not.toMatch(/\bthe body keeps\b/iu);
    expect(srSensitiveHtml).toContain('Small habits carry the year forward.');
    const srSensitiveCopy = extractCopyText(SolarReturnCard(srSensitiveProps));
    expect(srSensitiveCopy).toBeTruthy();
    expect(srSensitiveCopy).not.toMatch(/\b(?:health|the body keeps)\b/iu);
    expect(srSensitiveCopy).toContain('Small habits carry the year forward.');

    // Fixed-offset zones invert POSIX Etc/GMT signs into real UTC offsets and legacy POSIX/IANA aliases resolve to readable labels.
    expect(clockLabelFor('Etc/GMT+5')).toBe('UTC-05:00');
    expect(clockLabelFor('Etc/GMT-5')).toBe('UTC+05:00');
    expect(clockLabelFor('Etc/GMT+0')).toBe('UTC');
    expect(clockLabelFor('Etc/UTC')).toBe('UTC');
    expect(clockLabelFor('EST5EDT')).toBe('Eastern Time');
    expect(clockLabelFor('PST8PDT')).toBe('Pacific Time');
    expect(clockLabelFor('CET')).toBe('Central European Time');
    expect(clockLabelFor('US/Eastern')).toBe('Eastern Time');
    expect(clockLabelFor('Europe/London')).toBe('London time');
    const gdAlias = await executeAiTool('find_good_days', { goal: 'travel', from: '2027-01-15', to: '2027-02-15', zone: 'EST5EDT' }, ALL_ON, { ref: 'chatgpt' });
    expect(gdAlias.ok).toBe(true);
    if (!gdAlias.ok) throw new Error('gdAlias failed');
    const gdAliasProps = { data: gdAlias.data as never, links: gdAlias.links as ToolLink[] };
    const gdAliasHtml = render(h(GoodDaysCard, gdAliasProps));
    assertBrandedCard(gdAliasHtml, 'GoodDaysCard (EST5EDT)');
    expect(gdAliasHtml).toContain('Eastern Time');
    expect(gdAliasHtml).not.toContain('EST5EDT');
    const gdAliasCopy = extractCopyText(GoodDaysCard(gdAliasProps));
    expect(gdAliasCopy).toContain('Eastern Time');
    expect(gdAliasCopy).not.toContain('EST5EDT');
    const gdFixed = await executeAiTool('find_good_days', { goal: 'travel', from: '2027-01-15', to: '2027-02-15', zone: 'Etc/GMT+5' }, ALL_ON, { ref: 'chatgpt' });
    expect(gdFixed.ok).toBe(true);
    if (!gdFixed.ok) throw new Error('gdFixed failed');
    const gdFixedHtml = render(h(GoodDaysCard, { data: gdFixed.data as never, links: gdFixed.links as ToolLink[] }));
    assertBrandedCard(gdFixedHtml, 'GoodDaysCard (Etc/GMT+5)');
    expect(gdFixedHtml).toContain('UTC-05:00');
    expect(gdFixedHtml).not.toContain('GMT+5');

    // DESIGN.md action order: when a share URL is available, share is primary and the page link is secondary; when sharing is unavailable, the page link is primary.
    expect(srSensitiveHtml).toMatch(/<a class="primary"[^>]*>Share your return/u);
    expect(srSensitiveHtml).toMatch(/<a class="secondary"[^>]*>Open solar return/u);
    expect(srOffHtml).toMatch(/<a class="primary"[^>]*>Open solar return/u);

    // Timed Moon on a nakshatra boundary (1990-01-19 01:03 UTC, Chitra/Swati boundary) qualifies headline, summary, fold lore, and copy text (omitting definite pada).
    const nakBoundary = await executeAiTool('get_vedic_signs', { birthDate: '1990-01-19', time: '01:03', zone: 'UTC' }, ALL_ON, { ref: 'chatgpt' });
    expect(nakBoundary.ok).toBe(true);
    if (!nakBoundary.ok) throw new Error('nakBoundary failed');
    expect((nakBoundary.data as { moonNakshatra: { cusp?: boolean } | null }).moonNakshatra?.cusp).toBe(true);
    const nakProps = { data: nakBoundary.data as never, links: nakBoundary.links as ToolLink[] };
    const nakHtml = render(h(VedicSignsCard, nakProps));
    assertBrandedCard(nakHtml, 'VedicSignsCard (nakshatra boundary)');
    expect(nakHtml).toContain('<p class="verdict">Chitra or Swati nakshatra</p>');
    expect(nakHtml).not.toContain('Your Moon was in Chitra');
    expect(nakHtml).toContain('Provisional, on the Chitra or Swati boundary');
    expect(nakHtml).toContain('Chitra (provisional, on boundary)');
    const nakCopy = extractCopyText(VedicSignsCard(nakProps));
    expect(nakCopy).toBeTruthy();
    expect(nakCopy).toContain('Nakshatra: Chitra or Swati (provisional, on boundary; computed Chitra)');
    expect(nakCopy).not.toMatch(/\bpada\s+\d/iu);
    expect(nakCopy).not.toContain('Your Moon was in Chitra');

    // One-day contract search on the 2 August 2027 eclipse has no qualifying best days: neither fine print nor copy text calls the window good for signing contracts.
    const gdEmpty = await executeAiTool('find_good_days', { goal: 'contract', from: '2027-08-02', to: '2027-08-02', zone: 'UTC' }, ALL_ON, { ref: 'chatgpt' });
    expect(gdEmpty.ok).toBe(true);
    if (!gdEmpty.ok) throw new Error('gdEmpty failed');
    expect((gdEmpty.data as { best: unknown[] }).best).toHaveLength(0);
    const gdEmptyProps = { data: gdEmpty.data as never, links: gdEmpty.links as ToolLink[] };
    const gdEmptyHtml = render(h(GoodDaysCard, gdEmptyProps));
    assertBrandedCard(gdEmptyHtml, 'GoodDaysCard (empty best)');
    expect(gdEmptyHtml).toContain('No qualifying days for signing a contract');
    expect(gdEmptyHtml).not.toContain('Best days for signing a contract');
    expect(gdEmptyHtml).toContain('No clear best day in this window');
    expect(gdEmptyHtml).not.toContain('good windows to sign contracts');
    const gdEmptyCopy = extractCopyText(GoodDaysCard(gdEmptyProps));
    expect(gdEmptyCopy).toBeTruthy();
    expect(gdEmptyCopy).toContain('No qualifying days for signing a contract');
    expect(gdEmptyCopy).not.toContain('good windows to sign contracts');

    // Job and launch Good Days cards strip pay-timing and sales-timing phrasing from card display and copy text without altering tool responses.
    const gdJob = await executeAiTool('find_good_days', { goal: 'job', from: '2027-01-15', to: '2027-02-15', zone: 'UTC' }, ALL_ON, { ref: 'chatgpt' });
    expect(gdJob.ok).toBe(true);
    if (!gdJob.ok) throw new Error('gdJob failed');
    expect((gdJob.data as { care: string }).care).toContain('settle pay and terms');
    const gdJobProps = { data: gdJob.data as never, links: gdJob.links as ToolLink[] };
    const gdJobHtml = render(h(GoodDaysCard, gdJobProps));
    assertBrandedCard(gdJobHtml, 'GoodDaysCard (job)');
    expect(gdJobHtml).toContain('start work and build a reputation. The start date you agree with the employer comes first.');
    expect(gdJobHtml).not.toContain('agree on a start date');
    const gdJobCopy = extractCopyText(GoodDaysCard(gdJobProps));
    expect(gdJobCopy).toBeTruthy();
    expect(gdJobCopy).not.toMatch(/settle pay/iu);
    expect(gdJobCopy).toContain('start work and build a reputation. The start date you agree with the employer comes first.');
    expect(gdJobCopy).not.toContain('agree on a start date');

    const gdLaunch = await executeAiTool('find_good_days', { goal: 'launch', from: '2027-01-15', to: '2027-02-15', zone: 'UTC' }, ALL_ON, { ref: 'chatgpt' });
    expect(gdLaunch.ok).toBe(true);
    if (!gdLaunch.ok) throw new Error('gdLaunch failed');
    const gdLaunchProps = { data: gdLaunch.data as never, links: gdLaunch.links as ToolLink[] };
    const gdLaunchHtml = render(h(GoodDaysCard, gdLaunchProps));
    assertBrandedCard(gdLaunchHtml, 'GoodDaysCard (launch)');
    expect(gdLaunchHtml).toContain('first openings and announcements');
    const gdLaunchCopy = extractCopyText(GoodDaysCard(gdLaunchProps));
    expect(gdLaunchCopy).toBeTruthy();
    expect(gdLaunchCopy).not.toMatch(/first sales/iu);

    // GoodDaysCard surfaces void-of-course intervals on recommended days in both the visible list and copied text.
    const gdVoc = await executeAiTool('find_good_days', { goal: 'contract', from: '2027-01-15', to: '2027-02-15', zone: 'UTC' }, ALL_ON, { ref: 'chatgpt' });
    expect(gdVoc.ok).toBe(true);
    if (!gdVoc.ok) throw new Error('gdVoc failed');
    const gdVocDay = (gdVoc.data as { best: { date: string; voidOfCourse: { from: string; to: string }[] }[] }).best.find((day) => day.voidOfCourse.length > 0);
    expect(gdVocDay).toBeDefined();
    const expectedSpan = `${gdVocDay!.voidOfCourse[0].from} to ${gdVocDay!.voidOfCourse[0].to}`;
    const gdVocProps = { data: gdVoc.data as never, links: gdVoc.links as ToolLink[] };
    const gdVocHtml = render(h(GoodDaysCard, gdVocProps));
    assertBrandedCard(gdVocHtml, 'GoodDaysCard (void-of-course)');
    const gdVocBeforeFold = gdVocHtml.slice(0, gdVocHtml.indexOf('<details class="fold"'));
    expect(gdVocBeforeFold).toContain('Moon void of course:');
    expect(gdVocBeforeFold).toContain(expectedSpan);
    const gdVocCopy = extractCopyText(GoodDaysCard(gdVocProps));
    expect(gdVocCopy).toContain(`Moon void of course: ${expectedSpan}`);

    // AstrocartographyCard keeps the first four nearby lines visible and puts remaining lines behind a "more lines" disclosure and in the copied reading.
    const acgBase = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', cities: ['Lisbon'] }, ALL_ON, { ref: 'chatgpt' });
    expect(acgBase.ok).toBe(true);
    if (!acgBase.ok) throw new Error('acgBase failed');
    const acgSix = structuredClone(acgBase.data) as {
      cities: { closest: { planet: string; angle: string; title: string; distanceKm: number; side: string | null; strength: string; line: string; shareUrl: string | null }[] }[];
    };
    acgSix.cities[0].closest = [
      { planet: 'Sun', angle: 'MC', title: 'Sun Midheaven line', distanceKm: 40, side: 'east', strength: 'strong', line: 'Line one.', shareUrl: null },
      { planet: 'Moon', angle: 'ASC', title: 'Moon Ascendant line', distanceKm: 90, side: 'west', strength: 'strong', line: 'Line two.', shareUrl: null },
      { planet: 'Venus', angle: 'DSC', title: 'Venus Descendant line', distanceKm: 130, side: 'east', strength: 'noticeable', line: 'Line three.', shareUrl: null },
      { planet: 'Mars', angle: 'IC', title: 'Mars IC line', distanceKm: 180, side: 'west', strength: 'noticeable', line: 'Line four.', shareUrl: null },
      { planet: 'Jupiter', angle: 'MC', title: 'Jupiter Midheaven line', distanceKm: 230, side: 'east', strength: 'noticeable', line: 'Line five.', shareUrl: null },
      { planet: 'Saturn', angle: 'ASC', title: 'Saturn Ascendant line', distanceKm: 280, side: 'west', strength: 'noticeable', line: 'Line six.', shareUrl: null },
    ];
    const acgSixProps = { data: acgSix as never, links: acgBase.links as ToolLink[] };
    const acgSixHtml = render(h(AstrocartographyCard, acgSixProps));
    assertBrandedCard(acgSixHtml, 'AstrocartographyCard (6 lines)');
    expect(acgSixHtml).toContain('<details class="more"><summary>2 more lines</summary>');
    expect(acgSixHtml).toContain('Jupiter Midheaven line');
    expect(acgSixHtml).toContain('Saturn Ascendant line');
    const acgSixCopy = extractCopyText(AstrocartographyCard(acgSixProps));
    expect(acgSixCopy).toBeTruthy();
    expect(acgSixCopy).toContain('Jupiter Midheaven line');
    expect(acgSixCopy).toContain('Saturn Ascendant line');

    // Upcoming retrograde ranges stay on the requested clock when known and explicitly label UTC when a browser lacks the zone.
    expect(zoneRangeLabel('2027-02-09T17:36:00Z', '2027-03-03T11:30:00Z', 'Asia/Bangkok')).toBe('Wed 10 Feb 2027 to Wed 3 Mar 2027');
    expect(zoneRangeLabel('2027-02-09T17:36:00Z', '2027-03-03T11:30:00Z', 'America/Unknown_Browser_Zone')).toBe('Tue 9 Feb 2027 to Wed 3 Mar 2027 (UTC)');

    // Ashwini Moon and Neptune Midheaven card surfaces replace healing/physician wording without altering tool responses.
    const ashwini = await executeAiTool('get_vedic_signs', { birthDate: '1990-01-05', time: '06:00', zone: 'UTC' }, ALL_ON, { ref: 'chatgpt' });
    expect(ashwini.ok).toBe(true);
    if (!ashwini.ok) throw new Error('ashwini failed');
    const ashwiniData = ashwini.data as { moonNakshatra: { name: string; line: string } | null };
    expect(ashwiniData.moonNakshatra?.name).toBe('Ashwini');
    expect(ashwiniData.moonNakshatra?.line).toContain('traditionally linked with healing');
    const ashwiniProps = { data: ashwini.data as never, links: ashwini.links as ToolLink[] };
    const ashwiniHtml = render(h(VedicSignsCard, ashwiniProps));
    assertBrandedCard(ashwiniHtml, 'VedicSignsCard (Ashwini)');
    expect(ashwiniHtml).toContain('traditionally linked with renewal');
    const ashwiniCopy = extractCopyText(VedicSignsCard(ashwiniProps));
    expect(ashwiniCopy).toBeTruthy();
    expect(ashwiniCopy).not.toMatch(/\b(?:healing|physicians?)\b/iu);
    expect(ashwiniCopy).toContain('traditionally linked with renewal');

    const acgNeptune = structuredClone(acgBase.data) as {
      cities: { summary: string; closest: { planet: string; angle: string; title: string; distanceKm: number; side: string | null; strength: string; line: string; shareUrl: string | null }[] }[];
    };
    const neptuneLine = 'Neptune Midheaven line (Neptune overhead), for work, reputation and your public life. Traditionally good for creative, healing or spiritual work, less so for a clear, steady career path; read the small print here.';
    acgNeptune.cities[0].summary = `Closest to Lisbon: ${neptuneLine}`;
    acgNeptune.cities[0].closest = [{ planet: 'Neptune', angle: 'MC', title: 'Neptune Midheaven line', distanceKm: 20, side: 'east', strength: 'strong', line: neptuneLine, shareUrl: null }];
    const acgNeptuneProps = { data: acgNeptune as never, links: acgBase.links as ToolLink[] };
    const acgNeptuneHtml = render(h(AstrocartographyCard, acgNeptuneProps));
    assertBrandedCard(acgNeptuneHtml, 'AstrocartographyCard (Neptune MC)');
    expect(acgNeptuneHtml).toContain('creative, supportive or spiritual work');
    const acgNeptuneCopy = extractCopyText(AstrocartographyCard(acgNeptuneProps));
    expect(acgNeptuneCopy).toBeTruthy();
    expect(acgNeptuneCopy).not.toMatch(/\bhealing\b/iu);
    expect(acgNeptuneCopy).toContain('creative, supportive or spiritual work');

    // Mercury MC astrocartography ("trade") and Mithuna Vedic ("trading ideas") stay free of policy-rejected trading words on cards while tool outputs stay unchanged.
    const mercuryMcLine = 'Mercury Midheaven line (Mercury overhead), for work, reputation and your public life. Traditionally strong for work in writing, teaching, media, trade and anything that runs on communication.';
    const acgMercury = structuredClone(acgNeptune);
    acgMercury.cities[0].summary = `Closest to Lisbon: ${mercuryMcLine}`;
    acgMercury.cities[0].closest = [{ planet: 'Mercury', angle: 'MC', title: 'Mercury Midheaven line', distanceKm: 15, side: 'west', strength: 'strong', line: mercuryMcLine, shareUrl: null }];
    const acgMercuryProps = { data: acgMercury as never, links: acgBase.links as ToolLink[] };
    const acgMercuryHtml = render(h(AstrocartographyCard, acgMercuryProps));
    assertBrandedCard(acgMercuryHtml, 'AstrocartographyCard (Mercury MC)');
    expect(acgMercuryHtml).toContain('writing, teaching, media, exchange and');
    const acgMercuryCopy = extractCopyText(AstrocartographyCard(acgMercuryProps));
    expect(acgMercuryCopy).not.toMatch(/\btrad(?:e[sd]?|ing)(?!-off)\b/iu);

    const mithuna = await executeAiTool('get_vedic_signs', { birthDate: '1990-06-22', time: '12:00', zone: 'UTC' }, ALL_ON, { ref: 'chatgpt' });
    expect(mithuna.ok).toBe(true);
    if (!mithuna.ok) throw new Error('mithuna failed');
    expect((mithuna.data as { summary: string }).summary).toContain('trading ideas');
    const mithunaProps = { data: mithuna.data as never, links: mithuna.links as ToolLink[] };
    const mithunaHtml = render(h(VedicSignsCard, mithunaProps));
    assertBrandedCard(mithunaHtml, 'VedicSignsCard (Mithuna)');
    expect(mithunaHtml).toContain('exchanging ideas');
    const mithunaCopy = extractCopyText(VedicSignsCard(mithunaProps));
    expect(mithunaCopy).not.toMatch(/\btrad(?:e[sd]?|ing)(?!-off)\b/iu);

    // Raw place queries (even containing personal details, ISO dates, or long unbroken strings) are NEVER echoed on AstrocartographyCard or its copied text.
    const sensitiveQuery = `1990-05-03 Alice ${'x'.repeat(60)}`;
    const acgUnmatched = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', cities: [sensitiveQuery] }, ALL_ON, { ref: 'chatgpt' });
    expect(acgUnmatched.ok).toBe(true);
    if (!acgUnmatched.ok) throw new Error('acgUnmatched failed');
    const acgUnmatchedProps = { data: acgUnmatched.data as never, links: acgUnmatched.links as ToolLink[] };
    const acgUnmatchedHtml = render(h(AstrocartographyCard, acgUnmatchedProps));
    assertBrandedCard(acgUnmatchedHtml, 'AstrocartographyCard (unmatched raw query)', ['1990-05-03', 'Alice', 'xxxx']);
    expect(acgUnmatchedHtml).toContain('not found in the place index');
    const acgUnmatchedCopy = extractCopyText(AstrocartographyCard(acgUnmatchedProps));
    expect(acgUnmatchedCopy).toBeTruthy();
    expect(acgUnmatchedCopy).not.toContain('1990-05-03');
    expect(acgUnmatchedCopy).not.toContain('Alice');
    expect(acgUnmatchedCopy).not.toContain('xxxx');
    // Ambiguous lookups show curated directory labels without echoing raw `asked` text (including in limits).
    const acgAmbigSensitive = structuredClone(ambig.data) as { ambiguous: { asked: string; places: { label: string }[] }[]; limits: string[] };
    acgAmbigSensitive.ambiguous[0].asked = 'Springfield 1990-05-03 Alice';
    acgAmbigSensitive.limits = acgAmbigSensitive.limits.map((line) => line.replace('Springfield', 'Springfield 1990-05-03 Alice'));
    const acgAmbigSensitiveProps = { data: acgAmbigSensitive as never, links: ambig.links as ToolLink[] };
    const acgAmbigSensitiveHtml = render(h(AstrocartographyCard, acgAmbigSensitiveProps));
    assertBrandedCard(acgAmbigSensitiveHtml, 'AstrocartographyCard (ambiguous raw query)', ['1990-05-03', 'Alice']);
    expect(acgAmbigSensitiveHtml).toContain(acgAmbigSensitive.ambiguous[0].places[0].label);
    const acgAmbigSensitiveCopy = extractCopyText(AstrocartographyCard(acgAmbigSensitiveProps));
    expect(acgAmbigSensitiveCopy).not.toContain('1990-05-03');
    expect(acgAmbigSensitiveCopy).not.toContain('Alice');
    expect(acgAmbigSensitiveCopy).toContain(acgAmbigSensitive.ambiguous[0].places[0].label);

    // Solar return times during a repeated DST rollback hour include the UTC offset in both the card header and copied text.
    expect(repeatedClockOffset('2026-11-01T05:30:00Z', 'America/New_York')).toBe('UTC-4');
    expect(repeatedClockOffset('2026-11-01T06:30:00Z', 'America/New_York')).toBe('UTC-5');
    expect(repeatedClockOffset('2026-11-01T17:30:00Z', 'America/New_York')).toBeNull();
    const srFold = structuredClone(srBase.data) as { instantUtc: string; local: string; zone: string; timeKnown: boolean; limits: string[] };
    srFold.instantUtc = '2026-11-01T06:30:00.000Z';
    srFold.local = 'Sun 1 Nov 2026, 01:30';
    srFold.zone = 'America/New_York';
    srFold.timeKnown = true;
    srFold.limits = [];
    const srFoldProps = { data: srFold as never, links: srBase.links as ToolLink[] };
    const srFoldHtml = render(h(SolarReturnCard, srFoldProps));
    assertBrandedCard(srFoldHtml, 'SolarReturnCard (DST fold)');
    expect(srFoldHtml).toContain('Sun 1 Nov 2026, 01:30 (New York time, UTC-5)');
    const srFoldCopy = extractCopyText(SolarReturnCard(srFoldProps));
    expect(srFoldCopy).toContain('Sun 1 Nov 2026, 01:30 (New York time, UTC-5)');
  }, 60_000);

  it('preserves the host theme across partial host-context updates and ui/initialize replies without theme', async () => {
    const listeners = new Map<string, Set<(event: unknown) => void>>();
    const parent = { postMessage: () => {} };
    const prevWindow = (globalThis as unknown as { window?: unknown }).window;
    const fakeWindow = {
      parent,
      openai: { theme: 'light' },
      addEventListener: (type: string, fn: (event: unknown) => void) => {
        const set = listeners.get(type) ?? new Set();
        set.add(fn);
        listeners.set(type, set);
      },
      removeEventListener: (type: string, fn: (event: unknown) => void) => { listeners.get(type)?.delete(fn); },
    };
    (globalThis as unknown as { window?: unknown }).window = fakeWindow;
    const themes: string[] = [];
    const results: unknown[] = [];
    const bridge = new FeaturesBridge((result) => results.push(result), (theme) => themes.push(theme));
    try {
      bridge.connect();
      expect(themes).toEqual(['light']);
      // ui/initialize response without hostContext.theme must NOT clear the host theme.
      for (const fn of listeners.get('message') ?? []) {
        fn({ source: parent, origin: 'https://host.example', data: { jsonrpc: '2.0', id: 'zodiacs-features-1', result: { hostContext: {} } } });
      }
      await Promise.resolve();
      // Partial host-context-changed (dimensions only, no theme) must NOT clear the host theme.
      for (const fn of listeners.get('message') ?? []) {
        fn({ source: parent, origin: 'https://host.example', data: { jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { containerDimensions: { maxHeight: 500 } } } });
      }
      // openai:set_globals with toolOutput only must deliver the result and preserve the theme.
      for (const fn of listeners.get('openai:set_globals') ?? []) {
        fn({ detail: { globals: { toolOutput: { ok: true, tool: 'get_numerology' } } } });
      }
      expect(themes).toEqual(['light']);
      expect(results).toEqual([{ structuredContent: { ok: true, tool: 'get_numerology' } }]);
      // Explicit dark theme change updates cleanly.
      for (const fn of listeners.get('message') ?? []) {
        fn({ source: parent, origin: 'https://host.example', data: { jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } } });
      }
      expect(themes).toEqual(['light', 'dark']);
    } finally {
      bridge.dispose();
      if (prevWindow === undefined) delete (globalThis as unknown as { window?: unknown }).window;
      else (globalThis as unknown as { window?: unknown }).window = prevWindow;
    }
  });
});
