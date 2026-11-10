/**
 * The verdicts of rules (i), (ii), (iv) and (v) from rows already computed,
 * as the preregistration fixes them. A row the backend refused, left out or
 * answered with a non-finite number fails its rule; a row an instrument
 * could not give makes the rule NOT RUN.
 */
import { ARCSEC, max, quantile, summary, wrap } from './stats.mjs';

const verdict = (pass) => (pass ? 'PASS' : 'FAIL');

/** Rows of { ours: {lon,lat}|{fail}, ref: {lon,lat}|{instrument} }: the backend's failures and the instrument's. */
export function differences(rows) {
  const backendFailures = rows.filter((row) => row.ours.fail).map((row) => ({ id: row.id, body: row.body, why: row.ours.fail }));
  const instrumentFailures = rows.filter((row) => !row.ours.fail && row.ref.instrument).map((row) => ({ id: row.id, body: row.body, why: row.ref.instrument }));
  const scored = rows.filter((row) => !row.ours.fail && !row.ref.instrument).map((row) => ({
    id: row.id,
    body: row.body,
    dLon: wrap(row.ours.lon, row.ref.lon) * ARCSEC,
    dLat: (row.ours.lat - row.ref.lat) * ARCSEC,
  }));
  return { scored, backendFailures, instrumentFailures };
}

/** Rule (i): longitude max <= 0.5", p50 <= 0.15", latitude max <= 0.2"; with parity on the corpus. */
export function ruleI({ ours, swiss, label, parity }) {
  const d = differences(ours);
  const s = summary(d.scored);
  const out = { label, n: s.n, lonMaxArcsec: s.lonMax, lonP50Arcsec: s.lonP50, latMaxArcsec: s.latMax, backendFailures: d.backendFailures, instrumentFailures: d.instrumentFailures };
  let pass = d.backendFailures.length === 0 && s.lonMax <= 0.5 && s.lonP50 <= 0.15 && s.latMax <= 0.2;
  if (parity) {
    const swDiff = differences(swiss);
    if (swDiff.instrumentFailures.length && d.backendFailures.length === 0) return { ...out, swissInstrumentFailures: swDiff.instrumentFailures, verdict: 'NOT RUN' };
    const sw = summary(swDiff.scored);
    out.swissRemeasured = { n: sw.n, lonMaxArcsec: sw.lonMax, lonP50Arcsec: sw.lonP50 };
    out.parity = {
      brief: { lonMax: s.lonMax <= 0.384 + 0.12, lonP50: s.lonP50 <= 0.098 + 0.12 },
      remeasured: { lonMax: s.lonMax <= sw.lonMax + 0.12, lonP50: s.lonP50 <= sw.lonP50 + 0.12 },
    };
    pass = pass && Object.values(out.parity).every((p) => p.lonMax && p.lonP50);
  }
  if (d.instrumentFailures.length && d.backendFailures.length === 0) return { ...out, verdict: 'NOT RUN' };
  return { ...out, verdict: verdict(pass) };
}

/** Rule (ii): for longitude and latitude, the Moon <= 0.01", every other body <= 0.003". */
export function ruleII({ ours, label }) {
  const d = differences(ours);
  const byBody = {};
  for (const row of d.scored) {
    const entry = (byBody[row.body] ??= { n: 0, lonMaxArcsec: 0, latMaxArcsec: 0 });
    entry.n += 1;
    entry.lonMaxArcsec = Math.max(entry.lonMaxArcsec, Math.abs(row.dLon));
    entry.latMaxArcsec = Math.max(entry.latMaxArcsec, Math.abs(row.dLat));
  }
  const pass = d.backendFailures.length === 0 && Object.entries(byBody).every(([body, e]) => {
    const limit = body === 'Moon' ? 0.01 : 0.003;
    return e.lonMaxArcsec <= limit && e.latMaxArcsec <= limit;
  });
  const out = { label, n: d.scored.length, byBody, backendFailures: d.backendFailures, instrumentFailures: d.instrumentFailures };
  if (d.instrumentFailures.length && d.backendFailures.length === 0) return { ...out, verdict: 'NOT RUN' };
  return { ...out, verdict: verdict(pass) };
}

/** Rule (v): node against TRUE_NODE, p50 <= 1" and max <= 3" (longitude). */
export function ruleV({ ours, label }) {
  const d = differences(ours);
  const lon = d.scored.map((row) => Math.abs(row.dLon));
  const out = { label, n: lon.length, p50Arcsec: quantile(lon, 0.5), maxArcsec: max(lon), backendFailures: d.backendFailures, instrumentFailures: d.instrumentFailures };
  if (d.instrumentFailures.length && d.backendFailures.length === 0) return { ...out, verdict: 'NOT RUN' };
  return { ...out, verdict: verdict(d.backendFailures.length === 0 && out.p50Arcsec <= 1 && out.maxArcsec <= 3) };
}
