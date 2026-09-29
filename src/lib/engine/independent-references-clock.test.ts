import { describe, expect, it } from 'vitest';
import { deltaTAt } from '@zodiacs/engine/deltat';
import eightCases from './fixtures/independent-eight-cases.json';
import lunarReturns from './fixtures/independent-lunar-returns.json';
import nodePolar from './fixtures/independent-node-polar.json';
import transitWindows from './fixtures/transit-window-horizons.json';

// The independent references are evaluated at the engine's own TT: UT is the
// instant and TT = UT + the engine's ΔT
// (docs/engine-validation/independent-references/README.md, "Clock"). Each
// file records the ΔT model and table it was built on. If the installed
// engine carries another table, every reference instant has moved under it
// and the references are stale, however well the tests still pass: rebuild
// them with python3 docs/engine-validation/independent-references/tools/build.py.
const REFERENCES = {
  'independent-eight-cases.json': eightCases,
  'independent-lunar-returns.json': lunarReturns,
  'independent-node-polar.json': nodePolar,
  'transit-window-horizons.json': transitWindows,
};

describe('the independent references and the installed engine clock', () => {
  const installed = deltaTAt(0);

  for (const [name, reference] of Object.entries(REFERENCES)) {
    it(`${name} was built on the ΔT table the installed engine carries`, () => {
      const rebuild = `${name}: rebuild it with docs/engine-validation/independent-references/tools/build.py`;
      expect(reference.engineClock.deltaTModel, rebuild).toBe(installed.model);
      expect(reference.engineClock.deltaTTable, rebuild).toBe(installed.table);
      expect(reference.engineClock.deltaTTableDigest, rebuild).toBe(installed.tableDigest);
    });
  }
});
