# Decisions of 2026-09-29

On 2026-09-28 the owner delegated the programme's open decisions: "Choose the
best decision for me. It's beyond my expertise." The first decisions under
that delegation are in [DECISIONS-2026-09-28.md](DECISIONS-2026-09-28.md).
This record adds the ones taken on 2026-09-29, each with its reason and what
it changes.

## 1. The MCP adapter's archives 0.1.0-rc.8 to rc.10 (F-49): kept, with a notice beside them

The three archives bundle the engine's ΔT module, and so 32 values of Table
S15 of Stephenson, Morrison and Hohenkerk (2016), which are published under
CC BY 4.0. Each archive labels itself MIT and carries no notice. The licence
asks that anyone who shares the values say where they come from and under
what licence.

There were three choices:

- **Repack them with a notice.** Not possible: their SHA-256 digests are
  published and pinned, and a version names one byte sequence.
- **Stop serving them.** This would break every pinned link to them, and
  would not reach a copy already downloaded.
- **Keep them and publish a notice beside them.** The licence allows the
  attribution to be given in any reasonable manner, including by a link to a
  resource that holds it.

Decision: **keep the three archives as released, byte for byte, and publish
their notice beside them.**

- `public/examples/zodiacs-mcp-server-0.1.0-rc.8-to-rc.10-NOTICE.txt` names
  each archive by its digest, says that the MIT label covers the adapter's
  code, gives the work, its DOI and its licence, and asks that the notice be
  kept with any copy.
- `/developers/mcp/` links it.
- Archives from 0.1.0-rc.14 on declare `MIT AND CC-BY-4.0` and carry their
  own NOTICE.

## 2. What removing Swiss output covers (F-22)

The decision of 2026-09-28 §3 removes the raw Swiss fixtures and "raw Swiss
values in evidence folders", and keeps statistics and SHA-256 digests. The
independent review of the removal, on 2026-09-29, found Swiss material the
removal had left, of four kinds:

- Swiss Ephemeris source code: 148 lines of `swetest.c`, in the patch field
  of a commit receipt;
- per-case values that arithmetic on a stripped file still gives back;
- per-case Swiss figures on the site's own pages, and a test that reads one;
- figures quoted in the prose of dated evidence and audit records.

Decision: **code and data go everywhere; the product carries no Swiss value;
figures quoted in dated records stay as written.**

- **Code.** No Swiss Ephemeris source code anywhere in the tree. It is
  licensed under the AGPL or commercially, and this repository is all rights
  reserved. Scripts that call Swiss through pyswisseph stay, as the 2026-09-28
  decision allows.
- **Data.** No per-case Swiss value is kept as data anywhere. That covers a
  file, a field, a table, a list, or a script, and a value that arithmetic on
  what remains gives back, such as a difference kept beside the other term.
  A README table that lists Swiss's values case by case counts as data.
  Statistics and digests stay, including an extreme with the case it occurs
  at, such as the largest difference and its instant: it describes the
  comparison, and gives back at most one case for each statistic. The removal
  record names the reports that keep such extremes.
- **The product.** `src/` holds no Swiss value in any form, prose included,
  and neither does any package. The pages give statistics over a stated range
  instead of Swiss's value at one date, and tests read committed statistics.
- **Quoted figures in dated records.** Some figures are quoted in the prose
  of a dated evidence README, audit record or report, as part of the finding
  or analysis it records. They stay as written: they are cited facts in a
  historical record, not output kept for reuse, and removing them would
  change what the record says was found. The removal record names these
  files.
- **Enforcement.** The guard test fails on each of the first three:
  - a removed file's bytes under any name, archive members included;
  - a removed per-case value in any data file or anywhere in `src/`;
  - Swiss provenance markers in `src/`.

## 3. Published worked examples in tests

The handoff of 2026-09-28 says to use synthetic birth fixtures, and never to
turn personal information from a conversation into public test data. Several
of the brief's gates ask for "fixtures from a cited worked example": the
engine must reproduce a calculation a book prints. The books' examples are
charts of real people. Estadella's progression example (*Predictive
Astrology*, 3rd edition, 2019, pp. 84–85) is Charlie Chaplin's chart, and has
been in the engine's tests since rc.12. Saunders's profection examples
(pp. 3–5) are the charts of Christopher Reeve, Coretta Scott King and Diana,
Princess of Wales.

