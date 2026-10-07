// The underscore directory adds no Vercel function. /mcp rewrites through compatibility.
import { createAiNodeHandler } from './runtime.mjs';

// The daily publication commits the horoscope window; it is read when a horoscope is asked for, so the bundle stays the same every day.
const horoscopeWindow = async () => (await import('../../src/data/horoscope-window.json', { with: { type: 'json' } })).default;

export default createAiNodeHandler({ dependencies: { horoscopeWindow } });
