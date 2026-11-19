export type Comparison = { total: number; within: number; largest: number };
type Angles = { lon: number; lat: number };
type Instant = { date: string; label: string; jdTt?: number };
type Position = Instant & { body: string; engine: Angles; horizons: Angles; difference: Angles };
type Engine = { version: string; ephemerides: { name: string; version: string }[] };

export type Receipt = {
  date: string;
  label: string;
  checkedAt: string;
  auditUrl?: string;
  engine: Engine;
  source: { repository: string; commit: string; horizons: string; ephemeris: string };
  threshold: number;
  checksumAlgorithm: string;
  frames: { suite: string; rolling: string };
  frameDifference: Instant & { arcsec: number };
  nasaCheck: {
    total: number;
    historical: { through: string; tolerance: number; total: number; largest: number };
    later: { after: string; tolerance: number; total: number; largest: number };
  };
  sets: Record<'suite' | 'rolling', Comparison & { positions: Position[] }>;
  bodies: { body: string; suite: Comparison; rolling: Comparison }[];
  raw: { file: string; sha256: string; set: string; body: string; attempt: number; status: number }[];
};

export type ReceiptHistory = {
  date: string;
  label: string;
  checkedAt: string;
  engine: Engine;
  suite: Comparison;
  rolling: Comparison;
};
