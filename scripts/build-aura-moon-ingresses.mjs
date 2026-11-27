/*
 * Builds exact Moon sign ingresses for Registry Collection with the engine's
 * default DE440 source. The client still uses the lightweight Moon only for the visit-time
 * sign; this committed file supplies exact future activation timestamps.
 *
 *   npm run data:aura-moon-ingresses
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyLongitude } from '@zodiacs/engine/internal';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'src/data/aura-moon-ingresses.json');
const SIGN_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const FROM = Date.UTC(2026, 0, 1);
const TO = Date.UTC(2029, 0, 1);
const STEP_MS = 2 * 60 * 60 * 1_000;

const signIndexAt = (date) => Math.floor(bodyLongitude('Moon', date) / 30);

function refineBoundary(lowDate, highDate, previousSign) {
  let low = lowDate.getTime();
  let high = highDate.getTime();
  for (let iteration = 0; iteration < 32 && high - low > 50; iteration += 1) {
    const middle = Math.floor((low + high) / 2);
    if (signIndexAt(new Date(middle)) === previousSign) low = middle;
    else high = middle;
  }
  return new Date(high);
}

const ingresses = [];
let previousAt = FROM;
let previousSign = signIndexAt(new Date(FROM));
for (let at = FROM + STEP_MS; at <= TO; at += STEP_MS) {
  const sign = signIndexAt(new Date(at));
  if (sign !== previousSign) {
    const boundary = refineBoundary(new Date(previousAt), new Date(at), previousSign);
    ingresses.push({ sign: SIGN_SLUGS[sign], at: boundary.toISOString() });
    previousSign = sign;
  }
  previousAt = at;
}

const problems = [];
if (ingresses.length < 400) problems.push(`only ${ingresses.length} Moon ingresses`);
for (let index = 1; index < ingresses.length; index += 1) {
  const previous = ingresses[index - 1];
  const current = ingresses[index];
  const expected = SIGN_SLUGS[(SIGN_SLUGS.indexOf(previous.sign) + 1) % SIGN_SLUGS.length];
  const gapHours = (Date.parse(current.at) - Date.parse(previous.at)) / 3_600_000;
  if (current.sign !== expected) problems.push(`unexpected sequence at ${current.at}`);
  if (gapHours < 36 || gapHours > 84) problems.push(`unexpected ${gapHours.toFixed(2)}h gap at ${current.at}`);
}
if (problems.length) throw new Error(`build-aura-moon-ingresses failed:\n${problems.join('\n')}`);

await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  from: new Date(FROM).toISOString(),
  to: new Date(TO).toISOString(),
  ingresses,
}, null, 2)}\n`);
console.log(`build-aura-moon-ingresses: ${ingresses.length} exact boundaries written`);
