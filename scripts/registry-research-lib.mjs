import { createHash } from 'node:crypto';

export const REGISTRY_RESEARCH_ITEM_SCHEMA = 'zodiacs.registry-research-item.v1';
export const REGISTRY_RESEARCH_LEDGER_SCHEMA = 'zodiacs.registry-research-drafts.v1';
export const REGISTRY_RESEARCH_PUBLICATION_SCHEMA = 'zodiacs.registry-research-publication.v1';
export const REGISTRY_RESEARCH_FEED_SCHEMA = 'zodiacs.registry-research-feed.v1';
export const REGISTRY_RESEARCH_APPROVAL_SCHEMA = 'zodiacs.registry-research-approvals.v1';
export const REGISTRY_RESEARCH_GENERATOR = 'zodiacs.registry-research.deterministic.v1';
export const REGISTRY_RESEARCH_PUBLISHER = 'Zodiacs.org Research System';
export const REGISTRY_RESEARCH_RISK = 'Symbolic research—not investment advice. Market observations never alter the sky score.';
export const REGISTRY_RESEARCH_SCIENCE_NOTE = 'Astrology has no established predictive relationship with asset prices. Crypto assets can lose all value.';
export const REGISTRY_RESEARCH_PAUSE_SCHEMA = 'zodiacs.registry-research-pause.v1';
export const REGISTRY_RESEARCH_PAUSE_STATUSES = Object.freeze(['paused', 'publishing']);

const SITE = 'https://zodiacs.org';
const DAY_MS = 86_400_000;
const SIGN_ORDER = Object.freeze([
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
]);
const SIGN_NAMES = Object.freeze(Object.fromEntries(
  SIGN_ORDER.map((sign) => [sign, `${sign[0].toUpperCase()}${sign.slice(1)}`]),
));
const EVENT_ARRAYS = Object.freeze(['ingresses', 'lunations', 'stations', 'aspects']);
const EVENT_KIND_WEIGHT = Object.freeze({
  lunation: 4,
  station: 3,
  ingress: 2,
  aspect: 1,
});
const FORBIDDEN_DIRECTIONAL_CLAIMS = Object.freeze([
  /\bbullish\b/iu,
  /\bbearish\b/iu,
  /\bbuy signal\b/iu,
  /\bsell signal\b/iu,
  /\bprice target\b/iu,
  /\breturn probability\b/iu,
  /\b(?:planet|moon|sky|astrolog\w*)\w*\s+(?:caused|causes|will cause|predicts?)\b/iu,
  /\bprice\s+(?:will|must|is going to)\s+(?:rise|fall|increase|decrease|pump|drop)\b/iu,
]);

export const REGISTRY_RESEARCH_METHOD = Object.freeze({
  id: 'zodiacs.registry-research-method.v1',
  version: 1,
  generator: REGISTRY_RESEARCH_GENERATOR,
  deterministicTemplatesOnly: true,
  modelAuthoredProse: false,
  scoreRule: 'The disclosed Registry Outlook sky score is copied before market comparison. Market fields cannot alter that score or its wording.',
  observationRule: 'Follow-ups use the first archived market snapshot at or after the requested elapsed interval and report the actual elapsed time.',
  causalityRule: 'Market changes are observations, never evidence that a sky event caused a price or liquidity movement.',
  publicationRule: 'During the pilot, an exact artifact hash and named reviewer are required before an item enters public feeds.',
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function median(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return null;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 ? finite[middle] : round((finite[middle - 1] + finite[middle]) / 2, 8);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalValue(nested)]),
    );
  }
  return value;
}

