import { NAV_SIGNS } from './wing-nav.mjs';

// Reuse disclosure.adviceStatement's first sentence and the catalogue's
// market__copy verbatim. Neither audience awareness nor belief is demand.
export const GAP_RISK_LINE = 'Registry records, market context, and Registry Collection are not financial advice or a solicitation to buy, sell, or hold an asset. The price can change quickly and can fall to zero.';
export const GAP_TITLE = 'Astrology audience & Zodiac market cap';
export const GAP_DESCRIPTION = 'A dated U.S. audience survey beside the latest archived market cap of the official Zodiac tokens.';
export const GAP_CONTEXT = 'Survey percentages and token market cap describe different things, in different units and at different dates. They are presented separately, without a conversion between them.';
export const GAP_FORECAST_WORDS = /\b(?:forecast\w*|predict\w*|undervalued|overvalued|will|could\s+reach|price\s+targets?|upside|potential\s+return)\b/iu;
export const GAP_OG_DIRECTORY = 'public/assets/og/astrofolio/gap';

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function money(value) {
  return value === null ? 'Not reported' : new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value);
}

export function utcLabel(timestamp) {
  return timestamp.replace('T', ' ').replace('Z', ' UTC');
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function sourceUrl(value) {
  return typeof value === 'string' && /^https:\/\//u.test(value) && URL.canParse(value);
}

export function shapeAudience(data) {
  if (data?.schema !== 'zodiacs.astrofolio-gap-audience.v1'
      || typeof data.ownerReviewRequired !== 'boolean' || !Array.isArray(data.facts) || !data.facts.length) {
    throw new Error('Audience data needs a schema, review field and sourced facts');
  }
  const ids = new Set();
  for (const fact of data.facts) {
    if (!fact.id || ids.has(fact.id) || typeof fact.value !== 'number' || !Number.isFinite(fact.value)
        || fact.value < 0 || fact.value > 100 || fact.unit !== 'percent'
        || !fact.label || !fact.sourceName || !sourceUrl(fact.sourceUrl) || !validDate(fact.asOfDate)
        || !validDate(fact.publishedDate) || !fact.surveyPeriod
        || !Number.isInteger(fact.sampleSize) || fact.sampleSize < 1 || !fact.method || !fact.context) {
      throw new Error('Audience fact needs a unique id, percentage, source and survey dates');
    }
    if (GAP_FORECAST_WORDS.test(`${fact.label} ${fact.context} ${fact.method}`)) {
      throw new Error('Audience copy contains forecast language');
    }
    ids.add(fact.id);
  }
  return data;
}

export function shapeGapMarket(history, registry) {
  if (history?.schema !== 'zodiacs.registry-market-history.v1' || history.version !== 1
      || !Array.isArray(history.snapshots) || !history.snapshots.length) {
    throw new Error('A supported, non-empty market archive is required');
  }
  const canonical = registry?.assets;
  if (!Array.isArray(canonical) || canonical.length !== 12
      || new Set(canonical.map((asset) => asset.sign)).size !== 12
      || NAV_SIGNS.some(({ slug }) => !canonical.some((asset) => asset.sign === slug))) {
    throw new Error('The registry must contain the twelve canonical signs');
  }
  // Select by observation time, not array order; never substitute an older,
  // more complete observation when the latest record has missing values.
  for (const snapshot of history.snapshots) {
    const time = snapshot.source?.readAt;
    if (!validDate(snapshot.date) || typeof time !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(time)
        || !Number.isFinite(Date.parse(time)) || time.slice(0, 10) !== snapshot.date) {
      throw new Error('Market observation needs a dated UTC timestamp');
    }
  }
  const snapshot = [...history.snapshots].sort((a, b) => Date.parse(b.source.readAt) - Date.parse(a.source.readAt))[0];
  if (snapshot.source.provider !== 'DexScreener' || !sourceUrl(snapshot.source.url)) {
    throw new Error('Market observation needs its DexScreener source');
  }
  if (!Array.isArray(snapshot.assets) || snapshot.assets.length !== 12
      || new Set(snapshot.assets.map((asset) => asset.sign)).size !== 12) {
    throw new Error('Market observation must contain twelve unique signs');
  }
  const signs = NAV_SIGNS.map(({ slug, name, hue }) => {
    const official = canonical.find((asset) => asset.sign === slug);
    const asset = snapshot.assets.find((entry) => entry.sign === slug);
    if (official.native?.chain !== 'solana' || !official.native.isCanonicalOrigin
        || !official.native.isOfficialRepresentation || !asset || asset.mint !== official.native.address) {
      throw new Error(`Market mint does not match the canonical registry: ${slug}`);
    }
    const value = asset.marketCapUsd;
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      throw new Error(`Invalid market cap: ${slug}`);
    }
    return { slug, name, hue, mint: asset.mint, value,
      sourceName: snapshot.source.provider, sourceUrl: snapshot.source.url,
      observedAt: snapshot.source.readAt };
  });
  const reported = signs.filter((sign) => sign.value !== null);
  const subtotal = reported.length ? Math.round(reported.reduce((total, sign) => total + sign.value, 0) * 1e8) / 1e8 : null;
  if (snapshot.totals?.marketCapAssetCount !== reported.length || snapshot.totals?.marketCapUsd !== subtotal) {
    throw new Error('Archived market-cap totals disagree with the twelve records');
  }
  return {
    date: snapshot.date, observedAt: snapshot.source.readAt, sourceName: snapshot.source.provider,
    sourceUrl: snapshot.source.url, measure: 'Market cap (USD)', signs,
    reportedCount: reported.length, combined: reported.length === 12 ? subtotal : null,
    subtotal, method: history.method,
  };
}

export function marketHeadline(market) {
  return market.combined === null ? 'Combined value unavailable' : money(market.combined);
}

export function coverageLine(market) {
  return market.reportedCount === 12 ? 'All twelve canonical Solana mints reported.'
    : `${market.reportedCount} of ${market.signs.length} canonical mints reported market cap. Reported subtotal: ${money(market.subtotal)}. Missing values are not zero.`;
}

// Date-keyed URL plus a content digest keeps social caches from relabeling an
// older image, even if an observation is explicitly refreshed on the same day.
export function gapOgPath(market, digest) {
  return `/assets/og/astrofolio/gap/${market.date}-${digest.slice(0, 12)}.png`;
}
