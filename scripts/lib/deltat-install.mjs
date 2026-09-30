/**
 * Scripts that call astronomy-engine directly must run on the same clock as
 * every chart. Since @zodiacs/engine 0.1.1-rc.8 that clock is the engine's
 * observed ΔT (model "zodiacs-deltat/1", step 1.4 of the engine brief), which
 * the engine installs in astronomy-engine before each of its own calls. A
 * script that computes with astronomy-engine before, or without, calling the
 * engine would otherwise use astronomy-engine's 2004 polynomial, 6.3 s off
 * the observed value in 2026. Import this module first:
 *
 *   import './lib/deltat-install.mjs';
 *
 * Since 0.1.1-rc.15 a chart reads an instant from 1972 to 2027-10-02 as UTC,
 * with TT from the IERS leap seconds and UT1 from IERS UT1 − UTC, and only
 * other instants as UT1 with this model. astronomy-engine's MakeTime reads
 * every instant as UT1, so a script on this helper keeps the engine's clock
 * outside those years and, inside them, differs from it by the model's ΔT
 * minus TT − UTC: −0.07 to +0.20 s over 2026 and 2027, and up to 0.81 s just
 * after a leap second. No event time that the generators on it commit (the
 * retrograde windows in sky.json, eclipses.json, ingresses.json,
 * aura-moon-ingresses.json) lies near enough to the edge of a minute for that
 * to change the minute; the two retrograde periods that start at the
 * catalogue's first instant, 2026-01-01T00:00Z, are range ends, not events
 * (docs/platform/evidence/site-engine-rc15/model-clock.json). Code that
 * must match the engine to the millisecond takes the engine's own UT1 and TT
 * from src/lib/engine/time-basis.mjs, as src/lib/engine/server-ephemeris.ts
 * does.
 *
 * `scripts/deltat-install-guard.test.mjs` holds every direct importer of
 * astronomy-engine to it.
 */
import { SetDeltaTFunction } from 'astronomy-engine';
import { deltaT } from '@zodiacs/engine/deltat';

SetDeltaTFunction(deltaT);

export { deltaT };