export function canonicalRegistryResearchJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function registryResearchSha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertCanonicalInstant(value, label) {
  const parsed = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO instant`);
  }
}

function assertDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value ?? '')) throw new Error(`${label} must use YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a real UTC date`);
  }
}

function assertSign(sign, label) {
  if (!SIGN_ORDER.includes(sign)) throw new Error(`${label} contains unknown sign ${sign}`);
}

// The committed pause record, src/data/registry-research/pause.json. While its
// status is "paused", no new draft, item, feed entry, RSS entry or outlook
// edition is produced: the committed ledger and publication are kept exactly
// as they stand. Setting the status back to "publishing" resumes the normal
// lifecycle with no other change.
export function validateRegistryResearchPause(pause) {
  if (!isRecord(pause) || pause.schema !== REGISTRY_RESEARCH_PAUSE_SCHEMA) {
    throw new Error(`pause record must use ${REGISTRY_RESEARCH_PAUSE_SCHEMA}`);
  }
  if (!REGISTRY_RESEARCH_PAUSE_STATUSES.includes(pause.status)) {
    throw new Error(`pause.status must be one of ${REGISTRY_RESEARCH_PAUSE_STATUSES.join(', ')}`);
  }
  if (pause.status === 'paused') {
    assertCanonicalInstant(pause.pausedAt, 'pause.pausedAt');
    if (typeof pause.reason !== 'string' || pause.reason.trim().length < 10) {
      throw new Error('pause.reason must say why publishing is paused');
    }
  }
}

export function registryResearchIsPaused(pause) {
  if (pause === null || pause === undefined) return false;
  validateRegistryResearchPause(pause);
  return pause.status === 'paused';
}

function pauseDateLabel(pause) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(pause.pausedAt));
}

/** One plain sentence pair for the archive and the feeds, or null when publishing. */
export function registryResearchPauseNotice(pause) {
  if (!registryResearchIsPaused(pause)) return null;
  return `Publishing has been paused since ${pauseDateLabel(pause)}. No new notes are being added; the notes listed here stay as an archive, as they were published.`;
}

function compactNumber(value) {
  if (!Number.isFinite(value)) return 'unavailable';
  return new Intl.NumberFormat('en-US', {
    notation: Math.abs(value) >= 1_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(value) < 1 ? 8 : 2,
  }).format(value);
}

function percent(value) {
  if (!Number.isFinite(value)) return 'unavailable';
  return `${value >= 0 ? '+' : ''}${round(value, 2)}%`;
}

function money(value) {
  return Number.isFinite(value) ? `$${compactNumber(value)}` : 'unavailable';
}

function titleCase(value) {
  return String(value)
    .replaceAll('-', ' ')
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

function stableInstantSlug(value) {
  return value.toLowerCase().replaceAll(':', '-').replaceAll('.', '-');
}

function eventKind(event, arrayName) {
  if (arrayName === 'ingresses') return 'ingress';
  if (arrayName === 'lunations') return 'lunation';
  if (arrayName === 'stations') return 'station';
  if (arrayName === 'aspects') return 'aspect';
  throw new Error(`Unsupported event array ${arrayName}`);
}

function eventSigns(event, kind) {
  const signs = kind === 'aspect' ? [event.aSign, event.bSign] : [event.sign];
  return [...new Set(signs)].sort((left, right) => SIGN_ORDER.indexOf(left) - SIGN_ORDER.indexOf(right));
}

function eventLabel(event, kind) {
  if (kind === 'ingress') return `${event.planet} enters ${SIGN_NAMES[event.sign]}`;
  if (kind === 'lunation') return `${event.type === 'new' ? 'New' : 'Full'} Moon in ${SIGN_NAMES[event.sign]}`;
  if (kind === 'station') return `${event.planet} stations ${event.type}`;
  return `${event.a} ${titleCase(event.type)} ${event.b}`;
}

function eventKey(event, kind) {
  if (event.groupKind === 'minor-aspects') return `minor-aspects-${event.at.slice(0, 10)}-${event.events.length}`;
  if (kind === 'ingress') return `${event.planet}-${event.sign}`;
  if (kind === 'lunation') return `${event.type}-moon-${event.sign}`;
  if (kind === 'station') return `${event.planet}-${event.type}-${event.sign}`;
  return `${event.a}-${event.type}-${event.b}`;
}

function normalizedEvents(transitMonths, startAt, endAt) {
  if (!Array.isArray(transitMonths)) throw new Error('transitMonths must be an array');
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  const seen = new Set();
  const events = [];
  for (const [monthIndex, catalog] of transitMonths.entries()) {
    if (!isRecord(catalog) || !/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(catalog.month ?? '')) {
      throw new Error(`transitMonths[${monthIndex}].month must use YYYY-MM`);
    }
    for (const arrayName of EVENT_ARRAYS) {
      if (!Array.isArray(catalog[arrayName])) throw new Error(`${catalog.month}.${arrayName} must be an array`);
      for (const [eventIndex, event] of catalog[arrayName].entries()) {
        assertCanonicalInstant(event?.at, `${catalog.month}.${arrayName}[${eventIndex}].at`);
        const atMs = new Date(event.at).getTime();
        if (atMs < startMs || atMs >= endMs) continue;
        const kind = eventKind(event, arrayName);
        const key = `${kind}:${event.at}:${eventKey(event, kind)}`;
        if (seen.has(key)) continue;
        const signs = eventSigns(event, kind);
        signs.forEach((sign) => assertSign(sign, key));
        seen.add(key);
        events.push({ ...event, kind, signs, label: eventLabel(event, kind), source: `src/data/transits-${catalog.month}.json` });
      }
    }
  }
  const sorted = events.sort((left, right) => left.at.localeCompare(right.at) || EVENT_KIND_WEIGHT[right.kind] - EVENT_KIND_WEIGHT[left.kind]);
  const minorByDate = new Map();
  for (const event of sorted) {
    if (event.kind !== 'aspect' || !['trine', 'sextile'].includes(event.type)) continue;
    const date = event.at.slice(0, 10);
    const bucket = minorByDate.get(date) ?? [];
    bucket.push(event);
    minorByDate.set(date, bucket);
  }
  const grouped = [];
  const consumed = new Set();
  for (const [date, bucket] of minorByDate.entries()) {
    if (bucket.length < 2) continue;
    bucket.forEach((event) => consumed.add(`${event.at}:${eventKey(event, event.kind)}`));
    grouped.push({
      kind: 'aspect',
      groupKind: 'minor-aspects',
      at: bucket[0].at,
      signs: [...new Set(bucket.flatMap((event) => event.signs))]
        .sort((left, right) => SIGN_ORDER.indexOf(left) - SIGN_ORDER.indexOf(right)),
      label: `${bucket.length} exact aspects on ${date}`,
      source: bucket[0].source,
      events: bucket.map((event) => ({
        at: event.at,
        label: event.label,
        signs: event.signs,
        source: event.source,
      })),
    });
  }
  return [...sorted.filter((event) => !consumed.has(`${event.at}:${eventKey(event, event.kind)}`)), ...grouped]
    .sort((left, right) => left.at.localeCompare(right.at) || EVENT_KIND_WEIGHT[right.kind] - EVENT_KIND_WEIGHT[left.kind]);
}

function snapshotByDate(marketHistory, date) {
  return marketHistory.snapshots.find((snapshot) => snapshot.date === date) ?? null;
}

function latestSnapshot(marketHistory) {
  return marketHistory.snapshots.at(-1) ?? null;
}

function marketAsset(snapshot, sign) {
  return snapshot?.assets?.find((asset) => asset.sign === sign) ?? null;
}

function marketSnapshotId(snapshot) {
  if (!snapshot) return null;
  return `registry-market:${snapshot.date}:${snapshot.source.readAt}`;
}

function validateMarketHistory(marketHistory) {
  if (!isRecord(marketHistory) || marketHistory.schema !== 'zodiacs.registry-market-history.v1' || !Array.isArray(marketHistory.snapshots)) {
    throw new Error('marketHistory must use zodiacs.registry-market-history.v1');
  }
  let prior = '';
  for (const [index, snapshot] of marketHistory.snapshots.entries()) {
    assertDate(snapshot.date, `marketHistory.snapshots[${index}].date`);
    assertCanonicalInstant(snapshot.source?.readAt, `marketHistory.snapshots[${index}].source.readAt`);
    if (snapshot.source.readAt.slice(0, 10) !== snapshot.date) {
      throw new Error(`marketHistory.snapshots[${index}] read instant must match its UTC date`);
    }
    if (snapshot.date < prior) throw new Error('marketHistory.snapshots must be sorted by date');
    prior = snapshot.date;
    if (!Array.isArray(snapshot.assets)) throw new Error(`marketHistory.snapshots[${index}].assets must be an array`);
  }
}

function strongestEntry(outlookEdition) {
  return [...outlookEdition.signs].sort((left, right) => (
    left.attentionRank - right.attentionRank || SIGN_ORDER.indexOf(left.sign) - SIGN_ORDER.indexOf(right.sign)
  ))[0];
}

function factorForEvent(outlook, event) {
  const factors = outlook.weekly.signs.flatMap((entry) => entry.factors ?? []);
  return factors.find((factor) => factor.at === event.at && factor.signs?.some((sign) => event.signs.includes(sign))) ?? null;
}

function noteSections({ skyFact, traditionalReading, marketObservation, skyEvidence = [], marketEvidence = [] }) {
  return {
    skyFact: { heading: 'Sky fact', body: skyFact, evidence: skyEvidence },
    traditionalReading: { heading: 'Traditional reading', body: traditionalReading, evidence: skyEvidence },
    marketObservation: { heading: 'Market observation', body: marketObservation, evidence: marketEvidence },
  };
}

function itemHashPayload(item) {
  const { artifactHash: _artifactHash, status: _status, publication: _publication, publishedAt: _publishedAt, ...payload } = item;
  return payload;
}

export function calculateRegistryResearchItemHash(item) {
  return registryResearchSha256(canonicalRegistryResearchJson(itemHashPayload(item)));
}

function finalizeItem(item) {
  const normalized = {
    schema: REGISTRY_RESEARCH_ITEM_SCHEMA,
    sourceType: 'zodiacs-research',
    publisher: REGISTRY_RESEARCH_PUBLISHER,
    byline: REGISTRY_RESEARCH_PUBLISHER,
    status: 'draft',
    method: REGISTRY_RESEARCH_METHOD,
    riskStatement: REGISTRY_RESEARCH_RISK,
    scienceNote: REGISTRY_RESEARCH_SCIENCE_NOTE,
    revisions: [],
    ...item,
  };
  validateRegistryResearchItem(normalized, { requireHash: false });
  return Object.freeze({ ...normalized, artifactHash: calculateRegistryResearchItemHash(normalized) });
}

function marketObservationText(asset, snapshot) {
  if (!asset || !snapshot) return 'The paired market snapshot is unavailable. The symbolic note remains unchanged; market comparison is delayed.';
  return `At ${snapshot.source.readAt}, ${asset.displayName} was indexed at ${money(asset.priceUsd)}, with ${percent(asset.change24hPct)} over 24 hours, ${money(asset.marketCapUsd)} market cap, ${money(asset.fdvUsd)} FDV, ${money(asset.liquidityUsd)} indexed liquidity, ${money(asset.volume24hUsd)} 24-hour volume, and ${asset.indexedPoolCount ?? 'unavailable'} indexed pool${asset.indexedPoolCount === 1 ? '' : 's'}. Market cap and FDV are kept separate. These descriptive fields did not alter the sky score.`;
}

function marketContext(asset, snapshot) {
  if (!asset || !snapshot) return { available: false, snapshotId: null, observedAt: null };
  return {
    available: true,
    snapshotId: marketSnapshotId(snapshot),
    observedAt: snapshot.source.readAt,
    provider: snapshot.source.provider,
    sign: asset.sign,
    priceUsd: asset.priceUsd ?? null,
    change24hPct: asset.change24hPct ?? null,
    marketCapUsd: asset.marketCapUsd ?? null,
    fdvUsd: asset.fdvUsd ?? null,
    liquidityUsd: asset.liquidityUsd ?? null,
    volume24hUsd: asset.volume24hUsd ?? null,
    indexedPoolCount: asset.indexedPoolCount ?? null,
    deepestPoolUrl: asset.deepestPool?.url ?? null,
  };
}

function dailyBrief({ daily, outlook, marketSnapshot }) {
  const entry = strongestEntry(outlook.daily);
  const factor = entry.primaryFactor;
  const asset = marketAsset(marketSnapshot, entry.sign);
  const skyFact = factor
    ? `${factor.label} is the highest-weighted named factor for ${entry.displayName} in the ${daily.date} UTC edition. The disclosed score is attention ${entry.scores.attention}/100, tone ${entry.scores.tone}, and symbolic event intensity ${entry.scores.volatility}/100.`
    : `${entry.displayName} has the highest disclosed attention rank in the ${daily.date} UTC edition. No exact event is named as its primary factor.`;
  const summary = factor
    ? `${factor.label} leads the disclosed symbolic index; ${entry.displayName} market measures are recorded separately.`
    : `${entry.displayName} leads the disclosed symbolic index; market measures are recorded separately.`;
  return finalizeItem({
    id: `zrx-daily-market-brief-${daily.date}`,
    slug: `daily-market-brief-${daily.date}`,
    kind: 'daily-market-brief',
    templateId: 'daily-market-brief.v1',
    issuedAt: daily.snapshotAt,
    visibleAt: daily.snapshotAt,
    title: factor ? `${factor.label} · daily market brief` : `${entry.displayName} · daily market brief`,
    summary,
    url: `/terminal/research/daily-market-brief-${daily.date}/`,
    signs: factor?.signs?.length ? factor.signs : [entry.sign],
    topics: ['markets', 'daily-sky', factor?.kind ?? 'occupancy'],
    symbolicScore: {
      sign: entry.sign,
      attention: entry.scores.attention,
      tone: entry.scores.tone,
      eventIntensity: entry.scores.volatility,
      calculation: factor?.calculation ?? 'Published Registry Outlook rank; no exact primary factor.',
      marketFieldsUsed: false,
    },
    sections: noteSections({
      skyFact,
      traditionalReading: `${entry.summary} This is a traditional symbolic reading, not a price direction or probability.`,
      marketObservation: marketObservationText(asset, marketSnapshot),
      skyEvidence: [factor?.source, 'public/assets/registry-outlook.json'].filter(Boolean),
      marketEvidence: marketSnapshot ? ['public/assets/data/registry-market-history.v1.json'] : [],
    }),
    market: marketContext(asset, marketSnapshot),
    evidence: {
      dailyFacts: `src/data/daily.json#${daily.date}`,
      outlookEdition: `public/assets/registry-outlook.json#daily:${daily.date}`,
      marketSnapshotId: marketSnapshotId(marketSnapshot),
      coverage: outlook.daily.coverage,
    },
  });
}

