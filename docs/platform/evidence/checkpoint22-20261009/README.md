# Checkpoint 22: accepted uniform calculation API

P3.2 asks for declarations covering every calc_ut option Phase 2 ships,
round-trip fixtures and typed refusals. The owner already adopted the
`EPHEMERIS_SPAN` epoch interpretation in the October 6 decision. Packed
`1.0.0-rc.2` implements it and is adopted and served in production.

The [complete gate and actual outputs](https://github.com/zodiacs-org/engine/tree/98465b1a6aba46ff5e12c283f77f54278dc6905b/docs/evidence/checkpoint22-rc2-20261009)
on engine main bind the carried archive, declaration control/faults, fixture
and receipt replay, sidereal definitions and inclusive/beyond-end epoch
matrix. Full postmerge engine CI
[37890077138](https://github.com/zodiacs-org/engine/actions/runs/37890077138),
including every carried archive rebuild and packed consumers, passed;
Conformance 37890077148 and Atlas 37890077048 passed separately.

`production.json` is the original 2,484-byte structured export from site
run 37895777038, job 113706678168, recovered and SHA-256 verified before
commitment. It checks the preserved guide-preparation build's seven engine
assets against the canonical public assets and the hosted backend, with the
same rc.2 candidate. That preparation changed no engine asset/API source.
The separate Vercel observation in `validation.json` establishes READY
production source `e9a21981`, deployment
`dpl_7cRJfgBFaS4m6F2YVVGFn1ujYz1G`, assigned to zodiacs.org.
HTTP bytes alone do not establish a source commit.

This judges the complete P3.2 gate and closes F-80 under the already approved
reading. Acceptance adds its weight of 3: 64 of 182.45 (35.078%).
The denominator and other acceptance states stay unchanged.
No new candidate, guide route or registry package is shipped. Registry
publication is a separate unit. Replay/consistency checks are not independent
accuracy proof. Earlier failed/refused cases remain in the linked records.

Private release-range/staged search inputs from the failed executor are
unavailable; no new search or clearance is claimed. Required searches remain
before new stable/package/guide publication. This checkpoint records acceptance
of the existing adopted candidate, and does not approve those publications.
