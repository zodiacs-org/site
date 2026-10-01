// Generates the twelve official token records (/registry/{sign}/index.html).
// The top-level /{sign}/ URLs belong to
// the astrology guides rendered by Astro.
//
//   node scripts/build-sign-pages.mjs
//
// Content comes from two sources:
//   - public/registry/zodiacs.registry.json (addresses, metadata — source of truth)
//   - scripts/sign-data.mjs                 (sign stories, history, key objects)
//
// The output is committed static HTML, consistent with how this site ships
// (no runtime build). Pages share the main site's Cosmic Void surfaces while
// using plain language, sans-serif interfaces, and editorial display headings.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  SIGN_PAGES, CHANNELS, SIGN_ORDER,
  dexscreenerUrl
} from './sign-data.mjs';
import {
  CONSTELLATIONS, HYG_ATTRIBUTION, validateConstellations
} from './constellation-data.mjs';
import { NAV_SIGNS, wingNavHtml, wingNavCss, wingNavScript } from './wing-nav.mjs';
import { OG_SIGNS } from '../src/strings/seo.signs.mjs';
import {
  SIGN_PROFILE_PEOPLE,
  SIGN_PROFILE_RALLY_LINES,
  SIGN_PROFILE_PROTECTED_LINKS,
  registryProfilePersonLinkRel,
  validateSignProfileRallyLines,
} from './sign-profile-data.mjs';
import { brandIconLinkMarkup } from '../src/lib/brand-icons.mjs';
import { EN } from '../src/strings/en.mjs';
import { GUIDE_LOADER_MARKER, guideLoaderSource } from '../src/lib/assistant/guide-loader.mjs';
import { SITE_FOOTER_STYLESHEET, renderStaticFooter } from './site-footer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const profilePolishCss = await readFile(resolve(here, 'registry-profile-polish.css'), 'utf8');

// The official token records live at /registry/ (301 from the old /collect/
// path via vercel.json).
const BASE = '/registry';
const REGISTRY_OG_BASE = '/assets/og/registry/v3';
const signPath = (slug) => `${BASE}/${slug}/`;
const signUrl = (slug) => `https://zodiacs.org${signPath(slug)}`;
// Bump only when a sculpture must be re-fetched by clients that may have
// cached an incomplete response for the stable asset URL.
const SCULPTURE_ASSET_REVISIONS = Object.freeze({ scorpio: '20260818' });
const sculpturePath = (slug) => (
  `/assets/nuggets/${slug}.png${SCULPTURE_ASSET_REVISIONS[slug] ? `?v=${SCULPTURE_ASSET_REVISIONS[slug]}` : ''}`
);

const registry = JSON.parse(
  await readFile(resolve(root, 'public/registry/zodiacs.registry.json'), 'utf8')
);
const pulse = JSON.parse(
  await readFile(resolve(root, 'public/assets/pulse.json'), 'utf8')
);
const distribution = JSON.parse(
  await readFile(resolve(root, 'public/assets/distribution.json'), 'utf8')
);
const thesisDisclosure = JSON.parse(
  await readFile(resolve(root, 'public/thesis/thesis-disclosure.json'), 'utf8')
);
const peopleRelease = JSON.parse(
  await readFile(resolve(root, 'src/data/people.json'), 'utf8')
);
const peopleIndexPolicy = JSON.parse(
  await readFile(resolve(root, 'docs/phase5/people-pilot/index-policy.json'), 'utf8')
);
const marketHistory = JSON.parse(
  await readFile(resolve(root, 'public/assets/data/registry-market-history.v1.json'), 'utf8')
);

const peopleBySlug = new Map(peopleRelease.people.map((person) => [person.slug, person]));
const latestMarketSnapshot = marketHistory.snapshots.at(-1) ?? null;
const protectedLinkPolicy = peopleIndexPolicy.expansion?.personSpecificLinkAuthorization;
const expectedProtectedProfiles = Object.keys(SIGN_PROFILE_PROTECTED_LINKS).sort();
const policyProtectedProfiles = [...(protectedLinkPolicy?.profiles ?? [])].sort();

if (
  protectedLinkPolicy?.surface !== '/registry/scorpio/'
  || policyProtectedProfiles.join(',') !== expectedProtectedProfiles.join(',')
) {
  throw new Error(
    'Registry protected People link policy must authorize only bill-gates and '
    + 'leonardo-dicaprio on /registry/scorpio/'
  );
}

const constellationErrors = validateConstellations(SIGN_ORDER);
if (constellationErrors.length) {
  throw new Error(`Invalid constellation data:\n${constellationErrors.join('\n')}`);
}
const rallyLineErrors = validateSignProfileRallyLines(SIGN_ORDER);
if (rallyLineErrors.length) {
  throw new Error(`Invalid Registry profile rally lines:\n${rallyLineErrors.join('\n')}`);
}

const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const esc = (s) => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function shortDate(isoDate) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

function pulseDate(value, includeYear = false) {
  const iso = String(value).replace(/^(\d{4})(\d{2})(\d{2})$/u, '$1-$2-$3');
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}), timeZone: 'UTC'
  }).format(new Date(`${iso}T12:00:00Z`));
}

function recordDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(date);
}

function groupedTokenAmount(value) {
  const match = String(value ?? '').match(/^(\d+)(?:\.(\d+))?$/u);
  if (!match) return 'Unavailable';
  const integer = match[1].replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  return match[2] ? `${integer}.${match[2]}` : integer;
}

function compactTokenAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Unavailable';
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2).replace(/\.00$/u, '')} billion`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(1).replace(/\.0$/u, '')} million`;
  return Math.round(amount).toLocaleString('en-US');
}

function roundedPct(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

function ownershipModel(slug, solana, base) {
  const snapshot = distribution.signs?.[slug] ?? null;
  const disclosure = thesisDisclosure.signs?.[slug] ?? null;
  if (!snapshot || !disclosure) throw new Error(`Ownership data missing: ${slug}`);
  const top1 = roundedPct(snapshot.top1Pct);
  const top10 = roundedPct(snapshot.top10Pct);
  const top20 = roundedPct(snapshot.top20Pct);
  if (
    top1 === null || top10 === null || top20 === null
    || top1 < 0 || top1 > top10 || top10 > top20 || top20 > 100
  ) {
    throw new Error(`Ownership percentages invalid: ${slug}`);
  }
  const capturedAt = snapshot.capturedAt ?? distribution.capturedAt;
  const captureMode = snapshot.captureMode;
  if (captureMode !== 'observed' && captureMode !== 'carried-forward') {
    throw new Error(`Ownership capture mode invalid: ${slug}`);
  }
  const segment = (value) => roundedPct(Math.max(0, value));
  const mintDisabled = disclosure.mintAuthority?.status === 'filled'
    && disclosure.mintAuthority?.value === 'renounced';
  const freezeDisabled = disclosure.freezeAuthority?.status === 'filled'
    && disclosure.freezeAuthority?.value === 'renounced';
  const bridgedFromSolana = base?.kind === 'bridged'
    && base?.originChain === 'solana'
    && base?.originAddress === solana.address;
  return {
    supply: snapshot.supply,
    supplyDisplay: compactTokenAmount(snapshot.supply),
    supplyExact: groupedTokenAmount(snapshot.supply),
    top1,
    top10,
    top20,
    segments: [
      { label: 'Largest token account', value: top1, className: 'largest' },
      { label: 'Next 9 token accounts', value: segment(top10 - top1), className: 'next-nine' },
      { label: 'Next 10 token accounts', value: segment(top20 - top10), className: 'next-ten' },
      { label: 'All other token accounts', value: segment(100 - top20), className: 'others' },
    ],
    capturedAt,
    capturedLabel: recordDate(capturedAt),
    snapshotLabel: captureMode === 'observed' ? 'Observed snapshot' : 'Carried-forward snapshot',
    isCarriedForward: captureMode === 'carried-forward',
    mintDisabled,
    mintChecked: recordDate(disclosure.mintAuthority?.asOf),
    freezeDisabled,
    freezeChecked: recordDate(disclosure.freezeAuthority?.asOf),
    bridgedFromSolana,
    verifyUrl: disclosure.supply?.verifyUrl ?? `https://solscan.io/token/${solana.address}`,
  };
}

// Every canonical sign stays in the standings. A sign with no indexed market
// cap keeps a null value (rendered as an em dash, never as $0) and sorts after
// the priced ones; the rank itself is only published when coverage is
// complete. The client-side rebuild below mirrors this exactly.
function marketStandings(snapshot) {
  const canonical = new Set(SIGN_ORDER);
  const seen = new Set();
  const marketCap = (asset) => {
    if (asset?.marketCapUsd === null || asset?.marketCapUsd === undefined || asset?.marketCapUsd === '') return null;
    const number = Number(asset.marketCapUsd);
    return Number.isFinite(number) && number >= 0 ? number : null;
  };
  return (snapshot?.assets ?? [])
    .filter((asset) => {
      if (!canonical.has(asset?.sign) || seen.has(asset.sign)) return false;
      seen.add(asset.sign);
      return true;
    })
    .map((asset) => ({ ...asset, marketCapUsd: marketCap(asset) }))
    .sort((a, b) => (
      (b.marketCapUsd ?? -1) - (a.marketCapUsd ?? -1)
      || SIGN_ORDER.indexOf(a.sign) - SIGN_ORDER.indexOf(b.sign)
    ));
}

const MARKET_RANK_MAX_AGE_MS = 48 * 60 * 60 * 1000;

function rankedMarketStandings(standings) {
  let previousValue = null;
  let previousRank = 0;
  return standings.map((asset, index) => {
    const rank = previousValue !== null && asset.marketCapUsd === previousValue
      ? previousRank
      : index + 1;
    previousValue = asset.marketCapUsd;
    previousRank = rank;
    return { ...asset, rank };
  });
}

function marketRankStatus(snapshot, standings, now = Date.now()) {
  const coverage = snapshot?.coverage ?? {};
  const readAt = new Date(snapshot?.source?.readAt ?? '').getTime();
  const age = now - readAt;
  const complete = standings.length === SIGN_ORDER.length
    && Number(coverage.canonicalAssetCount) === SIGN_ORDER.length
    && Number(coverage.assetsWithIndexedPools) === SIGN_ORDER.length
    && Number(coverage.assetsWithMarketCap) === SIGN_ORDER.length;
  const timely = Number.isFinite(readAt) && age >= -5 * 60 * 1000 && age <= MARKET_RANK_MAX_AGE_MS;
  return {
    available: complete && timely,
    reason: !complete ? 'incomplete' : !timely ? 'stale' : null,
  };
}

function profilePeopleFor(slug) {
  const requested = SIGN_PROFILE_PEOPLE[slug] ?? [];
  if (requested.length !== 4) throw new Error(`${slug}: expected four profile people`);
  return requested.map((personSlug) => {
    const person = peopleBySlug.get(personSlug);
    if (!person) throw new Error(`${slug}: missing People record ${personSlug}`);
    if (person.sunSign.slug !== slug) {
      throw new Error(`${personSlug}: expected ${slug}, found ${person.sunSign.slug}`);
    }
    if (person.suppression?.status !== 'active') {
      throw new Error(`${personSlug}: suppressed People records cannot appear on Registry profiles`);
    }
    const linkRel = registryProfilePersonLinkRel({
      sign: slug,
      person,
      policyAuthorization: protectedLinkPolicy,
    });
    return {
      slug: person.slug,
      name: person.displayName,
      date: shortDate(person.birthDate.displayedDate),
      protectedLiving: linkRel === 'nofollow',
    };
  });
}

function assetFor(slug) {
  const asset = registry.assets.find((a) => a.sign === slug);
  if (!asset) throw new Error(`Registry missing sign: ${slug}`);
  return asset;
}

function repFor(asset, chain) {
  return asset.representations.find((r) => r.chain === chain);
}

function pageModel(slug) {
  const page = SIGN_PAGES[slug];
  const asset = assetFor(slug);
  const solana = repFor(asset, 'solana');
  const base = repFor(asset, 'base');
  const idx = SIGN_ORDER.indexOf(slug);
  const consumerSource = OG_SIGNS.find((sign) => sign.slug === slug);
  const consumer = consumerSource && slug === 'pisces'
    ? { ...consumerSource, essence: 'Imaginative, intuitive, tuned to what goes unspoken.' }
    : consumerSource;
  const signViews = Number(pulse.wikipedia?.perSignAvgDay?.[slug]);
  const standings = marketStandings(latestMarketSnapshot);
  const marketAsset = standings.find((candidate) => candidate.sign === slug) ?? null;
  if (!consumer) throw new Error(`Consumer sign data missing: ${slug}`);
  if (!Number.isFinite(signViews) || signViews <= 0) {
    throw new Error(`Attention snapshot incomplete: ${slug}`);
  }
  return {
    slug, page, asset, solana, base,
    name: asset.displayName,
    ticker: solana.symbol,
    order: idx + 1,
    // The sign's pastel — the panel tints itself with it, the same way the
    // rail's disc and the page's accents do.
    hue: NAV_SIGNS.find((s) => s.slug === slug)?.hue ?? null,
    constellation: CONSTELLATIONS[slug],
    dexscreener: dexscreenerUrl(slug, solana.address),
    consumer,
    rallyLine: SIGN_PROFILE_RALLY_LINES[slug],
    people: profilePeopleFor(slug),
    attention: {
      signViews,
      from: pulseDate(pulse.wikipedia.from),
      to: pulseDate(pulse.wikipedia.to, true),
      capturedAt: shortDate(pulse.capturedAt),
    },
    marketSnapshot: latestMarketSnapshot,
    marketAsset,
    standings,
    rankStatus: marketRankStatus(latestMarketSnapshot, standings),
    ownership: ownershipModel(slug, solana, base),
  };
}

function renderConstellationSvg(m) {
  const width = 720;
  const height = 460;
  const pad = 58;
  const stars = m.constellation.stars.map((star) => ({ ...star }));
  const rawRa = stars.map((star) => star.ra);
  const wrapsZero = Math.max(...rawRa) - Math.min(...rawRa) > 12;
  const meanDec = stars.reduce((sum, star) => sum + star.dec, 0) / stars.length;
  const cosDec = Math.max(0.35, Math.cos(meanDec * Math.PI / 180));

  for (const star of stars) {
    const ra = wrapsZero && star.ra < 12 ? star.ra + 24 : star.ra;
    star.mapX = ra * 15 * cosDec;
    star.mapY = star.dec;
  }

  const xs = stars.map((star) => star.mapX);
  const ys = stars.map((star) => star.mapY);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const usedWidth = spanX * scale;
  const usedHeight = spanY * scale;

  for (const star of stars) {
    // Right ascension increases eastward; conventional sky maps place east to
    // the left, hence the deliberate horizontal reversal.
    star.x = width / 2 + usedWidth / 2 - (star.mapX - minX) * scale;
    star.y = height / 2 + usedHeight / 2 - (star.mapY - minY) * scale;
  }

  const byId = new Map(stars.map((star) => [star.id, star]));
  const focus = byId.get(m.constellation.focusId);
  const lines = m.constellation.edges.map(([from, to]) => {
    const a = byId.get(from);
    const b = byId.get(to);
    return `  <path d="M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}"/>`;
  }).join('\n');
  const points = stars.map((star) => {
    const radius = Math.max(1.8, Math.min(5.8, 6.2 - star.mag));
    if (star.kind === 'open-cluster') {
      return `  <g class="cluster" transform="translate(${star.x.toFixed(2)} ${star.y.toFixed(2)})" aria-label="${esc(star.name)} open cluster"><circle r="10"/><circle class="cluster-dot" cx="-4" cy="-2" r="1.7"/><circle class="cluster-dot" cx="3" cy="-4" r="1.4"/><circle class="cluster-dot" cx="2" cy="4" r="1.5"/><circle class="cluster-dot" cx="-3" cy="5" r="1.1"/></g>`;
    }
    return `  <circle class="star${star.id === m.constellation.focusId ? ' focus' : ''}" cx="${star.x.toFixed(2)}" cy="${star.y.toFixed(2)}" r="${radius.toFixed(2)}"/>`;
  }).join('\n');
  const labelX = Math.min(width - 150, Math.max(22, focus.x + 16));
  const labelY = Math.min(height - 22, Math.max(34, focus.y - 14));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">${esc(m.name)} constellation map</title>
  <desc id="description">Brighter stars in ${esc(m.name)} plotted from HYG Database J2000 coordinates. ${esc(focus.name)} is highlighted. Guide lines are not official constellation boundaries.</desc>
  <metadata>HYG Database v4.0, CC BY-SA 4.0, source blob ${HYG_ATTRIBUTION.sourceBlob}. Guide segments authored by Zodiacs.org.</metadata>
  <defs>
    <radialGradient id="field" cx="50%" cy="46%" r="66%"><stop offset="0" stop-color="${m.hue}" stop-opacity=".08"/><stop offset="1" stop-color="#07080c" stop-opacity="0"/></radialGradient>
    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="720" height="460" rx="28" fill="#090b10"/>
  <rect width="720" height="460" rx="28" fill="url(#field)"/>
  <g fill="none" stroke="${m.hue}" stroke-opacity=".34" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">${lines}</g>
  <g fill="#eef1f7" fill-opacity=".86">${points}</g>
  <circle cx="${focus.x.toFixed(2)}" cy="${focus.y.toFixed(2)}" r="14" fill="none" stroke="${m.hue}" stroke-width="1.5" stroke-opacity=".9" filter="url(#glow)"/>
  <text x="${labelX.toFixed(2)}" y="${labelY.toFixed(2)}" fill="${m.hue}" font-family="ui-monospace, monospace" font-size="12" letter-spacing="1.5">${esc(focus.name.toUpperCase())}</text>
  <text x="24" y="430" fill="#8e96ab" font-family="ui-monospace, monospace" font-size="9" letter-spacing="2">J2000 · EAST LEFT · ${m.constellation.abbreviation.toUpperCase()}</text>
</svg>`;
}

function jsonLd(m) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Zodiacs.org', item: 'https://zodiacs.org/' },
          { '@type': 'ListItem', position: 2, name: 'All signs', item: 'https://zodiacs.org/registry/' },
          { '@type': 'ListItem', position: 3, name: m.name, item: signUrl(m.slug) }
        ]
      },
      {
        '@type': 'WebPage',
        '@id': `${signUrl(m.slug)}#page`,
        url: signUrl(m.slug),
        name: `${m.page.glyph.replace('︎', '')} ${m.name} · Zodiac sign ${m.order} of 12`,
        description: `${m.name} dates, famous birthdays, Wikipedia views, current price and rank, and verified token address.`,
        inLanguage: 'en',
        isPartOf: { '@type': 'WebSite', name: 'Zodiacs.org', url: 'https://zodiacs.org/' },
        primaryImageOfPage: `https://zodiacs.org${sculpturePath(m.slug)}`,
        about: {
          '@type': 'Thing',
          name: `${m.name} token`,
          alternateName: [m.ticker, `${m.name} token`],
          description: `The ${m.name} token in the twelve-sign Zodiacs collection.`,
          identifier: [
            { '@type': 'PropertyValue', propertyID: 'solana-mint', value: m.solana.address },
            { '@type': 'PropertyValue', propertyID: 'base-contract', value: m.base.address }
          ],
          sameAs: `https://zodiacs.org/registry/zodiacs.registry.json`
        }
      }
    ]
  };
}