function eventBrief({ event, outlook, createdAt }) {
  const factor = factorForEvent(outlook, event);
  const primarySign = event.signs[0];
  const instantSlug = stableInstantSlug(event.at);
  const eventSlug = `${event.kind}-${instantSlug}-${eventKey(event, event.kind).toLowerCase()}`;
  const groupedFacts = event.groupKind === 'minor-aspects'
    ? event.events.map((entry) => `${entry.label} at ${entry.at}`).join('; ')
    : null;
  const score = factor ? {
    sign: primarySign,
    attention: factor.attentionPoints,
    tone: factor.tonePoints,
    eventIntensity: factor.volatilityPoints,
    calculation: factor.calculation,
    marketFieldsUsed: false,
  } : null;
  return finalizeItem({
    id: `zrx-event-brief-${eventSlug}`,
    slug: `event-brief-${eventSlug}`,
    kind: 'event-brief',
    templateId: 'event-brief.v1',
    issuedAt: createdAt,
    visibleAt: event.at,
    eventAt: event.at,
    title: `${event.label} · event brief`,
    summary: groupedFacts
      ? `${event.label} are grouped into one calendar brief to avoid feed noise. Symbolic reading and market observations remain separate.`
      : `${event.label} becomes exact at ${event.at}. Its symbolic reading and later market observations remain separate.`,
    url: `/terminal/research/event-brief-${eventSlug}/`,
    signs: event.signs,
    topics: ['calendar', 'astrology', event.kind],
    symbolicScore: score,
    sections: noteSections({
      skyFact: groupedFacts
        ? `${groupedFacts}. The events are grouped because they share one UTC calendar day.`
        : `${event.label} is exact at ${event.at}, according to the committed transit catalog.`,
      traditionalReading: factor
        ? `${factor.explanation} The score calculation is ${factor.calculation}.`
        : 'The event is listed as calendar context. No directional market claim is attached to it.',
      marketObservation: 'No market outcome is attached to this precomputed event brief. A separately timestamped follow-up may be appended after an eligible archive observation.',
      skyEvidence: [event.source],
    }),
    market: { available: false, snapshotId: null, observedAt: null },
    evidence: {
      transitSource: event.source,
      eventKey: `${event.kind}:${event.at}:${eventKey(event, event.kind)}`,
      groupedEvents: event.events ?? null,
      outlookEdition: `public/assets/registry-outlook.json#weekly:${outlook.weekly.date}`,
      marketSnapshotId: null,
      coverage: outlook.weekly.coverage,
    },
  });
}

