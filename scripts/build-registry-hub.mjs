// Generates the quiet authority hub at /registry/.
//
// The Registry is deliberately separate from consumer-facing Astrofolio and the
// expert Terminal. It is a static, first-party verification surface: twelve records,
// twenty-four official addresses, two networks, and links to the canonical
// data and methodology. The address verifier is a progressive enhancement;
// every address remains readable and searchable when JavaScript is disabled.
//
//   node scripts/build-registry-hub.mjs
//   node scripts/build-registry-hub.mjs --check

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SIGN_ORDER } from './sign-data.mjs';
import { NAV_SIGNS, wingNavCss, wingNavHtml, wingNavScript } from './wing-nav.mjs';
import { REGISTRY_ESTABLISHED } from '../src/lib/registry-establishment.mjs';
import { GUIDE_LOADER_MARKER, guideLoaderSource } from '../src/lib/assistant/guide-loader.mjs';
import { SITE_FOOTER_STYLESHEET, renderStaticFooter } from './site-footer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const registryPath = resolve(root, 'public/registry/zodiacs.registry.json');
const outputPath = resolve(root, 'public/registry/index.html');
const checkOnly = process.argv.includes('--check');

const registry = JSON.parse(await readFile(registryPath, 'utf8'));

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function assertRegistryShape() {
  if (!Array.isArray(registry.assets) || registry.assets.length !== 12) {
    throw new Error(`Registry hub requires 12 assets; found ${registry.assets?.length ?? 0}`);
  }

  const signs = new Set(registry.assets.map((asset) => asset.sign));
  for (const sign of SIGN_ORDER) {
    if (!signs.has(sign)) throw new Error(`Registry hub is missing ${sign}`);
  }

  const official = registry.assets.flatMap((asset) => (
    (asset.representations ?? []).filter((representation) => representation.isOfficialRepresentation === true)
  ));
  if (official.length !== 24) {
    throw new Error(`Registry hub requires 24 official representations; found ${official.length}`);
  }

  for (const asset of registry.assets) {
    const representations = official.filter((representation) => representation.sign === asset.sign);
    const networks = new Set(representations.map((representation) => representation.chain));
    if (representations.length !== 2 || !networks.has('solana') || !networks.has('base')) {
      throw new Error(`${asset.displayName} requires one official Solana and one official Base address`);
    }
  }
}

assertRegistryShape();

const assets = SIGN_ORDER.map((sign, index) => {
  const asset = registry.assets.find((candidate) => candidate.sign === sign);
  const navSign = NAV_SIGNS.find((candidate) => candidate.slug === sign);
  const representations = asset.representations.filter((representation) => representation.isOfficialRepresentation === true);
  const solana = representations.find((representation) => representation.chain === 'solana');
  const base = representations.find((representation) => representation.chain === 'base');
  return {
    ...asset,
    index: index + 1,
    glyph: navSign?.glyph ?? '',
    hue: navSign?.hue ?? '#c6ccda',
    solana,
    base,
  };
});

const verifierIndex = assets.flatMap((asset) => [
  {
    sign: asset.sign,
    name: asset.displayName,
    chain: 'Solana',
    role: 'verified original address',
    address: asset.solana.address,
    normalized: asset.solana.address,
  },
  {
    sign: asset.sign,
    name: asset.displayName,
    chain: 'Base',
    role: 'verified Base address',
    address: asset.base.address,
    normalized: asset.base.address.toLowerCase(),
  },
]);

function renderNetwork(asset, representation, label, role) {
  return `<div class="record__network">
              <div class="record__network-head"><span>${esc(label)}</span><small>${esc(role)}</small></div>
              <code>${esc(representation.address)}</code>
            </div>`;
}

function renderRecord(asset) {
  return `<article class="record" id="${esc(asset.sign)}" style="--sign:${esc(asset.hue)}" data-registry-record>
          <header class="record__head">
            <a class="record__identity" href="/registry/${esc(asset.sign)}/" aria-label="Open the ${esc(asset.displayName)} profile">
              <picture class="record__icon" aria-hidden="true">
                <source srcset="/assets/zodiac-icons/128/${esc(asset.sign)}.avif" type="image/avif" />
                <img src="/assets/zodiac-icons/128/${esc(asset.sign)}.webp" width="48" height="48" alt="" loading="lazy" decoding="async" />
              </picture>
              <span><small>${esc(asset.glyph)} · ${esc(asset.metadata.element)} sign</small><strong>${esc(asset.displayName)}</strong></span>
            </a>
            <a class="record__open" href="/registry/${esc(asset.sign)}/"><span>View profile</span><i aria-hidden="true">→</i></a>
          </header>
          <details class="record__details">
            <summary>Verified token addresses</summary>
            <div class="record__networks">
              ${renderNetwork(asset, asset.solana, 'Solana address', 'Verified')}
              ${renderNetwork(asset, asset.base, 'Base address', 'Verified')}
            </div>
          </details>
        </article>`;
}

