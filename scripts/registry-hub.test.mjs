import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Zodiacs Registry catalogue hub', () => {
  test('is a distinct, self-canonical, identity-first catalogue page', async () => {
    const html = await read('public/registry/index.html');
    expect(html).toContain('<link rel="canonical" href="https://zodiacs.org/registry/"');
    expect(html.match(/<h1\b/giu)).toHaveLength(1);
    expect(html).toContain('<title>The 12 Zodiac Profiles | Zodiacs.org</title>');
    expect(html).toContain('<h1>Find your sign.</h1>');
    expect(html).toContain('The twelve Zodiac signs, their stories, shared birthdays and verified public records.');
    expect(html).toContain('<dt>Famous birthdays</dt><dd>48</dd>');
    expect(html).toContain('<dt>Attention</dt><dd>30 days</dd>');
    expect(html).toContain('<dt>Market standings</dt><dd>Daily</dd>');
    expect(html).not.toContain('copy its emoji');
    expect(html).not.toContain('one for every Zodiac sign');
    expect(html).not.toContain('one familiar emoji for each sign');
    expect(html.indexOf('id="records-title"')).toBeLessThan(html.indexOf('id="verify"'));
    expect(html).toContain("--sans:'Instrument Sans','Instrument Sans Fallback','Instrument Sans Fallback Android',system-ui,-apple-system,sans-serif");
    expect(html).toContain('font-family:var(--sans);');
    expect(html).toContain('data-registry-established');
    expect(html).not.toContain('<h1>Astrofolio</h1>');
    expect(html).not.toContain('<h1>Terminal</h1>');
  });

  test('keeps every verified address available behind the twelve profile disclosures', async () => {
    const [html, registryRaw] = await Promise.all([
      read('public/registry/index.html'),
      read('public/registry/zodiacs.registry.json'),
    ]);
    const registry = JSON.parse(registryRaw);
    const official = registry.assets.flatMap((asset) => (
      asset.representations.filter((representation) => representation.isOfficialRepresentation)
    ));

    expect(registry.assets).toHaveLength(12);
    expect(official).toHaveLength(24);
    expect(html.match(/data-registry-record/gu)).toHaveLength(12);
    expect(html.match(/<details class="record__details">/gu)).toHaveLength(12);
    expect(html.match(/<summary>Verified token addresses<\/summary>/gu)).toHaveLength(12);
    expect(html.match(/class="record__network"/gu)).toHaveLength(24);
    expect(html).toContain('<span><small>♈ · fire sign</small><strong>Aries</strong></span>');
    expect(html).toContain('<span>View profile</span>');
    expect(html).not.toContain('Solana · SPL');
    expect(html).not.toContain('Base · ERC-20');
    expect(html).not.toContain('Official counterpart');
    for (const representation of official) {
      expect(html).toContain(`<code>${representation.address}</code>`);
    }
  });

  test('keeps the page first-party and free of market or analytics runtime', async () => {
    const [html, analyticsBuild] = await Promise.all([
      read('public/registry/index.html'),
      read('scripts/configure-legacy-analytics.mjs'),
    ]);
    expect(html).toContain("script-src 'self' 'unsafe-inline'");
    expect(html).toContain("connect-src 'self'");
    expect(html).not.toMatch(/<script[^>]+src=/iu);
    expect(html).not.toContain('/assets/app.js');
    expect(html).toContain('data-guide-loader="zodiacs-guide-loader-v1"');
    expect(html).toContain('return mod.bootstrapGuide(defaultLocale)');
    expect(html).not.toContain('plausible.io');
    expect(html).not.toContain('zodiacs-analytics:start');
    expect(html).not.toMatch(/api\.(?:dexscreener|geckoterminal)/iu);
    expect(html).not.toMatch(/market-tape|market-board|leaderboard|Buy [A-Z]/u);
    expect(html).toContain('<noscript>');
    expect(html).toContain('class="wnav__search" href="/?search=1"');
    expect(analyticsBuild).toContain("entry.isFile() && entry.name === 'index.html'");
  });

  test('offers an exact local address check with honest unknown state', async () => {
    const html = await read('public/registry/index.html');
    expect(html).toContain('data-address-verifier');
    expect(html).toContain('<h2 id="verify-title">Check a token address.</h2>');
    expect(html).toContain('Every token has a long address, like an account number.');
    expect(html).toContain('we’ll check whether it matches the official list.');
    expect(html).toContain("entry.normalized===normalized");
    expect(html).toContain("value.toLowerCase()");
    expect(html).toContain("result.textContent='Paste a complete token address.'");
    expect(html).toContain('This address is not in the Zodiacs Registry. Check every character before continuing.');
    expect(html).toContain("link.href='/registry/'+match.sign+'/#record'");
    expect(html).toContain("link.textContent='Open '+match.name+' profile →'");
    expect(html).not.toMatch(/fetch\s*\(/u);
  });

  test('keeps detailed market data and technical resources subordinate to the catalogue', async () => {
    const html = await read('public/registry/index.html');
    expect(html).toContain('href="/terminal/"');
    expect(html).toContain('Want the full market view?');
    expect(html).toContain('View market data');
    expect(html).toContain('<details class="authority__details">');
    expect(html).toContain('<summary>Technical records and tools</summary>');
    for (const path of [
      '/registry/zodiacs.registry.json',
      '/registry/technical/',
      '/sdk/',
      '/disclosure/',
      '/registry/collection/',
      '/registry/wallet-chart/',
    ]) expect(html).toContain(`href="${path}"`);
    expect(html).toContain('“Verified” only means an address matches this published list.');
    expect(html).toContain('It does not prove who owns it, that it is safe, or that it will keep its value.');
  });

  test('hands old identity and market state to Astrofolio or Terminal without hijacking Registry state', async () => {
    const html = await read('public/registry/index.html');
    expect(html).toContain("var proQuery=['rank','outlook']");
    expect(html).toContain("var proHash=['market','briefing','research','outlook']");
    expect(html).toContain("'sign-gallery','gallery','aries'");
    expect(html).toContain("var proHashValue=hash==='outlook'?'briefing':hash");
    expect(html).toContain("location.replace('/terminal/'+location.search+(proHashValue?'#'+proHashValue:''))");
    expect(html).toContain("location.replace('/astrofolio/'+location.search+location.hash)");
    expect(html).toContain('id="verify"');
    expect(html).not.toContain("'address'].some");
  });

  test('keeps touch targets and narrow layouts explicit', async () => {
    const html = await read('public/registry/index.html');
    expect(html).toContain('min-height:44px');
    expect(html).toContain('@media (max-width:359px)');
    expect(html).toContain('@media (max-width:767px)');
    expect(html).toContain('overflow-wrap:anywhere');
  });

  test('keeps technical methodology inside the Registry hierarchy', async () => {
    const technical = await read('public/registry/technical/index.html');
    expect(technical).toContain('<title>Registry Data &amp; Methodology | Zodiacs Registry</title>');
    expect(technical).toContain('<li><a href="/registry/">Zodiacs Registry</a></li>');
    expect(technical).toContain('href="/registry/">← Return to Zodiacs Registry</a>');
    expect(technical).not.toContain('href="/registry/">← Return to Astrofolio</a>');
  });
});