function marketCheck({ daily, outlook, marketSnapshot }) {
  const entry = strongestEntry(outlook.daily);
  const asset = marketAsset(marketSnapshot, entry.sign);
  const assets = marketSnapshot?.assets ?? [];
  const marketCapMedian = median(assets.map((item) => item.marketCapUsd));
  const liquidityMedian = median(assets.map((item) => item.liquidityUsd));
  const market = marketContext(asset, marketSnapshot);
  if (market.available) {
    market.collectionMedian = { marketCapUsd: marketCapMedian, liquidityUsd: liquidityMedian };
    market.vsCollectionMedian = {
      marketCap: marketCapMedian && Number.isFinite(asset.marketCapUsd) ? round(asset.marketCapUsd / marketCapMedian, 3) : null,
      liquidity: liquidityMedian && Number.isFinite(asset.liquidityUsd) ? round(asset.liquidityUsd / liquidityMedian, 3) : null,
    };
  }
  const medianComparison = market.available
    ? ` ${entry.displayName} market cap was ${market.vsCollectionMedian.marketCap ?? 'unavailable'}× the collection median and indexed liquidity was ${market.vsCollectionMedian.liquidity ?? 'unavailable'}× the collection median.`
    : '';
  return finalizeItem({
    id: `zrx-market-check-${daily.date}`,
    slug: `market-check-${daily.date}`,
    kind: 'market-check',
    templateId: 'market-check.v1',
    issuedAt: marketSnapshot?.source?.readAt ?? daily.snapshotAt,
    visibleAt: marketSnapshot?.source?.readAt ?? daily.snapshotAt,
    title: `${entry.displayName} market check · ${daily.date}`,
    summary: market.available
      ? `${entry.displayName} price, market cap, liquidity, volume, and collection medians at one archived observation.`
      : `${entry.displayName} market comparison is delayed because the paired archive snapshot is unavailable.`,
    url: `/terminal/research/market-check-${daily.date}/`,
    signs: [entry.sign],
    topics: ['markets', 'market-check'],
    symbolicScore: {
      sign: entry.sign,
      attention: entry.scores.attention,
      tone: entry.scores.tone,
      eventIntensity: entry.scores.volatility,
      calculation: entry.primaryFactor?.calculation ?? 'Published Registry Outlook rank; no exact primary factor.',
      marketFieldsUsed: false,
    },
    sections: noteSections({
      skyFact: `${entry.displayName} is the highest-ranked attention entry in the separately published ${daily.date} daily outlook.`,
      traditionalReading: `${entry.summary} The symbolic score was fixed before this market comparison.`,
      marketObservation: `${marketObservationText(asset, marketSnapshot)}${medianComparison}`,
      skyEvidence: ['public/assets/registry-outlook.json'],
      marketEvidence: marketSnapshot ? ['public/assets/data/registry-market-history.v1.json'] : [],
    }),
    market,
    evidence: {
      outlookEdition: `public/assets/registry-outlook.json#daily:${daily.date}`,
      marketSnapshotId: marketSnapshotId(marketSnapshot),
      coverage: outlook.daily.coverage,
    },
  });
}