The review of rc.15's first cut removed every other real person's chart from
the engine's tests: four living people, the Kennedys, Presley and Kahlo.
Invented charts, counted by hand, replaced them.

Decision: **synthetic by default; a published worked example is allowed only
where a gate asks the engine to reproduce that book's printed result.**

- The person must have died, and the book must publish the data.
- The test cites the book and page, and uses the data only as the book
  prints it.
- No living person, no private individual, and nothing from a conversation.
- `CONTRIBUTING.md` and `AGENTS.md` in the engine repository state the rule,
  from rc.15. Every other fixture stays synthetic.

## 4. IERS EOP 20 C04 values in the engine package

From rc.15 the package carries UT1 − UTC for each day of 1972 from IERS EOP
20 C04, 367 values. The IERS Earth Orientation Centre publishes the series
freely, and IERS asks that its products be cited. Neither the file, its
readme nor the IERS pages state any other licence or terms. Values from the
same series have entered the ΔT table since rc.8, cited in the NOTICE.

Decision: **carry the 1972 values, cited in `LICENSING.md` and `NOTICE` with
the file's URL, retrieval date and SHA-256, and say plainly that no licence
is stated.** They are measurements, taken from one year of a series that runs
from 1962. If IERS states terms that forbid this, the next candidate takes
1972 from another source.

## 5. The hosted compute API's first version (P3.3)

The decision of 2026-09-28 §5 makes the compute endpoints free and anonymous,
on the existing Vercel project and plan, rate-limited per client address by
Vercel Firewall rules, each request under a compute budget, and with no
additional spending. Three facts found on 2026-09-29 shape how:

- The team is on Vercel Pro. Its Firewall rate limiting is billed per allowed
  request ($0.50 a million) from the plan's $20 monthly credit, which the
  project's other usage does not exhaust.
- No Firewall rule exists yet. Four endpoints already call the rate-limit SDK,
  and each passes every request while its rule is missing. The site's owner
  runbook (§3) makes publishing Firewall rules the owner's step.
- Production has no `PUBLIC_SUPABASE_URL`, so a request counter shared across
  function instances is not available without another owner step.

Decision: **six POST endpoints on the vendored engine, with per-address and
per-request limits, a switch to turn them off, and nothing about a request
kept anywhere.**

- **Endpoints.** `POST /api/v1/chart`, `/positions`, `/houses`, `/events`,
  `/time` and `/sky-fact`, served by one function. They sit beside the static
  sky data in the same `/api/v1` namespace and the same OpenAPI 3.1 document,
  with a JSON Schema and an example for every request and response.
- **Privacy.** Birth data, and anything from which it can be recovered, only
  in POST bodies: every other method is refused with 405, and query strings
  are ignored. Nothing from a request or a result is logged, stored or echoed
  in an error. A test runs every endpoint on canary inputs and fails if any of
  them reaches a log line, an error or a response header. Responses are not
  cached.
- **Limits.** A body over 16 KB is refused. Each endpoint has a compute budget:
  instants per request, bodies, the length of an events window. A request
  over its budget ends in a typed `budget-exhausted` refusal that names the
  limit, never a timeout.
- **Rate limit.** Per client address through the Firewall SDK, under the rate
  limit ID `zodiacs-compute-api`, at 60 requests a minute. Like the four
  existing endpoints, it passes requests until the owner publishes the rule;
  the owner's prompt adds the rule.
- **Switch.** `COMPUTE_API_ENABLED=0` turns the endpoints off with a 503 and a
  `Retry-After`. It is the answer if use approaches the plan's limits. Without
  a shared counter the endpoints cannot see total use themselves, so the
  programme checks the team's billing each week and records it.
- **Receipts.** Every response carries the engine's receipt and names its
  backend: `@zodiacs/engine` with its version, on astronomy-engine 2.1.19.
  The DE440 backend (P4.1) comes later and will be named the same way.
- **Measured before acceptance.** Latency (p50 and p95, warm and cold) and the
  cost of a thousand requests of each kind, on the deployed endpoints.

P3.3 counts as accepted when all six endpoints are deployed and its gate
holds: the negative-control test, receipts that name the backend, and the
latency and cost recorded.
