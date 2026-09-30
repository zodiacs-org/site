/**
 * The committed times that generators still compute on the ΔT model, against
 * rc.15's clock.
 *
 *   node docs/platform/evidence/site-engine-rc15/tools/model-clock-margins.mjs > model-clock.json
 *
 * `scripts/build-eclipses.mjs`, `build-ingresses.mjs`, `build-sky.mjs` (its
 * retrograde windows) and the generator of `src/data/aura-moon-ingresses.json`
 * call astronomy-engine directly, which reads an instant as UT1 with the ΔT
 * model the site installs (`scripts/lib/deltat-install.mjs`). rc.15's charts
 * read an instant from 1972 to 2027-10-02 as UTC instead. For each committed
 * time this finds the instant rc.15's clock would give the same Terrestrial
 * Time, t + (model ΔT − (TT − UTC)), which is t itself outside that span, and
 * counts the times whose UTC minute or date would change.
 */
import { readFileSync } from 'node:fs';
import { deltaT } from '@zodiacs/engine/deltat';
import { timeBasis } from '../../../../../src/lib/engine/time-basis.mjs';

const J2000 = Date.UTC(2000, 0, 1, 12);
const DAY = 86_400_000;
const root = new URL('../../../../../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
/** Seconds to add to a model-clock instant for rc.15's clock to give the same TT. */
const shift = (t) => {
  const basis = timeBasis(t, 'utc');
  if (basis.timeScale.basis !== 'iers') return 0;
  const days = (t - J2000) / DAY;
  return deltaT(days) - (basis.ttDays - days) * 86400;
};
const sets = {
  'src/data/eclipses.json peaks': read('src/data/eclipses.json').eclipses.map((e) => e.peak),
  'src/data/ingresses.json window ends': read('src/data/ingresses.json').windows.flatMap((w) => [w.from, w.to].filter(Boolean)),
  'src/data/aura-moon-ingresses.json': read('src/data/aura-moon-ingresses.json').ingresses.map((x) => x.at),
  'src/data/sky.json retrograde and shadow ends': read('src/data/sky.json').retrogrades
    .flatMap((r) => [r.from, r.to, r.preShadowStart, r.postShadowEnd].filter(Boolean)),
};
const result = {};
for (const [name, times] of Object.entries(sets)) {
  const row = { times: 0, inIersSpan: 0, largestShiftSeconds: 0, minuteWouldChange: [], dateWouldChange: [] };
  for (const iso of times) {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) continue;
    row.times += 1;
    const s = shift(t);
    if (s !== 0) row.inIersSpan += 1;
    row.largestShiftSeconds = Math.max(row.largestShiftSeconds, Math.abs(s));
    const moved = t + s * 1000;
    if (Math.floor(moved / 60000) !== Math.floor(t / 60000)) row.minuteWouldChange.push({ at: iso, shiftSeconds: Number(s.toFixed(3)) });
    if (new Date(moved).toISOString().slice(0, 10) !== iso.slice(0, 10)) row.dateWouldChange.push(iso);
  }
  row.largestShiftSeconds = Number(row.largestShiftSeconds.toFixed(3));
  result[name] = row;
}
process.stdout.write(`${JSON.stringify({
  schema: 'zodiacs-site-model-clock-margins/v1',
  generatedAt: new Date().toISOString(),
  node: process.version,
  sets: result,
}, null, 1)}\n`);
