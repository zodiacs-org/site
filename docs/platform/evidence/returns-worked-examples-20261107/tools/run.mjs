// Runs the vendored engine on the frozen holdout (PREREGISTRATION.md, "The fixtures and how each runs").
// Usage, from the site's root: node docs/platform/evidence/returns-worked-examples-20261107/tools/run.mjs
// Writes results.json next to holdout.json. Committed in the freeze commit; a change after the first run
// is a departure.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { lunarReturn, lunarReturnInstant, solarReturn, solarReturnInstant } from '@zodiacs/engine/techniques';
import { tolerance } from './tolerance.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const folder = join(here, '..');
const holdoutBytes = readFileSync(join(folder, 'holdout.json'));
const holdoutSha256 = createHash('sha256').update(holdoutBytes).digest('hex');
const holdout = JSON.parse(holdoutBytes.toString('utf8'));

const DAY_MS = 86400000;

/** The engine's instant for a fixture, as the preregistration fixes each call. No options are passed. */
export function engineInstant(fx) {
  const R = new Date(fx.return.utc);
  if (fx.form === 'whole-chain') {
    const birth = { utc: fx.birth.utc, latitude: fx.birth.latitude, longitude: fx.birth.longitude };
    if (fx.body === 'Sun') return solarReturn(birth, R).instant;
    return lunarReturn(birth, new Date(R.getTime() - 3 * DAY_MS)).instant;
  }
  if (fx.body === 'Sun') return solarReturnInstant(fx.radical.lonDeg, R);
  return lunarReturnInstant(fx.radical.lonDeg, new Date(R.getTime() - 3 * DAY_MS));
}

export function score(fx) {
  const tol = tolerance(fx);
  let E = null;
  let error = null;
  try {
    E = engineInstant(fx).toISOString();
  } catch (e) {
    error = String(e && e.message ? e.message : e);
  }
  const D = E === null ? null : Math.round(Date.parse(E) - Date.parse(fx.return.utc)) / 1000;
  const agrees = E !== null && Math.abs(D) <= tol.T;
  return { id: fx.id, body: fx.body, form: fx.form, author: fx.authorPerson ?? fx.author, work: fx.work, E, D, T: tol.T, terms: tol.terms, agrees, error };
}

export function verdict(rows) {
  const solar = rows.filter((x) => x.body === 'Sun');
  const lunar = rows.filter((x) => x.body === 'Moon');
  const agreeSolar = solar.filter((x) => x.agrees);
  const counts = {
    scored: rows.length,
    agreeing: rows.filter((x) => x.agrees).length,
    solarScored: solar.length,
    lunarScored: lunar.length,
    solarAgreeing: agreeSolar.length,
    lunarAgreeing: lunar.filter((x) => x.agrees).length,
    solarAuthorsScored: new Set(solar.map((x) => x.author)).size,
    solarWorksScored: new Set(solar.map((x) => x.work)).size,
    solarAuthorsAgreeing: new Set(agreeSolar.map((x) => x.author)).size,
    solarWorksAgreeing: new Set(agreeSolar.map((x) => x.work)).size,
  };
  const notScored = counts.solarScored < 5 || counts.lunarScored < 1 || counts.solarAuthorsScored < 2 || counts.solarWorksScored < 2;
  if (notScored) return { outcome: 'not-scored', counts };
  const pass = counts.solarAgreeing >= 5
    && counts.lunarAgreeing >= 1
    && counts.solarAuthorsAgreeing >= 2
    && counts.solarWorksAgreeing >= 2
    && counts.agreeing >= Math.ceil((2 * counts.scored) / 3);
  return { outcome: pass ? 'pass' : 'fail', counts };
}