function weeklyOutlook({ daily, outlook, marketSnapshot }) {
  const weekday = new Date(`${daily.date}T00:00:00.000Z`).getUTCDay();
  if (weekday !== 1) return null;
  const ranked = [...outlook.weekly.signs]
    .sort((left, right) => left.attentionRank - right.attentionRank)
    .slice(0, 3);
  const lead = ranked[0];
  const asset = marketAsset(marketSnapshot, lead.sign);
  const names = ranked.map((entry) => entry.displayName).join(', ');
  return finalizeItem({
    id: `zrx-weekly-outlook-${daily.date}`,
    slug: `weekly-outlook-${daily.date}`,
    kind: 'weekly-outlook',
    templateId: 'weekly-outlook.v1',
    issuedAt: daily.snapshotAt,
    visibleAt: daily.snapshotAt,
    title: `Weekly symbolic outlook · ${daily.date}`,
    summary: `${names} hold the three highest disclosed attention ranks for the next seven UTC days.`,
    url: `/terminal/research/weekly-outlook-${daily.date}/`,
    signs: ranked.map((entry) => entry.sign),
    topics: ['markets', 'weekly-outlook', 'astrology'],
    symbolicScore: {
      sign: lead.sign,
      attention: lead.scores.attention,
      tone: lead.scores.tone,
      eventIntensity: lead.scores.volatility,
      calculation: lead.primaryFactor?.calculation ?? 'Published seven-day Registry Outlook rank; no exact primary factor.',
      marketFieldsUsed: false,
    },
    sections: noteSections({
      skyFact: `${names} are ranked first through third by disclosed symbolic attention in the seven-day edition beginning ${daily.date}.`,
      traditionalReading: `${lead.summary} This reading supplies cultural context, not a forecast of price or liquidity.`,
      marketObservation: marketObservationText(asset, marketSnapshot),
      skyEvidence: ['public/assets/registry-outlook.json'],
      marketEvidence: marketSnapshot ? ['public/assets/data/registry-market-history.v1.json'] : [],
    }),
    market: marketContext(asset, marketSnapshot),
    evidence: {
      outlookEdition: `public/assets/registry-outlook.json#weekly:${daily.date}`,
      marketSnapshotId: marketSnapshotId(marketSnapshot),
      coverage: outlook.weekly.coverage,
    },
  });
}

function monthlyCalibration({ daily, existingItems, marketHistory }) {
  if (!daily.date.endsWith('-01')) return null;
  const monthStart = new Date(`${daily.date}T00:00:00.000Z`);
  const priorStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));
  const priorEnd = monthStart;
  const inPriorMonth = (instant) => {
    const value = new Date(instant).getTime();
    return value >= priorStart.getTime() && value < priorEnd.getTime();
  };
  const checks = existingItems.filter((item) => item.kind === 'market-check' && inPriorMonth(item.issuedAt));
  const observations = existingItems.filter((item) => item.kind === 'observation-update' && inPriorMonth(item.issuedAt));
  const snapshots = marketHistory.snapshots.filter((snapshot) => inPriorMonth(snapshot.source.readAt));
  const previousMonth = priorStart.toISOString().slice(0, 7);
  return finalizeItem({
    id: `zrx-monthly-calibration-${previousMonth}`,
    slug: `monthly-calibration-${previousMonth}`,
    kind: 'monthly-calibration',
    templateId: 'monthly-calibration.v1',
    issuedAt: daily.snapshotAt,
    visibleAt: daily.snapshotAt,
    title: `Research calibration · ${previousMonth}`,
    summary: `${checks.length} market checks, ${observations.length} elapsed observation updates, and ${snapshots.length} archived market snapshots are reported without a predictive claim.`,
    url: `/terminal/research/monthly-calibration-${previousMonth}/`,
    signs: [],
    topics: ['methodology', 'calibration', 'markets'],
    symbolicScore: null,
    sections: noteSections({
      skyFact: `The ${previousMonth} ledger contains ${checks.length} pre-comparison market checks generated by deterministic templates.`,
      traditionalReading: 'No traditional interpretation is rescored in this calibration report. Historical sky scores remain immutable.',
      marketObservation: `${observations.length} elapsed follow-ups and ${snapshots.length} daily market snapshots were available. Counts describe coverage; they do not establish predictive accuracy or causation.`,
      skyEvidence: ['src/data/registry-research/drafts.json'],
      marketEvidence: ['public/assets/data/registry-market-history.v1.json'],
    }),
    market: { available: snapshots.length > 0, snapshotId: null, observedAt: snapshots.at(-1)?.source?.readAt ?? null },
    evidence: {
      period: previousMonth,
      marketCheckCount: checks.length,
      observationUpdateCount: observations.length,
      marketSnapshotCount: snapshots.length,
      marketSnapshotId: snapshots.length ? marketSnapshotId(snapshots.at(-1)) : null,
      coverage: snapshots.length ? 'observed-days-only' : 'unavailable',
    },
  });
}

function firstQualifyingSnapshot(marketHistory, baseInstant, elapsedHours) {
  const threshold = new Date(baseInstant).getTime() + (elapsedHours * 3_600_000);
  return marketHistory.snapshots.find((snapshot) => new Date(snapshot.source.readAt).getTime() >= threshold) ?? null;
}

