import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { renderStaticSeasonBag, stampAstrofolioSeason } from './stamp-astrofolio-season.mjs';

const registry = JSON.parse(await readFile(new URL('../public/registry/zodiacs.registry.json', import.meta.url), 'utf8'));
const bagRegion = (html) => html.slice(
  html.indexOf('<!-- astrofolio-season-bag:start -->'),
  html.indexOf('<!-- astrofolio-season-bag:end -->'),
);

describe('Astrofolio build-season stamp', () => {
  it('selects one seasonal identity package across icons, manifest, lockup and runway, and keeps the evergreen share card', () => {
    const card = 'https://zodiacs.org/assets/og/astrofolio/v6/faces.jpg';
    const source = [
      '<link rel="icon" href="/assets/astrofolio/v1/leo/favicon.svg" />',
      '<link rel="manifest" href="/assets/astrofolio/v1/leo/astrofolio.webmanifest" />',
      `<meta property="og:image" content="${card}" />`,
      `<meta name="twitter:image" content="${card}" />`,
      `<script type="application/ld+json">{"image":"${card}"}</script>`,
      '<img src="/assets/astrofolio/v1/leo/icon-192.png" alt="">',
      '<img src="/assets/astrofolio/v2/zodiac-ring-192.png" alt="">',
      '<strong data-astrofolio-season-name style="--season-hue:#E0A9B4">Leo</strong> Season',
      '<article class="campaign-look is-season" data-static-sign="leo" style="--sign:#E0A9B4">',
      '<article class="campaign-look" data-static-sign="virgo" style="--sign:#B7D9B0">',
      '<article class="campaign-look" data-static-sign="libra" style="--sign:#D3A9DE">',
    ].join('\n');
    const stamped = stampAstrofolioSeason(source, 'virgo');
    expect(stamped).not.toContain('/leo/');
    expect(stamped.match(/\/assets\/astrofolio\/v2\/virgo\//gu)).toHaveLength(3);
    expect(stamped.split(card)).toHaveLength(4);
    expect(stamped).not.toContain('/assets/og/astrofolio/v4/');
    expect(stamped).toContain('/assets/astrofolio/v2/zodiac-ring-192.png');
    expect(stamped).toContain('style="--season-hue:#B7D9B0">Virgo</strong> Season');
    expect(stamped).toContain('<article class="campaign-look" data-static-sign="leo"');
    expect(stamped).toContain('<article class="campaign-look is-season" data-static-sign="virgo"');
    expect(stamped.match(/campaign-look is-season/gu)).toHaveLength(1);

    const restamped = stampAstrofolioSeason(stamped, 'libra');
    expect(restamped).not.toContain('/virgo/');
    expect(restamped.match(/\/assets\/astrofolio\/v2\/libra\//gu)).toHaveLength(3);
    expect(restamped.split(card)).toHaveLength(4);
    expect(restamped).toContain('style="--season-hue:#D3A9DE">Libra</strong> Season');
    expect(restamped).toContain('<article class="campaign-look is-season" data-static-sign="libra"');
    expect(restamped.match(/campaign-look is-season/gu)).toHaveLength(1);
  });

  it('renders the no-JavaScript season bag from the Registry with the approved Fomo control', () => {
    const libra = registry.assets.find((asset) => asset.sign === 'libra');
    const bag = renderStaticSeasonBag(libra, '  ');
    expect(bag.split('\n').every((line) => line.startsWith('  '))).toBe(true);
    expect(bag).toContain('<aside class="campaign-bag campaign-bag--static" aria-label="Buy Libra" data-campaign-bag="libra" style="--sign:#D3A9DE">');
    expect(bag).toContain('<strong>Libra</strong><small><span>In season now</span></small>');
    expect(bag).toContain(`href="https://fomo.family/coin?address=${libra.native.address}&amp;chainId=1399811149"`);
    expect(bag).toContain('aria-label="Open Fomo to buy Libra" data-fomo-buy="libra"');
    expect(bag).toContain('<img src="/assets/venues/fomo-official.svg" width="34" height="34" alt="">');
    expect(bag).toContain('<small>Libra <span class="btn--fomo__zodiac-emoji" aria-hidden="true">♎️</span></small><strong>Buy with Fomo</strong>');
    expect(() => renderStaticSeasonBag({ sign: 'ophiuchus', displayName: 'Ophiuchus', representations: [] })).toThrow('Solana origin');
  });

  it('re-renders the committed season bag for the release season and refuses a shell without one', async () => {
    const shell = await readFile(new URL('../public/astrofolio/index.html', import.meta.url), 'utf8');
    const committed = bagRegion(shell);
    const committedSign = committed.match(/data-campaign-bag="([a-z]+)"/u)?.[1];
    expect(committedSign).toBeTruthy();
    // The committed bag is exactly what the stamp renders, so a release only
    // ever swaps one generated region.
    expect(committed).toContain(renderStaticSeasonBag(registry.assets.find((asset) => asset.sign === committedSign)));

    const stamped = stampAstrofolioSeason(shell, 'pisces', { registry });
    const bag = bagRegion(stamped);
    expect(bag.match(/data-fomo-buy="[a-z]+"/gu)).toEqual(['data-fomo-buy="pisces"']);
    expect(bag).toContain('aria-label="Buy Pisces"');
    expect(stamped.match(/campaign-look is-season/gu)).toHaveLength(1);
    expect(stamped).toContain('<article class="campaign-look is-season" data-static-sign="pisces"');
    expect(stampAstrofolioSeason(stamped, 'pisces', { registry })).toBe(stamped);

    const withoutBag = shell.replace(/<!-- astrofolio-season-bag:start -->[\s\S]*?<!-- astrofolio-season-bag:end -->/u, '');
    expect(() => stampAstrofolioSeason(withoutBag, 'pisces', { registry })).toThrow('season bag');
  });

  it('refuses an unrelated page rather than claiming a successful stamp', () => {
    expect(() => stampAstrofolioSeason('<h1>Terminal</h1>', 'leo')).toThrow('could not find');
  });
});
