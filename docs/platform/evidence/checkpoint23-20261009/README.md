# Checkpoint 23 — ratified limited comparisons and public tool benchmark

The owner's specific replies to the two named ratification questions are
recorded in [DECISIONS-2026-10-09.md](../../programme/DECISIONS-2026-10-09.md).
This proposes accepting Koch (0.2), co-ascendants (0.25) and B4.a (3):
**67.45/182.45 = 36.969%**. Other states, fixed weights, denominator,
tolerances and dependencies are unchanged. Main adopts this figure only
after the final unchanged full Site Check and merge.

## Actual producer and preserved failure

[Run 37906091024](https://github.com/zodiacs-org/site/actions/runs/37906091024),
job 113739782327, passed at head
`57005b5e93dff20ce0d4f272538dfe539a70e6bc`, checked out as
`7153cf9556b9fa4ef8fb6eb89cc4dd1f4d00ac54`.
Runtimes: Node 22.23.3, Python 3.11.17, pyswisseph 2.10.3.2 /
Swiss Ephemeris 2.10.03. No ephemeris file or Swiss per-case value is exported
or committed. The five actual reports have verified byte counts and SHA-256;
[validation.json](results/validation.json) binds producer, engine version and
the exact carried archive.

First [run 37905773175](https://github.com/zodiacs-org/site/actions/runs/37905773175)
failed before its end-to-end comparison: rc.16's driver used `system`,
which rc.2 rejects in a request. The copied drivers change only that request
key to `houseSystem`. Original tools and records are unchanged. Seeds,
grids, cases, output fields, shared UT1 and tolerances are preserved. The
given-input co-ascendant grid is copied byte for byte from engine main
1b5d475b; the comparator derives only Gate A from its original comparison.

## Fresh gates and limits

- Koch given inputs: ladder maximum 4.71e-9″, none over 0.01″; polar status
  agrees (48 both undefined on the ladder). Shared UT1, 1850–2049:
  353 compared ladder cases, maximum 0.035″, none over 3″ and no refusal.
  The broad given-input set retains its recorded repeated draws; it is
  not 20,000 distinct draws.
- Co-ascendants given inputs: 5,616 ladder and 20,000 global cases per point,
  maximum 4.71e-9″, none over 0.01″. Shared UT1, 1850–2049: 319 ladder cases
  per point, maximum 0.02002″, none over 3″ and no failed case.
- The sky benchmark suite passes 21 tests with its one existing
  engine-version-bound redraw skip. It checks all 300 current tool answers,
  surrounding facts, immutable v0 identities and scorer controls. The four
  canonical published files match their frozen source bytes/hashes exactly.
  V0 is not redrawn or rewritten. The retained rc.2 redraw reports only
  version/citation-identity differences and no changed answers/facts.

**Original failures remain**: UTC read as UT1 exceeded the threshold, and
outside-window co-ascendants have larger residuals. The post-result choices,
incomplete preregistration statements and reference convention differences
remain in the 4 October records and FINDINGS F-71. This ratifies an explicit
limited judgement; it does not claim an end-to-end tolerance outside
1850–2049 or turn original failed comparisons into passes. Swiss comparisons
are finite reference checks; tool/engine agreement is consistency. The
separately retained Horizons benchmark check is not rerun here.

## Adoption and unfinished work

The exact rc.2 archive is already adopted and served, as established by
[Checkpoint 22](../checkpoint22-20261009/README.md). Its records-only merge
is now READY on canonical domains at site
`1d29cfabcf857357bc8a4fd1da0c5df5c06b61ce`,
deployment `dpl_4ycMhJKQfMSuRKoxwGpp3U1g9PNi`.
[The separate observation](production.json) changes no calculation source.

B4.b still needs assistants' private raw answers and separate evaluation.
Public tool replies do not resolve the brief's self-serving-assistant
benchmark risk. No new stable archive, registry package, active guide,
private scan, account/security/hosting setting or outreach occurs here.
P3.3, P3.4 and P3.10 retain their incomplete gates; stable/package/guide
publication retains separate prerequisites.
