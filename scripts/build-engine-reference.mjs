import { buildEngineReference } from './engine-reference/build.mjs';
await buildEngineReference({ check: process.argv.includes('--check') });
