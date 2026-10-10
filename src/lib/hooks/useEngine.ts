import { createModuleLoader } from '../module-load';

export type EngineModule = typeof import('../engine/full');
export type EngineLoader = () => Promise<EngineModule>;

export function createEngineLoader(importEngine: EngineLoader): EngineLoader {
  return createModuleLoader(importEngine);
}

/** Load the full ephemeris once, on demand, across every hydrated island. */
export const loadEngine = createEngineLoader(() => import('../engine/full'));

/** Stable lazy engine loader for island event handlers and warm-up effects. */
export function useEngine(): EngineLoader {
  return loadEngine;
}