function renderNav() {
  // The wing navigation's public chip leads to consumer-facing Astrofolio.
  // Registry is an authority page, so Astrofolio is intentionally not current.
  return wingNavHtml({ includeSearch: true })
    .replaceAll('href="/registry/"', 'href="/astrofolio/"')
    .replaceAll(' aria-current="page"', '');
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Zodiacs.org', item: 'https://zodiacs.org/' },
        { '@type': 'ListItem', position: 2, name: 'Zodiacs Registry', item: 'https://zodiacs.org/registry/' },
      ],
    },
    {
      '@type': 'Dataset',
      '@id': 'https://zodiacs.org/registry/zodiacs.registry.json#dataset',
      name: 'Zodiacs Registry',
      description: 'The public data behind the twelve Zodiac profiles and their verified token addresses.',
      url: 'https://zodiacs.org/registry/zodiacs.registry.json',
      creator: { '@type': 'Organization', name: 'Zodiacs.org', url: 'https://zodiacs.org/' },
      isAccessibleForFree: true,
      distribution: {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: 'https://zodiacs.org/registry/zodiacs.registry.json',
      },
    },
    {
      '@type': 'WebPage',
      '@id': 'https://zodiacs.org/registry/#page',
      url: 'https://zodiacs.org/registry/',
      name: 'The 12 Zodiac Profiles',
      description: 'The twelve Zodiac signs, their stories, shared birthdays and verified public records.',
      inLanguage: 'en',
      mainEntity: { '@id': 'https://zodiacs.org/registry/zodiacs.registry.json#dataset' },
      isPartOf: { '@type': 'WebSite', name: 'Zodiacs.org', url: 'https://zodiacs.org/' },
    },
  ],
};

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#08090c" />
  <meta name="color-scheme" content="dark" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" />
  <title>The 12 Zodiac Profiles | Zodiacs.org</title>
  <meta name="description" content="The twelve Zodiac signs, their stories, shared birthdays and verified public records." />
  <link rel="canonical" href="https://zodiacs.org/registry/" />
  <link rel="icon" type="image/svg+xml" sizes="any" href="/assets/app-icons/v3/favicon.svg" />
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/app-icons/v3/favicon-16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/app-icons/v3/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="96x96" href="/assets/app-icons/v3/favicon-96.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/app-icons/v3/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  ${SITE_FOOTER_STYLESHEET}
  <script>
    (function(){
      var query=new URLSearchParams(location.search);
      var proQuery=['rank','outlook'].some(function(key){return query.has(key);});
      var consumerQuery=query.has('sign');
      var hash=location.hash.slice(1).toLowerCase();
      var proHash=['market','briefing','research','outlook'].includes(hash);
      var consumerHash=['sign-gallery','gallery',${SIGN_ORDER.map((sign) => `'${sign}'`).join(',')}].includes(hash);
      if(proQuery||proHash){
        var proHashValue=hash==='outlook'?'briefing':hash;
        location.replace('/terminal/'+location.search+(proHashValue?'#'+proHashValue:''));
      }
      else if(consumerQuery||consumerHash) location.replace('/astrofolio/'+location.search+location.hash);
    })();
  </script>

  <meta property="og:site_name" content="Zodiacs" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="The 12 Zodiac Profiles | Zodiacs.org" />
  <meta property="og:description" content="The twelve Zodiac signs, their stories, shared birthdays and verified public records." />
  <meta property="og:url" content="https://zodiacs.org/registry/" />
  <meta property="og:image" content="https://zodiacs.org/assets/og/v2/registry.png" />
  <meta property="og:image:alt" content="The twelve Zodiac profiles on Zodiacs.org" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="The 12 Zodiac Profiles | Zodiacs.org" />
  <meta name="twitter:description" content="The twelve Zodiac signs, their stories, shared birthdays and verified public records." />
  <meta name="twitter:image" content="https://zodiacs.org/assets/og/v2/registry.png" />
  <script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll('<', '\\u003c')}</script>

  <style>
    @font-face { font-family:'JetBrains Mono'; src:url('/fonts/jetbrains-mono-latin-wght-normal.woff2') format('woff2-variations'); font-weight:300 600; font-style:normal; font-display:swap; }
    @font-face { font-family:'Instrument Sans'; src:url('/fonts/instrument-sans-latin-wght-normal.woff2') format('woff2-variations'); font-weight:400 650; font-style:normal; font-display:swap; }

    @font-face { font-family:'EB Garamond'; src:url('/fonts/eb-garamond-latin-400-normal.woff2') format('woff2'); font-weight:400; font-display:swap; }
    :root {
      --bg:#08090c; --surface:#0d0f14; --surface-2:#12141b; --ink:#eef1f7; --ink-2:#c6ccda;
      --ink-dim:#8e96ab; --ink-mute:#7a8397; --hair:rgba(198,204,218,.11); --hair-2:rgba(198,204,218,.18);
      --silver:#d3d8e4; --pastel:#e0a9b4; --serif:'EB Garamond',Georgia,serif;
      --sans:'Instrument Sans','Instrument Sans Fallback','Instrument Sans Fallback Android',system-ui,-apple-system,sans-serif;
      --mono:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;
      --ease:cubic-bezier(.32,.72,0,1); --page:min(1180px,calc(100% - 40px));
    }
    * { box-sizing:border-box; }
    html { background:var(--bg); color:var(--ink); scroll-behavior:smooth; }
    body { margin:0; min-width:280px; background:
      radial-gradient(72% 42% at 78% 5%,rgba(224,169,180,.07),transparent 66%),
      radial-gradient(52% 34% at 8% 22%,rgba(174,143,201,.045),transparent 70%),var(--bg);
      font-family:var(--sans); -webkit-font-smoothing:antialiased; }
    body::before { content:""; position:fixed; inset:0; z-index:5; pointer-events:none; opacity:.16; background-image:radial-gradient(rgba(238,241,247,.16) .55px,transparent .65px); background-size:17px 17px; mask-image:linear-gradient(to bottom,black,transparent 72%); }
    a { color:inherit; }
    [id] { scroll-margin-top:96px; }
    button,input { font:inherit; }
    button { cursor:pointer; }
    :focus-visible { outline:2px solid #eef1f7; outline-offset:4px; }
    .skip { position:fixed; z-index:100; left:16px; top:12px; transform:translateY(-150%); padding:12px 18px; border-radius:999px; background:var(--ink); color:var(--bg); font:600 13px var(--sans); text-decoration:none; transition:transform 260ms var(--ease); }
    .skip:focus { transform:translateY(0); }
    ${wingNavCss().replace(/[ \t]+$/gm, '').trim()}

    .page { width:var(--page); margin:0 auto; padding:clamp(130px,16vw,184px) 0 88px; }
    .crumbs { margin:0 0 48px; font:400 9px/1.5 var(--mono); letter-spacing:.2em; text-transform:uppercase; color:var(--ink-mute); }
    .crumbs ol { display:flex; flex-wrap:wrap; gap:8px; margin:0; padding:0; list-style:none; }
    .crumbs li+li::before { content:"/"; margin-right:8px; color:var(--hair-2); }
    .crumbs a { min-height:44px; display:inline-flex; align-items:center; text-underline-offset:4px; }

    .hero { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr); gap:clamp(50px,9vw,132px); align-items:end; padding-bottom:clamp(72px,10vw,120px); }
    .hero__seal { display:inline-flex; align-items:center; gap:10px; margin-bottom:24px; color:var(--ink-dim); font:450 9px/1 var(--mono); letter-spacing:.24em; text-transform:uppercase; }
    .hero__seal::before { display:none; content:""; width:6px; height:6px; border-radius:50%; background:var(--pastel); box-shadow:0 0 0 5px rgba(224,169,180,.07); }
    h1 { max-width:790px; margin:0; font:650 clamp(58px,9vw,118px)/.9 var(--sans); letter-spacing:-.05em; text-wrap:balance; }
    .hero__deck { max-width:54ch; margin:36px 0 0; color:var(--ink-2); font:400 clamp(17px,2vw,21px)/1.58 var(--sans); text-wrap:pretty; }
    .hero__facts { margin:0; border-top:1px solid var(--hair-2); }
    .hero__facts div { display:grid; grid-template-columns:1fr auto; gap:20px; align-items:baseline; padding:20px 0; border-bottom:1px solid var(--hair); }
    .hero__facts dt { color:var(--ink-dim); font:400 9px/1.5 var(--mono); letter-spacing:.18em; text-transform:uppercase; }
    .hero__facts dd { margin:0; color:var(--ink); font:600 clamp(28px,4vw,43px)/1 var(--sans); font-variant-numeric:tabular-nums; }
    .hero__facts small { display:block; grid-column:1/-1; margin-top:-10px; color:var(--ink-mute); font:400 10px/1.5 var(--mono); letter-spacing:.04em; }

    .verifier-shell { padding:7px; border-radius:31px; background:rgba(198,204,218,.035); box-shadow:inset 0 0 0 1px rgba(238,241,247,.09),0 32px 90px -58px rgba(183,217,176,.45); }
    .verifier { position:relative; overflow:hidden; padding:clamp(26px,5vw,58px); border-radius:24px; background:radial-gradient(90% 130% at 0 0,rgba(183,217,176,.055),transparent 54%),var(--surface); box-shadow:inset 0 1px 0 rgba(238,241,247,.09),inset 0 0 0 1px rgba(0,0,0,.55); }
    .verifier::after { content:"12"; position:absolute; right:-.03em; bottom:-.31em; color:rgba(238,241,247,.022); font:650 clamp(170px,26vw,360px)/1 var(--sans); pointer-events:none; }
    .verifier__layout { position:relative; z-index:1; display:grid; grid-template-columns:minmax(220px,.55fr) minmax(0,1.45fr); gap:clamp(36px,7vw,96px); align-items:end; }
    .eyebrow { margin:0 0 13px; color:var(--ink-dim); font:450 9px/1.5 var(--mono); letter-spacing:.21em; text-transform:uppercase; }
    h2 { margin:0; color:var(--ink); font:600 clamp(38px,6vw,67px)/.98 var(--sans); letter-spacing:-.035em; text-wrap:balance; }
    .verifier__copy { max-width:35ch; margin:18px 0 0; color:var(--ink-dim); font:400 14px/1.65 var(--sans); }
    .verify-form { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; }
    .verify-form label { grid-column:1/-1; color:var(--ink-2); font:500 13px/1.4 var(--sans); }
    .verify-form input { min-width:0; height:58px; padding:0 18px; border:0; border-radius:17px; color:var(--ink); background:#090b0f; box-shadow:inset 0 0 0 1px var(--hair-2),inset 0 2px 8px rgba(0,0,0,.25); font:400 13px/1 var(--mono); transition:box-shadow 360ms var(--ease),background 360ms var(--ease); }
    .verify-form input::placeholder { color:var(--ink-mute); font-family:var(--sans); }
    .verify-form input:focus { outline:0; background:#0b0d12; box-shadow:inset 0 0 0 1px rgba(238,241,247,.62),0 0 0 4px rgba(224,169,180,.08); }
    .verify-form button,.terminal-link { min-height:58px; border:0; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; gap:15px; padding:5px 6px 5px 22px; background:var(--ink); color:var(--bg); font:600 13px/1 var(--sans); text-decoration:none; transition:transform 240ms var(--ease),background 400ms var(--ease); }
    .verify-form button span,.terminal-link span:last-child { display:grid; place-items:center; width:46px; height:46px; border-radius:50%; background:rgba(8,9,12,.1); font:400 17px var(--sans); transition:transform 420ms var(--ease); }
    .verify-form button:hover,.terminal-link:hover { background:#fff; transform:translateY(-1px); }
    .verify-form button:hover span,.terminal-link:hover span:last-child { transform:translate(2px,-1px); }
    .verify-form button:active,.terminal-link:active { transform:scale(.985); }
    .verify-result { min-height:47px; margin:14px 0 0; padding:13px 2px 0; border-top:1px solid var(--hair); color:var(--ink-dim); font:400 12px/1.55 var(--mono); overflow-wrap:anywhere; }
    .verify-result strong { color:var(--ink); font-weight:500; }
    .verify-result a { color:var(--ink); text-underline-offset:4px; }
    .verify-result[data-state="verified"]::before { content:"Verified"; display:inline-block; margin-right:10px; color:#b7d9b0; font:500 8px/1 var(--mono); letter-spacing:.18em; text-transform:uppercase; }
    .verify-result[data-state="unknown"] { color:#e0b080; }
    .no-script { margin:12px 0 0; color:var(--ink-mute); font:400 11px/1.6 var(--mono); }

    .section { padding-top:clamp(100px,14vw,164px); }
    .section--profiles { padding-top:0; }
    .section__head { display:grid; grid-template-columns:minmax(0,.7fr) minmax(260px,.3fr); gap:36px; align-items:end; margin-bottom:46px; padding-bottom:25px; border-bottom:1px solid var(--hair-2); }
    .section__head p:last-child { max-width:43ch; margin:0; color:var(--ink-dim); font:400 14px/1.65 var(--sans); text-wrap:pretty; }
    .records { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:clamp(32px,6vw,78px); }
    .record { min-width:0; padding:28px 0 32px; border-bottom:1px solid var(--hair); content-visibility:auto; contain-intrinsic-size:auto 286px; }
    .record:nth-child(-n+2) { border-top:1px solid var(--hair); }
    .record__head { display:flex; align-items:center; justify-content:space-between; gap:20px; }
    .record__identity { min-width:0; min-height:58px; display:flex; align-items:center; gap:15px; text-decoration:none; }
    .record__icon { width:48px; height:48px; flex:0 0 auto; border-radius:50%; background:color-mix(in oklab,var(--sign) 84%,#fff 16%); box-shadow:0 0 0 5px color-mix(in oklab,var(--sign) 10%,transparent),inset 0 1px 0 rgba(255,255,255,.3); overflow:hidden; }
    .record__icon img { display:block; width:100%; height:100%; }
    .record__identity span { min-width:0; display:grid; gap:4px; }
    .record__identity small { color:var(--ink-mute); font:400 8px/1.2 var(--mono); letter-spacing:.16em; text-transform:uppercase; }
    .record__identity strong { color:var(--ink); font:600 25px/1 var(--sans); }
    .record__open { min-height:44px; display:inline-flex; align-items:center; gap:9px; color:var(--ink-dim); font:500 11px/1 var(--sans); text-decoration:none; }
    .record__open i { display:grid; place-items:center; width:32px; height:32px; border-radius:50%; background:rgba(198,204,218,.055); box-shadow:inset 0 0 0 1px var(--hair-2); font-style:normal; transition:transform 360ms var(--ease),background 360ms var(--ease); }
    .record__open:hover { color:var(--ink); }
    .record__open:hover i { transform:translate(2px,-1px); background:rgba(198,204,218,.1); }
    .record__details { margin:18px 0 0 63px; border-top:1px solid var(--hair); }
    .record__details summary { min-height:44px; display:flex; align-items:center; justify-content:space-between; gap:16px; color:var(--ink-dim); font:500 12px/1.4 var(--sans); cursor:pointer; list-style:none; }
    .record__details summary::-webkit-details-marker { display:none; }
    .record__details summary::after { content:"+"; color:var(--ink-mute); font:400 18px/1 var(--sans); }
    .record__details[open] summary::after { content:"−"; }
    .record__networks { padding:0; }
    .record__network { padding:13px 0; border-top:1px solid var(--hair); }
    .record__network-head { display:flex; justify-content:space-between; gap:16px; margin-bottom:7px; }
    .record__network-head span,.record__network-head small { color:var(--ink-dim); font:400 8px/1.35 var(--mono); letter-spacing:.12em; text-transform:uppercase; }
    .record__network-head small { color:var(--ink-mute); text-align:right; }
    .record__network code { display:block; max-width:100%; color:var(--ink-2); font:400 10.5px/1.55 var(--mono); overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }

    .authority { display:grid; grid-template-columns:minmax(220px,.38fr) minmax(0,.62fr); gap:clamp(48px,9vw,128px); align-items:start; }
    .authority__intro { position:sticky; top:108px; }
    .authority__intro p:last-child { max-width:38ch; margin:20px 0 0; color:var(--ink-dim); font:400 14px/1.68 var(--sans); }
    .authority__details > summary { min-height:52px; display:flex; align-items:center; justify-content:space-between; gap:18px; border-top:1px solid var(--hair-2); border-bottom:1px solid var(--hair); color:var(--ink-2); font:600 14px/1.4 var(--sans); cursor:pointer; list-style:none; }
    .authority__details > summary::-webkit-details-marker { display:none; }
    .authority__details > summary::after { content:"+"; color:var(--ink-mute); font:400 20px/1 var(--sans); }
    .authority__details[open] > summary::after { content:"−"; }
    .authority__links { border-top:1px solid var(--hair-2); }
    .authority__link { min-height:92px; display:grid; grid-template-columns:52px minmax(0,1fr) 42px; gap:18px; align-items:center; border-bottom:1px solid var(--hair); color:var(--ink); text-decoration:none; transition:background 500ms var(--ease),padding 500ms var(--ease); }
    .authority__link:hover { padding-inline:14px; background:rgba(198,204,218,.027); }
    .authority__number { color:var(--ink-mute); font:400 8px var(--mono); letter-spacing:.16em; }
    .authority__link span:nth-child(2) { min-width:0; display:grid; gap:5px; }
    .authority__link strong { font:600 clamp(20px,3vw,27px)/1 var(--sans); }
    .authority__link small { color:var(--ink-dim); font:400 11px/1.5 var(--sans); }
    .authority__arrow { display:grid; place-items:center; width:36px; height:36px; border-radius:50%; background:rgba(198,204,218,.05); box-shadow:inset 0 0 0 1px var(--hair); transition:transform 400ms var(--ease); }
    .authority__link:hover .authority__arrow { transform:translate(3px,-1px); }
    .authority__notice { margin:23px 0 0; max-width:68ch; color:var(--ink-mute); font:400 10px/1.75 var(--mono); letter-spacing:.025em; }

    .terminal { margin-top:clamp(112px,15vw,180px); padding:clamp(32px,6vw,66px); display:flex; align-items:center; justify-content:space-between; gap:48px; border-top:1px solid var(--hair-2); border-bottom:1px solid var(--hair-2); background:radial-gradient(65% 130% at 0 50%,rgba(224,169,180,.055),transparent 72%); }
    .terminal h2 { max-width:620px; }
    .terminal p { max-width:50ch; margin:17px 0 0; color:var(--ink-dim); font:400 14px/1.65 var(--sans); }
    .terminal-link { flex:0 0 auto; }

    .footer { display:flex; justify-content:space-between; align-items:flex-start; gap:30px; margin-top:74px; padding-top:28px; border-top:1px solid var(--hair); color:var(--ink-mute); font:400 9px/1.8 var(--mono); letter-spacing:.14em; text-transform:uppercase; }
    .footer__links { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px 22px; }
    .footer a { min-height:44px; display:inline-flex; align-items:center; color:var(--ink-dim); text-decoration:none; }
    .footer a:hover { color:var(--ink); }

    @media (max-width:767px) {
      @font-face { font-family:'EB Garamond'; src:url('/fonts/eb-garamond-latin-400-normal.woff2') format('woff2'); font-weight:400; font-display:swap; }
    :root { --page:min(100% - 32px,1180px); }
      .page { padding-top:116px; padding-bottom:56px; }
      .crumbs { margin-bottom:34px; }
      .hero { grid-template-columns:1fr; gap:52px; padding-bottom:72px; }
      h1 { font-size:clamp(52px,17vw,78px); line-height:.92; }
      .hero__deck { margin-top:28px; }
      .hero__facts div { padding:16px 0; }
      .verifier-shell { margin-inline:-1px; border-radius:25px; }
      .verifier { padding:27px 20px 24px; border-radius:19px; }
      .verifier__layout { grid-template-columns:1fr; gap:30px; }
      .verify-form { grid-template-columns:1fr; }
      .verify-form button { width:100%; justify-content:space-between; }
      .section { padding-top:96px; }
      .section__head { grid-template-columns:1fr; gap:18px; margin-bottom:28px; }
      .records { grid-template-columns:1fr; }
      .record:nth-child(2) { border-top:0; }
      .record__head { align-items:flex-start; }
      .record__open span { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
      .record__details { margin-left:0; }
      .record__networks { padding-left:0; }
      .authority { grid-template-columns:1fr; gap:38px; }
      .authority__intro { position:static; }
      .authority__link { grid-template-columns:35px minmax(0,1fr) 36px; gap:12px; min-height:102px; }
      .authority__link:hover { padding-inline:0; background:none; }
      .terminal { margin-inline:-16px; padding:42px 16px 48px; flex-direction:column; align-items:flex-start; gap:30px; }
      .terminal-link { width:100%; justify-content:space-between; }
      .footer { flex-direction:column; }
      .footer__links { justify-content:flex-start; }
    }
    @media (max-width:359px) {
      @font-face { font-family:'EB Garamond'; src:url('/fonts/eb-garamond-latin-400-normal.woff2') format('woff2'); font-weight:400; font-display:swap; }
    :root { --page:calc(100% - 24px); }
      .record { padding-block:24px; }
      .record__identity { gap:11px; }
      .record__icon { width:44px; height:44px; }
      .record__identity strong { font-size:23px; }
      .record__network code { font-size:9.8px; }
      .authority__link { grid-template-columns:28px minmax(0,1fr) 34px; gap:9px; }
      .authority__arrow { width:34px; height:34px; }
      .terminal { margin-inline:0; }
    }
    @media (prefers-reduced-motion:reduce) {
      html { scroll-behavior:auto; }
      *,*::before,*::after { transition-duration:.01ms!important; animation-duration:.01ms!important; animation-iteration-count:1!important; }
    }
    @media print {
      .wnav-wrap,.wnav-menu,.skip,.terminal { display:none!important; }
      body { background:#fff; color:#111; }
      .page { width:100%; padding:24px; }
      .record { break-inside:avoid; }
      .record__network code,.record__identity strong,h1,h2 { color:#111; }
    }
    .hero { display: block; padding-bottom: 28px; }
    .hero h1 { font-family: var(--serif); font-size: clamp(44px, 6vw, 72px); font-weight: 400; }
    .hero__deck { max-width: 48ch; margin-top: 18px; }
    .section__head h2 { font: 400 30px/1.1 var(--serif); }
    .record__identity small { font-size: 12px; letter-spacing: .02em; }
    .record__details { margin-top: 10px; }
    .page { padding-top: 100px; }
    .crumbs { margin-bottom: 20px; }
    .record { padding-block: 20px; }
    .hero__facts dt, .hero__facts small, .crumbs, .eyebrow, .record__dates { font-size: 12px; letter-spacing: .02em; }
    .section--profiles { padding-top: 0; }
    .section--profiles .section__head { margin-bottom: 16px; }
    .section--profiles .section__head p { display: none; }
    .profile-context { margin-top: 28px; color: var(--ink-2); }
    .profile-context summary { cursor: pointer; min-height: 44px; padding-block: 12px; }
    .profile-context .hero__facts { max-width: 600px; }
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to Registry</a>
  ${renderNav()}

  <main class="page" id="main">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Zodiacs.org</a></li><li aria-current="page">Registry</li></ol></nav>

    <header class="hero">
      <div>
        <p class="hero__seal">All 12 Zodiac signs</p>
        <h1>Find your sign.</h1>
        <p class="hero__deck">The twelve Zodiac signs, their stories, shared birthdays and verified public records.</p>
      </div>

    </header>

    <section class="section section--profiles" aria-labelledby="records-title">
      <header class="section__head">
        <div><p class="eyebrow">All 12 signs</p><h2 id="records-title">Choose your Zodiac.</h2></div>
        <p>Each profile brings together its dates, famous birthdays, recent Wikipedia views, price history and current rank.</p>
      </header>
      <div class="records">
        ${assets.map(renderRecord).join('\n')}
      </div>
    </section>

    <details class="profile-context"><summary>What each profile includes</summary>      <dl class="hero__facts" aria-label="What the profiles include">
        <div><dt>Famous birthdays</dt><dd>48</dd><small>four sourced names for each sign</small></div>
        <div><dt>Attention</dt><dd>30 days</dd><small>average English Wikipedia views</small></div>
        <div><dt>Market standings</dt><dd>Daily</dd><small>price history and current ranks</small></div>
      </dl></details>

    <section class="section" aria-label="Token address checker">
      <div class="verifier-shell" id="verify" aria-labelledby="verify-title">
        <div class="verifier">
          <div class="verifier__layout">
            <div>
              <p class="eyebrow">Token safety</p>
              <h2 id="verify-title">Check a token address.</h2>
              <p class="verifier__copy">Every token has a long address, like an account number. Paste one here and we’ll check whether it matches the official list.</p>
            </div>
            <div>
              <form class="verify-form" action="/registry/" method="get" role="search" data-address-verifier>
                <label for="registry-address">Token address</label>
                <input id="registry-address" name="address" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="Paste the complete address" aria-describedby="verify-result" />
                <button type="submit">Check <span aria-hidden="true">→</span></button>
              </form>
              <p class="verify-result" id="verify-result" aria-live="polite" data-verifier-result>Checks the verified addresses for all 12 signs.</p>
              <noscript><p class="no-script">Address checking is unavailable here. The complete list is still shown above.</p></noscript>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section authority" aria-labelledby="authority-title">
      <div class="authority__intro">
        <p class="eyebrow">For people who want the details</p>
        <h2 id="authority-title">How checking works.</h2>
      </div>
      <details class="authority__details">
        <summary>Technical records and tools</summary>
        <nav class="authority__links" aria-label="Registry resources">
          <a class="authority__link" href="/registry/zodiacs.registry.json"><span class="authority__number">01</span><span><strong>Download the full list</strong><small>A machine-readable copy of all verified addresses.</small></span><span class="authority__arrow" aria-hidden="true">↗</span></a>
          <a class="authority__link" href="/registry/technical/"><span class="authority__number">02</span><span><strong>How the list is maintained</strong><small>Sources, update rules, and market-data methods.</small></span><span class="authority__arrow" aria-hidden="true">→</span></a>
          <a class="authority__link" href="/sdk/"><span class="authority__number">03</span><span><strong>Tools for developers</strong><small>Read-only tools built from the public records.</small></span><span class="authority__arrow" aria-hidden="true">→</span></a>
          <a class="authority__link" href="/disclosure/"><span class="authority__number">04</span><span><strong>Disclosure and sources</strong><small>Origins, limits, risks, and corrections.</small></span><span class="authority__arrow" aria-hidden="true">→</span></a>
          <a class="authority__link" href="/registry/collection/"><span class="authority__number">05</span><span><strong>View a public collection</strong><small>A read-only view of recognized Zodiac tokens.</small></span><span class="authority__arrow" aria-hidden="true">→</span></a>
          <a class="authority__link" href="/registry/wallet-chart/"><span class="authority__number">06</span><span><strong>Check a public address</strong><small>See which Zodiac tokens a public address contains.</small></span><span class="authority__arrow" aria-hidden="true">→</span></a>
          <p class="authority__notice">“Verified” only means an address matches this published list. It does not prove who owns it, that it is safe, or that it will keep its value.</p>
        </nav>
      </details>
    </section>

    <aside class="terminal" aria-labelledby="terminal-title">
      <div><p class="eyebrow">More market detail</p><h2 id="terminal-title">Want the full market view?</h2><p>See prices, charts, and current standings for all 12 signs.</p></div>
      <a class="terminal-link" href="/terminal/"><b>View market data</b><span aria-hidden="true">→</span></a>
    </aside>

  </main>

  ${renderStaticFooter({
    tagline: 'The official public Registry of the Twelve.',
    established: REGISTRY_ESTABLISHED,
  })}

  <script>
  (function(){
    'use strict';
    ${wingNavScript().replace(/[ \t]+$/gm, '').trim()}

    var entries=${JSON.stringify(verifierIndex).replaceAll('<', '\\u003c')};
    var form=document.querySelector('[data-address-verifier]');
    var input=document.getElementById('registry-address');
    var result=document.querySelector('[data-verifier-result]');

    function verify(raw, updateUrl){
      var value=String(raw||'').trim();
      if(!value){
        result.removeAttribute('data-state');
        result.textContent='Paste a complete token address.';
        return;
      }
      var isBase=/^0x/i.test(value);
      var normalized=isBase?value.toLowerCase():value;
      var match=entries.find(function(entry){ return entry.normalized===normalized; });
      result.replaceChildren();
      if(match){
        result.setAttribute('data-state','verified');
        var strong=document.createElement('strong');
        strong.textContent=match.name+' · '+match.role+'. ';
        var link=document.createElement('a');
        link.href='/registry/'+match.sign+'/#record';
        link.textContent='Open '+match.name+' profile →';
        result.append(strong,link);
      }else{
        result.setAttribute('data-state','unknown');
        result.textContent='This address is not in the Zodiacs Registry. Check every character before continuing.';
      }
      if(updateUrl&&history.replaceState){
        var url=new URL(location.href);
        url.searchParams.set('address',value);
        history.replaceState(null,'',url.pathname+'?'+url.searchParams.toString()+url.hash);
      }
    }

    form.addEventListener('submit',function(event){ event.preventDefault(); verify(input.value,true); });
    var initial=new URLSearchParams(location.search).get('address');
    if(initial){ input.value=initial; verify(initial,false); }
  })();
  </script>

  <script data-guide-loader="${GUIDE_LOADER_MARKER}">
${guideLoaderSource('en')}
  </script>
</body>
</html>
`;

if (checkOnly) {
  const committed = await readFile(outputPath, 'utf8').catch(() => '');
  if (committed !== html) {
    console.error('public/registry/index.html is stale. Run: node scripts/build-registry-hub.mjs');
    process.exitCode = 1;
  } else {
    console.log('Registry hub is current.');
  }
} else {
  await writeFile(outputPath, html, 'utf8');
  console.log(`Wrote /registry/index.html (${html.length} bytes; 12 identities, 24 addresses, 2 networks).`);
}
