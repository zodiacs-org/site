/**
 * Brief v1 rules 1b and 1h (engine brief steps 1.3 and 1.9), as the engine
 * the site runs meets them.
 *
 * Since @zodiacs/engine 0.1.1-rc.7 the angles are built from apparent sidereal
 * time and the TRUE obliquity of date, and Placidus is refused only inside the
 * polar circle, |latitude| ≥ 90° − ε. This test holds the engine to the rules
 * on the preregistered corpus
 * (docs/platform/evidence/engine-beyond-swiss/corpora/angle-grid-inputs.json)
 * against an ERFA arbiter rather than Swiss, whose output is not committed:
 * angle-grid-erfa.json beside it, made by tools/angle-arbiter.py on the
 * engine's own clock. The ascendant is within 8″ of the arbiter everywhere and
 * 0.5″ for |latitude| ≤ 45°, and Placidus is computed exactly where the
 * arbiter's limit allows it.
 *
 * Under rc.6, with the mean obliquity and a 66° limit, the same corpus gave an
 * ascendant up to 506.8″ from the arbiter (14.6″ within 45°), a midheaven up to
 * 2.25″, and all 336 ladder cases refused.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import './lib/deltat-install.mjs';
import { deltaT } from '@zodiacs/engine/deltat';
import { e_tilt, MakeTime, SetDeltaTFunction, SiderealTime } from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { computeChart } from '../src/lib/engine/full';
import { timeBasis } from '../src/lib/engine/time-basis.mjs';

const corpora = resolve(import.meta.dirname, '../docs/platform/evidence/engine-beyond-swiss/corpora');
const corpusBytes = readFileSync(resolve(corpora, 'angle-grid-inputs.json'));
const corpus = JSON.parse(corpusBytes.toString('utf8'));
const erfa = JSON.parse(readFileSync(resolve(corpora, 'angle-grid-erfa.json'), 'utf8'));

const CORPUS_SHA256 = '82a5466caefb919df66060dd46861ac4f68a678ef9ce3c16bfc423a94042cd9d';
const RAD = Math.PI / 180;

/** Signed difference a − b in arcseconds, across the 0/360 seam. */
const arcsec = (a, b) => ((((a - b) % 360) + 540) % 360 - 180) * 3600;
const quantile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};
const chart = ([utc, latitude, longitude]) => computeChart({
  utc: new Date(utc), latitude, longitude, houseSystem: 'placidus', timeKnown: true,
});
/**
 * Sidereal time (hours) and the true obliquity at an instant, as the engine
 * takes them: since 0.1.1-rc.15 at the UT1 of its time basis (for 1972 to
 * 2027-10-02, UTC plus IERS UT1 − UTC), with the basis's ΔT held for the call.
 */
const onEngineClock = (utc) => {
  const basis = timeBasis(Date.parse(utc), 'utc');
  SetDeltaTFunction(() => basis.deltaT.seconds);
  try {
    const time = MakeTime(basis.ut1Days);
    return { gastHours: SiderealTime(time), obliquity: e_tilt(time).tobl };
  } finally {
    SetDeltaTFunction(deltaT);
  }
};
/** The ascendant for a sidereal time (hours) and obliquity (degrees), the arbiter's formula. */
const ascendant = (gastHours, obliquity, latitude, longitude) => {
  const ramc = (gastHours * 15 + longitude) * RAD;
  const eps = obliquity * RAD;
  const asc = Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(latitude * RAD) * Math.sin(eps)));
  return ((asc / RAD) % 360 + 360) % 360;
};

describe('the angles against the ERFA arbiter (rule 1b)', () => {
  const rows = corpus.A.map((row, i) => {
    const { angles } = chart(row);
    return {
      id: `${row[0]} ${row[1]}°`,
      latitude: row[1],
      asc: Math.abs(arcsec(angles.asc, erfa.A[i][0])),
      mc: Math.abs(arcsec(angles.mc, erfa.A[i][1])),
    };
  });
  const asc = rows.map((row) => row.asc);
  const midLatitudes = rows.filter((row) => Math.abs(row.latitude) <= 45).map((row) => row.asc);

  it('runs on the preregistered corpus, and the arbiter on the same one', () => {
    expect(createHash('sha256').update(corpusBytes).digest('hex')).toBe(CORPUS_SHA256);
    expect(erfa.corpus.sha256).toBe(CORPUS_SHA256);
    expect([corpus.A.length, erfa.A.length, corpus.L.length, erfa.L.limitDegrees.length]).toEqual([3128, 3128, 336, 336]);
  });

  it('keeps the ascendant within 8″ of the arbiter everywhere and 0.5″ within 45° of the equator', () => {
    const worst = rows.reduce((a, b) => (b.asc > a.asc ? b : a));
    expect(worst.id).toBe('2025-03-21T18:00:00Z -66°');
    expect(worst.asc).toBeCloseTo(6.36, 1);
    expect(quantile(asc, 0.95)).toBeCloseTo(0.24, 1);
    expect(quantile(asc, 0.5)).toBeCloseTo(0.065, 2);
    expect(Math.max(...midLatitudes)).toBeCloseTo(0.36, 1);
    // Rule 1b's gates.
    expect(Math.max(...asc)).toBeLessThan(8);
    expect(Math.max(...midLatitudes)).toBeLessThan(0.5);
  });

  it('keeps the midheaven within 0.21″ of the arbiter', () => {
    expect(Math.max(...rows.map((row) => row.mc))).toBeLessThan(0.21);
  });

  it('agrees with the arbiter\'s formula on the engine\'s own sidereal time and true obliquity', () => {
    // The engine's angles are the arbiter's formula on astronomy-engine's
    // sidereal time and true obliquity, so the two stay within 1e-6″.
    const worst = Math.max(...corpus.A.map(([utc, latitude, longitude]) => {
      const { gastHours, obliquity } = onEngineClock(utc);
      const expected = ascendant(gastHours, obliquity, latitude, longitude);
      return Math.abs(arcsec(chart([utc, latitude, longitude]).angles.asc, expected));
    }));
    expect(worst).toBeLessThan(1e-6);
    // 3,128 charts, each with its clock: 2.4 s alone, past the default 5 s when
    // the suite runs in parallel.
  }, 30_000);
});

describe('Placidus near the polar circle (rule 1h)', () => {
  it('computes the 320 ladder cases the arbiter\'s limit of 90° − ε allows, and refuses the other 16', () => {
    const verdicts = corpus.L.map((row, i) => ({
      refused: chart(row).flags.includes('polar-fallback'),
      allowed: Math.abs(row[1]) < erfa.L.limitDegrees[i],
    }));
    expect(verdicts.filter((v) => v.refused === v.allowed)).toEqual([]);
    expect(verdicts.filter((v) => !v.refused).length).toBe(320);
    expect(verdicts.filter((v) => v.refused).length).toBe(16);
    expect([erfa.L.computable, erfa.L.refused]).toEqual([320, 16]);
  });
});
