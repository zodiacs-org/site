import { createModuleLoader } from '../module-load';

export type EngineModule = Pick<typeof import('../engine/full'), 'bodyLongitude' | 'longitudeSpeed' | 'computeBodies' | 'computeChart'>;
export type EngineLoader = () => Promise<EngineModule>;

export function createEngineLoader(importEngine: EngineLoader): EngineLoader {
  return createModuleLoader(importEngine);
}

/** Load the full ephemeris once, on demand, across every hydrated island. */
export const loadEngine = createEngineLoader(async () => {
  const {bodyLongitude, longitudeSpeed, computeBodies, computeChart} = await import('../engine/full');
  return Object.freeze({bodyLongitude, longitudeSpeed, computeBodies, computeChart});
});

/** Stable lazy engine loader for island event handlers and warm-up effects. */
export function useEngine(): EngineLoader {
  return loadEngine;
}
