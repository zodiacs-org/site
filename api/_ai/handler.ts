// The underscore directory adds no Vercel function. /mcp rewrites through compatibility.
import { waitUntil } from '@vercel/functions';
import { createAiNodeHandler } from './runtime.mjs';

// The daily publication commits the horoscope window; it is read when a horoscope is asked for, so the bundle stays the same every day.
const horoscopeWindow = async () => (await import('../../src/data/horoscope-window.json', { with: { type: 'json' } })).default;

// The account consent page is read only when it is asked for, which happens only while ZODIACS_ACCOUNTS_ENABLED=1.
const consentPage = async () => import('../../integrations/generated/accounts-consent.mjs');

// waitUntil lets the anonymous daily usage count, started after each reply has ended, finish in the same invocation.
export default createAiNodeHandler({ dependencies: { horoscopeWindow }, waitUntil, consentPage });