function compactUsd(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const absolute = Math.abs(number);
  if (absolute >= 1e9) return `$${(number / 1e9).toFixed(1).replace(/\.0$/u, '')}B`;
  if (absolute >= 1e6) return `$${(number / 1e6).toFixed(1).replace(/\.0$/u, '')}M`;
  if (absolute >= 1e3) return `$${(number / 1e3).toFixed(1).replace(/\.0$/u, '')}K`;
  return `$${number.toFixed(2)}`;
}

function wholeUsd(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `$${Math.round(number).toLocaleString('en-US')}`;
}

function formatPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const digits = Math.abs(number) < 0.0001 ? 8 : Math.abs(number) < 0.01 ? 6 : 4;
  return `$${number.toFixed(digits).replace(/0+$/u, '').replace(/\.$/u, '')}`;
}

function ordinal(value) {
  const number = Number(value);
  const mod100 = number % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${number}th`;
  return `${number}${number % 10 === 1 ? 'st' : number % 10 === 2 ? 'nd' : number % 10 === 3 ? 'rd' : 'th'}`;
}

function readableTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short'
  }).format(date);
}

function render(m) {
  const p = m.page;
  const modalityMeaning = {
    cardinal: 'Cardinal — starts things',
    fixed: 'Fixed — stays the course',
    mutable: 'Mutable — adapts',
  }[m.consumer.modality];
  const focusObject = m.constellation.stars.find((star) => star.id === m.constellation.focusId);
  const focusKind = focusObject.kind === 'open-cluster' ? 'open cluster' : 'principal star';
  const ogImageAlt = `${m.name} — sign ${m.order} of 12 in the Zodiacs collection.`;
  const glanceRows = [
    ['Dates', m.consumer.dates],
    ['Element', titleCase(m.consumer.element)],
    ['Type', modalityMeaning],
    [focusKind === 'open cluster' ? 'Key object' : 'Key star', p.principalStar.name],
  ];
  const rankedStandings = rankedMarketStandings(m.standings);
  const selectedStanding = rankedStandings.find((asset) => asset.sign === m.slug);
  const currentRank = m.rankStatus.available ? selectedStanding?.rank ?? null : null;
  const marketReadAt = m.marketSnapshot?.source?.readAt;
  const standingsSummary = `This rank only compares total market value. It does not show how many people support each sign.${m.rankStatus.available ? '' : ' A rank is not shown because some numbers are missing or out of date.'}`;
  const staticMetrics = [
    ['Total market value', m.marketAsset ? compactUsd(m.marketAsset.marketCapUsd) : '—', ''],
    ['Traded in 24 hours', m.marketAsset ? compactUsd(m.marketAsset.volume24hUsd) : '—', ''],
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#060709" />
  <meta name="color-scheme" content="dark" />
  <title>${esc(`${p.glyph.replace('︎', '')} ${m.name}`)} · Zodiac sign ${m.order} of 12 | Zodiacs.org</title>
  <meta name="description" content="${esc(`${m.name} dates, famous birthdays, Wikipedia views, current price and rank, and verified token address.`)}" />
  <link rel="canonical" href="${signUrl(m.slug)}" />
  <meta property="og:site_name" content="Zodiacs" />
  <meta property="og:title" content="${esc(`${p.glyph.replace('︎', '')} ${m.name}`)} · Zodiac sign ${m.order} of 12 — Zodiacs" />
  <meta property="og:description" content="${esc(`${m.name} dates, famous birthdays, Wikipedia views, current price and rank, and verified token address.`)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${signUrl(m.slug)}" />
  <meta property="og:image" content="https://zodiacs.org${REGISTRY_OG_BASE}/${m.slug}.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(ogImageAlt)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(`${p.glyph.replace('︎', '')} ${m.name}`)} · Zodiac sign ${m.order} of 12 — Zodiacs" />
  <meta name="twitter:description" content="${esc(`${m.name} dates, famous birthdays, Wikipedia views, current price and rank, and verified token address.`)}" />
  <meta name="twitter:image" content="https://zodiacs.org${REGISTRY_OG_BASE}/${m.slug}.png" />
  <meta name="twitter:image:alt" content="${esc(ogImageAlt)}" />

  ${brandIconLinkMarkup()}
  ${SITE_FOOTER_STYLESHEET}
  <link rel="preload" href="/fonts/eb-garamond-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin />

  <style>
    /* Self-hosted interface and editorial faces. */
    @font-face { font-family: 'EB Garamond'; src: url('/fonts/eb-garamond-latin-400-normal.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Instrument Sans'; src: url('/fonts/instrument-sans-latin-wght-normal.woff2') format('woff2-variations'); font-weight: 400 700; font-style: normal; font-display: swap; }
    @font-face { font-family: 'JetBrains Mono'; src: url('/fonts/jetbrains-mono-latin-wght-normal.woff2') format('woff2-variations'); font-weight: 300 600; font-style: normal; font-display: swap; }
  </style>

  <script type="application/ld+json">
${JSON.stringify(jsonLd(m), null, 2)}
  </script>

  <style>
    :root {
      --bg: #060709; --bg-2: #0A0C11;
      --surface: #0F121A; --surface-2: #151925;
      --hair: rgba(198,204,218,0.10); --hair-2: rgba(198,204,218,0.22); --hair-3: rgba(198,204,218,0.42);
      --gold: #C6CCDA; --gold-bright: #EEF1F7; --gold-deep: #8E96AB;
      --live: #C6CCDA;
      --ink: #EEF1F7; --ink-2: #C6CCDA; --ink-dim: #8E96AB; --ink-mute: #7A8397;
      --sans: 'Instrument Sans', 'Instrument Sans Fallback', 'Instrument Sans Fallback Android', system-ui, -apple-system, sans-serif;
      --serif: var(--sans);
      --mono: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
      --display: var(--sans);
      --profile-display: 'EB Garamond', Georgia, serif;
      --profile-hue: ${m.hue};
      --profile-art-mask: url('/assets/sculptures/512/${m.slug}.webp');
      --profile-title-size: ${m.name.length >= 9 ? 'clamp(48px, 8vw, 82px)' : 'clamp(48px, 9.5vw, 100px)'};
      --profile-mobile-title-size: ${m.name.length >= 9 ? 'clamp(44px, 11vw, 56px)' : 'clamp(56px, 15vw, 72px)'};
      --vermilion: #D4603F;
      --ease: cubic-bezier(0.32, 0.72, 0, 1);
      --z-grain: 1; --z-base: 10; --z-nav: 40;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      background: var(--bg); color: var(--ink);
      font-family: var(--sans);
      -webkit-text-size-adjust: 100%; text-size-adjust: 100%;
      -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
    }
    html { scroll-behavior: smooth; scrollbar-color: rgba(198,204,218,0.14) #060709; scrollbar-width: thin; }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
    body {
      min-height: 100dvh;
      background:
        radial-gradient(120% 60% at 50% -10%, rgba(198,204,218,0.05), transparent 62%),
        radial-gradient(120% 80% at 50% 110%, rgba(198,204,218,0.02), transparent 62%),
        var(--bg);
    }
    [id] { scroll-margin-top: 96px; }
    img, svg { display: block; max-width: 100%; }
    a { color: inherit; }
    button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
    :focus-visible {
      outline: 1px solid var(--gold); outline-offset: 3px;
      box-shadow: 0 0 0 4px rgba(198,204,218,0.12);
    }
    :focus:not(:focus-visible) { outline: 0; }
    .skip {
      position: absolute; left: -9999px; top: 0;
      background: var(--surface-2); color: var(--gold);
      padding: 10px 16px; font-family: var(--mono); font-size: 11px;
      letter-spacing: 0.22em; text-transform: uppercase;
      border: 1px solid var(--hair-3); z-index: 60;
    }
    .skip:focus { left: 12px; top: 12px; }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    .grain {
      position: fixed; inset: 0; pointer-events: none; z-index: var(--z-grain);
      opacity: 0.035; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.88  0 0 0 0 0.90  0 0 0 0 0.96  0 0 0 0.85 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    }
    .stars {
      position: fixed; inset: 0; pointer-events: none; z-index: var(--z-grain);
      opacity: 0.34; mix-blend-mode: screen;
      background-image:
        radial-gradient(1px 1px at 8% 12%, rgba(238,241,247,0.7), transparent 60%),
        radial-gradient(1px 1px at 22% 38%, rgba(198,204,218,0.6), transparent 60%),
        radial-gradient(1px 1px at 71% 8%, rgba(238,241,247,0.45), transparent 60%),
        radial-gradient(1px 1px at 88% 24%, rgba(198,204,218,0.55), transparent 60%),
        radial-gradient(1px 1px at 44% 62%, rgba(238,241,247,0.4), transparent 60%),
        radial-gradient(1px 1px at 92% 71%, rgba(238,241,247,0.5), transparent 60%);
      background-attachment: fixed;
    }

    .label {
      font-family: var(--display); font-weight: 500; font-size: 9.5px;
      letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-dim);
    }
    .label--gold { color: var(--gold); }

    /* ── Unified site nav (Part AA) — shared wing nav module (wing-nav.mjs) ── */
    ${wingNavCss()}

    /* ── Page shell ── */
    .pg {
      max-width: 1140px; margin: 0 auto; position: relative; z-index: var(--z-base);
      padding: 0 20px; overflow-x: clip;
    }

    /* ── Lot header ── */
    .lot { padding: calc(94px + env(safe-area-inset-top)) 0 36px; position: relative; }
    .lot__crumbs {
      display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
      margin: 0 0 24px; padding: 0; list-style: none;
      color: var(--ink-mute); font-family: var(--mono); font-size: 8.5px;
      letter-spacing: 0.14em; text-transform: uppercase;
    }
    .lot__crumbs li { display: inline-flex; align-items: center; min-height: 44px; }
    .lot__crumbs li + li::before { content: "/"; margin-right: 6px; color: var(--hair-3); }
    .lot__crumbs a { min-height: 44px; display: inline-flex; align-items: center; color: var(--ink-dim); text-underline-offset: 4px; }
    .lot__crumbs a:hover { color: var(--ink); }
    .lot__eyebrow {
      display: flex; align-items: center; gap: 10px; width: 100%;
      margin-bottom: 28px;
      font-family: var(--display); font-weight: 500; font-size: 9px;
      letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold);
    }
    .lot__eyebrow::after {
      content: ""; flex: 1 1 auto; height: 1px;
      background: linear-gradient(90deg, var(--hair-2), transparent);
    }
    .lot__eyebrow .g { color: var(--ink-dim); }
    .lot__title {
      margin: 0 0 14px;
      font-family: var(--profile-display); font-weight: 400;
      font-size: clamp(56px, 11vw, 124px);
      line-height: 0.92; letter-spacing: -0.012em; color: var(--ink);
      text-wrap: balance;
    }
    .lot__title-icon {
      display: inline-block;
      width: 0.76em;
      height: 0.76em;
      margin-left: 0.08em;
      vertical-align: -0.08em;
      line-height: 0;
      filter: drop-shadow(0 8px 22px rgba(0,0,0,0.34));
    }
    .lot__title-icon img { display: block; width: 100%; height: 100%; border-radius: 50%; }
    .lot__epithet {
      margin: 0 0 10px; max-width: 30ch;
      font-family: var(--serif); font-style: italic;
      font-size: clamp(19px, 3vw, 26px); line-height: 1.35; color: var(--gold-bright);
      text-wrap: pretty;
    }
    .lot__intro {
      margin: 20px 0 0; max-width: 62ch;
      font-family: var(--serif); font-size: clamp(17px, 2.2vw, 20px);
      line-height: 1.55; color: var(--ink-2); text-wrap: pretty;
    }
    .lot__meta {
      display: grid; gap: 12px; align-items: center;
      margin-top: 22px; padding-top: 14px;
      border-top: 1px solid var(--hair);
    }
    .lot__dates {
      font-family: var(--mono); font-size: 10.5px;
      letter-spacing: 0.26em; text-transform: uppercase; color: var(--ink-dim);
    }
    .lot__next {
      display: inline-grid; grid-template-columns: 28px auto auto; align-items: center; gap: 9px;
      min-height: 44px; justify-self: start; padding: 4px 0;
      color: var(--ink-2);
      font-family: var(--display); font-weight: 500; font-size: 10px;
      letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none;
      transition: color 160ms cubic-bezier(0.23,1,0.32,1), transform 120ms cubic-bezier(0.23,1,0.32,1);
    }
    .lot__next picture { display: block; width: 28px; height: 28px; }
    .lot__next img { width: 100%; height: 100%; border-radius: 50%; }
    .lot__next strong { color: var(--gold-bright); font-weight: 500; }
    .lot__next > span:last-child { transition: transform 160ms cubic-bezier(0.23,1,0.32,1); }
    .lot__next:active { transform: scale(0.97); }
    @media (hover: hover) and (pointer: fine) {
      .lot__next:hover { color: var(--ink); }
      .lot__next:hover > span:last-child { transform: translateX(3px); }
    }
    @media (min-width: 700px) {
      .lot__meta { grid-template-columns: minmax(0, 1fr) auto; gap: 24px; }
      .lot__next { justify-self: end; }
    }

    /* ── Editorial split ── */
    .split { display: grid; grid-template-columns: 1fr; gap: 40px; padding-bottom: 24px; }
    .split__figure { order: 1; }
    .split__content { order: 2; }
    @media (min-width: 960px) {
      .split { grid-template-columns: 0.92fr 1.08fr; gap: 56px; align-items: start; }
      .split__figure { order: 1; position: sticky; top: 86px; }
      .split__content { order: 2; }
    }
    .figure__gallery {
      display: inline-flex; align-items: center; gap: 7px; min-height: 44px; margin-top: 8px;
      font-family: var(--display); font-size: 12px; letter-spacing: 0.04em;
      color: var(--ink-dim); text-decoration: none;
      border-bottom: 1px solid var(--hair-2); padding-bottom: 2px;
      transition: color 200ms ease, border-color 200ms ease;
    }
    .figure__gallery:hover { color: var(--gold-bright); border-color: var(--gold); }

    /* The first screen answers the three questions a new visitor is most
       likely to have: what this is, what it costs now, and where to start. */
    .quick {
      border: 1px solid var(--hair-2);
      background: linear-gradient(180deg, rgba(198,204,218,0.055), transparent 58%), var(--surface);
      padding: 22px 20px 20px;
    }
    .quick__label {
      display: block; margin-bottom: 10px;
      font-family: var(--mono); font-size: 9px; letter-spacing: 0.22em;
      text-transform: uppercase; color: var(--ink-dim);
    }
    .quick__quote {
      display: grid; grid-template-columns: minmax(0, 1fr) auto;
      align-items: end; gap: 8px 18px; padding-bottom: 18px;
      border-bottom: 1px solid var(--hair);
    }
    .quick__price {
      font-family: var(--mono); font-size: clamp(25px, 5vw, 36px);
      line-height: 1; letter-spacing: -0.03em; color: var(--ink);
    }
    .quick__change {
      font-family: var(--mono); font-size: 13px; letter-spacing: 0.04em;
      color: var(--ink-dim); white-space: nowrap;
    }
    .quick__change--up { color: var(--gold-bright); }
    .quick__change--down { color: var(--vermilion); }
    .quick__state {
      grid-column: 1 / -1; margin: 2px 0 0;
      font-family: var(--serif); font-size: 13.5px; line-height: 1.45; color: var(--ink-mute);
    }
    .quick__actions { display: grid; gap: 10px; margin-top: 18px; }
    .quick__action {
      display: inline-flex; min-height: 48px; align-items: center; justify-content: space-between;
      gap: 14px; padding: 0 16px; border: 1px solid var(--hair-2);
      font-family: var(--mono); font-size: 10px; letter-spacing: 0.16em;
      text-transform: uppercase; text-decoration: none; color: var(--ink-2);
      transition: border-color 220ms var(--ease), color 220ms var(--ease), transform 180ms var(--ease);
    }
    .quick__action:first-child { color: var(--gold-bright); border-color: var(--hair-3); }
    .quick__action:hover { color: var(--gold-bright); border-color: var(--gold); }
    .quick__action:active { transform: scale(0.985); }
    .quick__help { margin: 14px 0 0; font-size: 13.5px; line-height: 1.5; color: var(--ink-mute); }
    @media (min-width: 560px) { .quick__actions { grid-template-columns: 1fr 1fr; } }

    /* Museum plinth card */
    .card {
      position: relative;
      background:
        radial-gradient(120% 60% at 50% 0%, rgba(198,204,218,0.06), transparent 55%),
        linear-gradient(180deg, var(--surface-2) 0%, var(--surface) 100%);
      border: 1px solid var(--hair-3);
      box-shadow:
        inset 0 1px 0 rgba(238,241,247,0.14), inset 0 -1px 0 rgba(0,0,0,0.5),
        0 18px 40px -22px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4);
    }
    .card__inner { padding: 18px; border: 1px solid var(--hair); margin: 8px; }
    .card__corner { position: absolute; width: 10px; height: 10px; border-color: var(--gold); border-style: solid; opacity: 0.55; }
    .card__corner--tl { top: 4px; left: 4px; border-width: 1px 0 0 1px; }
    .card__corner--tr { top: 4px; right: 4px; border-width: 1px 1px 0 0; }
    .card__corner--bl { bottom: 4px; left: 4px; border-width: 0 0 1px 1px; }
    .card__corner--br { bottom: 4px; right: 4px; border-width: 0 1px 1px 0; }
    .card__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .stage {
      position: relative; height: clamp(340px, 44vw, 460px);
      display: flex; align-items: flex-end; justify-content: center;
      padding: 12px 0 28px; isolation: isolate; overflow: hidden;
    }
    .stage::before {
      content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 42%;
      background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.10) 60%, rgba(0,0,0,0.22) 100%);
      pointer-events: none; z-index: 0;
    }
    .stage::after {
      content: ""; position: absolute; left: 14%; right: 14%; bottom: 20px; height: 1px;
      background: linear-gradient(90deg, transparent 0%, rgba(198,204,218,0.55) 22%, rgba(198,204,218,0.55) 78%, transparent 100%);
      pointer-events: none; z-index: 0;
    }
    .stage img {
      position: relative; z-index: 1; width: auto; height: auto;
      max-width: 86%; max-height: 100%; object-fit: contain;
      filter: drop-shadow(0 6px 10px rgba(20,14,6,0.55)) drop-shadow(0 2px 4px rgba(36,26,12,0.65));
    }
    .card__caption {
      margin-top: 4px; text-align: center;
      font-family: var(--mono); font-size: 9.5px;
      letter-spacing: 0.24em; text-transform: uppercase; color: var(--ink-mute);
    }
    .card__caption .g { color: var(--gold); }

    /* ── Section frame ── */
    .sec { padding: 56px 0 8px; }
    .sec__head { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .sec__head .line { flex: 1; height: 1px; background: var(--hair); }
    .sec__title {
      margin: 0; font-family: var(--profile-display); font-weight: 400; font-size: clamp(25px, 4vw, 36px);
      letter-spacing: -0.02em; text-transform: none; color: var(--ink);
    }

    /* Longer catalogue material stays available without competing with the
       price and verified record above it. Native details work
       with a keyboard and without JavaScript. */
    .record-detail { border-top: 1px solid var(--hair); }
    .record-detail + .record-detail { margin-top: 8px; }
    .record-detail__summary {
      display: flex; min-height: 64px; align-items: center; justify-content: space-between;
      gap: 16px; padding: 0 2px; cursor: pointer; list-style: none;
      color: var(--gold); user-select: none;
    }
    .record-detail__summary::-webkit-details-marker { display: none; }
    .record-detail__summary::after {
      content: "+"; flex: 0 0 auto; font-family: var(--mono); font-size: 18px;
      line-height: 1; color: var(--ink-dim); transition: transform 220ms var(--ease), color 220ms var(--ease);
    }
    .record-detail[open] > .record-detail__summary::after { content: "−"; color: var(--gold-bright); }
    .record-detail__summary:hover::after { color: var(--gold-bright); }
    .record-detail__title {
      font-family: var(--profile-display); font-size: clamp(19px, 2.6vw, 24px);
      font-weight: 600; line-height: 1.2; letter-spacing: 0; color: var(--ink);
    }
    .record-detail__hint {
      margin-left: auto; font-family: var(--mono); font-size: 8.5px;
      letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-mute);
    }
    .record-detail__body { padding: 6px 0 34px; }
    .record-detail[open] > .record-detail__body { animation: detail-in 260ms var(--ease) both; }
    @keyframes detail-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    @media (max-width: 560px) { .record-detail__hint { display: none; } }
    @media (prefers-reduced-motion: reduce) { .record-detail[open] > .record-detail__body { animation: none; } }

    /* Token fact rows */
    .rows { border-top: 1px solid var(--hair); }
    .row {
      display: flex; justify-content: space-between; align-items: baseline;
      gap: 16px; padding: 11px 0; border-bottom: 1px solid var(--hair);
    }
    .row .k {
      flex: 0 0 auto; font-family: var(--mono); font-size: 10px;
      letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-dim);
    }
    .row .v { font-family: var(--serif); font-style: italic; font-size: 16.5px; color: var(--ink); text-align: right; }
    .row .v.mono { font-family: var(--mono); font-style: normal; font-size: 12px; color: var(--ink-2); letter-spacing: 0.04em; }

    /* Sign story */
    .note { max-width: 62ch; }
    .note__lede {
      margin: 0 0 26px;
      font-family: var(--serif); font-size: clamp(19px, 2.6vw, 23px);
      line-height: 1.5; color: var(--ink); text-wrap: pretty;
    }
    .note__lede::first-letter {
      font-size: 3.1em; float: left; line-height: 0.8;
      padding: 6px 12px 0 0; color: var(--gold-bright); font-style: italic;
    }
    .note p {
      margin: 0 0 20px;
      font-family: var(--serif); font-size: 16.5px; line-height: 1.62;
      color: var(--ink-2); text-wrap: pretty;
    }

    /* Why this record matters — an open editorial grid, not a card wall. */
    .value {
      display: grid; grid-template-columns: 1fr;
      border-top: 1px solid var(--hair);
    }
    .value__item { padding: 18px 0 20px; border-bottom: 1px solid var(--hair); }
    .value__k {
      display: block; margin-bottom: 8px;
      font-family: var(--mono); font-size: 9px; letter-spacing: 0.2em;
      text-transform: uppercase; color: var(--gold);
    }
    .value__v {
      margin: 0; max-width: 48ch;
      font-family: var(--serif); font-size: 15.5px; line-height: 1.55; color: var(--ink-2);
    }
    @media (min-width: 700px) {
      .value { grid-template-columns: 1fr 1fr; column-gap: 32px; }
    }

    /* Constellation record */
    .constellation {
      display: grid; gap: 26px; align-items: center;
    }
    .constellation__map {
      position: relative; padding: 7px;
      background: rgba(198,204,218,0.025);
      border: 1px solid var(--hair-2); border-radius: 30px;
      box-shadow: inset 0 1px 0 rgba(238,241,247,0.08);
    }
    .constellation__map img { width: 100%; height: auto; border-radius: 23px; }
    .constellation__copy { max-width: 54ch; }
    .constellation__body {
      margin: 0 0 18px; font-family: var(--serif); font-size: 15.5px;
      line-height: 1.58; color: var(--ink-2); text-wrap: pretty;
    }
    .constellation__source {
      margin: 0; font-family: var(--mono); font-size: 8.5px;
      line-height: 1.75; letter-spacing: 0.11em; color: var(--ink-mute);
    }
    .constellation__source a { color: var(--ink-dim); text-underline-offset: 3px; }
    @media (min-width: 820px) {
      .constellation { grid-template-columns: minmax(0, 1.28fr) minmax(260px, 0.72fr); gap: 48px; }
    }

    /* Provenance timeline */
    .prov { position: relative; padding-left: 26px; }
    .prov::before {
      content: ""; position: absolute; left: 4px; top: 8px; bottom: 8px; width: 1px;
      background: linear-gradient(180deg, transparent, var(--hair-3) 8%, var(--hair-3) 92%, transparent);
    }
    .prov__item { position: relative; padding: 0 0 26px; }
    .prov__item:last-child { padding-bottom: 4px; }
    .prov__item::before {
      content: ""; position: absolute; left: -26px; top: 7px;
      width: 9px; height: 9px; border-radius: 50%;
      background: var(--bg); border: 1px solid var(--gold);
      box-shadow: 0 0 10px rgba(198,204,218,0.35);
    }
    .prov__era {
      display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px;
      font-family: var(--mono); font-size: 10px;
      letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold);
    }
    .prov__era .place { color: var(--ink-mute); }
    .prov__body {
      margin: 0; max-width: 56ch;
      font-family: var(--serif); font-size: 15.5px; line-height: 1.58; color: var(--ink-2);
    }

    /* Record (addresses) */
    .rec {
      border: 1px solid var(--hair-2);
      background: linear-gradient(180deg, rgba(198,204,218,0.03), transparent 40%), var(--surface);
      padding: 22px 20px 20px;
    }
    .rec__row {
      display: flex; justify-content: space-between; align-items: center;
      gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--hair); flex-wrap: wrap;
    }
    .rec__row:last-of-type { border-bottom: 0; }
    .rec__k {
      font-family: var(--mono); font-size: 9.5px;
      letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-mute);
    }
    .rec__k .net { color: var(--ink-dim); }
    .rec__links { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--hair); }
    .rec__link {
      display: inline-flex; align-items: center; min-height: 44px;
      font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.16em;
      text-transform: uppercase; color: var(--gold); text-decoration: none;
      border-bottom: 1px solid rgba(198,204,218,0.32); padding-bottom: 2px;
      transition: color 280ms var(--ease), border-bottom-color 280ms var(--ease);
    }
    .rec__link:hover { color: var(--gold-bright); border-bottom-color: var(--gold); }

    .copychip {
      display: inline-flex; align-items: center; gap: 8px;
      min-height: 44px; padding: 7px 11px; border: 1px solid var(--hair-2);
      background: rgba(198,204,218,0.04); color: var(--ink-2);
      cursor: pointer; font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.04em;
      transition: border-color 280ms var(--ease), color 280ms var(--ease), transform 220ms var(--ease);
    }
    .copychip:hover { border-color: var(--hair-3); color: var(--ink); }
    .copychip:active { transform: scale(0.97); }
    .copychip__icon { color: var(--gold); font-size: 12px; line-height: 1; }
    .copychip.is-copied { border-color: rgba(95,160,140,0.55); color: var(--live); }
    .copychip.is-copied .copychip__icon { color: var(--live); }

    /* Market panel */
    .market {
      position: relative; border: 1px solid var(--hair);
      background: linear-gradient(180deg, rgba(198,204,218,0.025), transparent 62%), rgba(14,10,7,0.52);
    }
    .market::after {
      content: ""; position: absolute; top: 0; right: 0; width: 10px; height: 10px;
      border-top: 1px solid var(--hair-3); border-right: 1px solid var(--hair-3); opacity: 0.7;
    }
    .market__head {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 14px;
      padding: 15px 16px 13px; border-bottom: 1px solid var(--hair);
    }
    .market__label {
      display: block; margin-bottom: 6px;
      font-family: var(--mono); font-size: 9px; letter-spacing: 0.24em;
      text-transform: uppercase; color: var(--ink-dim);
    }
    .market__copy { margin: 0; font-family: var(--serif); font-size: 13.5px; line-height: 1.45; color: var(--ink-dim); }
    .market__source {
      flex: 0 0 auto; margin-top: 1px;
      font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.2em;
      text-transform: uppercase; color: var(--ink-mute); text-decoration: none;
      border-bottom: 1px solid transparent;
    }
    .market__source:hover { color: var(--gold-bright); border-bottom-color: var(--hair-3); }
    .market__grid { display: grid; grid-template-columns: 1fr 1fr; }
    @media (min-width: 640px) { .market__grid { grid-template-columns: repeat(4, 1fr); } }
    .market__cell { min-height: 72px; padding: 13px 14px 12px; border-bottom: 1px solid var(--hair); border-right: 1px solid var(--hair); }
    .market__cell:nth-child(2n) { border-right: 0; }
    @media (min-width: 640px) {
      .market__cell:nth-child(2n) { border-right: 1px solid var(--hair); }
      .market__cell:nth-child(4n) { border-right: 0; }
    }
    .market__k { margin-bottom: 7px; font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ink-mute); }
    .market__v { font-family: var(--serif); font-style: italic; font-size: 15px; line-height: 1.15; color: var(--ink-2); }
    .market__v--mono { font-family: var(--mono); font-style: normal; font-size: 11.5px; letter-spacing: 0.03em; }
    .market__v--up { color: var(--gold-bright); }
    .market__v--down { color: var(--vermilion); }
    .market__state { margin: 0; padding: 15px 16px 16px; font-family: var(--serif); font-style: italic; font-size: 13.5px; color: var(--ink-mute); }
    .market__state::before { content: "—"; margin-right: 8px; font-style: normal; }

    .market__chart { padding: 18px 16px 14px; border-bottom: 1px solid var(--hair); }
    .market__chart-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 18px; margin-bottom: 13px;
    }
    .market__chart-title { margin: 0 0 5px; font-family: var(--serif); font-size: 19px; font-weight: 400; color: var(--ink); }
    .market__chart-note { margin: 0; font-family: var(--mono); font-size: 8.5px; line-height: 1.6; letter-spacing: 0.12em; color: var(--ink-mute); }
    .market__ranges { display: inline-flex; gap: 4px; flex: 0 0 auto; }
    .market__range {
      min-width: 44px; min-height: 44px; padding: 0 11px;
      border: 1px solid var(--hair-2); border-radius: 999px;
      font-family: var(--mono); font-size: 9px; letter-spacing: 0.08em; color: var(--ink-dim);
      transition: color 280ms var(--ease), border-color 280ms var(--ease), background 280ms var(--ease), transform 180ms var(--ease);
    }
    .market__range[aria-pressed="true"] { color: var(--ink); border-color: var(--gold); background: rgba(198,204,218,0.09); }
    .market__range:disabled { opacity: 0.32; cursor: not-allowed; }
    .market__range:not(:disabled):active { transform: scale(0.96); }
    .market__svg { display: block; width: 100%; min-height: 176px; overflow: visible; }
    .market__chart-empty {
      min-height: 150px; display: grid; place-items: center; text-align: center;
      font-family: var(--serif); font-style: italic; font-size: 15px; color: var(--ink-mute);
    }
    .market__foot {
      display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px 18px;
      padding: 12px 16px 14px; font-family: var(--mono); font-size: 8.5px;
      line-height: 1.6; letter-spacing: 0.11em; color: var(--ink-mute);
    }
    @media (max-width: 520px) {
      .market__head, .market__chart-head { flex-direction: column; }
      .market__source { min-height: 32px; display: inline-flex; align-items: center; }
    }

    .research-links { display: grid; grid-template-columns: 1fr; gap: 1px; background: var(--hair); border: 1px solid var(--hair); }
    .research-links a {
      display: grid; grid-template-columns: 32px 1fr auto; align-items: center; gap: 13px;
      min-height: 70px; padding: 13px 16px; background: var(--bg); text-decoration: none;
      transition: background 320ms var(--ease), color 320ms var(--ease);
    }
    .research-links a:hover { background: rgba(198,204,218,0.05); }
    .research-links__glyph { color: var(--gold); font-family: var(--serif); font-style: italic; font-size: 22px; }
    .research-links strong { display: block; margin-bottom: 4px; font-family: var(--serif); font-size: 16px; font-weight: 400; color: var(--ink); }
    .research-links small { display: block; font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.11em; color: var(--ink-mute); }
    .research-links__arr { color: var(--gold); }
    @media (min-width: 700px) { .research-links { grid-template-columns: 1fr 1fr; } }

    /* Next lot / strip */
    .nextlot { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--hair); border: 1px solid var(--hair); }
    .nextlot a {
      display: flex; flex-direction: column; gap: 10px;
      background: var(--bg); padding: 20px 18px 22px; text-decoration: none;
      transition: background 320ms var(--ease);
    }
    .nextlot a:hover { background: rgba(198,204,218,0.05); }
    .nextlot .dir { font-family: var(--mono); font-size: 9px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--ink-mute); }
    .nextlot .nm { font-family: var(--serif); font-style: italic; font-size: 24px; color: var(--ink); line-height: 1; }
    .nextlot .lt { font-family: var(--display); font-weight: 500; font-size: 9px; letter-spacing: 0.16em; color: var(--gold); text-transform: uppercase; }
    .nextlot a:last-child { text-align: right; align-items: flex-end; }

    .strip {
      display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
      gap: 10px; padding: 26px 0 4px;
    }
    .strip a {
      display: grid; place-items: center; width: 44px; height: 44px;
      border-radius: 50%; border: 1px solid transparent;
      transition: border-color 320ms var(--ease), transform 220ms var(--ease);
    }
    .strip a:hover { border-color: var(--hair-2); transform: translateY(-1px); }
    .strip a.is-current { border-color: var(--gold); }
    .strip img { width: 20px; height: 20px; object-fit: contain; opacity: 0.62; }
    .strip a.is-current img, .strip a:hover img { opacity: 1; }

    /* Footer */
    .ftr {
      margin-top: 64px; padding: 36px 0 56px; border-top: 1px solid var(--hair);
      font-family: var(--sans); font-size: 12px; letter-spacing: 0;
      text-transform: none; color: var(--ink-mute);
    }
    .ftr__row { display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
    .ftr__row + .ftr__row { margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--hair); }
    .ftr .mark { color: var(--ink-2); letter-spacing: 0.14em; font-family: var(--display); font-weight: 400; text-transform: none; font-size: 11.5px; }
    .ftr .mark .g { color: var(--gold); }
    .ftr__links { display: inline-flex; flex-wrap: wrap; gap: 12px 16px; }
    .ftr__links a,
    .ftr__links .assistant-link { color: var(--ink-dim); text-decoration: none; transition: color 320ms var(--ease); }
    .ftr__links a:hover,
    .ftr__links .assistant-link:hover { color: var(--gold); }
    .assistant-link {
      appearance: none; border: 0; padding: 0; background: transparent;
      font: inherit; letter-spacing: inherit; text-transform: inherit; cursor: pointer;
    }
    .assistant-link:focus-visible { outline: 1px solid var(--gold); outline-offset: 4px; }

    /* Reveal */
    /* Content stays readable while headings receive a short scroll entrance. */
    .reveal { opacity: 1; transform: none; }
    @media (prefers-reduced-motion: reduce) {
      .reveal { transition: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
      .lot__next { transition: none; }
      .lot__next:active { transform: none; }
    }

    /* Consumer profile layer: familiar words first, technical detail later. */
    .lot__eyebrow, .lot__intro, .lot__dates, .sec__title,
    .record-detail__title, .record-detail__hint, .quick__state,
    .market__copy, .market__state, .market__chart-title,
    .market__chart-empty, .market__v,
    .constellation__body, .research-links strong,
    .research-links small { font-family: var(--sans); font-style: normal; }
    .lot__crumbs, .quick__label, .quick__price, .quick__change,
    .market__range, .market__v--mono, .chart-summary dd,
    .standings__rank, .standings__list a > span:last-child, .rec__k, .rec__link {
      font-family: var(--sans); font-style: normal; font-variant-numeric: tabular-nums;
    }
    .lot__crumbs, .quick__label, .rec__k, .rec__link {
      letter-spacing: 0; text-transform: none;
    }
    .lot__eyebrow { margin-bottom: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: none; }
    .lot__intro { max-width: 46ch; font-size: clamp(19px, 2.5vw, 24px); line-height: 1.4; }
    .lot__dates { font-size: 13px; letter-spacing: 0.02em; text-transform: none; }
    .lot__meta { align-items: start; }
    .identity-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .identity-actions button {
      min-height: 44px; padding: 0 15px; border: 1px solid var(--hair-2); border-radius: 999px;
      font-size: 14px; color: var(--ink-2); background: rgba(198,204,218,0.04);
    }
    .identity-actions button:hover { border-color: var(--hair-3); color: var(--ink); }
    .split { align-items: stretch; }
    .split__figure { position: static !important; }
    .profile-art { height: 100%; min-height: 440px; border-color: color-mix(in srgb, ${m.hue} 32%, transparent); }
    .profile-art .card__inner { height: calc(100% - 16px); }
    .profile-art .stage { height: 410px; min-height: 0; padding: 0; align-items: center; }
    .profile-art .stage img { width: 100%; height: 100%; max-width: 100%; object-fit: contain; }
    .profile-panel { padding: 24px; border: 1px solid var(--hair-2); background: var(--surface); }
    .profile-panel + .profile-panel { margin-top: 14px; }
    .profile-panel h2 { margin: 0 0 18px; font: 600 clamp(22px, 3vw, 30px)/1.15 var(--sans); letter-spacing: -0.02em; }
    .glance dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; }
    .glance dl div { padding: 13px 0; border-top: 1px solid var(--hair); }
    .glance dl div:nth-child(odd) { padding-right: 16px; }
    .glance dt { margin-bottom: 5px; font-size: 12px; color: var(--ink-mute); }
    .glance dd { margin: 0; font-size: 16px; font-weight: 600; color: var(--ink); }
    .ownership__eyebrow {
      display: block; margin-bottom: 10px; font-size: 12px; font-weight: 600;
      letter-spacing: 0.04em; color: ${m.hue};
    }
    .ownership__lede { margin: 0; max-width: 61ch; font-size: 17px; line-height: 1.58; color: var(--ink-2); }
    .ownership__facts {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1px; margin-top: 26px; border: 1px solid var(--hair-2); background: var(--hair);
    }
    .ownership-fact { min-width: 0; padding: 18px; background: var(--surface); }
    .ownership-fact__label { display: block; margin-bottom: 8px; font-size: 12px; color: var(--ink-mute); }
    .ownership-fact strong {
      display: block; overflow-wrap: anywhere; font-size: clamp(18px, 3vw, 25px);
      line-height: 1.15; color: var(--ink);
    }
    .ownership-fact small { display: block; margin-top: 8px; font-size: 12px; line-height: 1.45; color: var(--ink-mute); }
    .ownership__spread { margin-top: 18px; padding: 22px; border: 1px solid var(--hair-2); background: var(--surface); }
    .ownership__spread-head { display: grid; gap: 7px; margin-bottom: 18px; }
    .ownership__spread-head span { font-size: 12px; color: var(--ink-mute); }
    .ownership__spread-head strong { font-size: clamp(20px, 3vw, 28px); line-height: 1.2; }
    .ownership-bar { display: flex; width: 100%; height: 14px; overflow: hidden; border-radius: 999px; background: var(--hair); }
    .ownership-bar span { flex: var(--portion) 0 0; min-width: 2px; }
    .ownership-bar__largest { background: ${m.hue}; }
    .ownership-bar__next-nine { background: color-mix(in srgb, ${m.hue} 72%, #eef1f7); }
    .ownership-bar__next-ten { background: color-mix(in srgb, ${m.hue} 46%, #8e96ab); }
    .ownership-bar__others { background: color-mix(in srgb, ${m.hue} 20%, #252a36); }
    .ownership-legend {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 20px; margin: 18px 0 0;
    }
    .ownership-legend div { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: center; gap: 9px; }
    .ownership-legend i { width: 8px; height: 8px; border-radius: 50%; background: var(--legend); }
    .ownership-legend dt { min-width: 0; font-size: 12px; color: var(--ink-mute); }
    .ownership-legend dd { margin: 0; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .ownership__freshness {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px;
      margin: 16px 0 0; font-size: 12px; color: var(--ink-mute);
    }
    .ownership__age { padding: 4px 8px; border: 1px solid var(--hair-2); border-radius: 999px; color: var(--ink-2); }
    .ownership__age--carried { border-color: rgba(220, 174, 119, 0.42); color: #dcae77; }
    .ownership__freshness a { color: var(--ink-2); text-underline-offset: 3px; }
    .ownership-method { margin-top: 14px; border-top: 1px solid var(--hair); }
    .ownership-method summary {
      display: flex; min-height: 48px; align-items: center; cursor: pointer;
      font-size: 14px; font-weight: 600; color: var(--ink-2);
    }
    .ownership-method p { margin: 0 0 14px; max-width: 66ch; font-size: 13px; line-height: 1.55; color: var(--ink-mute); }
    @media (max-width: 560px) {
      .ownership-legend { grid-template-columns: 1fr; }
      .ownership-fact { padding: 16px; }
      .ownership__spread { padding: 18px 16px; }
    }
    @media (max-width: 350px) { .ownership__facts { grid-template-columns: 1fr; } }

    .sec { padding-top: 72px; }
    .sec__head { margin-bottom: 26px; }
    .sec__title { font-size: clamp(25px, 4vw, 36px); font-weight: 600; letter-spacing: -0.02em; text-transform: none; color: var(--ink); }
    .pride__rally { max-width: 32ch; margin: 0 0 12px; font-size: clamp(25px, 4vw, 40px); font-weight: 650; line-height: 1.15; letter-spacing: -0.025em; color: var(--ink); }
    .attention-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
    .attention-card { padding: 22px; border: 1px solid var(--hair-2); background: var(--surface); }
    .attention-card__label, .people-block__label {
      display: block; margin-bottom: 10px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; color: ${m.hue};
    }
    .attention-card > strong { display: block; margin-bottom: 10px; font-size: clamp(23px, 3.6vw, 34px); line-height: 1.12; }
    .attention-card p { margin: 0; font-size: 15px; line-height: 1.55; color: var(--ink-2); }
    .attention-card small { display: block; margin-top: 14px; font-size: 12px; line-height: 1.5; color: var(--ink-mute); }
    .people-block { margin-top: 30px; padding-top: 24px; border-top: 1px solid var(--hair); }
    .people-block__label { margin-bottom: 16px; }
    .people-block ul { display: grid; grid-template-columns: 1fr; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .people-block a { display: flex; min-height: 56px; align-items: center; justify-content: space-between; gap: 14px; padding: 0 16px; border: 1px solid var(--hair-2); text-decoration: none; background: var(--surface); }
    .people-block a:hover { border-color: color-mix(in srgb, ${m.hue} 58%, transparent); }
    .people-block a strong { font-size: 15px; }
    .people-block a span { font-size: 13px; color: var(--ink-mute); }
    .people-block > small { display: block; margin-top: 12px; color: var(--ink-mute); }
    @media (min-width: 700px) {
      .attention-grid, .people-block ul { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    .market { background: var(--surface); }
    .market__head { align-items: center; padding: 18px 20px; }
    .market__copy { max-width: 62ch; font-size: 14px; }
    .market__source { display: inline-flex; min-height: 44px; align-items: center; font-family: var(--sans); font-size: 14px; letter-spacing: 0; text-transform: none; white-space: nowrap; }
    .market .quick { border: 0; border-bottom: 1px solid var(--hair); background: transparent; border-radius: 0; }
    .market__k { font-family: var(--sans); font-size: 12px; letter-spacing: 0; text-transform: none; }
    .market__v { font-size: 18px; font-weight: 600; }
    .market__state { font-size: 14px; }
    .market__state::before { content: none; }
    .market__chart-title { font-size: 21px; font-weight: 600; }
    .market__chart-note { font-family: var(--sans); font-size: 12px; letter-spacing: 0; }
    .market__foot { font-family: var(--sans); font-size: 12px; letter-spacing: 0; }
    .chart-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; margin: 12px 0 0; background: var(--hair); }
    .chart-summary div { padding: 10px 12px; background: var(--bg); }
    .chart-summary dt { font-size: 11px; color: var(--ink-mute); }
    .chart-summary dd { margin: 4px 0 0; font-family: var(--mono); font-size: 12px; }
    .standings { margin-top: 18px; border: 1px solid var(--hair-2); background: var(--surface); }
    .standings__head { display: grid; gap: 10px; padding: 22px; border-bottom: 1px solid var(--hair); }
    .standings__head > div > span { display: block; margin-bottom: 6px; color: ${m.hue}; font-size: 13px; font-weight: 600; }
    .standings__head h3 { margin: 0; font: 600 clamp(22px, 3.5vw, 31px)/1.2 var(--sans); }
    .standings__head p { margin: 0; max-width: 50ch; font-size: 14px; line-height: 1.5; color: var(--ink-mute); }
    .standings__list { display: grid; grid-template-columns: 1fr; gap: 1px; margin: 0; padding: 0; list-style: none; background: var(--hair); }
    .standings__list a { display: grid; grid-template-columns: 34px 32px minmax(0, 1fr) auto; min-height: 56px; align-items: center; gap: 10px; padding: 7px 14px; background: var(--bg); text-decoration: none; }
    .standings__list li.is-current a { background: color-mix(in srgb, var(--sign) 13%, var(--bg)); box-shadow: inset 3px 0 0 var(--sign); }
    .standings__rank { font-family: var(--mono); font-size: 12px; color: var(--ink-mute); }
    .standings__list picture, .standings__list img { width: 32px; height: 32px; }
    .standings__list strong { font-size: 15px; }
    .standings__list a > span:last-child { font-family: var(--mono); font-size: 12px; color: var(--ink-dim); }
    .standings__time { margin: 0; padding: 12px 16px; border-top: 1px solid var(--hair); font-size: 12px; color: var(--ink-mute); }
    .standings__all summary {
      min-height: 52px; display: flex; align-items: center; padding: 0 16px; cursor: pointer;
      font-family: var(--sans); font-size: 15px; font-weight: 600; letter-spacing: 0; color: var(--ink-2);
    }
    .market-explainer { border-top: 1px solid var(--hair); }
    .market-explainer summary, .token-details summary, .map-sources summary {
      min-height: 48px; display: flex; align-items: center; cursor: pointer;
      font-family: var(--sans); font-style: normal; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink-2);
    }
    .market-explainer summary { padding: 0 16px; }
    .market-explainer p { margin: 0; padding: 0 16px 18px; max-width: 64ch; line-height: 1.55; color: var(--ink-mute); }
    @media (min-width: 760px) { .standings__list { grid-template-columns: repeat(2, minmax(0, 1fr)); } .standings__head { grid-template-columns: 1fr 1fr; align-items: end; } }

    .record-intro { max-width: 60ch; margin: 0 0 18px; font-size: 17px; line-height: 1.55; color: var(--ink-2); }
    .anchor-alias { display: block; height: 0; scroll-margin-top: 96px; }
    .token-details { margin-top: 16px; border-top: 1px solid var(--hair); }
    .mono-address { max-width: 100%; overflow-wrap: anywhere; font-family: var(--mono); font-size: 11px; color: var(--ink-dim); }
    .story-copy { max-width: 64ch; }
    .story-copy p { margin: 0 0 16px; font-size: 16px; line-height: 1.65; color: var(--ink-2); }
    .record-detail__summary { min-height: 68px; }
    .record-detail__title { font-size: clamp(19px, 2.6vw, 24px); font-weight: 600; }
    .record-detail__hint { font-size: 12px; letter-spacing: 0; text-transform: none; }
    .map-sources { margin-top: 12px; border-top: 1px solid var(--hair); }

    .strip { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding-top: 8px; }
    .strip a { display: flex; width: auto; min-width: 0; height: auto; min-height: 68px; align-items: center; justify-content: flex-start; gap: 12px; padding: 10px 12px; border-radius: 16px; border: 1px solid var(--hair); background: var(--surface); text-decoration: none; }
    .strip a:hover { transform: none; border-color: color-mix(in srgb, var(--sign) 55%, transparent); }
    .strip a.is-current { border-color: var(--sign); background: color-mix(in srgb, var(--sign) 12%, var(--surface)); }
    .strip picture, .strip img { flex: 0 0 auto; width: 44px; height: 44px; }
    .strip img { opacity: 1; }
    .strip__name { min-width: 0; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
    @media (min-width: 720px) { .strip { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 959.5px) {
      .split { gap: 24px; }
      .profile-art { height: auto; min-height: 0; }
      .profile-art .card__inner { height: auto; }
      .profile-art .stage { height: clamp(260px, 48vw, 360px); }
    }
    @media (max-width: 520px) {
      .market__head, .market__chart-head { flex-direction: column; align-items: stretch; }
      .market__source { min-height: 44px; }
      .rec__row { align-items: flex-start; }
      .copychip { max-width: 100%; }
    }
    ${profilePolishCss}
  </style>
  <noscript><style>.reveal { opacity: 1 !important; transform: none !important; filter: none !important; }</style></noscript>
</head>
<body>
  <a href="#main" class="skip">Skip to content</a>
  <div class="stars" aria-hidden="true"></div>
  <div class="grain" aria-hidden="true"></div>

  ${wingNavHtml({ includeSearch: true })}

  <main class="pg" id="main">
    <div class="profile-opening" data-profile-design="celestial">
      <div class="profile-breadcrumb">
        <nav aria-label="Breadcrumb"><ol class="lot__crumbs"><li><a href="/registry/">All signs</a></li><li aria-current="page">${esc(m.name)}</li></ol></nav>
        <div class="identity-actions"><button type="button" data-share-sign>Share ${esc(m.name)}</button></div>
      </div>
      <section class="lot" aria-labelledby="lot-title">
        <span class="lot__eyebrow">Zodiac sign <span class="g">·</span> ${m.order} of 12</span>
        <h1 class="lot__title" id="lot-title">${esc(m.name)} <picture class="lot__title-icon" aria-hidden="true"><source srcset="/assets/zodiac-icons/400/${m.slug}.avif" type="image/avif"/><img src="/assets/zodiac-icons/400/${m.slug}.webp" width="112" height="112" alt="" decoding="async"/></picture></h1>
        <div class="profile-celestial-art" aria-label="${esc(m.name)} artwork">
          <img class="profile-art__sky" src="/assets/constellations/${m.slug}.svg" alt="" aria-hidden="true" decoding="async" />
          <div class="card profile-art">
            <div class="card__inner"><div class="stage"><img src="/assets/sculptures/512/${m.slug}.webp" srcset="/assets/sculptures/512/${m.slug}.webp 512w, /assets/sculptures/1024/${m.slug}.webp 1024w" sizes="(max-width: 599px) 280px, 360px" width="1024" height="1024" alt="${esc(m.name)} zodiac artwork" decoding="async" fetchpriority="high" /><span class="profile-art__light" aria-hidden="true"></span></div></div>
          </div>
        </div>
        <p class="lot__intro">${esc(m.consumer.essence)}</p>
        <section class="profile-panel glance" aria-labelledby="glance-title">
          <h2 id="glance-title">${esc(m.name)} at a glance</h2>
          <dl>
${glanceRows.slice(0, 3).map(([key, value]) => `            <div><dt>${esc(key)}</dt><dd${key === 'Type' ? ` aria-label="${esc(value)}"` : ''}>${esc(key === 'Type' ? titleCase(m.consumer.modality) : value)}</dd></div>`).join('\n')}
          </dl>
        </section>
        <div class="profile-actions">
          <a class="profile-explore" href="/${m.slug}/">${esc(m.name)} guide <span aria-hidden="true">↗</span></a>
          <a class="profile-record" href="#token">Public record <span aria-hidden="true">↓</span></a>
        </div>
      </section>
    </div>
    <nav class="profile-sections" aria-label="Profile sections">
      <a href="#identity">The sign</a><a href="#people">Shared birthdays</a><a href="#constellation">In the sky</a><a href="#token">The record</a>
    </nav>

    <section class="sec reveal pride" id="identity" aria-labelledby="identity-title">
      <div class="sec__head"><h2 class="sec__title" id="identity-title">Born under ${esc(m.name)}</h2><span class="line"></span></div>
      <p class="pride__rally">${esc(m.rallyLine)}</p>
      <div class="attention-grid">
        <article class="attention-card"><span class="attention-card__label">People who share ${esc(m.name)}</span><strong>Hundreds of millions</strong><p>A rough estimate based on one-twelfth of the world’s population. It describes the sign, not token ownership.</p></article>
        <article class="attention-card" data-attention><span class="attention-card__label">Wikipedia views</span><strong>${m.attention.signViews.toLocaleString('en-US')} a day</strong><p>The English Wikipedia page for ${esc(m.name)} averaged ${m.attention.signViews.toLocaleString('en-US')} views a day from ${esc(m.attention.from)} to ${esc(m.attention.to)}.</p><small>Source: Wikimedia · updated ${esc(m.attention.capturedAt)}. One person may account for more than one view. This shows interest, not ownership or value. <a href="/thesis/#pulse">See the source</a>.</small></article>
      </div>
      <div class="people-block">
        <div id="people"><span class="people-block__label">You’re in good company</span></div>
        <ul>
${m.people.map((person) => `          <li><a href="/people/${person.slug}/"${person.protectedLiving ? ' rel="nofollow"' : ''}><strong>${esc(person.name)}</strong><span>${esc(person.date)}</span></a></li>`).join('\n')}
        </ul>
        <small>Birth dates are sourced. These people did not endorse Zodiacs.org.</small>
      </div>
    </section>

    <section class="sec reveal ownership" id="token" aria-labelledby="token-title">
      <div class="sec__head"><div><span class="ownership__eyebrow">The ${esc(m.name)} token</span><h2 class="sec__title" id="token-title">Supply &amp; ownership</h2></div><span class="line"></span></div>
      <p class="ownership__lede">The ${esc(m.name)} token is a digital item people can own or send. No new ${esc(m.name)} tokens can be created. The public chain shows how its supply is spread across token accounts, but not who the people behind those accounts are.</p>
      <div class="ownership__facts">
        <article class="ownership-fact"><span class="ownership-fact__label">Recorded Solana supply</span><strong>${esc(m.ownership.supplyDisplay)} ${esc(m.ticker)}</strong><small>${esc(m.ownership.supplyExact)} at the snapshot.</small></article>
        <article class="ownership-fact"><span class="ownership-fact__label">New issuance</span><strong>${m.ownership.mintDisabled ? 'Disabled' : 'Not verified'}</strong><small>${m.ownership.mintDisabled ? `Mint authority renounced · checked ${esc(m.ownership.mintChecked)}.` : 'See the public record before relying on this status.'}</small></article>
        <article class="ownership-fact"><span class="ownership-fact__label">Account freezing</span><strong>${m.ownership.freezeDisabled ? 'Disabled' : 'Not verified'}</strong><small>${m.ownership.freezeDisabled ? `Freeze authority renounced · checked ${esc(m.ownership.freezeChecked)}.` : 'See the public record before relying on this status.'}</small></article>
        <article class="ownership-fact"><span class="ownership-fact__label">Official Base version</span><strong>${m.ownership.bridgedFromSolana ? 'Bridged' : 'See record'}</strong><small>${m.ownership.bridgedFromSolana ? 'Backed by the original Solana token; it is not added again as extra supply.' : 'Check the verified Base representation below.'}</small></article>
      </div>
      <div class="ownership__spread">
        <div class="ownership__spread-head"><span>How the recorded supply is spread</span><strong>Top 10 token accounts hold ${m.ownership.top10.toFixed(2)}%</strong></div>
        <div class="ownership-bar" role="img" aria-label="Largest token account ${m.ownership.top1.toFixed(2)} percent; next 9 token accounts ${m.ownership.segments[1].value.toFixed(2)} percent; next 10 token accounts ${m.ownership.segments[2].value.toFixed(2)} percent; all other token accounts ${m.ownership.segments[3].value.toFixed(2)} percent">
${m.ownership.segments.map((segment) => `          <span class="ownership-bar__${segment.className}" style="--portion:${segment.value}" aria-hidden="true"></span>`).join('\n')}
        </div>
        <dl class="ownership-legend">
${m.ownership.segments.map((segment) => `          <div><i style="--legend:${segment.className === 'largest' ? m.hue : `color-mix(in srgb, ${m.hue} ${segment.className === 'next-nine' ? '72%' : segment.className === 'next-ten' ? '46%' : '20%'}, ${segment.className === 'next-nine' ? '#eef1f7' : segment.className === 'next-ten' ? '#8e96ab' : '#252a36'})`}" aria-hidden="true"></i><dt>${esc(segment.label)}</dt><dd>${segment.value.toFixed(2)}%</dd></div>`).join('\n')}
        </dl>
        <p class="ownership__freshness"><span class="ownership__age${m.ownership.isCarriedForward ? ' ownership__age--carried' : ''}">${esc(m.ownership.snapshotLabel)}</span><span>Recorded <time datetime="${esc(m.ownership.capturedAt)}">${esc(m.ownership.capturedLabel)}</time></span><a href="${esc(m.ownership.verifyUrl)}" rel="noopener noreferrer external">Check on Solscan ↗</a></p>
        <details class="ownership-method"><summary>What does “token account” mean?</summary><p>Solana reports token accounts, not verified people. One person can use several accounts, and one account can represent a liquidity pool, bridge, exchange, or custodian. The chain does not reveal a real-world identity.</p><p>Percentages compare account balances with the recorded native Solana supply. The official Base version is bridged from Solana and is not counted a second time.</p></details>
      </div>
    </section>

    <section class="sec reveal market-section" id="market" aria-labelledby="market-title">
      <div class="sec__head"><h2 class="sec__title" id="market-title">${esc(m.name)} today</h2><span class="line"></span></div>
      <aside class="market" data-market>
        <div class="market__head"><p class="market__copy">The price can change quickly and can fall to zero.</p><a class="market__source" data-market-live-link href="${esc(m.dexscreener)}" rel="noopener noreferrer external nofollow">View live chart ↗</a></div>
        <section class="quick" aria-labelledby="quick-title" data-live-quote>
          <span class="quick__label" id="quick-title" data-live-price-label>Latest recorded price</span>
          <div class="quick__quote" aria-live="polite"><strong class="quick__price" data-live-price>${m.marketAsset ? formatPrice(m.marketAsset.priceUsd) : '—'}</strong><span class="quick__change" data-live-change>Past 24 hours ${m.marketAsset?.change24hPct == null ? '—' : `${Number(m.marketAsset.change24hPct) > 0 ? '+' : ''}${Number(m.marketAsset.change24hPct).toFixed(2)}%`}</span><p class="quick__state" data-live-state>Showing the latest saved price. Checking for a newer one…</p></div>
        </section>
        <div class="market__grid" data-market-grid>
${staticMetrics.map(([key, value, className]) => `          <div class="market__cell"><div class="market__k">${esc(key)}</div><div class="market__v ${className}">${esc(value)}</div></div>`).join('\n')}
        </div>
        <p class="market__state" data-market-state>Loading price history…</p>
        <div class="market__chart" data-market-chart hidden>
          <div class="market__chart-head"><div><h3 class="market__chart-title">Price history</h3><p class="market__chart-note" data-market-chart-note></p></div><div class="market__ranges" aria-label="Price chart range"><button class="market__range" type="button" data-market-range="7d" aria-pressed="true">7D</button><button class="market__range" type="button" data-market-range="30d" aria-pressed="false">30D</button><button class="market__range" type="button" data-market-range="all" aria-pressed="false">All</button></div></div>
          <div data-market-chart-canvas></div><dl class="chart-summary" data-chart-summary hidden></dl>
        </div>
        <noscript><p class="market__state">Price history is unavailable here. The latest recorded price and verified address are still shown.</p></noscript>
        <div class="market__foot" data-market-foot>Updated ${esc(readableTimestamp(marketReadAt))}</div>
      </aside>
      <section class="standings" data-market-standings aria-labelledby="standings-title">
        <div class="standings__head"><div><span>Market standings</span><h3 id="standings-title">${currentRank ? `${ordinal(currentRank)} of 12 by total market value` : 'Market rank unavailable'}</h3></div><p data-standings-summary>${esc(standingsSummary)}</p></div>
        <details class="standings__all"><summary>See all 12 market standings</summary>
          <ol class="standings__list" data-standings-list>
${rankedStandings.map((asset) => {
  const sign = NAV_SIGNS.find((candidate) => candidate.slug === asset.sign);
  return `          <li${asset.sign === m.slug ? ' class="is-current" aria-current="true"' : ''}><a href="${signPath(asset.sign)}" style="--sign:${sign.hue}"><span class="standings__rank">${m.rankStatus.available ? `#${asset.rank}` : '—'}</span><picture><source srcset="/assets/zodiac-icons/48/${asset.sign}.avif" type="image/avif"/><img src="/assets/zodiac-icons/48/${asset.sign}.webp" width="32" height="32" alt="" loading="lazy" decoding="async"/></picture><strong>${esc(sign.name)}</strong><span>${wholeUsd(asset.marketCapUsd)}</span></a></li>`;
}).join('\n')}
          </ol>
        </details>
        <p class="standings__time" data-standings-time>Updated ${esc(readableTimestamp(marketReadAt))}</p>
        <details class="market-explainer"><summary>Where do these numbers come from?</summary><p>The source reports each sign’s price, trading activity and total market value. Zodiacs.org matches each sign by its verified address. Total market value is a comparison, not money held in a bank, and light trading can move it quickly. <a href="/registry/technical/#market-transparency">See sources and method details.</a></p></details>
      </section>
    </section>

    <span class="anchor-alias" id="acquire" aria-hidden="true"></span>
    <section class="sec reveal" id="record" aria-label="Check the token">
      <div class="sec__head"><h2 class="sec__title">Check the token</h2><span class="line"></span></div>
      <p class="record-intro">Every token has a long address, like an account number. If you see ${esc(m.name)} somewhere else, compare its address with this verified one:</p>
      <div class="rec">
        <div class="rec__row rec__row--primary">
          <span class="rec__k">Verified token address</span>
          <button type="button" class="copychip" data-copy="${esc(m.solana.address)}">
            <span class="copychip__text">${esc(m.solana.address.slice(0, 8))}…${esc(m.solana.address.slice(-6))}</span>
            <span class="copychip__icon" aria-hidden="true">⧉</span>
            <span class="sr-only">Copy verified token address</span>
          </button>
        </div>
        <details class="token-details"><summary>See technical details</summary>
          <div class="rec__row"><span class="rec__k">Solana <span class="net">· original</span></span><span class="mono-address">${esc(m.solana.address)}</span></div>
          <div class="rec__row"><span class="rec__k">Base <span class="net">· bridged version</span></span><button type="button" class="copychip" data-copy="${esc(m.base.address)}"><span class="copychip__text">${esc(m.base.address.slice(0, 8))}…${esc(m.base.address.slice(-6))}</span><span class="copychip__icon" aria-hidden="true">⧉</span><span class="sr-only">Copy Base token address</span></button></div>
          <div class="rec__links"><a class="rec__link" href="https://solscan.io/token/${esc(m.solana.address)}" rel="noopener noreferrer">Solscan ↗</a><a class="rec__link" href="https://basescan.org/token/${esc(m.base.address)}" rel="noopener noreferrer">BaseScan ↗</a><a class="rec__link" href="/registry/zodiacs.registry.json">Registry record</a></div>
        </details>
      </div>
    </section>

    <details class="record-detail reveal" id="constellation" aria-labelledby="constellation-title">
      <summary class="record-detail__summary"><span class="record-detail__title" id="constellation-title">${esc(m.name)} in the sky</span><span class="record-detail__hint">Constellation map</span></summary>
      <div class="record-detail__body constellation">
        <div class="constellation__map">
          <img src="/assets/constellations/${m.slug}.svg" width="720" height="460" loading="lazy" decoding="async" alt="Map of the brighter ${esc(m.name)} constellation stars, with ${esc(focusObject.name)} highlighted" />
        </div>
        <div class="constellation__copy">
          <p class="constellation__body">The dots show brighter stars. The lines are a reading guide, not official constellation boundaries.</p>
          <details class="map-sources"><summary>Map sources</summary><p class="constellation__source"><a href="${HYG_ATTRIBUTION.url}" rel="noopener noreferrer">${HYG_ATTRIBUTION.title}</a> · <a href="${HYG_ATTRIBUTION.licenseUrl}" rel="noopener noreferrer">${HYG_ATTRIBUTION.license}</a>.${focusObject.kind === 'open-cluster' ? ' Praesepe’s cluster centre comes from <a href="https://simbad.cds.unistra.fr/simbad/sim-id?Ident=M44" rel="noopener noreferrer">SIMBAD M44</a>.' : ''}</p></details>
        </div>
      </div>
    </details>

    <details class="record-detail reveal" id="provenance" aria-label="The story of ${esc(m.name)}">
      <summary class="record-detail__summary"><span class="record-detail__title">The story of ${esc(m.name)}</span><span class="record-detail__hint">A short history</span></summary>
      <div class="record-detail__body story-copy"><p>${esc(p.provenanceBabylon)}</p><p>${esc(p.provenanceGreece)}</p></div>
    </details>

    <details class="record-detail reveal" aria-labelledby="research-title">
      <summary class="record-detail__summary"><span class="record-detail__title" id="research-title">More about ${esc(m.name)}</span><span class="record-detail__hint">Stories and sky notes</span></summary>
      <div class="record-detail__body"><nav class="research-links" aria-label="Research related to ${esc(m.name)}">
        <a href="/terminal/research/?sign=${m.slug}&amp;type=daily"><span class="research-links__glyph" aria-hidden="true">☉</span><span><strong>Latest ${esc(m.name)} sky notes</strong><small>Sky facts and sources</small></span><span class="research-links__arr" aria-hidden="true">→</span></a>
        <a href="/terminal/research/?sign=${m.slug}"><span class="research-links__glyph" aria-hidden="true">✦</span><span><strong>All ${esc(m.name)} notes</strong><small>Events, observations and sources</small></span><span class="research-links__arr" aria-hidden="true">→</span></a>
      </nav></div>
    </details>

    <section class="sec reveal" aria-label="Explore all 12">
      <div class="sec__head"><h2 class="sec__title">Explore all 12</h2><span class="line"></span></div>
      <nav class="strip" aria-label="All twelve signs">
${NAV_SIGNS.map((sign) => `        <a href="${signPath(sign.slug)}" style="--sign:${sign.hue}"${sign.slug === m.slug ? ' class="is-current" aria-current="page"' : ''}><picture aria-hidden="true"><source srcset="/assets/zodiac-icons/128/${sign.slug}.avif" type="image/avif"/><img src="/assets/zodiac-icons/128/${sign.slug}.webp" width="48" height="48" alt="" loading="lazy" decoding="async"/></picture><span class="strip__name">${esc(sign.name)}</span></a>`).join('\n')}
      </nav>
    </section>

  </main>

  ${renderStaticFooter({ tagline: `${m.name} is one of the Twelve in the official Zodiacs Registry.` })}

  <script data-guide-loader="${GUIDE_LOADER_MARKER}">
${guideLoaderSource('en')}
  </script>

  <script>
  (function () {
    var sign = ${JSON.stringify(m.slug)};

    function trackWingEvent(name) {
      if (typeof plausible === 'function') {
        window.plausible(name, { props: { sign: sign } });
      }
    }

    window.addEventListener('load', function () {
      trackWingEvent('wing_record_view');
    });
  })();
  </script>

  <script>
  (function () {
    'use strict';

    // Scroll reveal
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var reveals = document.querySelectorAll('.reveal');
    if (!reduced && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
        });
      }, { threshold: 0, rootMargin: '0px 0px 48px 0px' });
      reveals.forEach(function (el) { io.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('is-in'); });
    }

    // Decorative light runs only while the sculpture can be seen.
    var art = document.querySelector('.profile-art');
    if (art && 'IntersectionObserver' in window) {
      var artInView = false;
      var artMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      var syncArtMotion = function () {
        art.dataset.artVisible = String(artInView && !document.hidden && !artMotion.matches);
      };
      var artObserver = new IntersectionObserver(function (entries) {
        artInView = entries[0].isIntersecting;
        syncArtMotion();
      }, { threshold: 0.1 });
      artObserver.observe(art);
      document.addEventListener('visibilitychange', syncArtMotion);
      artMotion.addEventListener('change', syncArtMotion);
    }

    // Unified site nav (Part AA) — Signs dropdown + mobile burger (wing-nav.mjs)
    ${wingNavScript()}

    // Section navigation exposes the requested sky record before scrolling.
    document.querySelectorAll('.profile-sections a').forEach(function (link) {
      link.addEventListener('click', function () {
        var target = document.getElementById(link.hash.slice(1));
        if (target && target.tagName === 'DETAILS') target.open = true;
      });
    });

    // Copy chips
    document.querySelectorAll('.copychip[data-copy]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var text = chip.getAttribute('data-copy');
        if (!navigator.clipboard || !navigator.clipboard.writeText) return;
        navigator.clipboard.writeText(text).then(function () {
          chip.classList.add('is-copied');
          var t = chip.querySelector('.copychip__text');
          var prior = t.textContent;
          t.textContent = 'Copied';
          setTimeout(function () {
            chip.classList.remove('is-copied');
            t.textContent = prior;
          }, 1400);
        });
      });
    });

    var shareButton = document.querySelector('[data-share-sign]');
    if (shareButton) shareButton.addEventListener('click', function () {
      var shareData = {
        title: ${JSON.stringify(`${m.name} · Zodiacs.org`)},
        text: ${JSON.stringify(`${p.glyph.replace('︎', '')} I’m a ${m.name}.`)},
        url: location.href
      };
      if (navigator.share) { navigator.share(shareData).catch(function () {}); return; }
      if (!navigator.clipboard || !navigator.clipboard.writeText) return;
      navigator.clipboard.writeText(shareData.text + ' ' + shareData.url).then(function () {
        var prior = shareButton.textContent;
        shareButton.textContent = 'Link copied';
        setTimeout(function () { shareButton.textContent = prior; }, 1400);
      });
    });

    // The first-screen quote is a single selected-token read. It never connects
    // a wallet or starts a transaction. Longer history comes separately from
    // the Registry-owned daily archive below.
    var SIGN = ${JSON.stringify(m.slug)};
    var SIGN_ORDER = ${JSON.stringify(SIGN_ORDER)};
    var SIGN_META = ${JSON.stringify(Object.fromEntries(NAV_SIGNS.map((sign) => [sign.slug, { name: sign.name, hue: sign.hue }]))) };
    var MINT = ${JSON.stringify(m.solana.address)};
    var ACCENT = ${JSON.stringify(m.hue)};
    var LIVE_URL = 'https://api.dexscreener.com/tokens/v1/solana/' + encodeURIComponent(MINT);
    var ARCHIVE_URL = '/assets/data/registry-market-history.v1.json';
    var liveQuote = document.querySelector('[data-live-quote]');
    var livePriceLabel = liveQuote && liveQuote.querySelector('[data-live-price-label]');
    var livePrice = liveQuote && liveQuote.querySelector('[data-live-price]');
    var liveChange = liveQuote && liveQuote.querySelector('[data-live-change]');
    var liveState = liveQuote && liveQuote.querySelector('[data-live-state]');
    var liveLoading = false;
    var hasLiveQuote = false;
    var liveCheckedAt = null;
    var panel = document.querySelector('[data-market]');
    var stateEl = panel.querySelector('[data-market-state]');
    var gridEl = panel.querySelector('[data-market-grid]');
    var chartEl = panel.querySelector('[data-market-chart]');
    var chartCanvas = panel.querySelector('[data-market-chart-canvas]');
    var chartNote = panel.querySelector('[data-market-chart-note]');
    var chartSummary = panel.querySelector('[data-chart-summary]');
    var footEl = panel.querySelector('[data-market-foot]');
    var liveLink = panel.querySelector('[data-market-live-link]');
    var standingsPanel = document.querySelector('[data-market-standings]');
    var standingsTitle = standingsPanel && standingsPanel.querySelector('#standings-title');
    var standingsSummary = standingsPanel && standingsPanel.querySelector('[data-standings-summary]');
    var standingsList = standingsPanel && standingsPanel.querySelector('[data-standings-list]');
    var standingsTime = standingsPanel && standingsPanel.querySelector('[data-standings-time]');
    var rangeButtons = Array.from(panel.querySelectorAll('[data-market-range]'));
    var archiveSnapshots = [];

    function finiteNumber(v) {
      if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
      var n = Number(v);
      return isFinite(n) ? n : null;
    }
    function setUnavailable(message) {
      stateEl.textContent = message || 'Price history is unavailable. The live chart may have a newer price.';
      stateEl.hidden = false;
      chartEl.hidden = true;
    }

    function fmtPrice(v) {
      var n = finiteNumber(v);
      if (n === null) return '—';
      var d = Math.abs(n) < 0.0001 ? 8 : Math.abs(n) < 0.01 ? 6 : 4;
      return '$' + n.toFixed(d).replace(/0+$/, '').replace(/\\.$/, '');
    }
    function fmtCompact(v) {
      var n = finiteNumber(v);
      if (n === null) return '—';
      var a = Math.abs(n);
      if (a >= 1e9) return '$' + (n / 1e9).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'B';
      if (a >= 1e6) return '$' + (n / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'M';
      if (a >= 1e3) return '$' + (n / 1e3).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K';
      return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    function fmtWholeUsd(v) {
      var n = finiteNumber(v);
      if (n === null) return '—';
      return '$' + Math.round(n).toLocaleString();
    }
    function fmtPct(v) {
      var n = finiteNumber(v);
      if (n === null) return '—';
      return (n > 0 ? '+' : '') + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    }
    function fmtDate(v) {
      if (!v) return '—';
      var d = new Date(v);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
    function fmtTimestamp(v) {
      if (!v) return 'Time unavailable';
      var d = new Date(v);
      if (isNaN(d.getTime())) return 'Time unavailable';
      return d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });
    }

    function setLiveUnavailable() {
      if (!liveQuote) return;
      if (hasLiveQuote) {
        liveState.textContent = 'Last price shown. A newer price is temporarily unavailable. Checked ' + liveCheckedAt + '.';
        return;
      }
      liveState.textContent = 'A newer price is temporarily unavailable. The latest saved price remains shown.';
    }

    function renderLiveQuote(payload) {
      var pairs = Array.isArray(payload) ? payload : payload && payload.pairs;
      if (!Array.isArray(pairs)) { setLiveUnavailable(); return; }
      var best = null;
      var bestLiquidity = -1;
      pairs.forEach(function (pair) {
        if (!pair || pair.chainId !== 'solana' || !pair.pairAddress) return;
        if (!pair.baseToken || pair.baseToken.address !== MINT) return;
        var liquidity = finiteNumber(pair.liquidity && pair.liquidity.usd);
        var depth = liquidity === null ? 0 : Math.max(0, liquidity);
        if (depth > bestLiquidity) { best = pair; bestLiquidity = depth; }
      });
      if (!best || finiteNumber(best.priceUsd) === null) { setLiveUnavailable(); return; }
      var change = finiteNumber(best.priceChange && best.priceChange.h24);
      hasLiveQuote = true;
      liveCheckedAt = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      if (livePriceLabel) livePriceLabel.textContent = 'Current price';
      livePrice.textContent = fmtPrice(best.priceUsd);
      liveChange.textContent = 'Past 24 hours ' + fmtPct(change);
      liveChange.classList.remove('quick__change--up', 'quick__change--down');
      if (change !== null && change > 0) liveChange.classList.add('quick__change--up');
      if (change !== null && change < 0) liveChange.classList.add('quick__change--down');
      liveState.textContent = 'Current price checked at ' + liveCheckedAt + '.';
      if (typeof best.url === 'string' && /^https:\\/\\/dexscreener\\.com\\//i.test(best.url)) liveLink.href = best.url;
    }

    function loadLiveQuote() {
      if (!liveQuote || liveLoading) return;
      liveLoading = true;
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 8000);
      fetch(LIVE_URL, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: controller.signal
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(renderLiveQuote).catch(setLiveUnavailable).finally(function () {
        liveLoading = false;
        clearTimeout(timeout);
      });
    }
    function make(tag, className, text) {
      var el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    }
    function latestAsset(snapshot) {
      var assets = snapshot && Array.isArray(snapshot.assets) ? snapshot.assets : [];
      return assets.find(function (asset) { return asset && asset.sign === SIGN; }) || null;
    }
    function marketCapStandings(snapshot) {
      // Mirrors marketStandings() in the generator: every canonical sign stays
      // listed, an unpriced sign keeps a null market cap and sorts last.
      var seen = new Set();
      return (snapshot.assets || []).filter(function (candidate) {
        if (!candidate || SIGN_ORDER.indexOf(candidate.sign) < 0 || seen.has(candidate.sign)) return false;
        seen.add(candidate.sign);
        return true;
      }).map(function (asset) {
        var value = finiteNumber(asset.marketCapUsd);
        return Object.assign({}, asset, { marketCapUsd: value === null || value < 0 ? null : value });
      }).sort(function (a, b) {
        return (b.marketCapUsd === null ? -1 : b.marketCapUsd) - (a.marketCapUsd === null ? -1 : a.marketCapUsd)
          || SIGN_ORDER.indexOf(a.sign) - SIGN_ORDER.indexOf(b.sign);
      });
    }

    function rankStandings(standings) {
      var previousValue = null;
      var previousRank = 0;
      return standings.map(function (asset, index) {
        var value = finiteNumber(asset.marketCapUsd);
        var rank = previousValue !== null && value === previousValue ? previousRank : index + 1;
        previousValue = value;
        previousRank = rank;
        return Object.assign({}, asset, { rank: rank });
      });
    }

    function ordinalRank(rank) {
      var mod100 = rank % 100;
      if (mod100 >= 11 && mod100 <= 13) return rank + 'th';
      return rank + (rank % 10 === 1 ? 'st' : rank % 10 === 2 ? 'nd' : rank % 10 === 3 ? 'rd' : 'th');
    }

    function canPublishRank(snapshot, standings) {
      var coverage = snapshot && snapshot.coverage || {};
      var readAt = new Date(snapshot && snapshot.source && snapshot.source.readAt || '').getTime();
      var age = Date.now() - readAt;
      return standings.length === 12
        && Number(coverage.canonicalAssetCount) === 12
        && Number(coverage.assetsWithIndexedPools) === 12
        && Number(coverage.assetsWithMarketCap) === 12
        && isFinite(readAt) && age >= -300000 && age <= 172800000;
    }

    function renderStandings(snapshot) {
      if (!standingsPanel || !standingsTitle || !standingsSummary || !standingsList || !standingsTime) return;
      var standings = rankStandings(marketCapStandings(snapshot));
      var selected = standings.find(function (candidate) { return candidate.sign === SIGN; });
      var publishRank = canPublishRank(snapshot, standings);
      standingsList.replaceChildren();
      standingsTitle.textContent = publishRank && selected
        ? ordinalRank(selected.rank) + ' of 12 by total market value'
        : 'Market rank unavailable';
      standingsSummary.textContent = 'This rank only compares total market value. It does not show how many people support each sign.'
        + (publishRank ? '' : ' A rank is not shown because some numbers are missing or out of date.');
      standings.forEach(function (asset) {
        var meta = SIGN_META[asset.sign];
        var item = make('li', asset.sign === SIGN ? 'is-current' : '');
        if (asset.sign === SIGN) item.setAttribute('aria-current', 'true');
        var link = make('a');
        link.href = '/registry/' + asset.sign + '/';
        link.style.setProperty('--sign', meta.hue);
        link.append(make('span', 'standings__rank', publishRank ? '#' + asset.rank : '—'));
        var picture = make('picture');
        var source = make('source');
        source.srcset = '/assets/zodiac-icons/48/' + asset.sign + '.avif';
        source.type = 'image/avif';
        var image = make('img');
        image.src = '/assets/zodiac-icons/48/' + asset.sign + '.webp';
        image.width = 32; image.height = 32; image.alt = '';
        picture.append(source, image);
        link.append(picture, make('strong', '', meta.name), make('span', '', fmtWholeUsd(asset.marketCapUsd)));
        item.append(link);
        standingsList.append(item);
      });
      standingsTime.textContent = 'Updated ' + fmtTimestamp(snapshot.source && snapshot.source.readAt);
    }

    function renderMetrics(snapshot, asset) {
      var cells = [
        ['Total market value', fmtCompact(asset.marketCapUsd), ''],
        ['Traded in 24 hours', fmtCompact(asset.volume24hUsd), '']
      ];
      gridEl.replaceChildren();
      cells.forEach(function (cell) {
        var wrapper = make('div', 'market__cell');
        wrapper.append(make('div', 'market__k', cell[0]));
        wrapper.append(make('div', 'market__v ' + cell[2], cell[1]));
        gridEl.append(wrapper);
      });
      stateEl.hidden = true;
      gridEl.hidden = false;
      footEl.replaceChildren(make('span', '', 'Updated ' + fmtTimestamp(snapshot.source && snapshot.source.readAt)));
      footEl.hidden = false;
      renderStandings(snapshot);

      var deepUrl = asset.deepestPool && asset.deepestPool.url;
      if (!hasLiveQuote && typeof deepUrl === 'string' && /^https:\\/\\/dexscreener\\.com\\//i.test(deepUrl)) liveLink.href = deepUrl;
    }

    function renderArchiveQuote(snapshot, asset) {
      if (hasLiveQuote || !liveQuote) return;
      var price = finiteNumber(asset.priceUsd);
      var change = finiteNumber(asset.change24hPct);
      if (livePriceLabel) livePriceLabel.textContent = 'Latest recorded price';
      livePrice.textContent = price === null ? '—' : fmtPrice(price);
      liveChange.textContent = 'Past 24 hours ' + fmtPct(change);
      liveChange.classList.remove('quick__change--up', 'quick__change--down');
      if (change !== null && change > 0) liveChange.classList.add('quick__change--up');
      if (change !== null && change < 0) liveChange.classList.add('quick__change--down');
      liveState.textContent = 'Updated ' + fmtTimestamp(snapshot.source && snapshot.source.readAt) + '.';
    }

    function observationsForRange(range) {
      if (!archiveSnapshots.length || range === 'all') return archiveSnapshots;
      var lastDate = new Date(archiveSnapshots[archiveSnapshots.length - 1].date + 'T00:00:00Z');
      var days = range === '7d' ? 7 : 30;
      var floor = lastDate.getTime() - (days - 1) * 86400000;
      return archiveSnapshots.filter(function (observation) {
        return new Date(observation.date + 'T00:00:00Z').getTime() >= floor;
      });
    }

    function svgNode(tag, attrs) {
      var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
      return node;
    }

    function chartDescription(points) {
      var finite = points.filter(function (point) { return point.price !== null; });
      if (!finite.length) return 'Price history unavailable.';
      var latestDate = fmtDate(finite[finite.length - 1].date);
      return finite.length + (finite.length === 1 ? ' daily price through ' : ' daily prices through ') + latestDate + '.';
    }

    function renderChart(range) {
      var points = observationsForRange(range);
      var finite = points.filter(function (point) { return point.price !== null; });
      chartCanvas.replaceChildren();
      chartSummary.hidden = true;
      chartNote.textContent = chartDescription(points);
      rangeButtons.forEach(function (button) {
        button.setAttribute('aria-pressed', button.getAttribute('data-market-range') === range ? 'true' : 'false');
      });
      if (!finite.length) {
        chartCanvas.append(make('div', 'market__chart-empty', 'No price history is available yet.'));
        return;
      }
      if (finite.length < 2) {
        chartCanvas.append(make(
          'div',
          'market__chart-empty',
          'One daily price is available. The chart will appear after the next one.'
        ));
        chartSummary.hidden = true;
        return;
      }

      var w = 680;
      var h = 190;
      var px = 18;
      var py = 20;
      var times = finite.map(function (point) { return new Date(point.date + 'T00:00:00Z').getTime(); });
      var prices = finite.map(function (point) { return point.price; });
      var minT = Math.min.apply(null, times);
      var maxT = Math.max.apply(null, times);
      var minP = Math.min.apply(null, prices);
      var maxP = Math.max.apply(null, prices);
      var pPad = maxP === minP ? Math.max(Math.abs(maxP) * 0.08, 0.00000001) : (maxP - minP) * 0.12;
      minP -= pPad;
      maxP += pPad;
      function xFor(point) {
        if (maxT === minT) return w / 2;
        return px + (new Date(point.date + 'T00:00:00Z').getTime() - minT) / (maxT - minT) * (w - px * 2);
      }
      function yFor(point) {
        return py + (maxP - point.price) / (maxP - minP) * (h - py * 2);
      }

      var svg = svgNode('svg', {
        class: 'market__svg',
        viewBox: '0 0 ' + w + ' ' + h,
        role: 'img',
        'aria-label': chartDescription(points)
      });
      var svgTitle = svgNode('title');
      svgTitle.textContent = chartDescription(points);
      svg.append(svgTitle);
      [0.25, 0.5, 0.75].forEach(function (ratio) {
        var y = py + (h - py * 2) * ratio;
        svg.append(svgNode('line', {
          x1: px, y1: y, x2: w - px, y2: y,
          stroke: 'rgba(198,204,218,0.12)', 'stroke-width': '1'
        }));
      });

      var segments = [];
      var active = [];
      points.forEach(function (point, index) {
        var previous = index ? points[index - 1] : null;
        var gap = previous
          ? new Date(point.date + 'T00:00:00Z').getTime() - new Date(previous.date + 'T00:00:00Z').getTime()
          : 0;
        if (point.price === null || gap > 1.5 * 86400000) {
          if (active.length) segments.push(active);
          active = point.price === null ? [] : [point];
        } else {
          active.push(point);
        }
      });
      if (active.length) segments.push(active);
      segments.forEach(function (segment) {
        if (segment.length < 2) return;
        var d = segment.map(function (point, index) {
          return (index ? 'L ' : 'M ') + xFor(point).toFixed(2) + ' ' + yFor(point).toFixed(2);
        }).join(' ');
        svg.append(svgNode('path', {
          d: d, fill: 'none', stroke: ACCENT, 'stroke-width': '3',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));
      });
      finite.forEach(function (point) {
        var dot = svgNode('circle', {
          cx: xFor(point).toFixed(2), cy: yFor(point).toFixed(2),
          r: finite.length === 1 ? '5' : '3.5',
          fill: ACCENT, stroke: '#090b10', 'stroke-width': '2'
        });
        var title = svgNode('title');
        title.textContent = fmtDate(point.date) + ': ' + fmtPrice(point.price);
        dot.append(title);
        svg.append(dot);
      });
      chartCanvas.append(svg);
      var first = finite[0];
      var latest = finite[finite.length - 1];
      var low = finite.reduce(function (best, point) { return point.price < best.price ? point : best; }, finite[0]);
      var high = finite.reduce(function (best, point) { return point.price > best.price ? point : best; }, finite[0]);
      chartSummary.replaceChildren();
      [
        ['Start · ' + fmtDate(first.date), fmtPrice(first.price)],
        ['Latest · ' + fmtDate(latest.date), fmtPrice(latest.price)],
        ['Low · ' + fmtDate(low.date), fmtPrice(low.price)],
        ['High · ' + fmtDate(high.date), fmtPrice(high.price)]
      ].forEach(function (row) {
        var wrapper = make('div');
        wrapper.append(make('dt', '', row[0]), make('dd', '', row[1]));
        chartSummary.append(wrapper);
      });
      chartSummary.hidden = false;
    }

    function configureRanges() {
      var seven = panel.querySelector('[data-market-range="7d"]');
      var thirty = panel.querySelector('[data-market-range="30d"]');
      var all = panel.querySelector('[data-market-range="all"]');
      var sevenPoints = observationsForRange('7d').filter(function (point) { return point.price !== null; });
      var thirtyPoints = observationsForRange('30d').filter(function (point) { return point.price !== null; });
      var allPoints = observationsForRange('all').filter(function (point) { return point.price !== null; });
      seven.disabled = sevenPoints.length < 2;
      if (seven.disabled) seven.title = 'Available after two daily prices';
      thirty.hidden = thirtyPoints.length < 30;
      all.hidden = allPoints.length < 2 || (
        sevenPoints.length === allPoints.length
        && sevenPoints[0] && allPoints[0]
        && sevenPoints[0].date === allPoints[0].date
        && sevenPoints[sevenPoints.length - 1].date === allPoints[allPoints.length - 1].date
      );
      rangeButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          if (!button.disabled) renderChart(button.getAttribute('data-market-range'));
        });
      });
      return !seven.disabled ? '7d' : !all.hidden ? 'all' : null;
    }

    function renderArchive(archive) {
      if (!archive || archive.schema !== 'zodiacs.registry-market-history.v1' || !Array.isArray(archive.snapshots)) {
        setUnavailable('Price history is unavailable.');
        return;
      }
      var snapshots = archive.snapshots.slice().sort(function (a, b) {
        return String(a.date).localeCompare(String(b.date));
      });
      if (!snapshots.length) {
        setUnavailable('Price history is not available yet.');
        return;
      }
      var latest = snapshots[snapshots.length - 1];
      var asset = latestAsset(latest);
      if (!asset) {
        setUnavailable('Price history is unavailable.');
        return;
      }

      archiveSnapshots = snapshots.map(function (snapshot) {
        var snapshotAsset = latestAsset(snapshot);
        return {
          date: snapshot.date,
          price: snapshotAsset ? finiteNumber(snapshotAsset.priceUsd) : null
        };
      });
      renderMetrics(latest, asset);
      renderArchiveQuote(latest, asset);
      var defaultRange = configureRanges();
      if (defaultRange) renderChart(defaultRange);
      else chartCanvas.replaceChildren(make('div', 'market__chart-empty', 'Price history is still being collected.'));
      chartEl.hidden = false;
    }

    function loadMarket() {
      fetch(ARCHIVE_URL, {
        cache: 'no-cache',
        headers: { accept: 'application/json' }
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(renderArchive).catch(function () {
        setUnavailable('Price history is unavailable.');
      });
    }

    var marketStarted = false;
    function startMarketData() {
      if (marketStarted) return;
      marketStarted = true;
      loadLiveQuote();
      loadMarket();
    }
    setInterval(function () {
      if (marketStarted && !document.hidden) loadLiveQuote();
    }, 120000);
    document.addEventListener('visibilitychange', function () {
      if (marketStarted && !document.hidden) loadLiveQuote();
    });

    if ('IntersectionObserver' in window) {
      var mio = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { mio.disconnect(); startMarketData(); }
      }, { rootMargin: '0px 0px 20% 0px' });
      mio.observe(panel);
    } else {
      startMarketData();
    }
  })();
  </script>
</body>
</html>
`;
}