function observationUpdate(base, snapshot, elapsedHours) {
  if (!base.market?.available || !base.market.observedAt || !base.market.sign) return null;
  const observed = marketAsset(snapshot, base.market.sign);
  if (!observed) return null;
  const baseMs = new Date(base.market.observedAt).getTime();
  const observedMs = new Date(snapshot.source.readAt).getTime();
  const actualHours = round((observedMs - baseMs) / 3_600_000, 2);
  const priceChange = Number.isFinite(base.market.priceUsd) && Number.isFinite(observed.priceUsd) && base.market.priceUsd !== 0
    ? round(((observed.priceUsd / base.market.priceUsd) - 1) * 100, 2)
    : null;
  const liquidityChange = Number.isFinite(base.market.liquidityUsd) && Number.isFinite(observed.liquidityUsd) && base.market.liquidityUsd !== 0
    ? round(((observed.liquidityUsd / base.market.liquidityUsd) - 1) * 100, 2)
    : null;
  const label = elapsedHours === 24 ? '24-hour' : '7-day';
  return finalizeItem({
    id: `${base.id}-observation-${elapsedHours}h`,
    slug: `${base.slug}-observation-${elapsedHours}h`,
    kind: 'observation-update',
    templateId: 'observation-update.v1',
    parentId: base.id,
    issuedAt: snapshot.source.readAt,
    visibleAt: snapshot.source.readAt,
    title: `${SIGN_NAMES[base.market.sign]} ${label} observation update`,
    summary: `${label} follow-up using the first qualifying archived snapshot (${actualHours} actual hours elapsed).`,
    url: `/terminal/research/${base.slug}-observation-${elapsedHours}h/`,
    signs: [base.market.sign],
    topics: ['markets', 'observation-update'],
    symbolicScore: base.symbolicScore,
    sections: noteSections({
      skyFact: `The original ${base.id} sky score and traditional reading remain unchanged.`,
      traditionalReading: 'This follow-up does not reinterpret the sky after observing the market.',
      marketObservation: `${actualHours} hours after the original market observation, indexed price change was ${percent(priceChange)} and indexed liquidity change was ${percent(liquidityChange)}. This temporal comparison does not establish causation.`,
      skyEvidence: [`/assets/data/registry-research/items/${base.id}.json`],
      marketEvidence: ['public/assets/data/registry-market-history.v1.json'],
    }),
    market: {
      ...marketContext(observed, snapshot),
      baselineSnapshotId: base.market.snapshotId,
      baselineObservedAt: base.market.observedAt,
      requestedElapsedHours: elapsedHours,
      actualElapsedHours: actualHours,
      priceChangePct: priceChange,
      liquidityChangePct: liquidityChange,
    },
    evidence: {
      parentId: base.id,
      baselineSnapshotId: base.market.snapshotId,
      marketSnapshotId: marketSnapshotId(snapshot),
      coverage: 'first-qualifying-archive-observation',
    },
    revisions: [{ kind: 'append-only-follow-up', parentId: base.id }],
  });
}

function generatedItems({ daily, outlook, transitMonths, marketHistory, existingItems }) {
  assertDate(daily?.date, 'daily.date');
  assertCanonicalInstant(daily?.snapshotAt, 'daily.snapshotAt');
  if (daily.snapshotAt.slice(0, 10) !== daily.date) throw new Error('daily.snapshotAt must match daily.date');
  if (!isRecord(outlook) || outlook.daily?.date !== daily.date || outlook.weekly?.date !== daily.date) {
    throw new Error('outlook daily and weekly editions must match daily.date');
  }
  validateMarketHistory(marketHistory);
  const pairedSnapshot = snapshotByDate(marketHistory, daily.date);
  const start = `${daily.date}T00:00:00.000Z`;
  const end = new Date(new Date(start).getTime() + (8 * DAY_MS)).toISOString();
  const events = normalizedEvents(transitMonths, start, end);
  const items = [
    dailyBrief({ daily, outlook, marketSnapshot: pairedSnapshot }),
    marketCheck({ daily, outlook, marketSnapshot: pairedSnapshot }),
    weeklyOutlook({ daily, outlook, marketSnapshot: pairedSnapshot }),
    monthlyCalibration({ daily, existingItems, marketHistory }),
    ...events.map((event) => eventBrief({ event, outlook, createdAt: daily.snapshotAt })),
  ].filter(Boolean);

  for (const base of existingItems.filter((item) => item.kind === 'market-check')) {
    for (const elapsedHours of [24, 168]) {
      const snapshot = firstQualifyingSnapshot(marketHistory, base.market?.observedAt, elapsedHours);
      if (snapshot) items.push(observationUpdate(base, snapshot, elapsedHours));
    }
  }
  return items.filter(Boolean);
}

function approvalByItem(manifest) {
  validateRegistryResearchApprovalManifest(manifest);
  return new Map(manifest.approvals.map((approval) => [approval.itemId, approval]));
}

export function buildRegistryResearchLedger({
  daily,
  outlook,
  transitMonths,
  marketHistory,
  existingLedger = null,
  approvalManifest,
  pause = null,
}) {
  const existingItems = existingLedger?.items ?? [];
  if (existingLedger && existingLedger.schema !== REGISTRY_RESEARCH_LEDGER_SCHEMA) {
    throw new Error(`existingLedger must use ${REGISTRY_RESEARCH_LEDGER_SCHEMA}`);
  }
  existingItems.forEach((item) => validateRegistryResearchItem(item));
  if (registryResearchIsPaused(pause)) {
    // Paused: the committed ledger stands as it is. No draft is generated,
    // regenerated or dropped, and today's sky and market inputs are not read,
    // so nothing new can reach a feed and no pairing with today is required.
    if (!existingLedger) throw new Error('Registry Research is paused and there is no committed ledger to keep');
    validateRegistryResearchApprovalManifest(approvalManifest);
    return existingLedger;
  }
  const approvals = approvalByItem(approvalManifest);
  const generationWindowStart = `${daily.date}T00:00:00.000Z`;
  // A published item is frozen. During the pilot that means an exact-hash
  // approval; after it, any item the deterministic allowlist publishes on
  // sight. Its immutable copy is already on disk, so a later observation the
  // same day (a backstop snapshot, a re-run) refreshes the archive, the
  // outlook, and the ledger's generatedAt, but never regenerates the item.
  const frozen = (item) => approvals.get(item.id)?.artifactSha256 === item.artifactHash
    || eligibleForAutomaticPublication(item, approvalManifest);
  const retainedItems = existingItems.filter((item) => {
    const regeneratingFutureEvent = item.kind === 'event-brief' && item.visibleAt >= generationWindowStart;
    return frozen(item) || !regeneratingFutureEvent;
  });
  const byId = new Map(retainedItems.map((item) => [item.id, item]));
  const frozenEvents = retainedItems.filter(frozen).map(eventIdentity).filter(Boolean);
  for (const candidate of generatedItems({ daily, outlook, transitMonths, marketHistory, existingItems })) {
    const existing = byId.get(candidate.id);
    if (existing && frozen(existing)) continue;
    if (!existing && sameFrozenEvent(candidate, frozenEvents)) continue;
    byId.set(candidate.id, candidate);
  }
  const items = [...byId.values()].sort((left, right) => left.visibleAt.localeCompare(right.visibleAt) || left.id.localeCompare(right.id));
  return {
    schema: REGISTRY_RESEARCH_LEDGER_SCHEMA,
    generatedAt: latestSnapshot(marketHistory)?.source?.readAt ?? daily.snapshotAt,
    generator: REGISTRY_RESEARCH_GENERATOR,
    method: REGISTRY_RESEARCH_METHOD,
    items,
  };
}

