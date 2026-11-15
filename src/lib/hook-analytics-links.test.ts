import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  ANALYTICS_EVENT_PROPS,
  ANALYTICS_EVENT_VALUES,
  ANALYTICS_HOOK_EVENTS,
} from './analytics-config.mjs';

// The retention hook links (docs/ANALYTICS.md, "Retention hook events") name
// their event and closed values in data-hook-* attributes, and the analytics
// bootstrap in Base.astro counts a click on them through the allowlist shim.

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

/** Every `<a ...>` opening tag in a source file that names a hook event. */
function hookLinks(source: string): string[] {
  return [...source.matchAll(/<a\b[^>]*data-hook-event=[^>]*>/gu)].map((match) => match[0]);
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`, 'u'))?.[1];

const HOOK_SOURCES = [
  'src/components/SiteFooter.astro',
  'src/components/HoroscopeProgramPage.astro',
  'src/components/return-visits/ReturnToolPage.astro',
  'src/pages/feeds/index.astro',
  'src/pages/developers/index.astro',
  'src/pages/eclipses/2027/index.astro',
  'src/pages/full-moon-calendar/2027/index.astro',
  'src/pages/mercury-retrograde/2027/index.astro',
];

describe('retention hook links', () => {
  it('marks the footer RSS link', () => {
    const [link, ...rest] = hookLinks(read('src/components/SiteFooter.astro'));
    expect(rest).toEqual([]);
    expect(link).toContain('href="/feeds/horoscopes.xml"');
    expect(attr(link, 'data-hook-event')).toBe('rss_subscribe');
    expect(attr(link, 'data-hook-feed')).toBe('horoscopes');
    expect(attr(link, 'data-hook-placement')).toBe('footer');
  });

  it('marks the per-sign RSS link without its sign', () => {
    const [link, ...rest] = hookLinks(read('src/components/HoroscopeProgramPage.astro'));
    expect(rest).toEqual([]);
    expect(link).toContain('href={`/feeds/horoscopes/${sign.slug}.xml`}');
    expect(attr(link, 'data-hook-event')).toBe('rss_subscribe');
    expect(attr(link, 'data-hook-feed')).toBe('horoscopes_sign');
    expect(attr(link, 'data-hook-placement')).toBe('horoscope_page');
    expect(link).not.toMatch(/data-hook-[a-z]+=\{/u);
  });

  it('marks the sky calendar and heads-up subscribe and download links', () => {
    const links = hookLinks(read('src/components/return-visits/ReturnToolPage.astro'));
    const summary = links.map((link) => [
      attr(link, 'data-hook-event'),
      attr(link, 'data-hook-feed'),
      link.includes("replace('https:', 'webcal:')") ? 'webcal' : link.includes(' download') ? 'download' : 'other',
    ]);
    expect(summary).toEqual([
      ['calendar_subscribe', 'sky', 'webcal'],
      ['calendar_download', 'sky', 'download'],
      ['calendar_subscribe', 'heads_up', 'webcal'],
      ['calendar_download', 'heads_up', 'download'],
    ]);
  });

  it('marks the 2027 calendar files and the feeds page and developer links', () => {
    for (const [path, feed] of [
      ['src/pages/eclipses/2027/index.astro', 'eclipses'],
      ['src/pages/full-moon-calendar/2027/index.astro', 'full_moons'],
      ['src/pages/mercury-retrograde/2027/index.astro', 'mercury_retrograde'],
    ]) {
      const links = hookLinks(read(path));
      expect(links.map((link) => [attr(link, 'data-hook-event'), attr(link, 'data-hook-feed')]), path)
        .toEqual([['calendar_download', feed]]);
    }
    const feedsPage = read('src/pages/feeds/index.astro');
    expect(hookLinks(feedsPage)).toHaveLength(2);
    expect([...feedsPage.matchAll(/hook: '([a-z_]+)'/gu)].map((match) => match[1]))
      .toEqual(['events', 'daily_sky', 'horoscopes', 'almanac']);
    expect(hookLinks(read('src/pages/developers/index.astro')).map((link) => attr(link, 'data-hook-feed')))
      .toEqual(['horoscopes', 'daily_sky']);
  });

  it('uses only listed events and closed values in every hook link', () => {
    for (const path of HOOK_SOURCES) {
      const source = read(path);
      const literalHooks = [...source.matchAll(/hook: '([a-z_]+)'/gu)].map((match) => match[1]);
      for (const link of hookLinks(source)) {
        const event = attr(link, 'data-hook-event') as string;
        expect(ANALYTICS_HOOK_EVENTS, `${path}: ${link}`).toContain(event);
        const values = ANALYTICS_EVENT_VALUES[event as keyof typeof ANALYTICS_EVENT_VALUES] as
          Record<string, readonly string[]>;
        for (const key of ['feed', 'placement']) {
          if (!new RegExp(`data-hook-${key}=`, 'u').test(link)) continue;
          expect(ANALYTICS_EVENT_PROPS[event as keyof typeof ANALYTICS_EVENT_PROPS], `${path}: ${key}`).toContain(key);
          const value = attr(link, `data-hook-${key}`);
          // The feeds page reads its feed word from the literal list checked below.
          const candidates = value === undefined ? literalHooks : [value];
          for (const candidate of candidates) expect(values[key], `${path}: ${key}=${candidate}`).toContain(candidate);
        }
      }
    }
  });

  it('never marks the market research feed', () => {
    for (const path of HOOK_SOURCES) {
      for (const link of hookLinks(read(path))) expect(link).not.toMatch(/market/u);
    }
  });
});

describe('the analytics bootstrap click listener', () => {
  // Runs the real inline bootstrap from Base.astro against a minimal page.
  function bootstrap() {
    const base = read('src/layouts/Base.astro');
    const match = base.match(/<script is:inline define:vars=\{\{\s*plausibleScriptUrl,[\s\S]*?\}\}>([\s\S]*?)<\/script>/u);
    expect(match, 'the Plausible bootstrap script').not.toBeNull();
    expect(match![0]).toContain('hookEvents: ANALYTICS_HOOK_EVENTS');
    const sent: Array<[string, unknown]> = [];
    let onClick: ((event: unknown) => void) | undefined;
    const win: Record<string, unknown> = {};
    win.plausible = (name: string, options: { props: unknown }) => sent.push([name, options.props]);
    const doc = {
      addEventListener: (type: string, handler: (event: unknown) => void) => { if (type === 'click') onClick = handler; },
      querySelector: () => null,
      createElement: () => ({ dataset: {} }),
      head: { appendChild: () => {} },
    };
    const run = new Function(
      'plausibleScriptUrl', 'plausibleEndpoint', 'plausibleDomain', 'guidePrivateSessionKey',
      'analyticsEventProps', 'analyticsEventValues', 'hookEvents',
      'window', 'document', 'sessionStorage', 'location',
      match![1],
    );
    run(
      'https://plausible.example/script.js', '', '', 'guide-private',
      ANALYTICS_EVENT_PROPS, ANALYTICS_EVENT_VALUES, ANALYTICS_HOOK_EVENTS,
      win, doc, { getItem: () => null }, { origin: 'https://zodiacs.org', pathname: '/' },
    );
    expect(onClick).toBeTypeOf('function');
    const click = (attrs: Record<string, string>) => {
      const link = { getAttribute: (name: string) => (name in attrs ? attrs[name] : null) };
      onClick!({ target: { closest: (selector: string) => (selector === 'a[href]' ? link : null) } });
    };
    return { sent, click };
  }

  it('counts a hook link click with its closed values only', () => {
    const { sent, click } = bootstrap();
    click({ href: '/feeds/horoscopes.xml', 'data-hook-event': 'rss_subscribe', 'data-hook-feed': 'horoscopes', 'data-hook-placement': 'footer' });
    click({ href: 'webcal://zodiacs.org/sky-calendar.ics', 'data-hook-event': 'calendar_subscribe', 'data-hook-feed': 'sky' });
    expect(sent).toEqual([
      ['rss_subscribe', { feed: 'horoscopes', placement: 'footer' }],
      ['calendar_subscribe', { feed: 'sky' }],
    ]);
  });

  it('drops unlisted events and values a link names', () => {
    const { sent, click } = bootstrap();
    click({ href: '/feeds/market-research.xml', 'data-hook-event': 'rss_subscribe', 'data-hook-feed': 'market_research', 'data-hook-placement': 'terminal' });
    click({ href: '/birthday/', 'data-hook-event': 'birth_details', 'data-hook-feed': 'horoscopes' });
    click({ href: '/birthday/', 'data-hook-event': 'email_subscribed', 'data-hook-placement': 'chart' });
    click({ href: '/feeds/horoscopes.xml' });
    expect(sent).toEqual([['rss_subscribe', {}]]);
  });
});
