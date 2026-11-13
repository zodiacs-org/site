// Declarations for lib.mjs, the resolver copied from the engine repository's
// atlas/tools/lib.mjs: only what src/lib/time-atlas/index.ts uses.
export declare const CLOCKS: readonly ['civil', 'railway'];
export declare const FLAGS: readonly ['documented', 'inferred', 'uncertain'];

export interface AtlasLibReading {
  utc: string;
  utcMs: number;
  offset: string;
  offsetSeconds: number;
  rule: string;
  ruleVersion: number;
  isDst: boolean;
  abbreviation: string | null;
  uncertainty: { flag: 'documented' | 'inferred' | 'uncertain'; reasons: string[] };
  citations: string[];
}

export interface AtlasLibResult {
  place: string | null;
  jurisdiction: string;
  clock: 'civil' | 'railway';
  local: string;
  status: 'ok' | 'ambiguous' | 'nonexistent' | 'out-of-coverage' | 'no-such-clock';
  instants: AtlasLibReading[];
  skipped?: { from: string; to: string };
  reason?: string;
}

export interface LoadedAtlas {
  manifest: unknown;
  citations: Map<string, Record<string, unknown>>;
  places: Map<string, Record<string, unknown>>;
  jurisdictions: Map<string, Record<string, unknown>>;
  rules: Map<string, Record<string, unknown>>;
  problems: string[];
}

export declare function loadAtlas(manifest: { files: string[] }, files: Record<string, unknown>): LoadedAtlas;
export declare function resolve(atlas: LoadedAtlas, spec: string, local: string, clock?: 'civil' | 'railway'): AtlasLibResult;
