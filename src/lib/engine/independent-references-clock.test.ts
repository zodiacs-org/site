import { describe, expect, it } from 'vitest';
import { natalChart } from '@zodiacs/engine';
import { deltaTAt } from '@zodiacs/engine/deltat';
import eightCases from './fixtures/independent-eight-cases.json';
import lunarReturns from './fixtures/independent-lunar-returns.json';
import nodePolar from './fixtures/independent-node-polar.json';
import transitWindows from './fixtures/transit-window-horizons.json';
import { timeBasis } from './time-basis.mjs';

// The independent references are evaluated at the engine's own UT1 and TT
// (docs/engine-validation/independent-references/README.md, "Clock"). Since
// engine 0.1.1-rc.15 that clock reads an instant from 1972 to 2027-10-02 as
// UTC, with the IERS leap seconds and UT1 − UTC, and any other instant as UT1
// with the ΔT model. Each file records the model and the IERS table it was
// built on. If the installed engine carries another, or reads an instant on
// another basis, every reference instant has moved under it and the
// references are stale, however well the tests still pass: rebuild them with
// python3 docs/engine-validation/independent-references/tools/build.py.
const REFERENCES = {
  'independent-eight-cases.json': eightCases,
  'independent-lunar-returns.json': lunarReturns,
  'independent-node-polar.json': nodePolar,
  'transit-window-horizons.json': transitWindows,
};
const J2000_JD = 2451545;

describe('the independent references and the installed engine clock', () => {
  const installed = deltaTAt(0);
  const iers = natalChart({ utc: new Date('2000-01-01T12:00:00Z'), timeKnown: false }).deltaT;

  for (const [name, reference] of Object.entries(REFERENCES)) {
    it(`${name} was built on the ΔT model and IERS table the installed engine carries`, () => {
      const rebuild = `${name}: rebuild it with docs/engine-validation/independent-references/tools/build.py`;
      expect(reference.engineClock.deltaTModel, rebuild).toBe(installed.model);
      expect(reference.engineClock.deltaTTable, rebuild).toBe(installed.table);
      expect(reference.engineClock.deltaTTableDigest, rebuild).toBe(installed.tableDigest);
      expect(reference.engineClock.iersModel, rebuild).toBe(iers.model);
      expect(reference.engineClock.iersTable, rebuild).toBe(iers.table);
      expect(reference.engineClock.iersTableDigest, rebuild).toBe(iers.tableDigest);
    });
  }

  // The node and polar references record the TT and ΔT each was taken at.
  // Those are the engine's for the instant, which a change of basis moves
  // though no table name changes (rc.15 moved them by up to 0.54 s).
  it.each([...nodePolar.trueNode, ...nodePolar.polar])('$id was taken at the TT the installed engine gives its instant', (reference) => {
    const basis = timeBasis(Date.parse(reference.input.utc), 'utc');
    const rebuild = `${reference.id}: rebuild the references with docs/engine-validation/independent-references/tools/build.py`;
    expect(Math.abs(reference.input.jdTT - (basis.ttDays + J2000_JD)), rebuild).toBeLessThanOrEqual(2e-10);
    expect(Math.abs(reference.input.deltaTSeconds - basis.deltaT.seconds), rebuild).toBeLessThanOrEqual(1e-5);
  });
});
