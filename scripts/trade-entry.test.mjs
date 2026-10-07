import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const page = (sign) => readFile(resolve(root, `public/registry/${sign}/index.html`), 'utf8');
const decision = () => readFile(
  resolve(root, 'docs/REGISTRY-TRADE-OWNER-RISK-DECISION.md'),
  'utf8',
);
const compact = (value) => value.replace(/\s+/g, ' ').trim();

describe('the committed pages', () => {
  it('contain no catalogue trade flag, markers, host, or runtime', async () => {
    for (const sign of SIGNS) {
      const html = await page(sign);
      expect(html, sign).not.toContain('zodiacs-registry-trade-enabled');
      expect(html, sign).not.toMatch(/registry-trade:(?:start|slot|end)/u);
      expect(html, sign).not.toContain('data-trade-panel');
      expect(html, sign).not.toContain('/assets/trade.js');
      expect(html, sign).not.toMatch(/window\.zodiacsTrade|api\.jup\.ag/u);
    }
  });

  it('contains no purchase route or external execution-venue link', async () => {
    for (const sign of SIGNS) {
      const html = await page(sign);
      expect(html, sign).not.toMatch(/href="https:\/\/(?:[^"/]+\.)?jup\.ag(?:\/|")/iu);
      expect(html, sign).not.toContain('Continue to Jupiter');
      expect(html, sign).not.toContain('Open Jupiter route');
      expect(html, sign).not.toContain('href="/terminal/markets/');
      expect(html, sign).not.toContain('data-acquisition');
      expect(html, sign).not.toContain('id="get"');
    }
  });

  it('keeps the old acquisition fragment as one inert alias beside the verified record', async () => {
    for (const sign of SIGNS) {
      const html = compact(await page(sign));
      expect(html.match(/\bid="acquire"/gu), sign).toHaveLength(1);
      expect(html, sign).toContain(
        '<span class="anchor-alias" id="acquire" aria-hidden="true"></span> <section class="sec reveal" id="record" aria-label="Check the token">',
      );
      expect(html, sign).not.toMatch(/<(?:a|button)\b[^>]*\bid="acquire"/iu);
      expect(html, sign).not.toContain('This page only shows information. It cannot make a purchase or move money.');
      expect(html, sign).toContain('Verified token address');
    }
  });
});

describe('the retired catalogue compatibility hook', () => {
  it('ignores the old flag and cannot rewrite a profile', async () => {
    const source = await readFile(resolve(root, 'scripts/configure-registry-trade.mjs'), 'utf8');
    expect(source).toContain('ignores PUBLIC_REGISTRY_TRADE_ENABLED');
    expect(source).toContain('Registry trade panel: retired');
    expect(source).not.toMatch(/injectRegistryTrade|renderTradeRegion|writeFile|readFile/u);
  });
});

describe('the retired transaction runtime', () => {
  it('ships an inert cached-page API and no provider or submission code', async () => {
    const runtime = await readFile(resolve(root, 'public/assets/trade.js'), 'utf8');
    const terminal = await readFile(resolve(root, 'src/exchange/terminal.mjs'), 'utf8');
    const guide = await readFile(resolve(root, 'src/pages/astrofolio/how-to-buy/index.astro'), 'utf8');
    expect(runtime).toContain('window.zodiacsTrade');
    expect(runtime).not.toMatch(/api\.jup\.ag|signTransaction|standard:connect|executeOrder|eth_requestAccounts/);
    expect(terminal).not.toContain('loadTradeBundle');
    expect(guide).not.toMatch(/trade\.js|data-jupiter-host|revealTrade/);
  });
});

