/** UTC instants in candles are Unix seconds at the start of the bucket. */
export type Interval = '1h' | '1d';
export type InstrumentId = string;
export type AssetClass = 'crypto' | 'stocks' | 'indices' | 'fx' | 'commodities';
export type EventFamily = 'lunation' | 'eclipse' | 'station' | 'retrograde' | 'ingress' | 'aspect';

export interface Instrument {
  id: InstrumentId;
  name: string;
  base: string;
  quote: string;
  venue: string;
  sourceUrl: string;
  catalogVersion?: string;
  symbol?: string;
  assetClass?: AssetClass;
  kind?: 'spot' | 'stock' | 'etf' | 'reference' | 'future' | 'continuous';
  calendar?: string;
  timeZone?: string;
  tickSize?: number;
  lotSize?: number;
  multiplier?: number;
  proxyFor?: string;
  expiry?: string;
  roll?: string;
  provider?: { id: 'coinbase' | 'twelve-data' | 'databento' | 'none'; symbol: string; exchange?: string; coverage: 'adapter' | 'mapping-pending' | 'unsupported' };
  eligibility?: { asOf: string; source: string; benchmark: string; status: 'candidate' | 'verified'; liquidity: string };
  lifecycle?: 'active' | 'candidate' | 'expired';
  rights?: 'pending-written-grant';
  freshnessSeconds?: number;

}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
  /** Verified session boundaries; never infer these from the next returned row. */
  closeTime?: number;
  nextTime?: number;
  adjustmentBreak?: boolean;
}

export interface MarketDataset {
  schema: 1 | 2;
  sessions?: import('./sessions').TradingSession[];
  adjustment?: 'unadjusted-reset-at-split';
  attribution?: string;
  instrument: Instrument;
  interval: Interval;
  candles: Candle[];
  fetchedAt: string;
  source: string;
  stale: boolean;
  coverage: {
    requestedStart: number;
    requestedEnd: number;
    start: number | null;
    end: number | null;
    gaps: number[];
  };
  warnings: string[];
}

export interface SkyEvent {
  /** Browser-only derived context. Public catalog loaders never supply this. */
  personal?: import('./personal').PersonalContact;
  economic?: import('./economics').EconomicEvent;
  id: string;
  family: EventFamily | 'economic';
  subtype: string;
  title: string;
  at: string;
  end?: string | null;
  bodies: string[];
  aspectType?: string;
  sign?: string;
  linkedIds?: string[];
  interpretation: string;
  provenance: {
    catalog: string;
    sha256: string;
    engineVersion: string;
    convention: string;
  };
}

export interface EventManifest {
  schema: 1;
  generatedAt: string;
  engineVersion: string;
  coverage: { start: string; end: string };
  months: string[];
  supportedFamilies: EventFamily[];
  limitations: string[];
}

export type RuleCondition = 'sma-cross-up' | 'sma-cross-down' | 'price-cross-up' | 'price-cross-down' | 'rsi-cross-up' | 'rsi-cross-down';
export interface WatchRule {
  id: string;
  version: number;
  instrument: InstrumentId;
  interval: Interval;
  condition: RuleCondition;
  threshold?: number;
  family: EventFamily | 'any';
  windowHours: number;
  enabled: boolean;
  createdAt: string;
}

export interface RuleMatch {
  key: string;
  ruleId: string;
  at: string;
  candleTime: number;
  eventId: string;
  condition: string;
}

export interface JournalRevision {
  at: string;
  hypothesis: string;
  plan: string;
  outcome: string;
  setup?: SetupPlan;
}
export interface JournalEntry {
  id: string;
  instrument: InstrumentId;
  createdAt: string;
  updatedAt: string;
  eventIds: string[];
  horizonHours: number;
  method: 'TA only' | 'TA + astrology';
  hypothesis: string;
  plan: string;
  outcome: string;
  revisions: JournalRevision[];
  chartRef?: { id: string; updatedAt: string };
  setup?: SetupPlan;
}

export interface SetupPlan {
  interval: Interval;
  technicalSetup: string;
  confirmation: string;
  invalidation: string;
  risk: { equity: number; riskMode: 'percent' | 'usd' | 'quote'; riskValue: number; entry: number; stop: number; target?: number; feeBps: number; slippageBps: number; instrumentId?: InstrumentId; currency?: string; funding?: 'cash' | 'derivative'; marginPerContract?: number };
  window?: { kind: 'shared' | 'personal' | 'economic'; id: string; sourceId?: string; sourceUpdatedAt?: string; from: string; to: string };
}

export interface IndicatorPoint { time: number; value: number }
export interface Indicators {
  sma20: IndicatorPoint[];
  sma50: IndicatorPoint[];
  ema20: IndicatorPoint[];
  rsi14: IndicatorPoint[];
}
