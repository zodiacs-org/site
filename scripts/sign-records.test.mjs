import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONSTELLATIONS,
  HYG_ATTRIBUTION,
  validateConstellations,
} from './constellation-data.mjs';
import {
  SIGN_PROFILE_PEOPLE,
  SIGN_PROFILE_RALLY_LINES,
  SIGN_PROFILE_PROTECTED_LINKS,
  registryProfilePersonLinkRel,
  validateSignProfileRallyLines,
} from './sign-profile-data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const signs = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

function visibleMarkup(html) {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, '')
    .replace(/<!--([\s\S]*?)-->/gu, '');
}

// Execute only the existing pure formatter declarations, never the page builder
// or market-fetching script. Matching indentation keeps adjacent code excluded.
function priceFormatter(source, name, dependencies = []) {
  const declarations = [...dependencies, name].map((functionName) => {
    const declaration = source.match(new RegExp(
      String.raw`^([ \t]*)function ${functionName}\([^)]*\) \{[\s\S]*?^\1\}`,
      'mu',
    ));
    expect(declaration, `Missing ${functionName} formatter`).not.toBeNull();
    return declaration[0];
  });
  return new Function(`${declarations.join('\n')}\nreturn ${name};`)();
}

const NEW_PROTECTED_SIGNS = Object.freeze({
  'lisa': 'aries',
  'sabrina-carpenter': 'taurus',
  'mrbeast': 'taurus',
  'kendrick-lamar': 'gemini',
  'erling-haaland': 'cancer',
  'kylie-jenner': 'leo',
  'zendaya': 'virgo',
  'max-verstappen': 'libra',
  'jenna-ortega': 'libra',
  'taylor-swift': 'sagittarius',
  'timothee-chalamet': 'capricorn',
  'harry-styles': 'aquarius',
  'bad-bunny': 'pisces',
  'rihanna': 'pisces',
  'olivia-rodrigo': 'pisces',
});

