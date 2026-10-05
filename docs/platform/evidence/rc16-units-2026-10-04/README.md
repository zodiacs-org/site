# Three more of engine rc.16's units, 2026-10-04

Checkpoint 14 judged nine units that first shipped in `@zodiacs/engine`
0.1.1-rc.16 ([`../rc16-gates-2026-10-04/`](../rc16-gates-2026-10-04/README.md))
and left three Phase 2 A units that rc.16 also touches unjudged: aspect
patterns, composite and Davison charts, and solar and lunar returns. Each is
judged here against its gate as the ledger words it, from the engine at the
release commit
[`6807f632`](https://github.com/zodiacs-org/engine/commit/6807f632fc5aad08999d97f61e50793c6ca9a0b4),
whose package source is the release source
[`ddbbaa0`](https://github.com/zodiacs-org/engine/tree/ddbbaa0b1d21e16834722f81e8708816849c6726),
and from the site's parity record of rc.16,
[`../site-engine-rc16/techniques-parity.json`](../site-engine-rc16/techniques-parity.json).

| Unit | Weight | Gate | Verdict |
| --- | ---: | --- | --- |
| P2.A.aspects.configurable | 1 | fixtures for every pattern definition; exact inclusive orb semantics as documented | **met**, on the reading below |
| P2.A.composite-davison | 0.75 | definitions cited; fixtures | **met**, on the reading below |
| P2.A.timing.returns | 1.5 | fixtures from cited worked examples; site parity | partial: site parity is met, no cited worked example |

**Release state.** The archive at `6807f632`,
`artifacts/zodiacs-engine-0.1.1-rc.16.tgz`, has SHA-256 `43a72d30…15d8`, the
bytes of the npm tarball and of `vendor/zodiacs-engine-0.1.1-rc.16.tgz`, which
the site vendors and production serves (checkpoint 14). That is the release
state the ledger asks of an engine capability, so all three are recorded
`deployed`, as checkpoint 14 recorded the entry points the site vendors without
calling. The site calls the package's aspect patterns and returns; it does not
call `davisonChart`.

**The readings.** Two of these gates can be read two ways, and this record
takes the plainer reading of each. As with the readings checkpoint 14
disclosed, the owner can overrule them, and the unit then returns to partial.

## P2.A.aspects.configurable: met

The package defines four aspect patterns among the Sun to Pluto, the grand
trine, the T-square, the grand cross and the kite (`PatternKind`), each as
Robert Hand defines it in *Horoscope Symbols* (1981), ch. 6, quoted in the
engine's `docs/techniques.md`, *Aspect patterns*.

- **A fixture for every definition.** `src/techniques/aspect-patterns.test.ts`:
  "finds the grand trine", "finds the T-square and its apex", "finds the grand
  cross, its two oppositions and the four T-squares inside it" and "finds the
  kite and its roles", on exact constructed positions whose expected patterns
  follow from the definitions, not from engine output. "needs every edge of
  the %#th definition" removes each aspect of each of the four in turn and
  finds the pattern gone every time, and "finds nothing in a figure of minor
  aspects" holds the negative case. The site's parity families agree in full:
  P-D 840 of 840 and P-C 1,000 of 1,000.
- **Exact inclusive orb semantics, as documented.** The orb decisions are
  exact on binary64 inputs (the engine's README, *Exact binary arithmetic*;
  `configured-aspects.ts` and `exact.ts` are unchanged since rc.13). The
  engine's rational oracle, `docs/evidence/rc13-20260928/exact-oracle.py`,
  which decides every case in Python fractions on the exact binary64 inputs,
  was rerun here on the rc.16 archive: 53,168 cases in seven families, 0
  mismatches ([`results/exact-oracle-rc16.json`](results/exact-oracle-rc16.json)).
  The inclusive limits have their own fixtures ("keeps the inclusive square
  limit for %s", "keeps the inclusive sextile limit for %s").

**Reading.** "Every pattern definition" is read as every pattern the package
defines. Hand's chapter also defines the grand sextile, the mystic rectangle,
the minor grand trine and the yod, which the package does not offer and says
so (`docs/techniques.md`, *Not covered*); read as every pattern in Hand's
chapter, the gate is not met. The gate names neither a source nor a list.

`aspectPatterns` decides a pattern from a chart's aspect records with the
natal orbs of `ASPECTS`, so a pattern cannot use a configured orb policy; the
documentation says so. The same *Not covered* list calls the mystic rectangle
and the grand sextile "patterns with minor aspects", but both are made only of
oppositions, trines and sextiles (FINDINGS F-76).

## P2.A.composite-davison: met

- **Definitions cited.** `docs/techniques.md`, *Composite charts*, cites John
  Townley, *The Composite Chart* (1973), and Robert Hand, *Planets in
  Composite* (1975), and quotes "a chart out of mutual midpoints" from
  Townley's interview on *The Astrology Podcast*, ep. 128. *Davison charts*
  cites Ronald C. Davison, *Synastry* (1977), and quotes the same episode's
  description, "you create a chart for ... the midpoint in time between those
  two ... and for a location that's between the two", cited to the episode.
  The episode's host says that sentence; the engine attributes it to the
  episode, not to Davison. The engine says that none of the three books could
  be read, and that its Davison place conventions are its own reading of the
  definition, not Davison's text.
- **Fixtures.** `src/techniques/relationship.test.ts`, 11 tests:
  - the composite midpoint on the shorter arc, the site's convention for exact
    opposites, composite aspects at the natal orbs, refusals, and a composite
    chart with no angles;
  - the Davison chart at the mean instant and the mean place of two invented
    births, equal to `natalChart` there; an odd millisecond rounded down; no
    angles unless both births have a place and no known time unless both do;
    the midpoint of longitude across the antimeridian; the great-circle
    midpoint against a second formula at 500 random pairs; refusals.

  The site's parity families for the composite agree in full: C-M 500 of 500
  and C-R 500 of 500. The Davison chart is new in the package and has no
  parity family.

**Reading.** "Definitions cited" is read as: each definition cites the source
it was taken from and names the work it comes from. Read as the brief's M5
rule, definitions taken from the original books with every formula cited, it
is not met: the books were not read, and the place conventions are the
package's own.

## P2.A.timing.returns: partial

- **Site parity: met.** The engine's `src/techniques/site-parity.test.ts`
  compares every return instant and chart of the site's families. The site's
  record runs the site's former code against the vendored rc.16: R-SI, R-SY,
  R-SM and R-LI 400 of 400 each; R-SC and R-LC 160 of 160 each; and R-E,
  windows reaching outside 1800 to 2200, which the site clips, differs in 50
  of 60 by that cause alone, as designed. The year-ahead scan's returns, moved
  onto the package by F-67, keep their own parity record.
- **Fixtures from cited worked examples: not met.** The engine checks solar
  returns against USNO's *Earth's Seasons* (20 equinoxes and solstices, worst
  42.27 s against 120 s allowed) and returns against JPL Horizons positions;
  al-Bīrūnī §522 is cited for the definition. These are published reference
  values, not worked examples of a return, which is the same judgment
  checkpoint 14 made for planetary returns. Fixtures from a cited, published
  worked example of a solar return and of a lunar return would close it.

## Commands

All in a detached worktree of `zodiacs-org/engine` at `6807f632`, on Node
22.22.2:

```sh
npm ci                                  # 110 packages
npx vitest run src/techniques/aspect-patterns.test.ts \
  src/techniques/relationship.test.ts src/techniques/returns.test.ts \
  src/techniques/site-parity.test.ts src/configured-aspects.test.ts
# 5 files, 173 tests passed: 23, 11, 81, 6 and 52
sha256sum artifacts/zodiacs-engine-0.1.1-rc.16.tgz
# 43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8,
# equal to the site's vendor/zodiacs-engine-0.1.1-rc.16.tgz
python3 docs/evidence/rc13-20260928/exact-oracle.py \
  --entry <consumer>/node_modules/@zodiacs/engine/dist/index.js \
  --archive artifacts/zodiacs-engine-0.1.1-rc.16.tgz --output exact-oracle-rc16.json
# passed: 53,168 cases, 0 mismatches
```

`<consumer>` is an empty package that installed the archive and nothing else.
An independent review reached the same verdicts from the same sources before
these runs; the counts above are this record's own.