// An event brief is named by the instant the transit catalog gives its event.
// When the catalog is recomputed, as engine 0.1.1-rc.8's observed ΔT moved
// every event about 6 s, the same event returns under a new instant and so a
// new id. A frozen brief for it already stands and cannot be rewritten; a
// second one would repeat it. The same event is the same kind and subject
// within an hour of the frozen instant.
const SAME_EVENT_WINDOW_MS = 3_600_000;
const EVENT_KEY = /^([a-z-]+):(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z):(.+)$/;

function eventIdentity(item) {
  if (item?.kind !== 'event-brief') return null;
  const match = EVENT_KEY.exec(item.evidence?.eventKey ?? '');
  if (!match) return null;
  return { kind: match[1], at: Date.parse(match[2]), subject: match[3] };
}

function sameFrozenEvent(candidate, frozenEvents) {
  const identity = eventIdentity(candidate);
  if (!identity) return false;
  return frozenEvents.some((event) => event.kind === identity.kind
    && event.subject === identity.subject
    && Math.abs(event.at - identity.at) <= SAME_EVENT_WINDOW_MS);
}

function withinPilot(item, manifest) {
  const date = item.issuedAt.slice(0, 10);
  return date >= manifest.pilot.startsOn && date <= manifest.pilot.endsOn;
}

function eligibleForAutomaticPublication(item, manifest) {
  if (withinPilot(item, manifest)) return false;
  return manifest.postPilot.mode === 'deterministic-allowlist'
    && manifest.postPilot.automaticTemplateIds.includes(item.templateId)
    && item.method.deterministicTemplatesOnly === true
    && item.method.modelAuthoredProse === false;
}

function publicItem(item, publication, asOf) {
  const status = item.visibleAt > asOf ? 'scheduled' : 'published';
  return {
    ...item,
    status,
    publishedAt: publication.publishedAt,
    publication,
  };
}

export function immutableRegistryResearchItem(item) {
  const { status: _status, ...immutable } = item;
  return { ...immutable, status: 'approved' };
}

export function compactRegistryResearchItem(item) {
  return {
    id: item.id,
    slug: item.slug,
    kind: item.kind,
    sourceType: item.sourceType,
    publisher: item.publisher,
    publishedAt: item.publishedAt,
    visibleAt: item.visibleAt,
    title: item.title,
    summary: item.summary,
    url: item.url,
    signs: item.signs,
    topics: item.topics,
    status: item.status,
  };
}

// While paused, an approval recorded after the pause publishes nothing and
// cannot move the publication clock, so a scheduled item is not revealed.
function approvalsInForce(approvalManifest, pause) {
  validateRegistryResearchApprovalManifest(approvalManifest);
  if (!registryResearchIsPaused(pause)) return approvalManifest;
  return {
    ...approvalManifest,
    approvals: approvalManifest.approvals.filter((approval) => approval.reviewedAt <= pause.pausedAt),
  };
}

export function publishRegistryResearch({ ledger, approvalManifest: manifest, pause = null }) {
  if (ledger?.schema !== REGISTRY_RESEARCH_LEDGER_SCHEMA) throw new Error(`ledger must use ${REGISTRY_RESEARCH_LEDGER_SCHEMA}`);
  assertCanonicalInstant(ledger.generatedAt, 'ledger.generatedAt');
  const approvalManifest = approvalsInForce(manifest, pause);
  const approvals = approvalByItem(approvalManifest);
  const publicationGeneratedAt = [...approvals.values()].reduce(
    (latest, approval) => approval.reviewedAt > latest ? approval.reviewedAt : latest,
    ledger.generatedAt,
  );
  const published = [];
  for (const item of ledger.items) {
    validateRegistryResearchItem(item);
    const approval = approvals.get(item.id);
    if (approval && approval.artifactSha256 !== item.artifactHash) {
      throw new Error(`Approval hash for ${item.id} does not match the current immutable draft`);
    }
    if (approval) {
      published.push(publicItem(item, {
        mode: 'human-approved-pilot',
        publishedAt: approval.reviewedAt,
        reviewer: approval.reviewer,
        artifactSha256: item.artifactHash,
      }, publicationGeneratedAt));
      continue;
    }
    if (eligibleForAutomaticPublication(item, approvalManifest)) {
      published.push(publicItem(item, {
        mode: 'post-pilot-deterministic-allowlist',
        publishedAt: item.issuedAt,
        reviewer: null,
        artifactSha256: item.artifactHash,
      }, publicationGeneratedAt));
    }
  }
  const publicationDayStart = new Date(`${publicationGeneratedAt.slice(0, 10)}T00:00:00.000Z`);
  const windowStart = new Date(publicationDayStart.getTime() - (30 * DAY_MS)).toISOString();
  const windowEnd = new Date(publicationDayStart.getTime() + (8 * DAY_MS)).toISOString();
  const rolling = published
    .filter((item) => item.visibleAt >= windowStart && item.visibleAt < windowEnd)
    .sort((left, right) => right.visibleAt.localeCompare(left.visibleAt) || left.id.localeCompare(right.id));
  const publication = {
    schema: REGISTRY_RESEARCH_PUBLICATION_SCHEMA,
    generatedAt: publicationGeneratedAt,
    publisher: REGISTRY_RESEARCH_PUBLISHER,
    method: REGISTRY_RESEARCH_METHOD,
    window: { previousDays: 30, futureDays: 7, startsAt: windowStart, endsBefore: windowEnd },
    rollingItemIds: rolling.map((item) => item.id),
    items: published.sort((left, right) => right.visibleAt.localeCompare(left.visibleAt) || left.id.localeCompare(right.id)),
  };
  const feed = {
    schema: REGISTRY_RESEARCH_FEED_SCHEMA,
    generatedAt: publicationGeneratedAt,
    publisher: REGISTRY_RESEARCH_PUBLISHER,
    window: publication.window,
    items: rolling.map(compactRegistryResearchItem),
  };
  return { publication, feed };
}