describe('the landing', () => {
  const hub = () => readFile(resolve(root, 'public/astrofolio/index.html'), 'utf8');

  it('is identity-first and carries no trade flag or panel surface', async () => {
    const html = await hub();
    expect(html).not.toContain('zodiacs-registry-trade-enabled');
    // Owner addendum 2026-08-31: the exchange marker is present, committed
    // off, for the flag-gated market-gateway venue-route entry. The trade
    // flag and panel stay off this surface.
    expect(html).toContain('<meta name="zodiacs-registry-exchange-enabled" content="0" />');
    expect(html).not.toContain('data-trade-panel');
    expect(html).not.toContain('/assets/trade.js');
  });

  it('offers Registry, beginner-guide, and same-origin market handoffs across twelve no-JS sign states', async () => {
    const html = await hub();
    const runway = html.match(/<section\b[^>]*\bid="the-twelve"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    expect(runway).toBeDefined();

    // Without JavaScript the runway is one swipeable row: all twelve looks
    // are present in zodiac order, and exactly one carries the season mark
    // (stamped with the real season at release by stamp-astrofolio-season).
    const looks = [...runway.matchAll(
      /<article\b[^>]*\bdata-static-sign="([a-z]+)"[^>]*>([\s\S]*?)<\/article>/g,
    )];
    expect(looks.map(([, sign]) => sign)).toEqual(SIGNS);
    expect(runway.match(/<article class="campaign-look is-season"/g)).toHaveLength(1);
    for (const [, sign, look] of looks) {
      const records = [...look.matchAll(/href="\/registry\/([a-z]+)\/"/g)];
      const guides = [...look.matchAll(/href="\/astrofolio\/how-to-buy\/([a-z]+)\/"/g)];
      const fomo = [...look.matchAll(/data-fomo-buy="([a-z]+)"/g)];
      expect(records, sign).toHaveLength(1);
      expect(records[0][1], sign).toBe(sign);
      expect(guides, sign).toHaveLength(1);
      expect(guides[0][1], sign).toBe(sign);
      expect(fomo, sign).toHaveLength(1);
      expect(fomo[0][1], sign).toBe(sign);
    }
    expect(html).toMatch(/\.campaign-runway\[data-mode="carousel"\] \.campaign-runway__track \{[^}]*overflow-x: auto;/);

    // Sign-level handoffs stay educational. Market discovery is consolidated
    // into the leaderboard gateway rather than repeated in each panel, while
    // the executable venue route remains out of the Consumer landing.
    expect(runway).not.toContain('href="/terminal/');
    const gateway = html.match(/<section\b[^>]*\bid="market-layer"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    expect(gateway).toBeDefined();
    expect(gateway.match(/href="\/astrofolio\/\?sign=[a-z]+#consumer-sign-preview"/g)).toHaveLength(12);
    expect(gateway.match(/href="\/registry\/technical\/#market-transparency"/g)).toHaveLength(1);
    expect(gateway.match(/href="\/terminal\/\?rank=marketCap"/g)).toHaveLength(1);
    expect(gateway).not.toContain('href="/terminal/markets/');
    expect(html).not.toMatch(/href="https:\/\/(?:[^"/]+\.)?jup\.ag\//);
    expect(html).not.toContain('data-trade-panel');
  });

  // The Registry's own risk test forbids a swap deep-link in the shell. The
  // panel's endpoint is a different host and lives in the bundle, not here.
  it('keeps every venue URL out of the shell', async () => {
    const html = await hub();
    expect(html).not.toContain('jup.ag/swap/');
    expect(html).not.toContain('api.jup.ag');
  });
});

describe('the historical 2026-08-13 Consumer handoff decision', () => {
  it('authorizes only the selected-sign record handoff', async () => {
    const text = await decision();
    expect(text).toContain('Addendum — 2026-08-13: beginner Consumer record handoff');
    expect(text).toContain('Authorized: 2026-08-13');
    expect(text).toContain('exactly one selected-sign educational action');
    expect(text).toContain('`/registry/<canonical-sign>/#acquire`');
    expect(text).toContain('no link to `/terminal/markets/`');
    expect(text).toMatch(/no embedded\s+trade interface/);
    expect(text).toMatch(/no direct venue URL/);
  });

  it('pins the inertness, compensation, custody, and pilot boundaries', async () => {
    const text = await decision();
    expect(text).toContain('Mounting or focusing the action, or changing the selected sign');
    expect(text).toContain('must not\nconnect a wallet or request anything from Jupiter');
    expect(text).toContain('does not authorize an acquisition action on Pro');
    expect(text).toContain('extend its pilot\ndeadline');
    expect(text).toContain('It adds no authority for custody');
    expect(text).toMatch(/referral fees,\s+platform fees, or other compensation/);
  });
});

describe('the 2026-08-24 Astrofolio market-gateway decision', () => {
  it('authorizes one bottom discovery gateway without adding execution to the landing', async () => {
    const text = compact(await decision());
    expect(text).toContain('Addendum — 2026-08-24: Astrofolio bottom market gateway');
    expect(text).toContain('Authorized: 2026-08-24');
    expect(text).toContain('exactly one same-origin link to `/terminal/`');
    expect(text).toContain('exactly one same-origin link to `/terminal/markets/`');
    expect(text).toContain('No sign placard, Registry profile, Cabinet, global navigation, or footer gains either action');
    expect(text).toContain('must not load `/assets/trade.js`, request a Jupiter quote, discover or connect a wallet, or ask for a signature');
  });
});

describe('the historical 2026-08-16 catalogue retirement decision', () => {
  it('records the now-superseded one-link step and retirement of every embedded profile surface', async () => {
    const text = compact(await decision());
    expect(text).toContain('Addendum — 2026-08-16: catalogue trade panel retired');
    expect(text).toContain('Authorized: 2026-08-16');
    expect(text).toContain('Each profile is now read-only');
    expect(text).toContain('exactly one external, mint-pinned link to Jupiter');
    expect(text).toContain('plain-language explanation of Solana, a wallet, SOL, Jupiter, irreversibility, and complete-loss risk');
    expect(text).toContain('must not mount a wallet host, load the Registry trade runtime');
    expect(text).toContain('request a Jupiter quote, construct a transaction, or ask for a signature');
  });

  it('keeps the executable interface in Terminal and preserves the compensation boundary', async () => {
    const text = compact(await decision());
    expect(text).toContain('`PUBLIC_REGISTRY_TRADE_ENABLED` no longer controls catalogue output');
    expect(text).toContain('cannot restore the embedded trade panel');
    expect(text).toContain('full trade interface remains confined to Zodiac Terminal markets');
    expect(text).toContain('no-custody, no-referral, no-platform-fee, and no-compensation commitments');
  });
});

describe('the superseding 2026-08-16 no-venue catalogue decision', () => {
  it('removes every purchase path while retaining only an inert compatibility fragment', async () => {
    const text = compact(await decision());
    expect(text).toContain('Addendum — 2026-08-16: catalogue venue links removed');
    expect(text).toContain('Authorized: 2026-08-16');
    expect(text).toContain('contain no purchase route, external venue link, wallet prompt, or transaction instructions');
    expect(text).toContain('read-only identity, market-context, and address-verification pages');
    expect(text).toContain('old `#acquire` fragment is kept only as an invisible compatibility alias');
    expect(text).toContain('does not expose an acquisition action');
  });

  it('supersedes the one-link permission and requires separate approval for any future doorway', async () => {
    const text = compact(await decision());
    expect(text).toContain('supersedes the preceding permission for one mint-pinned Jupiter link');
    expect(text).toContain('No venue link or embedded trade surface may be restored to a catalogue profile');
    expect(text).toContain('through `PUBLIC_REGISTRY_TRADE_ENABLED` or any other deployment flag');
    expect(text).toContain('Any future ownership doorway must be separately approved');
    expect(text).toContain('plain-language, separation, risk, and no-compensation commitments');
  });
});
