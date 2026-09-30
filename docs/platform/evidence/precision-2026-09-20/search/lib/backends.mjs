/**
 * The three longitude sources used by this track, behind one interface.
 *
 *   core   the shipped engine, @zodiacs/engine/internal bodyLongitude. This is
 *          what the product and the transit-window core actually call.
 *   de     the repository's DE prototype
 *          docs/platform/evidence/swiss-benchmark/prototype/apparent.mjs over
 *          the DE440s kernel. Same reduction as `core` (it reuses
 *          astronomy-engine's Rotation_EQJ_ECT); only the positions change.
 *   swiss  pyswisseph 2.10.03 over sepl_18.se1, batched through a subprocess.
 *          An INSTRUMENT. Nothing here is fitted to it.
 *
 * CLOCK. The v6 D policy's recipe is UTC -> TT with TT - UTC = 69.184 s over
 * 2019-2020 (37 leap seconds + 32.184). Swiss is driven through
 * swe.utc_to_jd + swe.calc, which realises exactly that. The DE prototype is
 * pinned to the same TT with its deltaTSeconds argument, so a comparison
 * between them measures positions and not clocks. `core` has no pinning hook:
 * it applies astronomy-engine's own Delta-T (TT - UT1) instead, and the size
 * of that difference is measured rather than assumed.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const REPO = '/home/user/site';
export const KERNEL = '/tmp/claude-0/swisslab/de440s.bsp';
export const SWISS_PYTHON = '/tmp/claude-0/swisslab/venv/bin/python3';
export const SWISS_EPHE = '/tmp/claude-0/swisslab/ephe';
export const SWISS_BRIDGE = fileURLToPath(new URL('./swiss-longitudes.py', import.meta.url));

/**
 * The Swiss transit-window fixture this track read, which left the tree on
 * 2026-09-28 (docs/platform/programme/DECISIONS-2026-09-28.md §3). Give a
 * copy of `git show 2ca93d41:src/lib/engine/fixtures/transit-window-independent.json`
 * kept outside the repository, as a .json argument or in SWISS_WINDOW_FIXTURE.
 * A path inside the repository is refused, so the fixture is never read from
 * src/ and never has to come back there; so is any other file.
 */
export const SWISS_WINDOW_FIXTURE_SHA256 = 'db4ddce1d2761ad0ada1ab7aaf456d74d2f79b6b6a3434b1b8f6b9895ad66c3a';
export function swissWindowFixture(argv = process.argv.slice(2)) {
  const given = argv.find((arg) => arg.endsWith('.json')) ?? process.env.SWISS_WINDOW_FIXTURE;
  if (!given) {
    throw new Error('Give the transit-window fixture of commit 2ca93d41, kept outside the repository, as an argument or in SWISS_WINDOW_FIXTURE');
  }
  const path = realpathSync(resolve(given));
  const here = realpathSync(fileURLToPath(new URL('../../../../../../', import.meta.url)));
  for (const repository of new Set([REPO, here])) {
    if (path === repository || path.startsWith(repository + sep)) {
      throw new Error(`${path} is inside the repository; keep the Swiss fixture outside it`);
    }
  }
  const bytes = readFileSync(path);
  if (createHash('sha256').update(bytes).digest('hex') !== SWISS_WINDOW_FIXTURE_SHA256) {
    throw new Error(`${path} is not the transit-window fixture of commit 2ca93d41`);
  }
  return { path, bytes, fixture: JSON.parse(bytes) };
}

/** The D case's two components, as the fixture recorded them. */
export function swissDComponents(argv) {
  const D = swissWindowFixture(argv).fixture.cases.find((x) => x.id === 'D-Uranus2020');
  return D.geometries[0].components;
}

/** TT - UTC over 2019-2020, seconds. Constant: no leap second fell in the window. */
export const TT_MINUS_UTC = 69.184;

export async function coreBackend() {
  const { bodyLongitude, longitudeSpeed } = await import('@zodiacs/engine/internal');
  return {
    id: 'core',
    what: '@zodiacs/engine/internal bodyLongitude (astronomy-engine series), engine-native Delta-T',
    lon: (body, ms) => bodyLongitude(body, new Date(ms)),
    speed: (body, ms) => longitudeSpeed(body, new Date(ms)),
  };
}

export async function deBackend({ ttMinusUtcSeconds = TT_MINUS_UTC } = {}) {
  const { DeBackend } = await import(`${REPO}/docs/platform/evidence/swiss-benchmark/prototype/apparent.mjs`);
  const engine = new DeBackend(KERNEL);
  return {
    id: 'de',
    what: `DE440s via the repository prototype, TT pinned to UTC + ${ttMinusUtcSeconds} s`,
    ttMinusUtcSeconds,
    lon: (body, ms) => engine.apparentEclipticLongitude(body, new Date(ms), ttMinusUtcSeconds),
  };
}

/** Batched Swiss longitudes. Returns rows in the order requested. */
export function swissLongitudes(body, msList) {
  const utc = msList.map((ms) => new Date(ms).toISOString().replace('Z', ''));
  const out = execFileSync(SWISS_PYTHON, [SWISS_BRIDGE], {
    input: JSON.stringify({ body, utc, ephe: SWISS_EPHE }),
    encoding: 'utf8', maxBuffer: 1 << 28,
  });
  const parsed = JSON.parse(out);
  if (parsed.rows.length !== msList.length) throw new Error('Swiss bridge returned the wrong row count');
  return parsed;
}

export const DAY_MS = 86_400_000;
/** Signed circular separation a - b, degrees, in (-180, 180]. */
export const circular = (a, b) => {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
};
export const iso = (ms) => new Date(Math.round(ms)).toISOString();
export { require };
