/**
 * Tests for the SPK reader and the reduction.
 *
 * These are skipped, loudly, when the kernel is absent — the file is 31 MiB of
 * JPL data that is deliberately not committed, and a test that silently passes
 * because its input is missing is worse than no test.
 */
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';

const KERNEL = process.env.DE_KERNEL ?? '/tmp/claude-0/swisslab/de440s.bsp';
const present = existsSync(KERNEL);
const when = new Date('1988-03-21T06:45:00Z');

describe.skipIf(!present)('the experimental DE backend', () => {
  it('reads the kernel and finds the expected segments', async () => {
    const { Spk, NAIF } = await import('./spk.mjs');
    const spk = new Spk(KERNEL);
    expect(spk.segments.length).toBeGreaterThan(10);
    // Every body the corpus asks for must be routable.
    for (const [target, centre] of [[NAIF.SUN, NAIF.SSB], [NAIF.EMB, NAIF.SSB], [NAIF.MOON, NAIF.EMB]]) {
      expect(() => spk.segment(target, centre)).not.toThrow();
    }
  });

  it('refuses an instant outside the segment coverage rather than extrapolating', async () => {
    const { Spk, NAIF } = await import('./spk.mjs');
    const spk = new Spk(KERNEL);
    const seg = spk.segment(NAIF.SUN, NAIF.SSB);
    // DE440s stops in 2150; silently extrapolating a Chebyshev fit past its
    // interval is how a wrong answer gets reported as a right one.
    expect(() => spk.position(seg, seg.stop + 86400)).toThrow(/outside segment coverage/);
  });

  it('produces apparent longitudes in range for every corpus body', async () => {
    const { DeBackend } = await import('./apparent.mjs');
    const de = new DeBackend(KERNEL);
    for (const body of ['Sun', 'Moon', 'Mercury', 'Jupiter', 'Pluto']) {
      const lon = de.apparentEclipticLongitude(body, when);
      expect(Number.isFinite(lon)).toBe(true);
      expect(lon).toBeGreaterThanOrEqual(0);
      expect(lon).toBeLessThan(360);
    }
  });

  it('moves the result when Delta-T is pinned, by the amount the time scale implies', async () => {
    const { DeBackend } = await import('./apparent.mjs');
    const de = new DeBackend(KERNEL);
    const far = new Date('2100-01-01T00:00:00Z');
    const engineDt = de.apparentEclipticLongitude('Moon', far);
    // A round 90 s, not any reference's value: until 2026-09-28 this pinned
    // Swiss's own ΔT at 2100, which left the tree with the rest of Swiss's raw
    // output (docs/platform/programme/DECISIONS-2026-09-28.md §3). What is
    // tested is the mechanism, and astronomy-engine's own 202.65 s at 2100 is
    // ~113 s from the pin, which times the Moon's ~0.549"/s is ~62".
    const pinned = de.apparentEclipticLongitude('Moon', far, 90);
    const movedArcsec = Math.abs(engineDt - pinned) * 3600;
    expect(movedArcsec).toBeGreaterThan(40);
    expect(movedArcsec).toBeLessThan(90);
  });
});