const constellationDir = resolve(root, 'public', 'assets', 'constellations');
await mkdir(constellationDir, { recursive: true });

for (const slug of SIGN_ORDER) {
  const m = pageModel(slug);
  const html = render(m);
  const dir = resolve(root, 'public', 'registry', slug);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), html, 'utf8');
  await writeFile(resolve(constellationDir, `${slug}.svg`), renderConstellationSvg(m), 'utf8');
  console.log(`Wrote /registry/${slug}/index.html (${html.length} bytes)`);
}
await writeFile(
  resolve(constellationDir, 'ATTRIBUTION.txt'),
  `Zodiacs.org constellation maps

Star positions and apparent magnitudes are derived from HYG Database v4.0:
${HYG_ATTRIBUTION.url}
Source file: hyg/CURRENT/hygdata_v40.csv.gz
Source blob: ${HYG_ATTRIBUTION.sourceBlob}
License: ${HYG_ATTRIBUTION.license} — ${HYG_ATTRIBUTION.licenseUrl}

The plotted subset is committed in scripts/constellation-data.mjs. Guide
segments were authored by Zodiacs.org as a visual aid; they are not official
IAU constellation boundaries. Praesepe is an open cluster rather than a HYG
star; its supplemental J2000 centre is attributed in the Cancer record to
SIMBAD M44: https://simbad.cds.unistra.fr/simbad/sim-id?Ident=M44
`,
  'utf8'
);
console.log('Done — 12 official token records and constellation maps.');
