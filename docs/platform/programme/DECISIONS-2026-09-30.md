# Decisions of 2026-09-30

On 2026-09-28 the owner delegated the programme's open decisions: "Choose the
best decision for me. It's beyond my expertise." The earlier decisions under
that delegation are in [DECISIONS-2026-09-28.md](DECISIONS-2026-09-28.md) and
[DECISIONS-2026-09-29.md](DECISIONS-2026-09-29.md).

## 1. The Chinese solar terms wait for a Sun that is not fitted to JPL data

The engine's branch for the sky and the Chinese calendar computes the 24 solar
terms and the Four Pillars from a compact Sun series fitted to JPL DE430. That
is a coefficient set derived from a JPL ephemeris. The decision of 2026-09-28
§11 ships none until NAIF answers the derived-coefficient question (STATUS.md,
step 7).

Decision: **rc.16 takes the sky entry (rise, set and transit, and planetary
hours) and leaves the Chinese entry out.** The Chinese entry returns when it
has a Sun source that is not derived from a JPL ephemeris and still meets its
gate (each term within 2 s of an independent computation), or when NAIF
answers. P2.C.solar-terms and P2.C.four-pillars stay not started until then.

## 2. The engine chunk's budget rises by rc.15's measured growth

rc.15 reads a chart's instant from 1972 to 2027-10-02 as UTC, through the IERS
leap-second list and a table of UT1 − UTC. The package's time-basis chunk that
carries them is 8,319 bytes minified, against 344 in rc.14. The site's engine
chunk grew from 27,303 to 32,108 gzip bytes; the site's own code in it is 595
bytes minified, and the rest is the package. No saving was found that keeps
the time basis correct (`evidence/site-engine-rc15/`).

Decision: **the engine chunk's budget moves from 27,648 to 32,358 gzip
bytes**, 4,710 bytes, less than the measured growth of 4,805, so the
headroom falls from 345 to 250 bytes. No route budget moves: `/birth-chart/`
measures 72,444 bytes with production's flags against its unchanged 72,704.
The next raise needs its own measurement and reason.

## 3. Seven reference values that equal removed Swiss values stay

Rebuilt on rc.15's clock, five TT instants in `independent-node-polar.json`
and one Horizons lunar crossing carried to UTC equal values the removed Swiss
fixtures held, so the guard matched their digests (F-56). The TT instants are
the cases' own UTC inputs converted through the IERS leap-second list, which
any correct conversion gives, Swiss's `swe_utc_to_jd` included; the crossing
is Horizons's, and falls on the same millisecond as Swiss's return did.

Decision: **they stay.** The decision of 2026-09-29 §2 removes Swiss output;
these values are not Swiss output, only equal to it. Their seven digests move
from "gone" to "kept" in `value-digests.json` with the reason in
`SWISS-OUTPUT-REMOVAL.md`, and `strip.py --check` still confirms that every
removed value is accounted for.

## 4. Declinations and sect wait for a pure entry point

rc.15 exports its declination parallels and sect only from the root entry's
shared chunk, which imports astronomy-engine, so importing them into the site
would break the rule that `src/lib/engine/full.ts` is the only browser module
that loads it (F-54). The package also decides sect by the Sun's ecliptic arc,
the site by its altitude.

Decision: **the site keeps its own declinations and sect with rc.15.** The
engine's next candidate exports them from an entry point that loads no
ephemeris, and names the sect convention as an option. P2.E.declinations and
P2.E.sect stay merged, not accepted, until the site imports them.

## 5. The site carries the 1972 UT1 − UTC values as the engine does

The site's chart bundle and the MCP archive 0.1.0-rc.15 carry the engine's
UT1 − UTC table, whose 1972 values come from IERS EOP 20 C04 (F-55).

Decision: **the decision of 2026-09-29 §4 covers these copies too.** They
carry the values cited as the engine's `NOTICE` cites them, and the
developer pages name the source and say that IERS states no licence for the
series. If IERS states terms that forbid this, the site takes 1972 from
another source with the engine.