// The nine development fixtures of 1 November (dev-search.json, selection.fixtures), with the inputs
// notes/returns-2026-11-01/check.mjs used. Seen data: re-run for regression only, never scored.
// Each runs with the same calls as a holdout fixture. toleranceSec is the 1 November figure.
export const DEVELOPMENT = [
  { id: 'sr-leo-1936-queen-mary-1910', body: 'Sun', form: 'whole-chain', birth: { utc: '1867-05-26T23:59:00Z', latitude: 51.5, longitude: -51 / 240 }, return: { utc: '1910-05-27T09:39:04Z' }, toleranceSec: 30 },
  { id: 'sr-leo-1936-besant-1907', body: 'Sun', form: 'whole-chain', birth: { utc: '1847-10-01T17:29:00Z', latitude: 51.5, longitude: 0 }, return: { utc: '1907-10-02T06:20:12Z' }, toleranceSec: 40 },
  { id: 'sr-green-1905-george-v-1893', body: 'Sun', form: 'whole-chain', birth: { utc: '1865-06-03T01:18:00Z', latitude: 51.5, longitude: -37 / 240 }, return: { utc: '1893-06-02T19:54:00Z' }, toleranceSec: 64 },
  { id: 'sr-green-1903-edward-vii-1900-step', body: 'Sun', form: 'step', radical: { lonDeg: 226 + 54 / 60 + 20 / 3600 }, return: { utc: '1900-11-09T18:10:27Z' }, toleranceSec: 60 },
  { id: 'sr-raphael-1905-edward-vii-1906', body: 'Sun', form: 'whole-chain', birth: { utc: '1841-11-09T10:48:00Z', latitude: 51 + 30 / 60 + 26 / 3600, longitude: -(7 / 60 + 39 / 3600) }, return: { utc: '1906-11-10T05:17:00Z' }, toleranceSec: 100 },
  { id: 'sr-astrolabus-1908-ah-1908', body: 'Sun', form: 'whole-chain', birth: { utc: '1891-05-30T14:00:00Z', latitude: 52.0567, longitude: 1.1482 }, return: { utc: '1908-05-30T16:44:00Z' }, toleranceSec: 60 },
  { id: 'lr-green-1904-victoria-1901-step', body: 'Moon', form: 'step', radical: { lonDeg: 63 + 34 / 60 }, return: { utc: '1901-01-02T01:59:00Z' }, toleranceSec: 130 },
  { id: 'sr-lilly-1647-merchant-1646', body: 'Sun', form: 'whole-chain', birth: { utc: '1616-09-29T14:33:12.856Z', latitude: 53, longitude: -2.1994 }, return: { utc: '1646-09-29T21:09:47.856Z' }, toleranceSec: 2217 },
  { id: 'sr-gadbury-1662-villiers-1648', body: 'Sun', form: 'whole-chain', birth: { utc: '1629-04-12T02:51:07.525Z', latitude: 51 + 32 / 60, longitude: -0.1 }, return: { utc: '1648-04-11T17:25:06.733Z' }, toleranceSec: 800 },
];

export function runDevelopment(fx) {
  let E = null;
  let error = null;
  try {
    E = engineInstant(fx).toISOString();
  } catch (e) {
    error = String(e && e.message ? e.message : e);
  }
  const D = E === null ? null : Math.round(Date.parse(E) - Date.parse(fx.return.utc)) / 1000;
  return { id: fx.id, body: fx.body, form: fx.form, E, D, toleranceSec1Nov: fx.toleranceSec, error, development: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const scored = holdout.fixtures.filter((fx) => fx.status === 'scored');
  const rows = scored.map(score);
  const out = {
    engine: ENGINE_VERSION,
    node: process.version,
    holdoutSha256,
    fixtures: rows,
    verdict: verdict(rows),
    development: DEVELOPMENT.map(runDevelopment),
  };
  writeFileSync(join(folder, 'results.json'), `${JSON.stringify(out, null, 1)}\n`);
  console.log(JSON.stringify({ holdoutSha256, outcome: out.verdict.outcome, counts: out.verdict.counts }));
}
