import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const SHOP_IMAGE_PATHS = [
  '/assets/astrofolio/merch/hoodie-800.webp',
  '/assets/astrofolio/merch/cap-800.webp',
  '/assets/astrofolio/merch/t-shirt-800.webp',
];
const EXPECTED_FAQS = [
  {
    q: 'What is Astrofolio?',
    a: 'Astrofolio is the collection of twelve official Zodiac tokens—one for each sign—with its own design and public Registry record.',
  },
  {
    q: 'How do I know a Zodiac is official?',
    a: 'Compare the complete token address with the published Registry. A name or ticker alone is not enough.',
  },
  {
    q: 'Why does each sign have Solana and Base addresses?',
    a: 'Each Zodiac began on Solana and has an official Base counterpart. Both verified addresses appear in the same Registry record.',
  },
  {
    q: 'Do I need a wallet to browse?',
    a: 'No. You can browse the collection, see market context, and verify addresses without connecting a wallet.',
  },
  {
    q: 'Where can I find Astrofolio merchandise?',
    a: 'Browse the Astrofolio Shop for clothing inspired by the twelve signs.',
  },
  {
    q: 'What are the risks?',
    a: 'Zodiac tokens are speculative and can be volatile or hard to sell. Prices can fall to zero, and wallet mistakes or scams can cause permanent loss.',
  },
  {
    // Merged 2026-08-31: the retired "Zodiac Markets" name (naming addendum
    // 2026-08-13) no longer fronts a consumer answer; Terminal carries the
    // trading sentence.
    q: 'What is the Terminal?',
    a: 'The Terminal is the market desk for all twelve Zodiacs, with live prices, liquidity, charts, season context, research, and trading. Jupiter Ultra supplies the executable route and transaction; your wallet reviews, approves, and signs.',
  },
];
function functionBlock(source, name) {
  const start = source.indexOf(`    function ${name}(`);
  expect(start, `${name} exists`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('\n    function ', start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

function ordered(source, needles) {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    expect(next, `${needle} follows the previous item`).toBeGreaterThan(cursor);
    cursor = next;
  }
}

function section(html, id) {
  const marker = html.indexOf(`id="${id}"`);
  expect(marker, `#${id} exists`).toBeGreaterThanOrEqual(0);
  const start = html.lastIndexOf('<section', marker);
  const end = html.indexOf('</section>', marker);
  expect(start, `#${id} is a section`).toBeGreaterThanOrEqual(0);
  expect(end, `#${id} closes`).toBeGreaterThan(marker);
  return html.slice(start, end + '</section>'.length);
}

function normalizedText(value) {
  return value
    .replace(/<br\s*\/?\s*>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&(?:rsquo|#39);/gu, "'")
    .replace(/&(?:ldquo|rdquo);/gu, '"')
    .replace(/&mdash;/gu, '—')
    .replace(/&amp;/gu, '&')
    .replace(/\s+/gu, ' ')
    .trim();
}

const PROHIBITED_CONSUMER_TERM = /\bsculptures?\b/iu;

function astrofolioConsumerSource(source) {
  const start = source.indexOf('    const CAMPAIGN_FILM = Object.freeze({');
  const end = source.indexOf('\n    function TechnicalRecordsSection(', start);
  expect(start, 'Astrofolio consumer source begins').toBeGreaterThanOrEqual(0);
  expect(end, 'Astrofolio consumer source ends').toBeGreaterThan(start);
  return source
    .slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/[^\n]*/gu, '')
    // These are implementation identifiers and asset directories, not copy.
    .replace(/SCULPTURE_PRESENTATION|renderSculpture|data-vitrine-sculpture/giu, '')
    .replace(/\/assets\/sculptures\//giu, '/assets/artwork/');
}

function staticConsumerCopy(html) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/iu)?.[1] ?? '';
  const metadata = [...html.matchAll(/<meta\s+(?:name|property)="(?:description|og:title|og:description|og:image:alt|twitter:title|twitter:description|twitter:image:alt)"\s+content="([^"]*)"\s*\/?>/giu)]
    .map((match) => match[1]);
  const attributes = [...html.matchAll(/\s(?:alt|aria-label|title)="([^"]*)"/giu)]
    .map((match) => match[1]);
  const visibleBody = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/iu)?.[1] ?? '')
    .replace(/<style\b[\s\S]*?<\/style>/giu, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/giu, ' ')
    .replace(/<!--[\s\S]*?-->/gu, ' ');
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/gu)]
    .map((match) => JSON.parse(match[1]));
  const schemaCopy = schemas.flatMap((document) => {
    const values = [];
    const visit = (value, key = '') => {
      if (typeof value === 'string') {
        if (['name', 'description', 'text', 'headline', 'alternativeHeadline', 'caption'].includes(key)) values.push(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => visit(item, key));
        return;
      }
      if (value && typeof value === 'object') {
        Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
      }
    };
    visit(document);
    return values;
  });
  return normalizedText([title, ...metadata, ...attributes, normalizedText(visibleBody), ...schemaCopy].join(' '));
}

// "What is Astrofolio?": the three answers and the risk line, the same in
// the no-JS shell and the app.
const ABOUT_ASTROFOLIO = [
  'What is Astrofolio?',
  'Twelve tokens, one for each sign. Each Zodiac is a crypto token on the Solana blockchain, with a matching version on Base. You can buy, hold and sell it like other crypto.',
  'Why the zodiac? Everyone is born under one of the twelve signs, and people have passed them down for 2,400 years, from clay tablets to your phone’s keyboard. A Zodiac makes your sign something you can own, give a friend on their birthday, and keep. Read the story →',
  'How do I get one? Pick your sign and tap Buy with Fomo. Fomo is a free app for iPhone, Android and the web.',
  'Prices can swing sharply and may fall to zero. Buy only what you can afford to lose.',
];

