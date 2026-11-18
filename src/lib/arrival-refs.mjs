/**
 * The `?ref=` words a link the site gives out may carry, and the only ones it
 * reads: Base.astro counts where a visit came from by them
 * (src/lib/arrival-source.ts), and every share page, preview image and story
 * picture accepts them (src/lib/share-results.ts). `direct`, the default for
 * a visit with none, is not a word any link carries. Re-exported by
 * src/lib/analytics-config.mjs.
 */
export const ARRIVAL_REF_VALUES = Object.freeze([
  'video', 'chatgpt', 'assistant', 'card', 'app', 'note',
]);
