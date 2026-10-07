import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { injectRegistryExchange, REGISTRY_EXCHANGE_FLAG } from '../src/exchange/entry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const compact = (value) => value.replace(/\s+/g, ' ');

describe('Exchange risk and trust copy', () => {
  it('keeps the pinned sentences on the committed page, beside Terminal, not in a footer', async () => {
    const html = compact(await read('public/terminal/markets/index.html'));
    expect(html).toContain("Zodiacs.org does not connect wallets, request signatures, or submit transactions. Public address lookups use an address you paste. Purchase links open independent services with their own terms and risks.");
    expect(html).toContain('could lose all money used to acquire one');
    expect(html).toContain('Zodiacs.org operates Astrofolio');
    expect(html).toContain('<title>Terminal · Advanced Market Route · Zodiacs.org</title>');
    expect(html).toContain('<meta property="og:title" content="Terminal · Advanced Market Route" />');
    expect(html).toContain('https://zodiacs.org/assets/og/v6/terminal.png');
    expect(html).not.toContain('https://zodiacs.org/assets/og/v2/registry.png');
    expect(html).toContain('"name": "Advanced market route"');
    expect(html).toContain('"name": "Terminal", "item": "https://zodiacs.org/terminal/"');
    expect(html).toContain('<h1 id="zme-title">Terminal</h1>');
    expect(html).toContain('<h2 id="zme-records">The twelve official Zodiac tokens</h2>');
    expect(html).toContain('Sign 12 of 12');
    expect(html).not.toMatch(/\bLot (?:I|V|X)/u);
    expect(html).not.toContain('Registry Trading Room');
    expect(html).not.toContain('Zodiacs Mercantile Exchange');
    expect(html).not.toContain('your wallet reviews, approves, and signs');
    expect(html).toContain('href="/privacy/"');
    expect(html).toContain('href="/terms/"');
    expect(html).toContain('href="/disclosure/"');
  });

  it('keeps the page unindexed and self-canonical until a later, separate decision', async () => {
    const html = await read('public/terminal/markets/index.html');
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).toContain('<link rel="canonical" href="https://zodiacs.org/terminal/markets/" />');
  });

  it('keeps banned surfaces off the page in both flag states', async () => {
    const committed = await read('public/terminal/markets/index.html');
    const on = injectRegistryExchange(committed, { [REGISTRY_EXCHANGE_FLAG]: '1' }).output;
    for (const html of [committed, on]) {
      expect(html).not.toContain('jup.ag/swap/');
      expect(html).not.toContain('/assets/webmcp-register.js');
      // The hub's venue-directory rule: the homepage link is the only jup.ag
      // reference a shell may carry.
      const venueLinks = html.match(/https:\/\/jup\.ag[^"']*/g) ?? [];
      expect(venueLinks.every((link) => link === 'https://jup.ag/')).toBe(true);
    }
    // The risk block survives stamping untouched.
    expect(compact(on)).toContain('Zodiacs.org does not connect wallets, request signatures, or submit transactions. Public address lookups use an address you paste. Purchase links open independent services with their own terms and risks.');
  });

  it('keeps the depth ladder honest about not being an order book, in source and bundle', async () => {
    for (const path of ['src/exchange/terminal.mjs', 'public/assets/exchange.js']) {
      const source = compact(await read(path));
      expect(source, path).toContain('These pools have no order book');
      expect(source, path).toContain('indicative Jupiter quote');
      expect(source, path).toContain('Sell sizes are estimates from the indexed mid');
      expect(source, path).toContain('does not connect wallets, request signatures, or submit transactions');
      expect(source, path).toContain('price comes from the returned atomic amounts');
      expect(source, path).toContain('fee above 0.10%, are refused');
      expect(source, path).toContain('Independent third-party data, not a valuation or recommendation');
    }
  });

  it('credits the chart-data provider beside the chart, not in a footnote', async () => {
    for (const path of ['src/exchange/terminal.mjs', 'public/assets/exchange.js']) {
      const source = await read(path);
      expect(source, path).toContain('Chart data by GeckoTerminal');
    }
  });

  it('keeps reference market and indicative quote labelled apart, in source and bundle', async () => {
    // The chart and tape describe the canonical pool; the panel's quote is
    // Jupiter's aggregate and may route beyond it. The two must never read
    // as the same market.
    for (const path of ['src/exchange/terminal.mjs', 'public/assets/exchange.js']) {
      const source = compact(await read(path));
      expect(source, path).toContain('Reference market — the sign’s canonical pool');
      expect(source, path).toContain('Public address lookups use an address you paste');
      expect(source, path).toContain('Indicative aggregate quote — Jupiter may route across several pools');
      expect(source, path).toContain('canonical pool · newest first');
    }
  });

  it('names GeckoTerminal in every privacy locale, beside the other providers', async () => {
    for (const path of [
      'src/pages/privacy/index.astro',
      'src/pages/es/privacy/index.astro',
      'src/pages/fr/privacy/index.astro',
      'src/pages/it/privacy/index.astro',
      'src/pages/pt/privacy/index.astro',
    ]) {
      const html = await read(path);
      expect(html, path).toContain('GeckoTerminal');
    }
  });

  it('serves both trade bundles fresh — no stale terminal after a rollback', async () => {
    const config = JSON.parse(await read('vercel.json'));
    for (const source of ['/assets/exchange.js', '/assets/trade.js']) {
      const rule = config.headers.find((entry) => entry.source === source);
      const cache = rule?.headers?.find((header) => header.key === 'Cache-Control')?.value;
      expect(cache, source).toBe('public, max-age=0, must-revalidate');
    }
  });

  it('browser-enforces the Terminal venue-route network allowlist and noindex boundary', async () => {
    const config = JSON.parse(await read('vercel.json'));
    const rule = config.headers.find((entry) => entry.source === '/terminal/markets/(.*)');
    const headers = new Map(rule?.headers?.map(({ key, value }) => [key, value]));
    const csp = headers.get('Content-Security-Policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' https://api.jup.ag https://api.dexscreener.com https://api.geckoterminal.com https://plausible.io;");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).not.toContain('*');
    expect(headers.get('Referrer-Policy')).toBe('same-origin');
    expect(csp).toContain("manifest-src 'self'");
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(headers.get('X-Robots-Tag')).toBe('noindex, noarchive');
  });

  it('keeps the Cabinet free of any route to the Terminal venue route', async () => {
    // Mandatory control: the Collection surface never gains an acquisition
    // link — including a link to this room.
    const cabinet = await read('src/pages/registry/collection/index.astro');
    expect(cabinet).not.toContain('/terminal/markets/');
    expect(cabinet).not.toContain('Mercantile');
  });

  it('records the owner-authorized Terminal route split without widening the acquisition surface', async () => {
    const decision = compact(await read('docs/REGISTRY-EXCHANGE-OWNER-RISK-DECISION.md'));
    expect(decision).toContain('Addendum: 2026-08-13 current public product names');
    expect(decision).toContain('`/astrofolio/` is **Astrofolio**');
    expect(decision).toContain('`/terminal/markets/` venue route are **Terminal**, the expert market desk');
    expect(decision).toContain('“Zodiac Markets,” “Pro Terminal,” “consumer Terminal,” and “Zodiac Terminal” below are historical labels');
    expect(decision).toContain('Addendum — 2026-08-11: Terminal route split');
    expect(decision).toContain('Zodiac Markets moves from `/registry/exchange/` to `/terminal/markets/`');
    expect(decision).toContain('discovery entry moves with Zodiac Terminal from the old `/registry/` market landing to `/terminal/`');
    expect(decision).toContain('feature flag, internal `exchange` identifiers, analytics event names, provider boundaries, and Registry API/schema contracts stay unchanged');
    expect(decision).toContain('This split creates no additional acquisition surface');
    expect(decision).toContain('Addendum — 2026-08-10: public name and one Registry entry');
    expect(decision).toContain('The public name is **Zodiac Markets**');
    expect(decision).toContain('only when `PUBLIC_REGISTRY_EXCHANGE_ENABLED=1`');
    expect(decision).toContain('No global navigation, footer, Cabinet, or sign-record entry is authorized');
    expect(decision).toContain('noindex, no-store, CSP, service-worker, custody, compensation, independent-venue, pilot, and rollback controls remain unchanged');
  });

  it('records the dated Pro gateway move without extending the Markets pilot', async () => {
    const [decision, runbook] = await Promise.all([
      read('docs/REGISTRY-EXCHANGE-OWNER-RISK-DECISION.md').then(compact),
      read('docs/REGISTRY-EXCHANGE-LAUNCH-RUNBOOK.md').then(compact),
    ]);
    expect(decision).toContain('Addendum — 2026-08-12: Pro Terminal discovery entry');
    expect(decision).toContain('Authorized: 2026-08-12');
    expect(decision).toContain('The one same-origin, flag-gated Zodiac Markets discovery entry moves from `/terminal/` to `/terminal/pro/`');
    expect(decision).toContain('`/terminal/` remains the indexed consumer collection, now named Astrofolio, and carries no venue-route discovery entry or exchange flag marker in either flag state');
    expect(decision).toContain('links to `/terminal/markets/#<selected-sign>`');
    expect(decision).toContain('market terminal and expert gateway are absent and both markers are `0`');
    expect(decision).toContain('Mounting, focusing, or selecting the gateway causes no provider or wallet request');
    expect(decision).toContain('each form of its navigation URL is service-worker network-only');
    expect(decision).toContain('The venue route itself remains `noindex`, `no-store`, out of the sitemap');
    expect(decision).toContain('does not restart or extend the 30-day pilot');
    expect(decision).toContain('returns flag-off on or before **2026-09-09**');

    expect(runbook).toContain('the route, `/terminal/`, and `/astrofolio/` landing markers are all `0`');
    expect(runbook).toContain('exactly one Terminal venue-route discovery entry appears on `/terminal/`');
    expect(runbook).toContain('no CacheStorage entry for any Terminal venue-route or expert Terminal navigation');
    expect(runbook).toContain('On or before 2026-09-30, turn the flag off');
  });

  it('records the dated 2026-08-31 pilot continuation as a bounded bridge', async () => {
    const [decision, runbook] = await Promise.all([
      read('docs/REGISTRY-EXCHANGE-OWNER-RISK-DECISION.md').then(compact),
      read('docs/REGISTRY-EXCHANGE-LAUNCH-RUNBOOK.md').then(compact),
    ]);
    expect(decision).toContain('Addendum — 2026-08-31: pilot continuation to 2026-09-30, as a bridge to Swap V2');
    expect(decision).toContain('Authorized: 2026-08-31 (owner-directed continuation)');
    expect(decision).toContain('Live-contract review, 2026-08-31');
    expect(decision).toContain('venue fee reported at 10 bps, equal to and not above the 0.10% ceiling');
    expect(decision).toContain('this continuation does not call that contract durable');
    expect(decision).toContain('ends at the earliest of: the migration deploying, a probe or stop-condition failure, or **2026-09-30**');
    expect(decision).toContain('On or before 2026-09-30 the venue route returns flag-off unless a further dated owner decision is recorded');
    expect(runbook).toContain('The 2026-08-31 owner continuation extends the pilot, at the latest, to 2026-09-30');
  });

  it('records the dated Astrofolio market-gateway entry without widening the pilot', async () => {
    const [decision, runbook] = await Promise.all([
      read('docs/REGISTRY-EXCHANGE-OWNER-RISK-DECISION.md').then(compact),
      read('docs/REGISTRY-EXCHANGE-LAUNCH-RUNBOOK.md').then(compact),
    ]);
    expect(decision).toContain('Addendum — 2026-08-31: Astrofolio market-gateway discovery entry');
    expect(decision).toContain('Authorized: 2026-08-31');
    expect(decision).toContain('A second flag-gated venue-route discovery entry is authorized on `/astrofolio/`, as one action in the market gateway beside the leaderboard');
    expect(decision).toContain('links to `/terminal/markets/#<selected-sign>` carrying only a canonical sign slug');
    expect(decision).toContain('`/astrofolio/` now carries the exchange flag marker, committed `0`');
    expect(decision).toContain('Mounting, rendering, or focusing the entry causes no provider or wallet request');
    expect(decision).toContain('No global navigation, footer, Cabinet, sign-record, or leaderboard-row venue-route entry is authorized');
    expect(decision).toContain('This addendum does not restart or extend the 30-day pilot');

    expect(runbook).toContain('Since the 2026-08-31 owner addendum `/astrofolio/` carries the exchange flag marker, committed `0`');
    expect(runbook).toContain('and exactly one on `/astrofolio/` as a market-gateway action beside the leaderboard');
    expect(runbook).toContain('leaderboard rows remain identity links and gain no venue-route entry');
  });
});