describe('Astrofolio consumer and Terminal market-desk split', () => {
  it('pins the indexed routes and their owner-directed names', async () => {
    const [consumer, pro] = await Promise.all([
      read('public/astrofolio/index.html'),
      read('public/terminal/index.html'),
    ]);

    expect(consumer).toContain('<link rel="canonical" href="https://zodiacs.org/astrofolio/" />');
    expect(consumer).toContain('<meta name="zodiacs-registry-view" content="terminal" />');
    expect(consumer).toContain('<title>Astrofolio · Choose your sign and see its official Zodiac token · Zodiacs.org</title>');
    expect(consumer).toContain('<meta property="og:title" content="Astrofolio · Zodiacs" />');
    expect(consumer).toContain('<meta name="twitter:title" content="Astrofolio · Zodiacs" />');
    expect(consumer).toContain('"position": 2, "name": "Astrofolio"');
    // Owner addendum 2026-08-31: Astrofolio carries the exchange marker,
    // committed off, for its flag-gated market-gateway venue-route entry.
    expect(consumer).toContain('<meta name="zodiacs-registry-exchange-enabled" content="0" />');
    expect(consumer).not.toMatch(/Zodiac Terminal(?: Pro)?/u);
    expect(consumer).not.toMatch(/<meta\s+name="robots"[^>]*noindex/u);

    expect(pro).toContain('<link rel="canonical" href="https://zodiacs.org/terminal/" />');
    expect(pro).toContain('<meta name="zodiacs-registry-view" content="terminal-pro" />');
    expect(pro).toContain('<meta name="zodiacs-registry-exchange-enabled" content="0" />');
    expect(pro).toContain('<title>Terminal · Live Prices, Liquidity &amp; Research · Zodiacs.org</title>');
    expect(pro).toContain('<meta property="og:title" content="Terminal · Zodiacs" />');
    expect(pro).toContain('<meta name="twitter:title" content="Terminal · Zodiacs" />');
    expect(pro).toContain('"position": 2, "name": "Terminal"');
    expect(pro).not.toMatch(/Zodiac Terminal(?: Pro)?/u);
    expect(pro).not.toMatch(/<meta\s+name="robots"[^>]*noindex/u);
  });

  it('keeps the prohibited visual-art term out of Astrofolio consumer copy', async () => {
    const [source, html] = await Promise.all([
      read('src/app.jsx'),
      read('public/astrofolio/index.html'),
    ]);

    // Internal transition hooks and the legacy asset directory remain stable;
    // this guard deliberately inspects copy, metadata, visible text, alt text,
    // ARIA labels, and structured-data text rather than matching raw files.
    expect(astrofolioConsumerSource(source)).not.toMatch(PROHIBITED_CONSUMER_TERM);
    expect(staticConsumerCopy(html)).not.toMatch(PROHIBITED_CONSUMER_TERM);
  });

  it('keeps the no-JS Astrofolio journey complete and in the locked order', async () => {
    const html = await read('public/astrofolio/index.html');
    ordered(html, [
      'id="official-twelve"',
      'astrofolio-season-bag:start',
      'id="the-twelve"',
      'id="consumer-sign-preview"',
      'id="market-snapshot"',
      'id="terminal"',
      'id="about"',
      'id="buy"',
      'id="story"',
      'id="shop"',
      'id="collection"',
      'id="registry"',
      'id="verify"',
      'id="market-layer"',
      'id="faq"',
      'data-terminal-market-notice',
    ]);

    // The opening is the Campaign film with its caption; the season bag
    // carries the first-screen Fomo action; the runway carries all twelve.
    const opening = section(html, 'official-twelve');
    expect(normalizedText(opening)).toContain('Astro folio');
    // The headline says what the collection is, and phones set it as a
    // tracked line with both of its full stops.
    expect(opening).toContain('<h1 id="static-astrofolio-title">Twelve signs. Twelve tokens.</h1>');
    expect(opening).not.toContain('campaign-hero__stop');
    expect(opening).toContain('<p>Twelve tokens, one for every sign. Each has its own design and public record.</p>');
    expect(normalizedText(opening)).toContain('Astrofolio Leo Season Twelve signs. Twelve tokens. One for every sign, each with its own design and a public record. Find yours, then buy it in the Fomo app.');
    expect(opening).toContain('<img src="/assets/fomo/fomo-film-poster.webp" width="1080" height="1920" alt="" fetchpriority="high" decoding="async">');
    expect(opening).toContain('<source srcset="/assets/fomo/fomo-film-poster.avif" type="image/avif">');
    expect(opening).toContain('href="#the-twelve"><span>Find your sign</span>');
    expect(opening).toContain('href="#buy"><span>How buying works</span>');
    // Phones end the opening like a campaign page: the name and one
    // Discover more with its cue, after the wide caption's buttons.
    ordered(opening, [
      'href="#buy"><span>How buying works</span>',
      '<p class="campaign-hero__name">Astro<em>folio</em></p>',
      '<a class="campaign-discover" href="#the-twelve"><span class="campaign-discover__pill">Discover more</span><svg class="campaign-discover__cue"',
    ]);
    expect(opening).not.toContain('<video');
    expect(opening).not.toContain('href="/terminal/');
    expect(opening).not.toMatch(/aggregate|market cap|indexed liquidity|volume|tape/iu);

    const bag = html.slice(html.indexOf('<!-- astrofolio-season-bag:start -->'), html.indexOf('<!-- astrofolio-season-bag:end -->'));
    expect(bag).toContain('<aside class="campaign-bag campaign-bag--static" aria-label="Buy Leo" data-campaign-bag="leo"');
    expect(bag).toContain('href="https://fomo.family/coin?address=8Cd7wXoPb5Yt9cUGtmHNqAEmpMDrhfcVqnGbLC48b8Qm&amp;chainId=1399811149"');
    expect(bag).toContain('src="/assets/venues/fomo-official.svg"');
    expect(bag).toContain('data-fomo-buy="leo"');

    const runway = section(html, 'the-twelve');
    expect(runway.match(/<article class="campaign-look(?: is-season)?" data-static-sign="[a-z]+"/gu)).toHaveLength(12);
    expect(runway).toContain('<article class="campaign-look is-season" data-static-sign="leo"');
    expect(runway).toContain('<h3 id="static-aries-title">Aries</h3>');
    ordered(runway, [
      '<h3 id="static-aries-title">Aries</h3>',
      'class="vitrine-price is-pending"',
      'class="campaign-look__actions"',
      'href="/astrofolio/how-to-buy/aries/">Other ways to buy</a>',
    ]);
    expect(runway).toContain('<span class="campaign-look__dates">March 21 to April 19</span>');
    expect(runway).toContain('<span class="vitrine-price__figure">Price unavailable</span>');
    expect(runway).toContain('<span class="vitrine-price__movement">movement unavailable</span>');
    expect(runway).toContain('href="/registry/aries/">Explore Aries</a>');
    expect(runway).toContain('href="https://fomo.family/coin?address=GhFiFrExPY3proVF96oth1gESWA5QPQzdtb8cy8b1YZv&amp;chainId=1399811149"');
    expect(runway).toContain('src="/assets/venues/fomo-official.svg"');
    expect(runway).toContain('data-fomo-buy="aries"');
    expect(runway).toContain('<img class="campaign-look__figure" src="/assets/sculptures/512/aries.webp" width="512" height="512" alt="Aries Zodiac artwork"');
    expect(runway).toContain('Star positions: HYG Database v4.0, CC BY-SA 4.0.');
    expect(runway).not.toContain('href="/terminal/');
    expect(runway).not.toContain('/registry/aries/#acquire');
    expect(html).not.toMatch(/href="[^"]*jup\.ag/iu);
    expect(runway).not.toMatch(/aggregate|market cap|indexed liquidity|volume|tape/iu);

    const howToBuyLinks = html.match(/href="\/astrofolio\/how-to-buy\/[a-z]+\/"/gu) ?? [];
    expect(howToBuyLinks).toHaveLength(12);
    expect(runway.match(/data-fomo-buy="[a-z]+"/gu)).toHaveLength(12);
    expect(html.match(/data-fomo-buy="[a-z]+"/gu)).toHaveLength(13);
    expect(runway.match(/<small>[A-Z][a-z]+ <span class="btn--fomo__zodiac-emoji" aria-hidden="true">[♈-♓]️<\/span><\/small><strong>Buy with Fomo<\/strong>/gu)).toHaveLength(12);
    expect(bag.match(/<small>Leo <span class="btn--fomo__zodiac-emoji" aria-hidden="true">♌️<\/span><\/small><strong>Buy with Fomo<\/strong>/gu)).toHaveLength(1);
    expect(runway).not.toContain(' selected</small>');
    expect(runway.match(/href="https:\/\/fomo\.family\/coin\?address=[^"&]+&amp;chainId=1399811149"/gu)).toHaveLength(12);
    expect(html.match(/href="https:\/\/fomo\.family\/coin\?address=[^"&]+&amp;chainId=1399811149"/gu)).toHaveLength(13);

    // A newcomer's three questions come before buying, in the app's words.
    const about = section(html, 'about');
    for (const line of ABOUT_ASTROFOLIO) expect(normalizedText(about)).toContain(line);
    expect(about).toContain('<a href="/thesis/">Read the story <span aria-hidden="true">→</span></a>');
    expect(about).toContain('<a href="#buy">Fomo</a>');

    const buy = section(html, 'buy');
    expect(normalizedText(buy)).toContain('In the Fomo app Buy yours in a few taps.');
    expect(buy).toContain('href="https://apps.apple.com/us/app/fomo-never-miss-out/id6741115427" rel="external nofollow noopener"');
    expect(buy).toContain('href="https://play.google.com/store/apps/details?id=family.fomo.app" rel="external nofollow noopener"');
    expect(buy).toContain('href="https://fomo.family/" rel="external nofollow noopener"');
    expect(buy).toContain('href="/fomo/">Zodiacs on Fomo');
    expect(buy).toContain('src="/assets/fomo/fomo-alert-900.webp"');
    expect(buy).not.toContain('fomo-alert.png');
    // The alert is its own figure after the three phones, never laid over one.
    expect(buy).not.toContain('campaign-phone__alert');
    expect(buy.match(/fomo-alert-900\.webp/gu)).toHaveLength(1);
    ordered(buy, [
      '<figcaption><strong>Write your thesis</strong>',
      '<figure class="campaign-alert">',
      'src="/assets/fomo/fomo-alert-900.webp"',
      '<figcaption><strong>Alerts when your sign moves</strong>',
    ]);
    expect(normalizedText(buy)).toContain('Alerts when your sign moves Fomo sends price alerts like this one for the Zodiacs you watch, so you hear about a move without keeping a chart open.');
    expect(html).not.toMatch(/href="\/terminal\/\?sign=[a-z]+#selected"/gu);
    const marketGateway = section(html, 'market-layer');
    expect(marketGateway.match(/href="\/registry\/technical\/#market-transparency"/gu)).toHaveLength(1);
    expect(marketGateway.match(/href="\/terminal\/\?rank=marketCap"/gu)).toHaveLength(1);
    expect(normalizedText(marketGateway)).toContain("Latest market snapshot Who's leading today?");
    expect(normalizedText(marketGateway)).toContain('The latest available snapshot ranks the Twelve by reported market cap.');
    expect(marketGateway).toContain('role="list" aria-label="Zodiac market-cap leaderboard"');
    expect(marketGateway.match(/<li(?:\s|>)/gu)).toHaveLength(12);
    expect(marketGateway.match(/class="consumer-market-leaderboard__icon"/gu)).toHaveLength(12);
    expect(marketGateway.match(/\/assets\/zodiac-icons\/48\/[a-z]+\.avif/gu)).toHaveLength(12);
    expect(marketGateway.match(/\/assets\/zodiac-icons\/48\/[a-z]+\.webp/gu)).toHaveLength(12);
    expect(marketGateway.match(/width="34" height="34"/gu)).toHaveLength(12);
    expect(html).not.toContain('See market details');
    expect(html).not.toContain('class="static-terminal-gateway"');
    const shop = section(html, 'shop');
    for (const href of [
      'https://shop.app/m/41mzeq7f2h',
      'https://shop.app/products/9655740694871/astrofolio-t-shirt',
      'https://shop.app/products/9654676455767/astrofolio-cap',
      'https://shop.app/products/9654762504535/astrofolio-hoodie',
    ]) {
      expect(shop).toContain(`href="${href}"`);
    }
    for (const image of SHOP_IMAGE_PATHS) {
      expect(shop).toContain(`src="${image}"`);
      await expect(access(resolve(root, `public${image}`))).resolves.toBeUndefined();
    }
    ordered(shop, SHOP_IMAGE_PATHS.map((image) => `src="${image}"`));
    expect(shop).not.toContain('cdn.shopify.com');
    expect(html).not.toContain('data-terminal-preference-banner');

    const registry = section(html, 'registry');
    expect(normalizedText(registry)).toContain('Names and symbols can be copied. The Registry identifies each official Zodiac by its complete token address.');
    expect(normalizedText(registry)).toContain("Open the verified list, then use your browser's Find command to search for the complete address. Never paste a recovery phrase.");
    expect(registry).toContain('id="verify"');
    expect(registry).toContain('class="consumer-destinations__card static-verifier"');
    expect(registry).toContain('href="/registry/">Browse all twelve records');
    expect(registry).toContain('href="/registry/zodiacs.registry.json">Open the verified address list');
  });

  it('pins the hydrated consumer composition in the same order', async () => {
    const source = await read('src/app.jsx');
    const start = source.indexOf('<main id="main" className="zd consumer-registry consumer-campaign">');
    const mounted = source.slice(start, source.indexOf('</main>', start));
    ordered(mounted, [
      '<CampaignHero />',
      '<CampaignBag sign={sign} batch={consumerMarket} onPick={pickFromBag} />',
      '<CampaignRunway',
      '<CampaignApp />',
      '<ConsumerStory />',
      '<ConsumerShop />',
      '<ConsumerCabinet />',
      '<ConsumerRegistryGuide sign={sign} />',
      '<ConsumerMarketGateway batch={consumerMarket} activeTicker={activeTicker} />',
      '<ConsumerFaq />',
      '<MarketVenueNotice />',
    ]);
    expect(source.slice(source.indexOf('</main>', start))).toContain(
      '<SiteEnd tagline="The official public Registry of the Twelve." />',
    );
    expect(source).toContain('<span id="consumer-sign-preview" className="terminal-compat-target" aria-hidden="true" />');
    expect(source).toContain('<span id="market-snapshot" className="terminal-compat-target" aria-hidden="true" />');
    expect(source).toContain('<span id="terminal" className="terminal-compat-target" aria-hidden="true" />');
    expect(mounted).not.toMatch(/ConsumerExplorer|ConsumerMarketSnapshot|ConsumerTerminalStrip|ConsumerMarketSection|ConsumerMarketBriefing|MarketTape|StandingsSection|PulseSection|ProMarketsGateway/gu);
  });

  it('builds the Campaign opening, runway, and bag as accessible, motion-aware controls', async () => {
    const source = await read('src/app.jsx');
    const hero = functionBlock(source, 'CampaignHero');
    const film = functionBlock(source, 'useCampaignFilm');
    const runway = functionBlock(source, 'CampaignRunway');
    const look = functionBlock(source, 'CampaignLook');
    const bag = functionBlock(source, 'CampaignBag');
    const button = functionBlock(source, 'FomoBuyButton');
    const spark = functionBlock(source, 'CampaignSpark');

    expect(normalizedText(hero)).toContain('Astrofolio {season.name} Season Twelve signs. Twelve tokens.');
    expect(hero).toContain('id="official-twelve"');
    expect(hero).toContain('<span className="campaign-hero__word campaign-hero__word--astro" aria-hidden="true">Astro</span>');
    expect(hero).toContain('<span className="campaign-hero__word campaign-hero__word--folio" aria-hidden="true">folio</span>');
    expect(hero).toContain('if (!campaignStageActive()) {');
    expect(hero).toContain("hero.dataset.caption = caption > 0.5 ? 'live' : 'rest';");
    expect(hero).not.toContain('<TerminalViewLink');
    // Films: posters are complete; sources attach after load, only on
    // screen, never under reduced motion or constrained data.
    expect(film).toContain("connection.saveData || ['slow-2g', '2g'].includes(connection.effectiveType || '')");
    expect(film).toContain('if (constrained || matchesMedia(CAMPAIGN_REDUCED_MOTION_QUERY)) return undefined;');
    expect(film).toContain("let ready = document.readyState === 'complete';");
    expect(film).toContain("window.addEventListener('load', onLoad, { once: true });");
    expect(film).toContain("source.src = source.dataset.src || '';");
    expect(film).toContain('if (document.hidden) rest(); else play();');
    expect(hero).toContain('preload="none"');
    expect(hero).toContain('<source data-src={CAMPAIGN_FILM.av1}');

    expect(runway).toContain('id="the-twelve"');
    expect(runway).toContain('All twelve, starting with {order[0].name}.');
    expect(runway).toContain('role="group"');
    expect(runway).toContain('aria-label="Choose your zodiac sign"');
    expect(runway).toContain('ArrowRight: Math.min(SIGNS.length - 1, activeIndex + 1)');
    expect(runway).toContain('ArrowLeft: Math.max(0, activeIndex - 1)');
    expect(runway).toContain('Home: 0');
    expect(runway).toContain('End: SIGNS.length - 1');
    expect(runway).toContain('tabIndex={selected ? 0 : -1}');
    expect(runway).toContain('aria-pressed={selected}');
    expect(runway).toContain("trackAnalytics('registry_sign_selected', { sign: next.asset.sign, source: 'consumer_explorer' })");
    expect(runway).toContain("url.searchParams.set('sign', next.asset.sign)");
    expect(runway).toContain("window.history.replaceState(null, '', `${url.pathname}?${url.searchParams}${url.hash}`)");
    // Passing looks on the pinned stage moves the count, never the chosen
    // sign; on phones a swipe moves the spotlight to the centred look and
    // the address bar follows once the swipe rests.
    expect(functionBlock(source, 'CampaignRunway')).toContain('if (best >= 0) setPosition(best);');
    expect(runway.slice(runway.indexOf('const pickLook'), runway.indexOf('const followSwipe'))).not.toContain('setActive(');
    const follow = runway.slice(runway.indexOf('const followSwipe'), runway.indexOf('const showLook'));
    expect(follow).toContain('if (stageRef.current.pinned || !matchesMedia(CAMPAIGN_PHONE_QUERY)) return;');
    expect(follow).toContain('if (ticker !== steer.ticker && window.performance.now() < steer.until) return;');
    expect(follow).toContain("trackAnalytics('registry_sign_selected', { sign: chosen.asset.sign, source: 'consumer_swipe' });");
    expect(runway).toContain('if (!stageRef.current.pinned) window.requestAnimationFrame(() => followSwipe(pickLook()));');
    expect(runway).toContain("if (!stageRef.current.pinned) steerRef.current = { ticker: next.ticker, until: window.performance.now() + 1200 };");
    // Phones: the film dims and the looks rise with the scroll as
    // scroll-driven animations in the stylesheet (pinned in
    // registry-pastel-polish). The script times nothing and writes nothing
    // per frame for them, and in carousel mode the track carries no inline
    // transform, so the stylesheet's rise owns it.
    expect(runway).not.toContain('dataset.rise');
    for (const property of ["'--stack'", "'--rise'"]) {
      expect(hero).not.toContain(property);
      expect(runway).not.toContain(property);
    }
    expect(look).toContain("style={{ '--sign': item.hue }}");
    expect(look).not.toContain('--rise-order');
    expect(runway).toContain("section.dataset.mode = stage.pinned ? 'pinned' : 'carousel';");
    expect(runway).toContain("track.style.removeProperty('transform');");
    expect(source).toContain("const CAMPAIGN_PHONE_QUERY = '(max-width: 900px)';");
    // The opening sticks only behind the runway, inside one stack.
    ordered(source, [
      '<div className="campaign-stack">',
      '<CampaignHero />',
      '<CampaignBag sign={sign} batch={consumerMarket} onPick={pickFromBag} />',
      '<CampaignRunway',
      '</div>',
      '<CampaignAbout />',
      '<CampaignApp />',
    ]);
    // Phones: the looks carry no buttons, so the bag stays over the runway,
    // and its sign opens a sheet of all twelve. A sign picked there moves the
    // runway to its look without moving the page.
    expect(bag).toContain('const phone = useMediaMatch(CAMPAIGN_PHONE_QUERY);');
    expect(bag).toContain('if (runway && !matchesMedia(CAMPAIGN_PHONE_QUERY)) {');
    expect(bag).toContain('aria-haspopup="dialog"');
    expect(bag).toContain('className="campaign-sheet"');
    expect(bag).toContain('aria-labelledby="campaign-sheet-title"');
    expect(bag).toContain('sheet.showModal();');
    expect(bag).toContain('aria-pressed={item.ticker === sign.ticker}');
    expect(bag).toContain('onPick(item.ticker);');
    expect(bag).toContain("openerRef.current?.focus({ preventScroll: true });");
    expect(functionBlock(source, 'Zodiacs')).toContain("trackAnalytics('registry_sign_selected', { sign: next.asset.sign, source: 'consumer_bag' });");
    expect(runway).toContain('if (active === activeRef.current) return;');
    expect(runway).toContain('steerRef.current = { ticker: active, until: window.performance.now() + 1200 };');
    expect(runway.slice(runway.indexOf('if (active === activeRef.current) return;'), runway.indexOf('const pickLook'))).not.toContain('scrollIntoView');
    expect(runway).toContain("section.dataset.mode = stage.pinned ? 'pinned' : 'carousel';");
    expect(runway).toContain('const history = useRegistryMarketHistory(historyWanted);');
    expect(runway).toContain("rootMargin: '600px 0px'");
    expect(runway).toContain('Data &amp; methodology');
    expect(runway).toContain('Star positions: HYG Database v4.0, CC BY-SA 4.0.');
    expect(runway).not.toContain('/terminal/');

    expect(look).toContain("if (event.target.matches?.(':focus-visible')) onKeyboardFocus(index);");
    expect(look).toContain('image.src = `/assets/sculptures/512/${slug}.webp`');
    expect(look).toContain('image.src = `/assets/cabinet-materials/gold/${slug}.webp`');
    expect(look).toContain('setArtworkFailed(true)');
    expect(look).toContain('`${item.name} artwork unavailable; ${item.symbol} symbol shown`');
    expect(look).toContain('<VitrinePrice sign={item} batch={batch} live={false} />');
    expect(look).toContain('<FomoBuyButton item={item} source="runway" />');
    expect(look).toContain('Explore {item.name}');
    expect(look).toContain('href={howToBuyPath(item)}');
    expect(look).toContain('>Other ways to buy</a>');
    expect(look).toContain('<span>Opens the Fomo app</span>');
    expect(look).not.toContain('/terminal/');
    expect(look).not.toContain('#acquire');
    expect(spark).toContain('.slice(-CAMPAIGN_SPARK_DAYS)');
    expect(spark).toContain("role=\"img\"");

    expect(button).toContain('href={fomoBuyPath(item)}');
    expect(button).toContain('/assets/venues/fomo-official.svg');
    expect(button).toContain('<small>{item.name} <span className="btn--fomo__zodiac-emoji" aria-hidden="true">{zodiacEmoji(item)}</span></small><strong>Buy with Fomo</strong>');
    expect(button).toContain("trackAnalytics('astrofolio_fomo_open', { sign: item.asset.sign, source })");
    expect(button).not.toContain(' selected</small>');
    expect(functionBlock(source, 'zodiacEmoji')).toContain("`${symbol}\\uFE0F`");

    expect(bag).toContain('<FomoBuyButton item={sign} source="bag" />');
    expect(bag).toContain('const [shown, setShown] = useState(true);');
    expect(bag).not.toContain("hero.dataset.caption");
    expect(bag).toContain("inert={shown ? undefined : ''}");
    expect(bag).toContain("aria-hidden={shown ? undefined : 'true'}");
    expect(bag).toContain("document.querySelector('.consumer-campaign > .ftr')");
    expect(source).not.toContain('function terminalMarketPath(');
    expect(source).not.toContain('function zodiacMarketsPath(');
  });

  it('uses query, saved sign, then current season without saving ordinary selection', async () => {
    const source = await read('src/app.jsx');
    const rootBlock = functionBlock(source, 'Zodiacs');
    ordered(rootBlock, [
      "new URLSearchParams(window.location.search).get('sign')",
      "window.localStorage.getItem('zodiacs:today-sun-sign:v1')",
      'currentSeason()?.sign.ticker',
    ]);
    expect(rootBlock).toContain('const [anchorTicker] = useState(activeTicker);');
    expect(functionBlock(source, 'CampaignRunway')).not.toContain('localStorage.setItem');
    expect(functionBlock(source, 'CampaignBag')).not.toContain('localStorage.setItem');
    expect(rootBlock).not.toContain("window.localStorage.setItem('zodiacs:today-sun-sign:v1'");
  });

  it('uses one market read shared by the bag, runway, and leaderboard', async () => {
    const source = await read('src/app.jsx');
    const rootBlock = functionBlock(source, 'Zodiacs');
    const runway = functionBlock(source, 'CampaignRunway');
    const look = functionBlock(source, 'CampaignLook');
    const bag = functionBlock(source, 'CampaignBag');
    const marketGateway = functionBlock(source, 'ConsumerMarketGateway');
    expect(rootBlock).toContain('const consumerMarket = useTwelveQuotes(!technical && !pro);');
    expect(rootBlock.match(/const consumerMarket = useTwelveQuotes\(!technical && !pro\);/gu)).toHaveLength(1);
    expect(rootBlock.match(/batch=\{consumerMarket\}/gu)).toHaveLength(3);
    expect(rootBlock).toContain('<CampaignRunway');
    expect(rootBlock).toContain('<ConsumerMarketGateway batch={consumerMarket} activeTicker={activeTicker} />');
    for (const block of [runway, look, bag, marketGateway]) expect(block).not.toContain('useTwelveQuotes(');
    expect(look).toContain('<VitrinePrice sign={item} batch={batch} live={false} />');
    expect(runway).toContain('Data &amp; methodology');
    expect(runway).toContain('role="status" aria-live="polite"');
    expect(source).not.toContain('function ConsumerMarketSnapshot(');
    expect(source).not.toContain('<summary>See market details</summary>');

    const movement = functionBlock(source, 'plainMarketMovement');
    expect(movement).toContain("up ${formatPercent(movement).replace('+', '')} today");
    expect(movement).toContain("down ${formatPercent(Math.abs(movement)).replace('+', '')} today");
    expect(movement).toContain("return 'unchanged today'");
    expect(movement).toContain("return 'movement unavailable'");
    const vitrinePrice = functionBlock(source, 'VitrinePrice');
    expect(vitrinePrice).toContain("change > 0 ? 'up' : change < 0 ? 'down' : 'flat'");
    expect(vitrinePrice).toContain('className={`vitrine-price__movement is-${direction}`}');

    const fallback = await read('public/astrofolio/index.html');
    expect(fallback).toContain('<span id="market-snapshot" class="terminal-compat-target" aria-hidden="true"></span>');
    expect(fallback).not.toContain('class="static-snapshot"');
  });

  it('does not insert defensive purchase copy into the Astrofolio journey', async () => {
    const source = await read('src/app.jsx');
    const fallback = await read('public/astrofolio/index.html');
    const removed = [
      'If you want to go further',
      'Most people stop at browsing, and that is fine.',
      'Astrofolio.xyz is a separate website.',
      'Zodiacs.org does not take payment or complete purchases.',
      'Can I buy a Zodiac on Zodiacs.org?',
    ];
    for (const copy of removed) {
      expect(source, copy).not.toContain(copy);
      expect(fallback, copy).not.toContain(copy);
    }
    expect(source).not.toContain('function ConsumerBuyGuide(');
    expect(fallback).not.toContain('id="buying-guide"');
    expect(fallback).not.toContain('href="#buying-guide"');
    expect(fallback).toContain('href="/astrofolio/">Astrofolio</a>');
    expect(fallback).not.toContain('href="https://astrofolio.xyz/"');
  });

  it('keeps the collection story, Shop, Registry guide, leaderboard, and FAQs exact', async () => {
    const source = await read('src/app.jsx');
    expect(source).not.toContain('function ConsumerIntroduction(');
    const hero = functionBlock(source, 'CampaignHero');
    expect(hero).toContain('<h1 id="campaign-hero-title">Twelve signs. Twelve tokens.</h1>');
    expect(hero).toContain('<p>Twelve tokens, one for every sign. Each has its own design and public record.</p>');
    expect(hero).toContain('<p>One for every sign, each with its own design and a public record. Find yours, then buy it in the Fomo app.</p>');
    ordered(hero, [
      '<a className="campaign-button" href="#buy"><span>How buying works</span></a>',
      '<p className="campaign-hero__name">Astro<em>folio</em></p>',
      '<a className="campaign-discover" href="#the-twelve">',
      '<span className="campaign-discover__pill">Discover more</span>',
      '<svg className="campaign-discover__cue"',
    ]);
    expect(hero).toContain('<a className="campaign-button campaign-button--light" href="#the-twelve">');
    expect(hero).toContain('<a className="campaign-button" href="#buy"><span>How buying works</span></a>');
    const app = functionBlock(source, 'CampaignApp');
    expect(app).not.toContain('campaign-phone__alert');
    ordered(app, [
      '<figcaption><strong>Write your thesis</strong>',
      '<figure className="campaign-alert">',
      'src="/assets/fomo/fomo-alert-900.webp"',
      '<figcaption><strong>Alerts when your sign moves</strong>',
    ]);
    const about = functionBlock(source, 'CampaignAbout');
    expect(about).toContain('id="about" className="campaign-about reveal" aria-labelledby="campaign-about-title"');
    for (const line of ABOUT_ASTROFOLIO) expect(normalizedText(about)).toContain(line);
    expect(about).toContain('<a href="/thesis/">Read the story <span aria-hidden="true">→</span></a>');
    expect(about).toContain('<a href="#buy">Fomo</a>');
    expect(app).toContain('id="buy" className="campaign-app reveal"');
    expect(app).toContain('<h2 id="campaign-app-title">Buy yours in a few taps.</h2>');
    expect(app).toContain('href={FOMO_APP_STORE_URL} rel="external nofollow noopener"');
    expect(app).toContain('href={FOMO_PLAY_URL} rel="external nofollow noopener"');
    expect(app).toContain('<a href="/fomo/">Zodiacs on Fomo');
    expect(app).not.toContain('/terminal/');

    const story = functionBlock(source, 'ConsumerStory');
    expect(story).toContain('id="thesis" className="consumer-story reveal"');
    expect(story).toContain('Symbol · record · identity');
    expect(story).toContain('<h2 id="consumer-story-title">The story behind the collection.</h2>');
    expect(story).toContain('<span className="consumer-purpose__cta consumer-story__cta"><span>Read the story</span><span className="consumer-purpose__arrow" aria-hidden="true">→</span></span>');

    const shop = functionBlock(source, 'ConsumerShop');
    expect(shop).toContain('id="shop" className="consumer-shop reveal"');
    expect(shop).toContain('<h2 id="consumer-shop-title">Wear your sign.</h2>');
    expect(shop).toContain('href="https://shop.app/m/41mzeq7f2h" rel="noopener noreferrer external"');
    expect(shop).toContain('{ASTROFOLIO_SHOP_PRODUCTS.map((product, index) =>');
    const shopProductsStart = source.indexOf('    const ASTROFOLIO_SHOP_PRODUCTS = Object.freeze([');
    const shopProducts = source.slice(shopProductsStart, source.indexOf('\n    function ConsumerShop(', shopProductsStart));
    for (const href of [
      'https://shop.app/products/9655740694871/astrofolio-t-shirt',
      'https://shop.app/products/9654676455767/astrofolio-cap',
      'https://shop.app/products/9654762504535/astrofolio-hoodie',
    ]) {
      expect(shopProducts).toContain(`href: '${href}'`);
    }
    for (const image of SHOP_IMAGE_PATHS) {
      expect(shopProducts).toContain(`image: '${image}'`);
    }
    ordered(shopProducts, SHOP_IMAGE_PATHS.map((image) => `image: '${image}'`));
    expect(shopProducts).not.toContain('cdn.shopify.com');

    expect(source).not.toContain('function ConsumerTerminalStrip(');
    expect(functionBlock(source, 'CampaignLook')).toContain('>Other ways to buy</a>');
    expect(functionBlock(source, 'FomoBuyButton')).toContain('href={fomoBuyPath(item)}');
    expect(functionBlock(source, 'CampaignLook')).not.toContain('/terminal/');
    const marketGateway = functionBlock(source, 'ConsumerMarketGateway');
    expect(marketGateway).toContain('id="market-layer"');
    expect(marketGateway).toContain('<h2 id="consumer-market-gateway-title">Who&rsquo;s leading today?</h2>');
    expect(marketGateway).toContain('<ol role="list" aria-label="Zodiac market-cap leaderboard">');
    expect(marketGateway).toContain('.sort((left, right) =>');
    expect(marketGateway).toContain('return right.marketCap - left.marketCap || left.item.order - right.item.order;');
    expect(marketGateway).toContain('{rows.map(({ item, marketCap, change }, index) =>');
    expect(marketGateway).toContain('formatUsdCompact(marketCap)');
    expect(marketGateway).toContain("batch.stale ? 'Delayed'");
    expect(marketGateway).toContain('batch.quotes?.[item.asset.sign]');
    expect(marketGateway).toContain('href="/registry/technical/#market-transparency"');
    expect(marketGateway).toContain('<span>How ranking works</span>');
    expect(marketGateway).toContain('href="/terminal/?rank=marketCap"');
    expect(marketGateway).toContain('<span>View full market</span>');
    expect(marketGateway).toContain('Market data comes from an independent index');
    expect(marketGateway).toContain('className="consumer-market-leaderboard__icon"');
    expect(marketGateway).toContain('/assets/zodiac-icons/48/${item.asset.sign}.avif');
    expect(marketGateway).toContain('/assets/zodiac-icons/48/${item.asset.sign}.webp');
    expect(marketGateway).toContain('width="34" height="34"');

    const marketLoader = functionBlock(source, 'loadTwelveMarketQuotes');
    expect(marketLoader).toContain('isPinnedPairForSign(pair, sign)');
    expect(marketLoader).toContain('latest/dex/pairs/solana/${missingPairIds.join(\',\')}');
    expect(marketLoader).toContain('const pair = configured');
    expect(marketLoader).toContain('pinnedPairsBySign.get(sign.asset.sign) || null');
    expect(marketLoader).not.toContain('configured ? market?.bestPair');
    const pinnedValidator = functionBlock(source, 'isPinnedPairForSign');
    expect(pinnedValidator).toContain('pair?.pairAddress === config.pairId');
    expect(pinnedValidator).toContain('pair?.baseToken?.address === mint');
    expect(pinnedValidator).toContain('pair?.quoteToken?.address === SOLANA_WRAPPED_SOL_MINT');
    const marketParser = functionBlock(source, 'parseMarketContextPayload');
    expect(marketParser).not.toContain('|| pairs[0]');

    const cabinet = functionBlock(source, 'ConsumerCabinet');
    expect(cabinet).toContain('id="cabinet" className="consumer-cabinet-section reveal"');
    expect(cabinet).toContain('<h2 id="consumer-cabinet-title">Cabinet of Twelve</h2>');
    expect(cabinet).toContain('<span>Open the Cabinet</span><span className="consumer-purpose__arrow"');
    expect(cabinet).toContain('{SIGNS.map((item, index) =>');
    expect(cabinet).toContain("aries: { finish: 'crown', numeral: 'V', count: '×12' }");
    expect(cabinet).toContain("aquarius: { finish: 'gold', numeral: 'IV', count: '×3' }");

    const verifier = functionBlock(source, 'ConsumerVerifier');
    expect(verifier).toContain('function ConsumerVerifier({ embedded = false })');
    expect(verifier).toContain("const Wrapper = embedded ? 'div' : 'section'");
    expect(verifier).toContain("(embedded ? ' is-embedded' : '')");
    expect(verifier).toContain('<h3 id="consumer-verify-title">Verify an address</h3>');
    expect(verifier).toContain('Check a Zodiac token address');
    expect(verifier).toContain('Paste the token address shown where you found it. We&rsquo;ll tell you whether it appears in the verified list. Never paste a recovery phrase.');
    expect(verifier).toContain('This checks a token address, not a personal account.');
    expect(verifier).not.toContain('This checker only shows information. It cannot move money or approve anything.');
    expect(verifier).not.toContain('vrf__examples');
    expect(verifier).not.toContain('mono');
    const registry = functionBlock(source, 'ConsumerRegistryGuide');
    expect(registry).toContain('id="registry" className="consumer-registry-guide campaign-record reveal"');
    expect(registry).toContain('<h2 id="consumer-registry-title">Check the address, not the name.</h2>');
    expect(registry).toContain('<code>{origin.slice(0, 4)}<span>{origin.slice(4, -4)}</span>{origin.slice(-4)}</code>');
    expect(registry).toContain('Base counterpart <code>{truncateAddress(counterpart, 6, 4)}</code>');
    expect(registry).toContain('<ConsumerVerifier embedded />');
    expect(registry).toContain('Open the complete {sign.name} record');
    const faqStart = source.indexOf('    const CONSUMER_FAQS = [');
    const faqSource = source.slice(faqStart, source.indexOf('    function ConsumerFaq(', faqStart));
    expect(faqSource.match(/\n\s*q:/gu)).toHaveLength(EXPECTED_FAQS.length);
    ordered(faqSource, [
      "q: 'Where can I find Astrofolio merchandise?'",
      "q: 'What are the risks?'",
      "q: 'What is the Terminal?'",
    ]);
    const fallback = await read('public/astrofolio/index.html');
    const staticFaq = section(fallback, 'faq');
    expect(staticFaq.match(/<details\s+class="consumer-faq__item">/gu)).toHaveLength(EXPECTED_FAQS.length);
    ordered(staticFaq, [
      '<summary>Where can I find Astrofolio merchandise?</summary>',
      '<summary>What are the risks?</summary>',
      '<summary>What is the Terminal?</summary>',
    ]);
    for (const item of EXPECTED_FAQS) {
      expect(faqSource).toContain(`q: '${item.q}'`);
      expect(faqSource).toContain(`a: '${item.a}'`);
      expect(normalizedText(staticFaq)).toContain(`${item.q} ${item.a}`);
    }
    const schemaDocuments = [...fallback.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/gu)]
      .map((match) => JSON.parse(match[1]));
    const schemaFaq = schemaDocuments
      .flatMap((document) => document['@graph'] ?? [document])
      .find((node) => node['@type'] === 'FAQPage');
    expect(schemaFaq.mainEntity.map((item) => ({
      q: item.name,
      a: item.acceptedAnswer.text,
    }))).toEqual(EXPECTED_FAQS);

    expect(source).not.toContain('function ConsumerClosing(');
    expect(fallback).not.toContain('<section class="static-astrofolio-closing"');
    expect(functionBlock(source, 'TerminalViewLink')).toContain("{pro ? 'Open the Terminal' : 'Astrofolio'}");
    expect(functionBlock(source, 'SiteEnd')).not.toContain('shop.astrofolio.xyz');
    const staticFooter = fallback.slice(fallback.indexOf('<footer class="zfooter zfooter--compact">'), fallback.indexOf('</footer>', fallback.indexOf('<footer class="zfooter zfooter--compact">')));
    expect(staticFooter).not.toContain('shop.astrofolio.xyz');
    expect(source).not.toContain('function ConsumerPreferenceBanner(');
    expect(source).not.toContain('data-terminal-preference-banner');
    expect(source).not.toContain('TERMINAL_PRO_BANNER_DISMISSED_KEY');
  });

  it('keeps consumer navigation on Astrofolio and market depth on Terminal', async () => {
    const source = await read('src/app.jsx');
    const header = functionBlock(source, 'Header');
    expect(header).toContain("const terminalNav = {");
    expect(header).toContain("href: '/astrofolio/'");
    expect(header).toContain("label: 'Astrofolio'");
    expect(header).toContain("description: 'Choose a sign and explore the collection'");
    expect(header).not.toContain("label: 'Terminal'");

    const proStart = source.indexOf('<main id="main" className="zd terminal-pro">');
    const proMounted = source.slice(proStart, source.indexOf('</main>', proStart));
    ordered(proMounted, [
      '<ProMasthead batch={proMarket} />',
      '<ProSelectedSign sign={sign} batch={proMarket} />',
      '<ProMarketBoard active={activeTicker} setActive={setActiveTicker} batch={proMarket} />',
      '<ProMarketsGateway sign={sign} />',
      '<ConsumerMarketBriefing active={activeTicker} sharedMarket={proMarket} />',
      '<ProResearchSection sign={sign} />',
      '<ProVerifierLink sign={sign} />',
      '<MarketVenueNotice />',
    ]);
    expect(source.slice(source.indexOf('</main>', proStart))).toContain(
      '<SiteEnd tagline="Live market context, anchored to verified public records." />',
    );
    expect(functionBlock(source, 'ProMasthead')).toContain('<h1 id="pro-terminal-title">Terminal</h1>');
    expect(source).toContain('const proMarket = useTwelveQuotes(pro);');
  });

  it('preserves view-switch analytics enums and resilient storage', async () => {
    const source = await read('src/app.jsx');
    const link = functionBlock(source, 'TerminalViewLink');
    const remember = functionBlock(source, 'rememberTerminalView');
    expect(link).toContain("const direction = pro ? 'consumer_to_pro' : 'pro_to_consumer'");
    expect(link).toContain('data-terminal-view-link={view}');
    expect(link).not.toMatch(/role=["']switch/gu);
    expect(remember).toContain('window.localStorage.setItem(TERMINAL_VIEW_STORAGE_KEY, view)');
    expect(remember).toMatch(/try \{[\s\S]*?\} catch/gu);
    expect(remember).toContain("trackAnalytics('terminal_view_switch', { surface, direction })");
  });

  it('keeps legacy market intent mapped to the canonical Terminal URL', async () => {
    const source = await read('src/app.jsx');
    expect(source).toContain("market: 'market'");
    expect(source).toContain("briefing: 'briefing'");
    expect(source).toContain("research: 'research'");
    expect(source).toContain("outlook: 'briefing'");
    expect(source).toContain('window.location.replace(`/terminal/${clean.size ? `?${clean}` : \'\'}#${proDestination}`)');
    const html = await read('public/astrofolio/index.html');
    for (const id of ['market', 'briefing', 'research', 'outlook']) {
      expect(html).toContain(`<span id="${id}" class="terminal-compat-target" aria-hidden="true"></span>`);
    }
  });

  it('leaves technical Registry instruments on the technical branch', async () => {
    const source = await read('src/app.jsx');
    const start = source.indexOf('<main id="main" className="zd technical-registry">');
    const mounted = source.slice(start, source.indexOf('</main>', start));
    expect(mounted).toContain('<PulseSection />');
    expect(mounted).toContain('<StandingsSection />');
    const standings = functionBlock(source, 'StandingsSection');
    expect(standings).toContain('entry?.capturedAt || dist?.capturedAt');
    expect(standings).toContain('Each sign keeps its own');
    expect(standings).toContain('Token accounts are');
    expect(standings).toContain('not verified people or unique wallet owners');
    expect(standings).not.toContain('wallet concentration is lower');
  });
});
