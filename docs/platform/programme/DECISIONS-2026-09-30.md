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

## 6. The compute endpoints fail closed without their rate limit

The record of 2026-09-29 §5 has the compute API, like the four endpoints that
already call the Firewall SDK, let every request through until the owner
publishes its rule. The review of the API on 2026-09-30 found what that means
while no rule exists: the SDK answers `not-found`, every request is computed,
nothing limits what one address can spend, and the documentation's "requests
from one address are rate limited" is false.

There were three choices:

- **Keep failing open.** The endpoints stay available, and the claim and the
  spending bound stay untrue until the owner acts.
- **Fail closed on the compute endpoints only.** Nothing is computed unless
  the Firewall counted the request and let it through.
- **Fail closed everywhere.** The email sign-up, the Aura lookup, the wallet
  birth lookup and the transit calendar would stop for people using the site
  today, until the owner publishes rules for them. That is outside this unit.

Decision: **the compute endpoints fail closed; the site's other endpoints keep
failing open.**

- A compute request is computed only when the Firewall counted it under every
  rule it falls under and let it through. When a rule is not published (the
  SDK reports `not-found`), when the check errors or answers anything else,
  and outside `NODE_ENV=production`, where the SDK lets every request through
  without asking the Firewall, the endpoint answers `503` with the code
  `rate-limit-unavailable`, a fixed message and `Retry-After: 300`, before it
  reads the body, and computes nothing.
- So the API answers only while its rate limit is in place, and "rate
  limited" is true whenever it answers. The documentation keeps saying the API
  is rate limited, and says, wherever it describes the API as available, that
  it answers only while its rate limit is in place.
- The switch stays: `COMPUTE_API_ENABLED=0` answers `503 disabled` with
  `Retry-After: 3600`.
- An endpoint answers 503 until every rule it is counted under is published:
  the events endpoint needs both rules of §7, the other five only the first
  (runbook §3). The gate's deployed measurements wait for both.

## 7. What one address can cost: a 92-day events window and a second rule

The record of 2026-09-29 §5 set one rule, `zodiacs-compute-api`, at 60
requests a minute per address, and allowed events windows of 366 days. The
review measured such a window over all 399 years it could start in: p50
669 ms, p95 890 ms, at most 1,170 ms. At 60 requests a minute one address could
cost 33 to 50 CPU-seconds a minute, and nothing but the programme's weekly look
at the bill would stop it. The review asked for at most 10 CPU-seconds a
minute.

Decision: **events windows of at most 92 days, the first rule at 40 requests
a minute, and a second rule for events alone.**

- `events.windowDays` is 92: a quarter of a year, so a year of events is four
  requests. `events.samples` becomes 12,000, about twice the most any such
  window used (5,302).
- Two Firewall rules, each counting requests per client address over 60
  seconds, and both failing closed as §6 decides:
  - `zodiacs-compute-api`: 40 requests, counting every compute request;
  - `zodiacs-compute-events`: 10 requests, counting events requests, which
    are also counted under the first.
- The worst case, measured on one 4-core machine over every year from 1800 to
  2199 on engine rc.15, in the run with the higher maxima of two
  (`docs/platform/evidence/compute-api-2026-09-29/worst-case.json`): a 92-day
  window with every body and kind took CPU p50 165.7 ms, p95 244.0 ms and at
  most 359.2 ms; the costliest other request, positions at the instant limit,
  at most 170.1 ms. One address at both limits costs at most
  10 × 0.359 s + 30 × 0.170 s = 8.7 CPU-seconds a minute (5.2 at the 95th
  percentiles). The other run gave 8.0, and the same sweep on rc.14 8.5.
- rc.15 was expected to cost about a fifth more per call than rc.14. On the
  same machine the engine calls the API makes cost 2% to 7% more, within the
  spread between runs, so the limits stand; the slowest requests could grow
  by 15% before one address reached 10 CPU-seconds a minute.
- Forty rather than sixty: with 60, the same arithmetic gives
  10 × 0.359 s + 50 × 0.170 s = 12.1 CPU-seconds, over the limit, because
  positions requests at the instant limit then dominate. Forty a minute is
  still one request every second and a half from each address. The owner had
  published the first rule at 60, from the runbook's first version; it moves
  to 40, and the events rule is added.
- A second rule rather than one lower limit: a chart takes a few
  milliseconds, and a single rule low enough for events would hold every
  endpoint to the events rate.
- A CPU-bound events request holds the shared function's instance while it
  runs: measured, each one in flight adds about 0.2 to 0.3 s to every other
  request on that instance, the Games and the chart previews included. The
  events rule bounds that to about 3.6 seconds a minute per address. The API
  stays in the shared function; a function of its own would remove the effect
  if it is ever seen.
- These are one machine's figures. The P3.3 gate measures the deployed
  endpoints, and the rules come down if Vercel's figures, or a later engine's,
  put one address over 10 CPU-seconds a minute.