export function validateRegistryResearchApprovalManifest(manifest) {
  if (!isRecord(manifest) || manifest.schema !== REGISTRY_RESEARCH_APPROVAL_SCHEMA) {
    throw new Error(`approval manifest must use ${REGISTRY_RESEARCH_APPROVAL_SCHEMA}`);
  }
  assertDate(manifest.pilot?.startsOn, 'approvalManifest.pilot.startsOn');
  assertDate(manifest.pilot?.endsOn, 'approvalManifest.pilot.endsOn');
  if (manifest.pilot.endsOn < manifest.pilot.startsOn) throw new Error('approval pilot end must not precede its start');
  if (manifest.pilot.mode !== 'human-approval-required') throw new Error('approval pilot mode must be human-approval-required');
  if (manifest.postPilot?.mode !== 'deterministic-allowlist' || !Array.isArray(manifest.postPilot.automaticTemplateIds)) {
    throw new Error('postPilot must provide a deterministic template allowlist');
  }
  if (!Array.isArray(manifest.approvals)) throw new Error('approvalManifest.approvals must be an array');
  const seen = new Set();
  for (const [index, approval] of manifest.approvals.entries()) {
    if (!/^zrx-[a-z0-9-]+$/u.test(approval?.itemId ?? '')) throw new Error(`approvals[${index}].itemId is invalid`);
    if (seen.has(approval.itemId)) throw new Error(`Duplicate approval for ${approval.itemId}`);
    seen.add(approval.itemId);
    if (!/^[a-f0-9]{64}$/u.test(approval.artifactSha256 ?? '')) throw new Error(`approvals[${index}].artifactSha256 must be sha256 hex`);
    if (typeof approval.reviewer !== 'string' || approval.reviewer.trim().length < 2) throw new Error(`approvals[${index}].reviewer is required`);
    assertCanonicalInstant(approval.reviewedAt, `approvals[${index}].reviewedAt`);
  }
}

function allItemText(item) {
  return canonicalRegistryResearchJson({
    title: item.title,
    summary: item.summary,
    sections: item.sections,
    riskStatement: item.riskStatement,
    scienceNote: item.scienceNote,
  });
}

export function validateRegistryResearchItem(item, { requireHash = true } = {}) {
  if (!isRecord(item) || item.schema !== REGISTRY_RESEARCH_ITEM_SCHEMA) throw new Error(`research item must use ${REGISTRY_RESEARCH_ITEM_SCHEMA}`);
  if (!/^zrx-[a-z0-9-]+$/u.test(item.id ?? '')) throw new Error('research item id is invalid');
  if (!/^[a-z0-9-]+$/u.test(item.slug ?? '')) throw new Error(`${item.id}.slug is invalid`);
  if (item.url !== `/terminal/research/${item.slug}/`) throw new Error(`${item.id}.url must be canonical`);
  if (!['daily-market-brief', 'event-brief', 'market-check', 'observation-update', 'weekly-outlook', 'monthly-calibration'].includes(item.kind)) {
    throw new Error(`${item.id}.kind is unsupported`);
  }
  if (item.sourceType !== 'zodiacs-research' || item.publisher !== REGISTRY_RESEARCH_PUBLISHER) throw new Error(`${item.id} has an invalid publisher`);
  assertCanonicalInstant(item.issuedAt, `${item.id}.issuedAt`);
  assertCanonicalInstant(item.visibleAt, `${item.id}.visibleAt`);
  if (!Array.isArray(item.signs)) throw new Error(`${item.id}.signs must be an array`);
  item.signs.forEach((sign) => assertSign(sign, item.id));
  if (!Array.isArray(item.topics) || !item.topics.length) throw new Error(`${item.id}.topics must be non-empty`);
  if (item.riskStatement !== REGISTRY_RESEARCH_RISK || item.scienceNote !== REGISTRY_RESEARCH_SCIENCE_NOTE) {
    throw new Error(`${item.id} must carry the standard risk and science statements`);
  }
  if (!isRecord(item.sections?.skyFact) || !isRecord(item.sections?.traditionalReading) || !isRecord(item.sections?.marketObservation)) {
    throw new Error(`${item.id} must separate Sky fact, Traditional reading, and Market observation`);
  }
  if (item.symbolicScore !== null && item.symbolicScore?.marketFieldsUsed !== false) {
    throw new Error(`${item.id} symbolic score must explicitly exclude market fields`);
  }
  for (const pattern of FORBIDDEN_DIRECTIONAL_CLAIMS) {
    if (pattern.test(allItemText(item))) throw new Error(`${item.id} contains prohibited directional or causal language`);
  }
  if (requireHash) {
    if (!/^[a-f0-9]{64}$/u.test(item.artifactHash ?? '')) throw new Error(`${item.id}.artifactHash must be sha256 hex`);
    if (calculateRegistryResearchItemHash(item) !== item.artifactHash) throw new Error(`${item.id}.artifactHash does not match its content`);
  }
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export const REGISTRY_RESEARCH_FEED_DESCRIPTION = 'Deterministic symbolic research and separately timestamped Zodiac market observations.';

export function registryResearchRss(feed, { pause = null } = {}) {
  if (feed?.schema !== REGISTRY_RESEARCH_FEED_SCHEMA) throw new Error(`feed must use ${REGISTRY_RESEARCH_FEED_SCHEMA}`);
  const pauseNotice = registryResearchPauseNotice(pause);
  const description = pauseNotice ? `${pauseNotice} ${REGISTRY_RESEARCH_FEED_DESCRIPTION}` : REGISTRY_RESEARCH_FEED_DESCRIPTION;
  const visibleItems = feed.items.filter((item) => item.status === 'published' && item.visibleAt <= feed.generatedAt);
  const items = visibleItems.map((item) => `    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${SITE}${xmlEscape(item.url)}</link>
      <guid isPermaLink="false">${SITE}/feeds/market-research/${xmlEscape(item.id)}</guid>
      <pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>
      <description>${xmlEscape(`${item.summary} ${REGISTRY_RESEARCH_RISK}`)}</description>
      <category>${xmlEscape(item.kind)}</category>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Zodiacs.org Markets Research</title>
    <link>${SITE}/terminal/research/</link>
    <atom:link href="${SITE}/feeds/market-research.xml" rel="self" type="application/rss+xml" />
    <description>${xmlEscape(description)}</description>
    <language>en</language>
    <lastBuildDate>${new Date(feed.generatedAt).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}
