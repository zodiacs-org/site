/** UTC instants in candles are Unix seconds at the start of the bucket. */
export type Interval = '1h' | '1d';
export type InstrumentId = 'BTC-USD' | 'ETH-USD';
export type EventFamily = 'lunation' | 'eclipse' | 'station' | 'retrograde' | 'ingress' | 'aspect';

export interface Instrument {
  id: InstrumentId;
  name: string;
  base: 'BTC' | 'ETH';
  quote: 'USD';
  venue: 'Coinbase Exchange';
  sourceUrl: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
}

export interface MarketDataset {
  schema: 1;
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
  id: string;
  family: EventFamily;
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
}

export interface IndicatorPoint { time: number; value: number }
export interface Indicators {
  sma20: IndicatorPoint[];
  sma50: IndicatorPoint[];
  ema20: IndicatorPoint[];
  rsi14: IndicatorPoint[];
}
