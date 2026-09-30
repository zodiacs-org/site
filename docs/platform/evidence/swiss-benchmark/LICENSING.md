# Licensing posture of this laboratory

Written before any result was published, because the answer changes what may
be committed, not just how it is described.

## Swiss Ephemeris

The Swiss Ephemeris is distributed by Astrodienst under a dual licence: the
GNU Affero General Public License v3, or a paid commercial licence. The
`.se1` data files carry the same terms as the library they serve.
`pyswisseph` is the Python binding to that library and inherits the
obligation.

Two consequences, both acted on:

1. **Nothing Swiss is committed to this repository.** Not the library, not the
   binding, not the `.se1` files, not any derived coefficient table. The venv
   and the data live under the session scratchpad at
   `/tmp/claude-0/swisslab/` and are recreated by the documented commands.
   `CONFIGURATION.md` records their sizes and SHA-256 so a reader can confirm
   they fetched the same bytes, which is not the same thing as redistributing
   them.

   **Correction, 2026-09-23.** This holds for Swiss code and data files, and
   not for Swiss output, which is committed as measurements and test oracles:
   three raw files under `../precision-2026-09-20/numerics/`, five oracle
   fixtures under `src/lib/engine/fixtures/`, and differences from which
   Swiss's values can be recovered, in this directory's `report-*.json` and in
   `../events-vs-swiss-2026-09-23/deltas.json`.
   [`../precision-2026-09-20/METADATA-CORRECTION.md`](../precision-2026-09-20/METADATA-CORRECTION.md)
   lists them with the owner decision they wait on (the engine audit,
   data-toolchain-packaging-6). None is used as a fitting target.

   **Decision, 2026-09-28.** The owner decided that Swiss's raw output leaves
   the current tree and that statistics and SHA-256 digests stay
   ([`../../programme/DECISIONS-2026-09-28.md`](../../programme/DECISIONS-2026-09-28.md)
   §3). That day the fixtures and the nutation files were removed, the
   per-row values in the reports and deltas above were stripped, and the
   tests moved to NASA JPL Horizons and ERFA.
   [`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md)
   lists every file and field with its SHA-256 and the command that
   regenerates it. Commit `2ca93d41` still has them; history was not
   rewritten.
2. **No Swiss output is used as a fitting target.** Swiss appears here only as
   a *measuring instrument*. Fitting an approximation to Swiss output and then
   presenting the result as independent physical accuracy would be circular,
   and it would also be a derivative use of AGPL-covered output that this
   project has not established a right to make. Any higher-precision prototype
   must take its coefficients from a source whose terms permit it, and must be
   measured against Swiss afterwards, never trained on it.

   **Correction, 2026-09-20.** An earlier version of this sentence said JPL
   development ephemerides "are US Government work and are in the public
   domain". That was an assumption, not a reading. SPICE and its kernels are
   produced by Caltech's Jet Propulsion Laboratory under contract to NASA, and
   NAIF's rules page does not use the words "public domain" — it grants
   permission explicitly, with conditions attached to modified kernels. The
   primary text, and what it leaves genuinely unsettled, is in
   [`../precision-2026-09-20/RIGHTS.md`](../precision-2026-09-20/RIGHTS.md).
   The practical answer is still that this work may proceed; the reasoning was
   wrong and the obligations were missed.

Process isolation does not settle this. Running Swiss in a separate Python
process does not make its output unencumbered, which is exactly why the rule
above is about *what the numbers are used for*, not about where the process
boundary sits.

## What the engine itself ships under

`@zodiacs/engine` is MIT, and its one runtime dependency, `astronomy-engine`,
is MIT. Those terms are unaffected by anything in this directory, and must
stay unaffected: **no Swiss-derived code, data or fitted coefficient may enter
the published package.** If a future prototype needs data whose redistribution
rights are unresolved, the data stays out of the release and the open question
is reported rather than assumed away.

## The unresolved question, stated precisely

If an optional higher-precision backend ships, and it carries JPL-derived
Chebyshev coefficients, then the question the owner has to answer is not about
Swiss at all. It is:

> May Zodiacs redistribute a *derived* coefficient set computed from JPL
> DE ephemerides, under MIT, inside an npm package — and what attribution does
> JPL/Caltech ask for in that case?

JPL ephemerides are public-domain US Government work, so the expected answer
is yes with attribution. That expectation has **not** been confirmed with a
primary source in this session and is recorded here as open, not settled.

No paid licence has been bought, no agreement entered, and no Swiss commercial
licence sought.
