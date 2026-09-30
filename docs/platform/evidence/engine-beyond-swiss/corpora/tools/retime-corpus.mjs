/*
 * The TT instants of the 24-instant Horizons corpus, on the engine's own ΔT.
 *
 * Until 2026-09-29 the corpus was fetched at TT = UT + Swiss Ephemeris's ΔT,
 * so each TT instant beside its UT gave Swiss's ΔT back. Under
 * DECISIONS-2026-09-29 §2 that clock left the tree: TT is now UT + ΔT from the
 * installed engine's model (zodiacs-deltat/1), the clock every chart on the
 * site runs on, rounded to the 1e-8 day that the Horizons request carries, so
 * Horizons and every script that reads the corpus evaluate the same instant.
 * The UTC instants are the preregistered ones in corpus.json, unchanged.
 *
 *   node docs/platform/evidence/engine-beyond-swiss/corpora/tools/retime-corpus.mjs \
 *     > docs/platform/evidence/engine-beyond-swiss/corpora/horizons-24/corpus-tt.json
 *
 * It reads the installed @zodiacs/engine and makes no network request.
 * horizons-24/fetch.py then asks Horizons for the corpus at these instants.
 */
import { readFileSync } from 'node:fs';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { deltaTAt } from '@zodiacs/engine/deltat';

const DAY_MS = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const corpus = JSON.parse(readFileSync(new URL('../horizons-24/corpus.json', import.meta.url), 'utf8'));
const model = deltaTAt(0);

const cases = corpus.instants.map(({ id, utc }) => {
  const ms = Date.parse(utc);
  const deltaT = deltaTAt((ms - J2000_MS) / DAY_MS);
  const jdUt = 2440587.5 + ms / DAY_MS;
  return {
    id,
    utc,
    jdUt,
    deltaTSeconds: deltaT.seconds,
    jdTt: Number((jdUt + deltaT.seconds / 86_400).toFixed(8)),
  };
});

process.stdout.write(`${JSON.stringify({
  note: 'The 24 corpus instants: UTC, and the TT Julian dates sent to Horizons (TLIST, TIME_TYPE=TT). TT is UT + the engine\'s own ΔT (deltaTSeconds, model and table under clock), rounded to the 1e-8 day the request carries. Until 2026-09-29 TT was UT + Swiss Ephemeris\'s ΔT, which the TT instants gave back; that clock left the tree under docs/platform/programme/DECISIONS-2026-09-29.md §2 (docs/engine-validation/SWISS-OUTPUT-REMOVAL.md).',
  clock: {
    engine: ENGINE_VERSION,
    deltaTModel: model.model,
    deltaTTable: model.table,
    deltaTTableDigest: model.tableDigest,
    rounding: 'jdTt to 1e-8 day',
    madeBy: 'node docs/platform/evidence/engine-beyond-swiss/corpora/tools/retime-corpus.mjs',
  },
  cases,
}, null, 1)}\n`);
