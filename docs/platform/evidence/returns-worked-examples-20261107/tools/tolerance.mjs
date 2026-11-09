// Tolerance T for a returns fixture, as PREREGISTRATION.md ("The tolerance") fixes it.
// Node built-ins only (C4): no engine, no ephemeris. Every term comes from the fixture's
// recorded source properties, from the UT values tools/readings.mjs recorded before the
// freeze, or from a constant the preregistration fixes. Nothing comes from the engine or D.
//
// Fixture fields used here:
//   body: 'Sun' | 'Moon'; form: 'whole-chain' | 'step'
//   units: { returnSec, returnTruncated, birthSec?, birthTruncated?,
//            radicalArcsec?, radicalTruncated?, radicalUsedInWorking? }
//   interpolation: { birth?, return? }   (method names below; missing means unknown)
//   readings: [ { name, returnUtc, birthUtc } ]   the first is the reading used; the rest are
//            every combination of the open readings (birthUtc is null for step fixtures)

export const RATE_SEC_PER_ARCSEC = { Sun: 25.2, Moon: 2.1 };
export const SPEED_RATIO_F = { Sun: 1.01, Moon: 1.31 };
export const CAP_SEC = { Sun: { step: 600, 'whole-chain': 600 }, Moon: { step: 900, 'whole-chain': 1500 } };
export const INTERPOLATION_SEC = {
  Sun: { 'daily-linear': 8, other: 1, unknown: 8 },
  Moon: {
    '24h-linear': 410,
    '12h-linear': 105,
    '24h-second-differences': 13,
    'hourly-or-12h-second-differences': 2,
    unknown: 410,
  },
};

/** Table allowance in arcseconds for the era of an instant (decimal year). */
export function tableArcsec(body, year) {
  if (body === 'Sun') return year < 1834 ? 15 : year < 1860 ? 4 : year < 1960 ? 1.5 : 0.5;
  return year < 1862 ? 30 : year < 1923 ? 20 : year < 1960 ? 5 : 2;
}

/** Decimal year of an ISO instant (UTC). */
export function decimalYear(utc) {
  const t = Date.parse(utc);
  if (!Number.isFinite(t)) throw new Error(`bad instant ${utc}`);
  const y = new Date(t).getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (t - start) / (end - start);
}

/** dT in seconds: Espenak and Meeus (2006) polynomial expressions, 1800 to 2050. */
export function deltaT(year) {
  const y = year;
  if (!(y >= 1800 && y <= 2050)) throw new Error(`dT outside 1800-2050: ${y}`);
  let t;
  if (y < 1860) {
    t = y - 1800;
    return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4
      + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
  }
  if (y < 1900) {
    t = y - 1860;
    return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  }
  if (y < 1920) {
    t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y < 1941) {
    t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (y < 1961) {
    t = y - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (y < 1986) {
    t = y - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (y < 2005) {
    t = y - 2000;
    return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  }
  t = y - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
}

function halfUnit(unit, truncated, what) {
  if (!(unit > 0)) throw new Error(`missing printed unit: ${what}`);
  return truncated ? unit : unit / 2;
}

function ms(utc, what) {
  const t = Date.parse(utc);
  if (!Number.isFinite(t)) throw new Error(`bad ${what}: ${utc}`);
  return t;
}

/** T and its terms. Throws when a required property is missing. */
export function tolerance(fx) {
  const { body, form } = fx;
  if (body !== 'Sun' && body !== 'Moon') throw new Error(`body ${body}`);
  if (form !== 'whole-chain' && form !== 'step') throw new Error(`form ${form}`);
  const chain = form === 'whole-chain';
  const rate = RATE_SEC_PER_ARCSEC[body];
  const f = SPEED_RATIO_F[body];
  const u = fx.units ?? {};
  const readings = fx.readings ?? [];
  if (readings.length === 0) throw new Error('no reading recorded');
  const used = readings[0];
  if (chain && !used.birthUtc) throw new Error('whole-chain without a birth instant');

  const r = halfUnit(u.returnSec, u.returnTruncated, 'return');

  let i;
  if (chain) {
    i = halfUnit(u.birthSec, u.birthTruncated, 'birth') * f;
    if (u.radicalUsedInWorking) i += halfUnit(u.radicalArcsec, u.radicalTruncated, 'radical') * rate;
  } else {
    i = halfUnit(u.radicalArcsec, u.radicalTruncated, 'radical') * rate;
  }

  let b = 0;
  for (const alt of readings.slice(1)) {
    const dR = (ms(alt.returnUtc, 'return reading') - ms(used.returnUtc, 'return reading')) / 1000;
    const dB = chain ? (ms(alt.birthUtc, 'birth reading') - ms(used.birthUtc, 'birth reading')) / 1000 : 0;
    b = Math.max(b, Math.abs(dR - dB) + Math.abs(dB) * (f - 1));
  }

  const table = INTERPOLATION_SEC[body];
  const method = (m) => {
    const key = m ?? 'unknown';
    if (!Object.hasOwn(table, key)) throw new Error(`method ${key} for ${body}`);
    return table[key];
  };
  const interp = fx.interpolation ?? {};
  const c = method(interp.return) + (chain ? method(interp.birth) * f : 0);

  const yR = decimalYear(used.returnUtc);
  const yB = chain ? decimalYear(used.birthUtc) : null;
  const t = (tableArcsec(body, yR) + (chain ? tableArcsec(body, yB) : 0)) * rate;
  const d = (chain ? Math.abs(deltaT(yR) - deltaT(yB)) : Math.abs(deltaT(yR))) + 2;

  const T = r + i + b + c + t + d;
  const round = (x) => Math.round(x * 1000) / 1000;
  return {
    T: round(T),
    terms: { r: round(r), i: round(i), b: round(b), c: round(c), t: round(t), d: round(d) },
    tooImprecise: T > CAP_SEC[body][form],
  };
}
