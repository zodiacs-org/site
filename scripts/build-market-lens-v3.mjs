import {build} from 'esbuild';
// Standalone private acquisition; no public route or browser import. Engine stays pinned and external.
await build({entryPoints:['scripts/market-lens-v3-acquire.ts'],outfile:'research/market-lens/v3/acquire.mjs',bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',legalComments:'none'});
