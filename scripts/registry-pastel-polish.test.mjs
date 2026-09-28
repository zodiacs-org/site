import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const signs = [
  ['aries', 'Aries'],
  ['taurus', 'Taurus'],
  ['gemini', 'Gemini'],
  ['cancer', 'Cancer'],
  ['leo', 'Leo'],
  ['virgo', 'Virgo'],
  ['libra', 'Libra'],
  ['scorpio', 'Scorpio'],
  ['sagittarius', 'Sagittarius'],
  ['capricorn', 'Capricorn'],
  ['aquarius', 'Aquarius'],
  ['pisces', 'Pisces'],
];

const read = (path) => readFile(resolve(root, path), 'utf8');

function cssRule(source, selector) {
  const start = source.indexOf(selector);
  expect(start, `${selector} exists`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(start, close + 1);
}

describe('registry pastel polish', () => {
  it('uses canonical sign discs and gold artwork derivatives in the Campaign runway', async () => {
    const source = await read('src/app.jsx');
    const runway = source.slice(source.indexOf('    function CampaignRunway('), source.indexOf('\n    function CampaignApp('));
    const look = source.slice(source.indexOf('    function CampaignLook('), source.indexOf('\n    function CampaignRunway('));
    const bag = source.slice(source.indexOf('    function CampaignBag('), source.indexOf('\n    const ASTROFOLIO_SHOP_PRODUCTS'));
    expect(runway).toContain('src={`/assets/zodiac-icons/48/${item.asset.sign}.webp`}');
    expect(look).toContain('src={`/assets/sculptures/512/${slug}.webp`}');
    expect(look).toContain('srcSet={`/assets/sculptures/512/${slug}.webp 512w, /assets/sculptures/1024/${slug}.webp 1024w`}');
    expect(look).toContain('alt={`${item.name} Zodiac artwork`}');
    expect(look).toContain('src={`/assets/constellations/${slug}.svg`}');
    expect(bag).toContain('src={`/assets/zodiac-icons/128/${sign.asset.sign}.webp`}');
  });

  it('keeps every selector disc pastel, reserves the selected hue for atmosphere, and colors movement by direction', async () => {
    const [css, html] = await Promise.all([
      read('src/terminal/split-styles.css'),
      read('public/astrofolio/index.html'),
    ]);
    const campaign = css.slice(css.indexOf('/* Astrofolio · Campaign'));
    expect(campaign).toContain('--campaign-up: #8dd9ad;');
    expect(campaign).toContain('--campaign-down: #f28e87;');
    expect(campaign).toContain('.campaign-look .vitrine-price__movement.is-up { color: var(--campaign-up); }');
    expect(campaign).toContain('.campaign-look .vitrine-price__movement.is-down { color: var(--campaign-down); }');
    expect(campaign).toContain('.campaign-bag__move.is-up { color: var(--campaign-up); }');
    expect(campaign).toContain('.campaign-bag__move.is-down { color: var(--campaign-down); }');
    const disc = cssRule(campaign, '.campaign-dot img {');
    expect(disc).toContain('border-radius: 50%;');
    expect(disc).not.toMatch(/filter|grayscale/u);
    const ring = cssRule(campaign, '.campaign-dot::after {');
    expect(ring).toContain('border: 1px solid var(--sign);');
    expect(ring).toContain('border-radius: 50%;');
    expect(campaign).toContain('.campaign-dot.is-active::after { opacity: 1; }');
    expect(campaign).toContain('.campaign-runway__dots:has(.campaign-dot:focus-visible) .campaign-dot::after { transition: none; }');
    const lookGlow = cssRule(campaign, '\n    .campaign-look {');
    expect(lookGlow).toContain('color-mix(in srgb, var(--sign) 9%, transparent)');
    expect(cssRule(css, '.consumer-registry .astrofolio-lockup__avatar {')).toContain('radial-gradient(circle, #010204');
    expect(cssRule(html, '.static-astrofolio-lockup > img {')).toContain('radial-gradient(circle, #010204');
    expect(html).toContain('<img class="campaign-look__stars" src="/assets/constellations/leo.svg"');
    expect(html).not.toContain('class="static-snapshot"');
    expect(campaign).not.toContain('var(--gold)');
    expect(campaign).not.toContain('var(--gold-bright)');
    expect(campaign).not.toContain('var(--gold-deep)');
    expect(campaign).not.toMatch(/215, ?173, ?105/u);
  });

  it('keeps all twelve signs reachable and gives the final Astrofolio market gateway touch-safe chrome', async () => {
    const css = await read('src/terminal/split-styles.css');
    const campaign = css.slice(css.indexOf('/* Astrofolio · Campaign'));
    const dots = cssRule(campaign, '.campaign-runway__dots {');
    const gateway = cssRule(css, '.consumer-market-gateway__action {');
    const staticShopImage = cssRule(css, '.consumer-static .static-shop__image {');
    const staticShopAsset = cssRule(css, '.consumer-static .static-shop__image img {');

    expect(dots).toContain('--campaign-dot-columns: 12;');
    expect(dots).toContain('grid-template-columns: repeat(var(--campaign-dot-columns), 44px);');
    expect(cssRule(campaign, '.campaign-dot {')).toContain('width: 44px;');
    expect(cssRule(campaign, '.campaign-dot {')).toContain('height: 44px;');
    expect(campaign).toContain('.campaign-runway__dots { --campaign-dot-columns: 6; grid-template-columns: repeat(6, minmax(44px, 1fr)); gap: 2px; }');
    expect(campaign).toContain('.campaign-dot { width: 100%; height: 48px; border-radius: 14px; }');
    expect(cssRule(campaign, '.campaign-runway[data-mode="carousel"] .campaign-runway__track {')).toContain('scroll-snap-type: x mandatory;');
    expect(css).not.toContain('.consumer-registry .vitrine-disc-picker');

    expect(gateway).toContain('min-height: 52px;');
    expect(gateway).toContain('border-radius: 999px;');
    expect(gateway).toContain('text-decoration: none;');
    expect(css).not.toContain('.consumer-registry .vitrine-official-note');
    expect(staticShopImage).toContain('width: 100%;');
    expect(staticShopImage).toContain('max-width: 100%;');
    expect(staticShopImage).toContain('overflow: hidden;');
    expect(staticShopAsset).toContain('width: 100%;');
    expect(staticShopAsset).toContain('height: auto;');
  });

  it('keeps the sign-hued artwork glow, neutral Explore chrome, and branded Fomo action', async () => {
    const css = await read('src/terminal/split-styles.css');
    const campaign = css.slice(css.indexOf('/* Astrofolio · Campaign'));
    const explore = cssRule(campaign, '.campaign-look__explore {');
    const fomo = cssRule(campaign, '.consumer-registry .btn.btn--fomo,');
    const fomoIcon = cssRule(campaign, '.consumer-registry .btn--fomo img,');
    const leaderboardIconShell = cssRule(css, '.consumer-market-leaderboard__icon {');
    const leaderboardIcon = cssRule(css, '.consumer-market-leaderboard__icon img {');
    expect(cssRule(campaign, '.campaign-look__figure {')).toContain('filter: drop-shadow(0 26px 30px rgba(0,0,0,.75));');
    expect(explore).toContain('color: var(--ink-2);');
    expect(explore).toContain('min-height: 44px;');
    expect(fomo).toContain('height: 48px;');
    expect(fomo).toContain('justify-content: flex-start;');
    expect(fomo).toContain('border: 1px solid rgba(255,255,255,.78);');
    expect(fomo).toContain('border-radius: 999px;');
    expect(fomo).toContain('#f1f0ec;');
    expect(fomo).toContain('color: #111318;');
    expect(fomo).not.toMatch(/--active-sign|--sign|215, 173, 105/u);
    expect(fomoIcon).toContain('width: 34px;');
    expect(fomoIcon).toContain('height: 34px;');
    expect(leaderboardIconShell).toContain('flex: 0 0 34px;');
    expect(leaderboardIconShell).toContain('width: 34px;');
    expect(leaderboardIconShell).toContain('height: 34px;');
    expect(leaderboardIcon).toContain('filter: none;');
    expect(leaderboardIcon).toContain('border-radius: 50%;');
    expect(css).toContain('.consumer-market-leaderboard__icon { width: 34px; height: 34px; flex-basis: 34px; }');
    expect(css).toContain('.btn--fomo__arrow {');
    expect(css).toContain('flex: 0 0 31px;');
    expect(css).toContain('.btn--fomo__arrow { width: 31px; height: 31px; flex-basis: 31px; }');
    expect(css).toContain('.btn--fomo__zodiac-emoji {');
    expect(css).toContain('font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;');
    expect(css).toContain('font-size: 14px;');
    expect(css).toContain('filter: saturate(1.32) hue-rotate(-8deg) brightness(.78) contrast(1.8);');
    expect(css).toContain('transform: translateY(-.5px);');
    expect(css).toContain('@media (hover: hover) and (pointer: fine) {');
    expect(campaign).toContain('.consumer-registry .vitrine-buy-options,');
  });

  it('pins the Campaign typography roles and removes consumer mono-caps labels', async () => {
    const css = await read('src/terminal/split-styles.css');
    const campaign = css.slice(css.indexOf('/* Astrofolio · Campaign'));
    expect(cssRule(css, '.consumer-registry .terminal-consumer-hero__kicker {')).toContain('font: italic 500');
    expect(cssRule(campaign, '.campaign-hero__word {')).toContain('var(--serif)');
    expect(cssRule(campaign, '.campaign-hero__caption h1 {')).toContain('var(--serif)');
    expect(cssRule(campaign, '.campaign-runway__head h2 {')).toContain('var(--serif)');
    expect(cssRule(campaign, '.campaign-look h3 {')).toContain('var(--serif)');
    expect(cssRule(css, '.consumer-registry .consumer-section-head h2,')).toContain('var(--serif)');
    expect(cssRule(campaign, '.campaign-look .vitrine-price__figure {')).toContain('var(--mono)');
    expect(cssRule(campaign, '.campaign-look .vitrine-price__figure {')).toContain('font-variant-numeric: tabular-nums;');
    expect(cssRule(campaign, '.campaign-button {')).toContain('var(--sans)');
    // Phones: the headline becomes a tracked sans line above the serif name.
    const phoneCaption = campaign.slice(campaign.indexOf('/* The phone opening ends like a campaign page'));
    expect(cssRule(phoneCaption, '.campaign-hero__caption h1 {')).toContain('text-transform: uppercase;');
    expect(cssRule(phoneCaption, '.campaign-hero__caption h1 {')).toContain('var(--sans)');
    expect(cssRule(phoneCaption, '.campaign-hero__caption > .campaign-hero__name {')).toContain('var(--serif)');
    expect(cssRule(phoneCaption, '.campaign-discover__pill {')).toContain('min-height: 44px;');
    expect(campaign).toContain('.campaign-hero__caption > .campaign-hero__name,\n    .campaign-discover { display: none; }');
    expect(cssRule(campaign, '.campaign-alert figcaption strong {')).toContain('var(--serif)');
    expect(campaign).toContain('.campaign-alert figcaption span { max-width: 40ch; color: var(--ink-2); font: 400 16.5px/1.6 var(--sans); }');
    const eyebrow = cssRule(campaign, '.consumer-campaign .consumer-eyebrow,');
    expect(eyebrow).toContain('font: italic 400');
    expect(eyebrow).toContain('var(--serif)');
    expect(eyebrow).toContain('letter-spacing: 0;');
    expect(eyebrow).toContain('text-transform: none;');
    expect(css).toContain('.consumer-registry .consumer-section-head__eyebrow { display: none; }');
  });

  it('pins opacity-only film fades, stable stage geometry, and quiet entrances', async () => {
    const css = await read('src/terminal/split-styles.css');
    const campaign = css.slice(css.indexOf('/* Astrofolio · Campaign'));
    const reveal = cssRule(css, '.consumer-registry .reveal {');
    expect(reveal).toContain('transition: opacity 240ms linear !important;');
    expect(reveal).toContain('transform: none !important;');
    expect(reveal).toContain('filter: none !important;');
    const film = cssRule(campaign, '.campaign-hero__film {');
    expect(film).toContain('aspect-ratio: 9 / 16;');
    expect(film).toContain('transform: translate(-50%, -50%) scale(var(--hero-scale, 1));');
    expect(campaign).toContain('.campaign-hero__video { opacity: 0; transition: opacity 560ms ease; }');
    expect(cssRule(campaign, '.campaign-phone__video {')).toContain('transition: opacity 560ms ease;');
    const pin = cssRule(campaign, '.campaign-hero__pin {');
    expect(pin).toContain('--film-w: min(27vw, 40vh);');
    expect(pin).toContain('position: sticky;');
    expect(pin).toContain('height: 100vh;');
    expect(cssRule(campaign, '.campaign-runway[data-mode="pinned"] .campaign-runway__pin {')).toContain('height: 100vh;');
    expect(campaign).toContain('.campaign-hero__pin { position: relative; height: 100svh; min-height: 560px; }');
    expect(campaign).toContain('.campaign-look { flex-basis: min(84vw, 380px); padding: 20px 18px 12px; }');
  });

  it('pins the press responses and disables all consumer motion on request', async () => {
    const css = await read('src/terminal/split-styles.css');
    const campaign = css.slice(css.indexOf('/* Astrofolio · Campaign'));
    expect(campaign).toContain('.campaign-button:active { transform: scale(.98); }');
    expect(campaign).toContain('.static-campaign .btn.btn--fomo:active { transform: scale(.975); transition-duration: 120ms; }');
    expect(css).toContain('.consumer-registry .vrf__submit:active,');
    expect(css).toContain('.consumer-registry .vrf__example:active { transform: scale(.98); }');
    const consumerReduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n      .wnav-tools,'));
    expect(consumerReduced).toContain('animation: none !important;');
    expect(consumerReduced).toContain('transition: none !important;');
    expect(consumerReduced).toContain('.consumer-registry .reveal { opacity: 1; }');
    expect(consumerReduced).toContain('.consumer-registry .vrf__example:active,');
    expect(consumerReduced).toContain('.consumer-registry .consumer-purpose__arrow,');
    expect(consumerReduced).toContain('.consumer-market-gateway__action:active { transform: none; }');
    const campaignReduced = campaign.slice(campaign.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(campaignReduced).toContain('.static-campaign *,');
    expect(campaignReduced).toContain('animation: none !important;');
    expect(campaignReduced).toContain('transition: none !important;');
    expect(campaignReduced).toContain('.campaign-button:active,');
    expect(campaignReduced).toContain('.consumer-registry .btn.btn--fomo:active,');
    // Reduced motion also keeps the film still and the runway unpinned.
    const stack = campaign.slice(campaign.indexOf('/* Phones: as the page moves on, the film stays in place and dims'), campaign.indexOf('@media (min-width: 601px) and (max-width: 900px)'));
    // The opening is one small-viewport screen tall, so the beats are set
    // against that span, which holds still while a phone's toolbar comes and
    // goes. The swipeable track never scrolls vertically.
    expect(stack).toContain('.campaign-stack { position: relative; --stack-span: max(100svh, 560px); }');
    expect(stack).toContain('.campaign-stack > .campaign-runway[data-mode="carousel"] .campaign-runway__track { overflow-y: hidden; }');
    // Every beat is a scroll-driven animation on the page's own scroll, set
    // only where the browser runs them and motion is welcome. Everywhere else
    // the opening scrolls away before the runway as a plain column.
    const beats = stack.slice(stack.indexOf('@supports (animation-timeline: scroll()) and (animation-range: 0% 100%) {'), stack.indexOf('@media (max-width: 900px) and (prefers-reduced-motion: reduce) {'));
    expect(beats).toContain('@supports (animation-timeline: scroll()) and (animation-range: 0% 100%) {\n      @media (max-width: 900px) and (prefers-reduced-motion: no-preference) {\n        .campaign-stack > .campaign-hero { position: sticky; top: 0; z-index: 0; }');
    expect(stack.slice(0, stack.indexOf('@supports (animation-timeline: scroll()) and (animation-range: 0% 100%) {'))).not.toContain('position: sticky');
    expect(beats).toContain('animation: campaign-film-dim linear both;\n          animation-timeline: scroll(root);\n          animation-range: 0 calc(var(--stack-span) * .56);');
    expect(beats).toContain('animation: campaign-caption-fade linear both, campaign-caption-lift linear both;\n          animation-timeline: scroll(root), scroll(root);\n          animation-range: 0 calc(var(--stack-span) * .38), 0 var(--stack-span);');
    // The looks rise as one track, easing out, so they arrive fast and
    // settle; the disc row follows them in.
    expect(beats).toContain('.campaign-stack > .campaign-runway[data-mode="carousel"] .campaign-runway__track {\n          animation: campaign-runway-rise cubic-bezier(.215, .61, .355, 1) both;\n          animation-timeline: scroll(root);\n          animation-range: calc(var(--stack-span) * .3) calc(var(--stack-span) * .8);');
    expect(beats).toContain('.campaign-stack > .campaign-runway[data-mode="carousel"] .campaign-runway__dots {\n          animation: campaign-dots-in linear both;\n          animation-timeline: scroll(root);\n          animation-range: calc(var(--stack-span) * .55) calc(var(--stack-span) * .85);');
    expect(beats).not.toContain('.campaign-look');
    expect(stack).toContain('@keyframes campaign-film-dim { from { opacity: 0; } to { opacity: .9; } }');
    expect(stack).toContain('@keyframes campaign-caption-fade { from { opacity: 1; } to { opacity: 0; } }');
    expect(stack).toContain('@keyframes campaign-caption-lift { from { transform: none; } to { transform: translateY(-30vh); } }');
    expect(stack).toContain('@keyframes campaign-runway-rise { from { transform: translateY(48vh); } to { transform: none; } }');
    expect(stack).toContain('@keyframes campaign-dots-in { from { opacity: 0; } to { opacity: 1; } }');
    // Nothing reads values a script writes per frame, and nothing is timed.
    for (const retired of ['var(--stack,', 'var(--rise', '--look-rise', '--rise-order', 'data-rise', 'scale(calc(1 - var(--stack']) {
      expect(stack).not.toContain(retired);
    }
    expect(stack).toContain('@media (max-width: 900px) and (prefers-reduced-motion: reduce) {\n      .campaign-discover__cue { animation: none; }');
    const stillFilm = campaign.slice(campaign.indexOf('@media (min-width: 901px) and (prefers-reduced-motion: reduce)'));
    expect(stillFilm).toContain('.campaign-hero { height: auto; }');
    expect(stillFilm).toContain('.campaign-hero__pin { position: relative; }');
    const source = await read('src/app.jsx');
    expect(source).toContain("const CAMPAIGN_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';");
    expect(source).toContain('return matchesMedia(CAMPAIGN_WIDE_QUERY) && !matchesMedia(CAMPAIGN_REDUCED_MOTION_QUERY);');
  });

  it('fits one look per phone screen and changes sign from the bag', async () => {
    const campaign = await read('src/terminal/split-styles.css');
    const phone = campaign.slice(campaign.indexOf('/* Phones: one look per screen, after rolex.com'), campaign.indexOf('/* The bag\'s sign opens a sheet of all twelve (phones). */'));
    expect(phone).toContain('@media (max-width: 900px) {');
    // The heading stays for screen readers; the discs take one slim row.
    expect(phone).toContain('.campaign-runway__head > div:first-child {');
    expect(phone).toContain('clip-path: inset(50%);');
    expect(phone).toContain('.campaign-runway__dots { --campaign-dot-columns: 12; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 0; }');
    expect(phone).toContain('.campaign-dot { height: 44px; border-radius: 12px; }');
    // Each look is sized to the screen, above the bag.
    expect(phone).toContain('--look-top: 92px;');
    expect(phone).toContain('--look-room: calc(var(--look-top) + 44px + 24px + 92px + env(safe-area-inset-bottom, 0px));');
    // The phone top bar slides away on the way down, so the runway keeps no
    // clearance for it there.
    expect(phone).toContain('@media (max-width: 599.5px) {\n      .campaign-runway { --look-top: max(16px, env(safe-area-inset-top, 0px)); }\n      .campaign-stack > .campaign-runway .campaign-runway__pin { padding-top: var(--look-top); }');
    expect(phone).toContain('height: clamp(360px, calc(100svh - var(--look-room)), 640px);');
    expect(phone).toContain('.campaign-look h3 { order: 2;');
    // Buying is the bag's job; the whole look opens its page.
    expect(phone).toContain('.campaign-look__actions > .btn--fomo,\n      .campaign-look > .vitrine-buy-options { display: none; }');
    expect(phone).toContain('.campaign-look__explore {\n        position: absolute;\n        z-index: 3;\n        inset: 0;');
    expect(phone).toContain('.campaign-look .campaign-spark { display: none; }');
    const sheet = campaign.slice(campaign.indexOf('/* The bag\'s sign opens a sheet of all twelve (phones). */'), campaign.indexOf('@media (min-width: 601px) and (max-width: 900px)'));
    expect(sheet).toContain('.campaign-bag__pick {\n      min-height: 48px;');
    // The caret rides beside the name and steps aside for a long one, so
    // neither the name nor the status line gives up width to it.
    expect(sheet).toContain('.campaign-bag__name { min-width: 0; height: 20px; display: flex; flex-wrap: wrap; align-items: center; column-gap: 6px; overflow: hidden; }');
    expect(sheet).toContain('.campaign-sheet__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }');
    expect(sheet).toContain('.campaign-sheet__sign {\n      min-height: 84px;');
    expect(sheet).toContain('.campaign-sheet__close {\n      width: 44px;\n      height: 44px;');
    expect(sheet).toContain('.campaign-sheet[open] .campaign-sheet__panel { animation: campaign-sheet-up 420ms cubic-bezier(.16, 1, .3, 1); }');
    expect(sheet).toContain('html.has-campaign-sheet { overflow: hidden; }');
    expect(sheet).toContain('@media (prefers-reduced-motion: reduce) {\n      .campaign-sheet[open] .campaign-sheet__panel,\n      .campaign-sheet[open]::backdrop { animation: none; }');
  });

  it('uses deliberate hierarchy hairlines and one editorial market gateway', async () => {
    const [source, css] = await Promise.all([
      read('src/app.jsx'),
      read('src/terminal/split-styles.css'),
    ]);
    expect(source.slice(source.indexOf('    function CampaignApp('), source.indexOf('\n    function CampaignBag('))).toContain('data-vitrine-rule');
    expect(source.slice(source.indexOf('    function ConsumerShop('), source.indexOf('\n    function ConsumerCabinet('))).toContain('data-vitrine-rule');
    expect(source.slice(source.indexOf('    function ConsumerRegistryGuide('), source.indexOf('\n    function ConsumerStory('))).toContain('data-vitrine-rule');
    expect(css).toContain('.consumer-registry > [data-vitrine-rule]::before {');
    expect(css).toContain('height: 1px;');
    const sections = cssRule(css, '.consumer-registry > .consumer-buy,');
    expect(sections).toContain('border: 0;');
    expect(sections).toContain('background: transparent;');
    expect(sections).toContain('box-shadow: none;');
    expect(css).toContain('--gold: var(--ink-2);');
    expect(css).toContain('--gold-bright: var(--ink);');
    expect(css).toContain('outline-color: var(--ink-2);');
    expect(css).not.toContain('outline-color: var(--active-sign');
    expect(css).toContain('grid-template-columns: minmax(0, 1.06fr) minmax(0, .94fr);');
    expect(css).toContain('.consumer-registry .consumer-thesis { border-radius: 24px 24px 6px 24px; }');
    expect(css).toContain('aspect-ratio: 16 / 9;');
    expect(css).toContain('@media (max-width: 1020px) {');
    expect(css).toContain('.consumer-registry .consumer-thesis__visual { aspect-ratio: 16 / 10; }');
    expect(css).not.toContain('min-height: clamp(520px, 50vw, 620px);');
    expect(css).toContain('.consumer-market-gateway__shell {');
    expect(css).toContain('grid-template-columns: minmax(0, 1.12fr) minmax(350px, .88fr);');
    expect(css).toContain('border-radius: 26px 26px 7px 26px;');
    expect(css).toContain('.consumer-market-gateway__action.is-primary:visited { color: #111318; }');
    expect(css).toContain('.consumer-registry .ftr .mark .g { color: var(--ink-2); }');
    expect(css).toContain('.consumer-registry .consumer-thesis__link:hover .consumer-thesis__visual img { transform: none; }');
    expect(cssRule(css, '.consumer-registry .consumer-thesis__visual img {')).not.toContain('grayscale');
    expect(cssRule(css, '.consumer-registry .consumer-purpose__cta {')).toContain('border-radius: 999px;');
    expect(cssRule(css, '.consumer-registry .consumer-story__cta {')).toContain('width: fit-content;');
    expect(cssRule(css, '.consumer-registry .consumer-story__cta {')).not.toContain('background: transparent;');
    expect(cssRule(css, '.consumer-registry .consumer-purpose__arrow {')).toContain('border-radius: 50%;');
  });

  it('keeps the committed collection flag off and its generator slots inert', async () => {
    const html = await read('public/astrofolio/index.html');
    expect(html).toContain('<meta name="zodiacs-registry-collection-enabled" content="0" />');
    expect(html).toContain('<div hidden aria-hidden="true"><!-- registry-collection-hero:slot --></div>');
    expect(html).toContain('<div hidden aria-hidden="true"><!-- registry-collection-entry:slot --></div>');
  });

  it('keeps the wing nav on the shared compact and desktop geometry contract', async () => {
    const [wingNav, astrofolio, terminal, markets, thesis, sdk, technical, source, siteNav] = await Promise.all([
      read('scripts/wing-nav.mjs'),
      read('public/astrofolio/index.html'),
      read('public/terminal/index.html'),
      read('public/terminal/markets/index.html'),
      read('public/thesis/index.html'),
      read('public/sdk/index.html'),
      read('public/registry/technical/index.html'),
      read('src/app.jsx'),
      read('src/components/SiteNav.astro'),
    ]);

    // Phones: every copy turns the pill into a full-width bar at the top edge
    // that slides away on the way down: the menu on the left, the
    // ZODIACS | ASTROFOLIO lockup on the centre line, search on the right.
    // The static pages carry the shared script; the hub SPA's Header sets
    // .is-away itself.
    for (const value of [wingNav, astrofolio, terminal, markets, thesis, sdk, technical]) {
      expect(value).toContain('@media (max-width: 599.5px) {\n    .wnav-wrap { top: 0; padding-top: 0; transition: transform 360ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease; }');
      expect(value).toContain('.wnav-wrap.is-away { transform: translateY(-100%); opacity: 0; }');
      expect(value).toContain("html body .wnav-wrap .wnav { --wnav-lockup: clamp(12px, 3.8vw, 15px); display: grid; grid-template-areas: 'menu . mark chip . search'; grid-template-columns: 44px minmax(0,1fr) calc(var(--wnav-lockup) * 5.7 + 13px) calc(var(--wnav-lockup) * 8.27 + 13px) minmax(0,1fr) 44px; box-sizing: border-box; width: 100%; height: calc(52px + env(safe-area-inset-top, 0px));");
      expect(value).toContain('border-width: 0 0 1px; border-radius: 0; box-shadow: none; }');
      expect(value).toContain('.wnav__burger { grid-area: menu; border-color: transparent; }');
      expect(value).toContain(".wnav__burger:not([aria-expanded='true']) .wnav__burger-line:nth-child(2) { opacity: 0; }");
      expect(value).toContain('.wnav__mark { grid-area: mark; min-height: 44px; gap: 0; padding: 0 calc(13px - 0.2em) 0 0.2em; font-size: var(--wnav-lockup); }');
      expect(value).toContain('.wnav__chip { grid-area: chip; position: relative; padding: 0 0 0 13px; border-left: 0; font-size: var(--wnav-lockup); letter-spacing: 0.2em; line-height: 1; }');
      expect(value).toContain(".wnav__chip::before { content: ''; position: absolute; left: 0; top: 50%; width: 1px; height: 15px;");
      expect(value).toContain('.wnav__search { grid-area: search; }');
      expect(value).toContain('@media (max-width: 599.5px) and (prefers-reduced-motion: reduce) { .wnav-wrap { transition: none; } }');
    }
    for (const value of [wingNav, markets, thesis, sdk]) {
      expect(value).toContain("var phone = window.matchMedia('(max-width: 599.5px)');");
      expect(value).toContain("if(!phone.matches || y < 64 || held()){ set(false); last = y; return; }");
      expect(value).toContain("wrap.classList.toggle('is-away', next);");
    }
    expect(source).toContain("const PHONE_BAR_QUERY = '(max-width: 599.5px)';");
    expect(source).toContain('<div className="wnav-wrap" ref={wrapRef}>');
    const header = source.slice(source.indexOf('function Header() {'), source.indexOf('\n    function ', source.indexOf('function Header() {')));
    expect(header).toContain("wrap.classList.toggle('is-away', next);");
    expect(header).toContain("|| root.classList.contains('has-campaign-sheet')");
    expect(siteNav).toContain(":global(html:not([data-chart-share-receiver])) .nav-wrap.is-away { transform: translateY(-100%); opacity: 0; }");
    expect(siteNav).toContain("grid-template-areas: 'menu . mark chip . search';");
    expect(siteNav).toContain("grid-template-areas: 'menu . mark chip . .';");
    expect(siteNav).toContain('grid-template-columns: 44px minmax(0, 1fr) calc(var(--nav-lockup) * 5.7 + 13px) calc(var(--nav-lockup) * 8.27 + 13px) minmax(0, 1fr) 44px;');
    expect(siteNav).toContain(":global(html:not([data-chart-share-receiver])) .nav__chip::before {");
    expect(siteNav).toContain(":global(html:not([data-chart-share-receiver])) .nav__burger:not([aria-expanded='true']) .nav__burger-line:nth-child(2) { opacity: 0; }");
    expect(siteNav).toContain("var phone = window.matchMedia('(max-width: 599.5px)');");
    expect(siteNav).toContain("if (!wrap || !window.matchMedia || root.hasAttribute('data-chart-share-receiver')) return;");

    for (const value of [wingNav, astrofolio, terminal, markets, thesis, sdk, technical]) {
      expect(value).toContain('height: 52px; padding: 0 10px 0 20px;');
      expect(value).toContain('gap: 10px;');
      expect(value).toContain('@media (min-width: 820px) { .wnav { gap: 10px; } }');
      expect(value).toContain('@media (min-width: 900px) { .wnav { gap: 18px; } }');
      expect(value).toContain('rgba(198,204,218,0.16)');
      expect(value).toContain('width: 18px; height: 1.5px;');
      expect(value).toContain('position: absolute; top: 50%; left: 50%;');
      expect(value).toContain('translate(-50%, calc(-50% - 5px))');
      expect(value).toContain('translate(-50%, calc(-50% + 5px))');
      expect(value).toContain('transform 220ms cubic-bezier(0.77,0,0.175,1)');
      expect(value).toContain('letter-spacing: 0.14em;');
      expect(value).toMatch(/@media \(min-width: 820px\) \{ \.wnav__chip \{ (?:(?:min-)?height: 34px; )?letter-spacing: 0\.14em; \} \}/u);
      expect(value).toContain('@media (max-width: 819.5px) { .wnav__sep, .wnav__dim { display: none; } }');
      expect(value).toContain('padding-top: env(safe-area-inset-top);');
      expect(value).toContain('border: 1px solid rgba(198,204,218,0.16);');
      expect(value).toContain('border-left: 1px solid rgba(198,204,218,0.16);');
      expect(value).toContain('wnav-menu__registry');
      expect(value).toContain('wnav-menu__tools');
      expect(value).toContain('wnav-menu__tool');
      expect(value).toContain('background: rgba(6,7,9,0.88)');
      expect(value).toContain('padding: calc(96px + env(safe-area-inset-top)) 24px 40px;');
      expect(value).not.toContain('.wnav-menu > nav { max-width: 520px; margin: 0 auto; }');
      expect(value).not.toContain('@keyframes wnav-in');
    }
    for (const value of [wingNav, astrofolio, thesis]) {
      expect(cssRule(value, '.wnav__burger {')).toContain('width: 44px; height: 44px;');
      expect(value).toMatch(/@media \(max-width: 819\.5px\)\s*\{[\s\S]{0,260}\.wnav__search\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/u);
      expect(cssRule(value, '.wnav__chip {')).toMatch(/(?:min-)?height:\s*44px;/u);
      expect(value).toContain('@media (max-width: 360px) {');
      expect(value).toContain('.wnav { gap: 4px; padding: 0 4px 0 10px; }');
      expect(value).toContain('.wnav__name { font-size: 11px; letter-spacing: 0.08em; }');
      expect(value).toContain('.wnav__chip { padding: 0 0 0 7px; font-size: 11px; letter-spacing: 0.04em; }');
    }
    for (const value of [wingNav, thesis]) {
      expect(value).toContain('<a class="wnav__link" href="/today/">Today</a>');
      expect(value).toContain('<a class="wnav-menu__link" style="--i:0" href="/today/">Today</a>');
    }
    for (const value of [wingNav, thesis, sdk]) expect(value).toContain('>Tools</span>');
    for (const [href, name] of [
      ['/birth-chart/', 'Birth chart'],
      ['/compatibility/', 'Compatibility'],
      ['/transits/', 'Transits'],
      ['/moon-sign/', 'Moon sign'],
      ['/rising-sign/', 'Rising sign'],
      ['/moon-phase/', 'Moon phase'],
      ['/saturn-return/', 'Saturn return'],
      ['/birthday/', 'Birthday'],
    ]) {
      expect(wingNav).toContain(`{ href: '${href}', name: '${name}', description:`);
      expect(source).toContain(`{ href: '${href}', name: '${name}', description:`);
      for (const output of [thesis, sdk]) {
        expect(output).toContain(`href="${href}" aria-label="${name}.`);
        expect(output).toContain(`>${name}</a>`);
      }
    }
    for (const output of [thesis, sdk]) {
      expect(output).toContain('class="wnav-menu__sign" style="--i:0;--sign:#DE8E79"');
      expect(output).toContain('class="wnav-menu__sign" style="--i:11;--sign:#A9D4C4"');
    }
    expect(thesis).toContain('<a class="wnav__chip" href="/astrofolio/">Astrofolio</a>');
    expect(thesis).toContain('<span>Astrofolio</span><small>The twelve Zodiac signs</small>');
    expect(thesis).not.toContain('<a class="wnav__chip" href="/terminal/">Terminal</a>');
    expect(siteNav).toContain('.mobile-menu__tool:last-child { border-bottom: 0; }');
    expect(source).toContain('<span className="wnav__sep">·</span><span className="wnav__dim">org</span>');
    expect(source).toContain('<span className="wnav-menu__label">Tools</span>');
    expect(source).toContain('wnav-menu__registry');
    expect(source).toContain('className="wnav-menu__tool"');
  });

  it('paints technical market direction after generic values and includes a flat state', async () => {
    const [source, registry] = await Promise.all([
      read('src/app.jsx'),
      read('public/terminal/index.html'),
    ]);

    expect(source.match(/market__change--flat/g)?.length).toBeGreaterThanOrEqual(2);
    expect(registry).toContain('--market-up:     #A9D4C4;');
    expect(registry).toContain('--market-flat:   #8E96AB;');
    const valueRule = registry.indexOf('.standings__v {');
    const directionRule = registry.indexOf('.market__change--up {', valueRule);
    expect(valueRule).toBeGreaterThan(-1);
    expect(directionRule).toBeGreaterThan(valueRule);
    expect(registry.slice(directionRule)).toContain('.market__change--down { color: var(--vermilion); }');
    expect(registry.slice(directionRule)).toContain('.market__change--flat { color: var(--market-flat); }');
  });

  it.each(signs)('renders the %s token record in plain language with market and constellation context', async (slug, name) => {
    const html = await read(`public/registry/${slug}/index.html`);
    const title = `<h1 class="lot__title" id="lot-title">${name} <picture class="lot__title-icon" aria-hidden="true">`;

    expect(html).toContain(title);
    expect(html).toContain(`srcset="/assets/zodiac-icons/400/${slug}.avif"`);
    expect(html).toContain(`src="/assets/zodiac-icons/400/${slug}.webp"`);
    expect(html).toContain('width="112" height="112" alt=""');
    expect(html).not.toContain('class="lot__icon"');
    expect(html).not.toContain('<span class="glyph">');
    expect(html).toContain('padding: calc(94px + env(safe-area-inset-top)) 0 36px;');
    expect(html).toContain(`<span class="lot__eyebrow">Zodiac sign <span class="g">·</span>`);
    expect(html).toContain(`data-share-sign>Share ${name}</button>`);
    expect(html).not.toContain('data-copy-identity');
    expect(html).toContain("@font-face { font-family: 'Instrument Sans';");
    expect(cssRule(html, 'html, body {')).toContain('font-family: var(--sans);');
    expect(cssRule(html, '.lot__title {')).toContain('font-family: var(--sans);');
    expect(cssRule(html, '.sec__title {')).toContain('font-family: var(--sans);');
    expect(cssRule(html, '.sec__title {')).toContain('text-transform: none;');
    expect(cssRule(html, '.record-detail__title {')).toContain('font-family: var(--sans);');
    expect(cssRule(html, '.ftr {')).toContain('font-family: var(--sans);');
    expect(cssRule(html, '.ftr {')).toContain('letter-spacing: 0;');
    expect(html).toContain('.lot__eyebrow, .lot__intro, .lot__dates, .sec__title,');
    expect(html).toContain('font-family: var(--sans); font-style: normal;');
    expect(html).not.toContain('not a physical sculpture or a one-of-one NFT');
    for (const heading of [
      `${name} at a glance`,
      `The ${name} token`,
      'Supply &amp; ownership',
      `Born under ${name}`,
      `${name} today`,
      'Market standings',
      'Check the token',
      `${name} in the sky`,
      `The story of ${name}`,
      'Explore all 12',
    ]) expect(html).toContain(heading);
    for (const retired of [
      'Museum label', 'Catalogue note', '>Provenance<', '>Acquisition<',
      `Why ${name} is in the collection`, 'recognizable artwork', 'It pairs a familiar sign',
    ]) {
      expect(html).not.toContain(retired);
    }
    expect(html).toContain(`src="/assets/constellations/${slug}.svg"`);
    expect(html).toContain('HYG Database v4.0');
    expect(html).toContain('CC BY-SA 4.0');
    expect(html).toContain('not official constellation boundaries');
    expect(html).toContain('data-market-chart');
    expect(html).toContain('data-live-quote');
    expect(html).toContain('data-market-standings');
    expect(html).toContain('<details class="standings__all"><summary>See all 12 market standings</summary>');
    expect(html).toContain('This rank only compares total market value. It does not show how many people support each sign.');
    expect(html).not.toContain('The Zodiac Race');
    expect(html).toContain('Wikipedia views');
    expect(html).toContain(`The English Wikipedia page for ${name} averaged`);
    expect(html).not.toContain('symbol works anywhere text does');
    expect(html).not.toContain(`${name} season returns every year`);
    expect(html).not.toContain('Ethereum');
    expect(html).not.toContain('Dogecoin');
    expect(html).not.toContain('meme coins');
    expect(html).toContain('https://api.dexscreener.com/tokens/v1/solana/');
    expect(html).not.toMatch(/href="https:\/\/jup\.ag\//u);
    expect(html).not.toContain('Continue to Jupiter');
    expect(html).toContain('View live chart');
    expect(html).toContain('class="lot__meta"');
    expect(html).toContain('min-height: 44px;');
    expect(html).toContain('.standings__list a { display: grid;');
    expect(html).toContain('min-height: 56px;');
    expect(html).toContain('.strip picture, .strip img { flex: 0 0 auto; width: 44px; height: 44px; }');

    const standings = html.match(/<ol class="standings__list" data-standings-list>([\s\S]*?)<\/ol>/u)?.[1] ?? '';
    expect(standings.match(/\/assets\/zodiac-icons\/48\/[a-z-]+\.webp/gu)).toHaveLength(12);
    expect(standings).toContain('class="is-current" aria-current="true"');

    expect(html.match(/<nav class="strip" aria-label="All twelve signs">/gu)).toHaveLength(1);
    const strip = html.match(/<nav class="strip" aria-label="All twelve signs">([\s\S]*?)<\/nav>/u)?.[1] ?? '';
    expect(strip.match(/class="strip__name"/gu)).toHaveLength(12);
    expect(strip.match(/\/assets\/zodiac-icons\/128\/[a-z-]+\.webp/gu)).toHaveLength(12);
    for (const [, signName] of signs) expect(strip).toContain(`>${signName}</span>`);
  });

  it('adds one decorative pastel disc after every thesis sign name', async () => {
    const thesis = await read('public/thesis/index.html');

    for (const [slug, name] of signs) {
      expect(thesis).toContain(
        `<span class="disc-sign">${name}<img class="disc-sign__icon" src="/assets/zodiac-icons/48/${slug}.webp" width="18" height="18" alt=""`,
      );
    }
    expect(thesis.match(/class="disc-sign__icon"/g)).toHaveLength(12);
  });
});