describe('Zodiac token records', () => {
  it('keeps one validated, sign-specific rally line for every profile', () => {
    expect(Object.keys(SIGN_PROFILE_RALLY_LINES)).toEqual(signs);
    expect(validateSignProfileRallyLines(signs)).toEqual([]);
    expect(SIGN_PROFILE_RALLY_LINES.scorpio).toBe('Scorpio never does anything halfway.');
    expect(new Set(Object.values(SIGN_PROFILE_RALLY_LINES)).size).toBe(12);
  });

  it('commits a valid, attributed constellation subset for all twelve signs', async () => {
    expect(Object.keys(CONSTELLATIONS)).toEqual(signs);
    expect(validateConstellations(signs)).toEqual([]);
    expect(HYG_ATTRIBUTION.license).toBe('CC BY-SA 4.0');

    for (const sign of signs) {
      const constellation = CONSTELLATIONS[sign];
      expect(constellation.stars.length).toBeGreaterThanOrEqual(5);
      expect(constellation.edges.length).toBeGreaterThanOrEqual(3);
      expect(constellation.stars.some((star) => star.id === constellation.focusId)).toBe(true);
      for (const star of constellation.stars.filter((entry) => entry.kind === 'star')) {
        expect(star.source).toBe('hyg-v4.0');
        expect(star.hygId).toBeTypeOf('number');
      }

      const svg = await read(`public/assets/constellations/${sign}.svg`);
      expect(svg).toContain(`${HYG_ATTRIBUTION.sourceBlob}`);
      expect(svg).toContain(`${HYG_ATTRIBUTION.license}`);
      expect(svg).toContain('Guide lines are not official constellation boundaries.');
    }

    const attribution = await read('public/assets/constellations/ATTRIBUTION.txt');
    expect(attribution).toContain(HYG_ATTRIBUTION.url);
    expect(attribution).toContain(HYG_ATTRIBUTION.licenseUrl);
    expect(attribution).toContain('SIMBAD M44');
  });

  it('leads with identity and emotional context, then explains the token, market, and verified address', async () => {
    for (const [index, sign] of signs.entries()) {
      const html = await read(`public/registry/${sign}/index.html`);
      const visible = visibleMarkup(html);
      const name = sign.charAt(0).toUpperCase() + sign.slice(1);

      expect((visible.match(/<h1\b/gu) || [])).toHaveLength(1);
      expect(visible).toContain(`Zodiac sign <span class="g">·</span> ${index + 1} of 12`);
      expect(visible).toContain(`${name} at a glance`);
      expect(visible).toContain(`<div class="stage"><img src="/assets/sculptures/512/${sign}.webp`);
      expect(visible).toContain(`The ${name} token`);
      expect(visible).toContain('Supply &amp; ownership');
      expect(visible).toContain(`Born under ${name}`);
      expect(visible).toContain(`${name} today`);
      expect(visible).toContain('Market standings');
      expect(visible).not.toContain('The Zodiac Race');
      expect(visible).toContain('Check the token');
      expect(visible).toContain(`${name} in the sky`);
      expect(visible).toContain(`The story of ${name}`);
      expect(visible).toContain('Explore all 12');
      expect(visible).not.toContain('class="lot__epithet"');
      expect(visible).not.toContain('not a physical sculpture or a one-of-one NFT');
      expect(visible).not.toContain(`Why ${name} is in the collection`);
      expect(visible).not.toContain('recognizable artwork');
      expect(visible).not.toContain('It pairs a familiar sign');
      expect(html).not.toContain('/terminal/markets/');
      expect(visible).toContain('<section class="quick" aria-labelledby="quick-title" data-live-quote>');
      expect(visible).toContain('Latest recorded price');
      expect(visible).toContain('Price history');
      expect(visible).toContain(`The ${name} token is a digital item people can own or send.`);
      expect(visible).toContain(`No new ${name} tokens can be created.`);
      expect(visible).not.toContain('This page only shows information. It cannot make a purchase or move money.');
      expect(visible).not.toMatch(/Continue to Jupiter|What do I need before I continue|How to buy/u);
      expect(html).not.toMatch(/href="https:\/\/jup\.ag\//u);
      expect(visible).not.toContain('data-trade-panel');
      expect(visible).not.toContain('registry-trade:slot');
      expect(visible).not.toMatch(/>Museum label<|>Catalogue note<|>Provenance<|>Acquisition<|>The catalogue</u);

      const glanceIndex = visible.indexOf(`${name} at a glance`);
      const identityIndex = visible.indexOf(`id="identity"`);
      const tokenIndex = visible.indexOf(`id="token"`);
      const marketIndex = visible.indexOf(`id="market"`);
      const legacyAliasIndex = visible.indexOf(`id="acquire"`);
      const addressIndex = visible.indexOf(`id="record"`);
      const storyIndex = visible.indexOf(`The story of ${name}`);
      expect(glanceIndex).toBeGreaterThan(-1);
      expect(identityIndex).toBeGreaterThan(glanceIndex);
      expect(tokenIndex).toBeGreaterThan(identityIndex);
      expect(marketIndex).toBeGreaterThan(tokenIndex);
      expect(legacyAliasIndex).toBeGreaterThan(marketIndex);
      expect(addressIndex).toBeGreaterThan(marketIndex);
      expect(addressIndex).toBeGreaterThan(legacyAliasIndex);
      expect(storyIndex).toBeGreaterThan(addressIndex);
    }
  });

  it('shows supply and token-account distribution without inventing holder identities', async () => {
    const distribution = JSON.parse(await read('public/assets/distribution.json'));

    for (const sign of signs) {
      const html = await read(`public/registry/${sign}/index.html`);
      const name = sign.charAt(0).toUpperCase() + sign.slice(1);
      const data = distribution.signs[sign];
      const start = html.indexOf('<section class="sec reveal ownership" id="token"');
      const end = html.indexOf('<section class="sec reveal market-section"', start);
      const ownership = html.slice(start, end);
      const nextNine = Math.round((data.top10Pct - data.top1Pct) * 100) / 100;
      const nextTen = Math.round((data.top20Pct - data.top10Pct) * 100) / 100;
      const others = Math.round((100 - data.top20Pct) * 100) / 100;

      expect(start, sign).toBeGreaterThan(-1);
      expect(end, sign).toBeGreaterThan(start);
      expect(ownership).toContain(`The ${name} token`);
      expect(ownership).toContain('Supply &amp; ownership');
      expect(ownership).toContain('Recorded Solana supply');
      expect(ownership).toContain('New issuance');
      expect(ownership).toContain('Account freezing');
      expect(ownership).toContain('Official Base version');
      expect(ownership).toContain(`Top 10 token accounts hold ${data.top10Pct.toFixed(2)}%`);
      expect(ownership).toContain(`Largest token account ${data.top1Pct.toFixed(2)} percent`);
      expect(ownership).toContain(`next 9 token accounts ${nextNine.toFixed(2)} percent`);
      expect(ownership).toContain(`next 10 token accounts ${nextTen.toFixed(2)} percent`);
      expect(ownership).toContain(`all other token accounts ${others.toFixed(2)} percent`);
      expect(ownership).toContain('token accounts, not verified people');
      expect(ownership).toContain('One person can use several accounts');
      expect(ownership).toContain('The official Base version is bridged from Solana and is not counted a second time.');
      expect(ownership).toContain(data.captureMode === 'observed' ? 'Observed snapshot' : 'Carried-forward snapshot');
      expect(ownership).toContain(`<time datetime="${data.capturedAt}">`);
      expect(ownership).not.toMatch(/(?:Recent|Older) snapshot|\d+ days? old/u);
      expect(ownership).toContain('Check on Solscan ↗');
      expect(ownership).not.toMatch(/Top holders|wallet concentration is lower|whale|team wallet/iu);
      expect(ownership).not.toMatch(/href="https:\/\/jup\.ag\//u);
    }
  });

  it('connects pride, dated public attention, famous people, and neutral market standings', async () => {
    for (const sign of signs) {
      const html = await read(`public/registry/${sign}/index.html`);
      const visible = visibleMarkup(html);
      const name = sign.charAt(0).toUpperCase() + sign.slice(1);

      expect(visible).toContain('data-share-sign');
      expect(visible).toContain(SIGN_PROFILE_RALLY_LINES[sign]);
      expect(visible).not.toContain('data-copy-identity=');
      expect(visible).not.toContain('for your bio</button>');
      expect(visible).not.toContain('symbol works anywhere text does');
      expect(visible).not.toContain(`${name} season returns every year`);
      expect(visible).not.toContain('Read about four people born during');
      expect(visible).not.toContain('<dt>Symbol</dt>');
      expect(visible).toContain(`People who share ${name}`);
      expect(visible).toContain('Hundreds of millions');
      expect(visible).toContain('A rough estimate based on one-twelfth of the world’s population.');
      expect(visible).toContain('It describes the sign, not token ownership.');
      expect(visible).toContain('Wikipedia views');
      expect(visible).toContain(`The English Wikipedia page for ${name} averaged`);
      expect(visible).toContain('One person may account for more than one view.');
      expect(visible).toContain('This shows interest, not ownership or value.');
      expect(visible).not.toContain('Ethereum');
      expect(visible).not.toContain('Dogecoin');
      expect(visible).not.toContain('meme coins');
      expect(visible).toContain('You’re in good company');
      expect(visible).toContain('Birth dates are sourced. These people did not endorse Zodiacs.org.');
      expect(visible).not.toContain('No endorsement is implied.');
      for (const person of SIGN_PROFILE_PEOPLE[sign]) {
        expect(visible).toContain(`href="/people/${person}/"`);
      }

      const standings = visible.match(/<ol class="standings__list" data-standings-list>([\s\S]*?)<\/ol>/u)?.[1] ?? '';
      expect(visible).toContain('<details class="standings__all"><summary>See all 12 market standings</summary>');
      expect(standings.match(/<li\b/gu)).toHaveLength(12);
      expect(standings.match(/\/assets\/zodiac-icons\/48\/[a-z-]+\.webp/gu)).toHaveLength(12);
      // The rank line is published only when the committed snapshot covers
      // every sign and is fresh (build-sign-pages.mjs marketRankStatus).
      // With a partial DexScreener day (2026-09-09 indexed 10 of 12 pools)
      // the page shows dashes and says why instead of a rank.
      const marketHistory = JSON.parse(await read('public/assets/data/registry-market-history.v1.json'));
      const latestSnapshot = marketHistory.snapshots.at(-1);
      const coverage = latestSnapshot?.coverage ?? {};
      const snapshotReadAt = Date.parse(latestSnapshot?.source?.readAt ?? '');
      const snapshotAge = Date.now() - snapshotReadAt;
      const rankAvailable = [coverage.canonicalAssetCount, coverage.assetsWithIndexedPools, coverage.assetsWithMarketCap]
        .every((count) => Number(count) === 12)
        && Number.isFinite(snapshotReadAt)
        && snapshotAge >= -5 * 60 * 1000
        && snapshotAge <= 48 * 60 * 60 * 1000;
      if (rankAvailable) {
        expect(visible).toMatch(/\d+(?:st|nd|rd|th) of 12 by total market value/u);
        expect(visible).not.toContain('A rank is not shown because some numbers are missing or out of date.');
      } else {
        expect(visible).not.toMatch(/\d+(?:st|nd|rd|th) of 12 by total market value/u);
        expect(visible).toContain('A rank is not shown because some numbers are missing or out of date.');
        expect(standings.match(/<span class="standings__rank">—<\/span>/gu)).toHaveLength(12);
      }
      expect(visible).toContain('This rank only compares total market value. It does not show how many people support each sign.');
      expect(visible).not.toContain('leads this snapshot');
      expect(visible).not.toContain('one place above');
      expect(visible).not.toContain('/race');

      const strip = visible.match(/<nav class="strip" aria-label="All twelve signs">([\s\S]*?)<\/nav>/u)?.[1] ?? '';
      expect(strip.match(/class="strip__name"/gu)).toHaveLength(12);
      expect(strip.match(/\/assets\/zodiac-icons\/128\/[a-z-]+\.webp/gu)).toHaveLength(12);
    }

    const scorpio = await read('public/registry/scorpio/index.html');
    expect(scorpio).toContain('/assets/nuggets/scorpio.png?v=20260818');
    expect(scorpio).toContain('https://zodiacs.org/assets/nuggets/scorpio.png?v=20260818');
    for (const person of ['marie-curie', 'pablo-picasso', 'bill-gates', 'leonardo-dicaprio']) {
      expect(scorpio).toContain(`href="/people/${person}/"`);
    }
  });

  it('allows only the owner-authorized protected People links, each on its own sign', async () => {
    const peopleRelease = JSON.parse(await read('src/data/people.json'));
    const indexPolicy = JSON.parse(await read('docs/phase5/people-pilot/index-policy.json'));
    const peopleBySlug = new Map(peopleRelease.people.map((person) => [person.slug, person]));
    const expectedProtected = [
      'bad-bunny',
      'bill-gates',
      'erling-haaland',
      'harry-styles',
      'jenna-ortega',
      'kendrick-lamar',
      'kylie-jenner',
      'leonardo-dicaprio',
      'lisa',
      'max-verstappen',
      'mrbeast',
      'olivia-rodrigo',
      'rihanna',
      'sabrina-carpenter',
      'taylor-swift',
      'timothee-chalamet',
      'zendaya',
    ];
    const expectedSign = (personSlug) => (
      ['bill-gates', 'leonardo-dicaprio'].includes(personSlug) ? 'scorpio' : NEW_PROTECTED_SIGNS[personSlug]
    );
    const mapped = Object.entries(SIGN_PROFILE_PEOPLE).flatMap(([sign, personSlugs]) => (
      personSlugs.map((personSlug) => ({ sign, personSlug }))
    ));
    const mappedProtected = mapped.filter(({ personSlug }) => (
      !peopleBySlug.get(personSlug)?.indexEligibility.eligible
    ));

    expect(Object.keys(SIGN_PROFILE_PROTECTED_LINKS).sort()).toEqual(expectedProtected);
    const authorization = indexPolicy.expansion.personSpecificLinkAuthorization;
    expect([...authorization.profiles].sort()).toEqual(expectedProtected);
    expect(authorization.grants.flatMap((grant) => grant.profiles).sort()).toEqual(expectedProtected);
    expect(Object.fromEntries(Object.entries(authorization.surfaces).sort())).toEqual(Object.fromEntries(
      expectedProtected.map((personSlug) => [personSlug, `/registry/${expectedSign(personSlug)}/`]),
    ));
    expect([...mappedProtected].sort((a, b) => a.personSlug.localeCompare(b.personSlug)))
      .toEqual(expectedProtected.map((personSlug) => ({ sign: expectedSign(personSlug), personSlug })));

    for (const personSlug of expectedProtected) {
      expect(SIGN_PROFILE_PROTECTED_LINKS[personSlug]).toEqual({
        sign: expectedSign(personSlug),
        surface: `/registry/${expectedSign(personSlug)}/`,
        rel: 'nofollow',
      });
      const person = peopleBySlug.get(personSlug);
      expect(person?.living).toBe(true);
      expect(person?.indexEligibility.eligible).toBe(false);
      expect(registryProfilePersonLinkRel({
        sign: expectedSign(personSlug),
        person,
        policyAuthorization: indexPolicy.expansion.personSpecificLinkAuthorization,
      })).toBe('nofollow');
    }

    expect(() => registryProfilePersonLinkRel({
      sign: 'libra',
      person: peopleBySlug.get('serena-williams'),
      policyAuthorization: indexPolicy.expansion.personSpecificLinkAuthorization,
    })).toThrow('protected/non-indexable People records require exact, surface-specific authorization');
    expect(() => registryProfilePersonLinkRel({
      sign: 'libra',
      person: peopleBySlug.get('bill-gates'),
      policyAuthorization: indexPolicy.expansion.personSpecificLinkAuthorization,
    })).toThrow('protected/non-indexable People records require exact, surface-specific authorization');
    expect(registryProfilePersonLinkRel({
      sign: 'scorpio',
      person: peopleBySlug.get('marie-curie'),
      policyAuthorization: indexPolicy.expansion.personSpecificLinkAuthorization,
    })).toBeNull();

    for (const sign of signs) {
      const html = await read(`public/registry/${sign}/index.html`);
      const peopleMarkup = html.match(/<div class="people-block">([\s\S]*?)<\/div>\s*<\/section>/u)?.[1] ?? '';
      const nofollowLinks = peopleMarkup.match(/<a href="\/people\/[a-z0-9-]+\/" rel="nofollow">/gu) ?? [];
      expect(nofollowLinks).toHaveLength(expectedProtected.filter((personSlug) => expectedSign(personSlug) === sign).length);
      for (const personSlug of expectedProtected.filter((slug) => expectedSign(slug) === sign)) {
        {
          expect(peopleMarkup).toContain(
            `<a href="/people/${personSlug}/" rel="nofollow">`,
          );
        }
      }
    }
  });

  it('separates a live selected-token quote from the honestly labelled daily archive', async () => {
    const [source, leo] = await Promise.all([
      read('scripts/build-sign-pages.mjs'),
      read('public/registry/leo/index.html'),
    ]);

    for (const value of [source, leo]) {
      expect(value).toContain('https://api.dexscreener.com/tokens/v1/solana/');
      expect(value).toContain('data-live-price');
      expect(value).toContain('data-live-change');
      expect(value).toContain("pair.baseToken.address !== MINT");
      expect(value).toContain('if (marketStarted && !document.hidden) loadLiveQuote();');
      expect(value).toContain('function startMarketData()');
      expect(value).toContain('Last price shown. A newer price is temporarily unavailable.');
      expect(value).toContain('/assets/data/registry-market-history.v1.json');
      expect(value).toContain("archive.schema !== 'zodiacs.registry-market-history.v1'");
      expect(value).toContain("' daily price through '");
      expect(value).toContain("' daily prices through '");
      expect(value).toContain('One daily price is available. The chart will appear after the next one.');
      expect(value).toContain('if (finite.length < 2)');
      expect(value).not.toContain('if (finite.length < 8)');
      expect(value).toContain('Price history unavailable.');
      expect(value).toContain('seven.disabled = sevenPoints.length < 2');
      expect(value).toContain('gap > 1.5 * 86400000');
      expect(value).toContain("['Total market value', fmtCompact(asset.marketCapUsd)");
      expect(value).toContain("['Traded in 24 hours', fmtCompact(asset.volume24hUsd)");
      expect(value).toContain('data-chart-summary');
      expect(value).not.toContain('https://api.dexscreener.com/latest/dex/pairs/');
    }
    expect(leo).toContain('data-market-range="7d"');
    expect(leo).toContain('data-market-range="30d"');
    expect(leo).toContain('data-market-range="all"');
    expect(leo).toContain('View live chart ↗');
    expect(leo).toContain('The source reports each sign’s price, trading activity and total market value.');
    expect(leo).toContain('Where do these numbers come from?');
    expect(leo).toMatch(/data-market-foot>Updated [^<]+<\/div>/u);
    expect(leo).toContain('<noscript><style>.reveal { opacity: 1 !important;');
  });

  it('keeps small prices precise and emits no catalogue purchase handoff', async () => {
    const [source, scorpio] = await Promise.all([
      read('scripts/build-sign-pages.mjs'),
      read('public/registry/scorpio/index.html'),
    ]);
    // A daily quote may be missing or leave the sub-cent range. Exercise the
    // server formatter and the shipped live formatter with stable prices.
    const formatters = [priceFormatter(source, 'formatPrice'), priceFormatter(scorpio, 'fmtPrice', ['finiteNumber'])];
    for (const format of formatters) {
      for (const [value, expected] of [
        [0.00000001, '$0.00000001'], [0.00001234, '$0.00001234'],
        [0.00009999, '$0.00009999'], [0.0001, '$0.0001'],
        [0.001234, '$0.001234'], [0.01, '$0.01'],
      ]) {
        expect(format(value)).toBe(expected);
        expect(format(String(value))).toBe(expected);
      }
    }
    expect(source).not.toContain('wing_acquisition_click');
    expect(scorpio).not.toMatch(/href="https:\/\/jup\.ag\//u);
    expect(source).toContain('function canPublishRank(snapshot, standings)');
    expect(source).toContain('assetsWithMarketCap');
    expect(source).toContain("'Market rank unavailable'");
  });

  it('links every record to its constellation, collection, registry, and sign-filtered research', async () => {
    for (const sign of signs) {
      const html = await read(`public/registry/${sign}/index.html`);
      expect(html).toContain(`/assets/constellations/${sign}.svg`);
      expect(html).toContain('<a href="/astrofolio/">Astrofolio</a>');
      expect(html).toContain('<a href="/registry/">All signs</a>');
      expect(html).toContain(`/terminal/research/?sign=${sign}&amp;type=daily`);
      expect(html).toContain(`/terminal/research/?sign=${sign}`);
    }
  });

  it('emits the Guide bootstrap and parseable executable inline scripts on every record', async () => {
    for (const sign of signs) {
      const html = await read(`public/registry/${sign}/index.html`);
      const scripts = [...html.matchAll(/<script(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/giu)]
        .map((match) => match[1])
        .filter((script) => script.trim());
      // Tolerate the loader's cache tag: match the import specifier prefix
      // so a version bump cannot silently orphan this contract.
      const guideBootstrap = scripts.find((script) => script.includes("import('/assets/assistant-ui.js"));
      expect(guideBootstrap).toContain('return mod.bootstrapGuide(defaultLocale)');
      expect(guideBootstrap).toContain('return mod.openAssistant(');
      expect(html).toContain('data-guide-loader="zodiacs-guide-loader-v1"');
      expect(scripts).toEqual(expect.arrayContaining([
        expect.stringContaining("trackWingEvent('wing_record_view')"),
        expect.stringContaining("var ARCHIVE_URL = '/assets/data/registry-market-history.v1.json'"),
      ]));
      for (const script of scripts) {
        expect(() => new Function(script)).not.toThrow();
      }
    }
  });
});
