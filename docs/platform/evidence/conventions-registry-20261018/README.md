# The conventions registry (R44), 2026-10-18

R44 asks for a "conventions registry begun as the receipt vocabulary, with
ids, definitions and URIs on zodiacs.org". Its gate is "registry published;
receipts and conformance vectors use its ids". The brief (§4.4) describes it
as a canonical id and definition for every convention, such as
`zodiac:tropical`, `house:placidus` or the ΔT model, each citing its source,
with the URIs on zodiacs.org.

## What it is

- **The registry.** `src/data/conventions/registry.json`, version
  2026-10-18. It holds 156 ids in 57 namespaces, from @zodiacs/engine 1.0.0
  (commit `7307665`) and conformance suite 0.1.0. Each id has a title, a
  definition, its sources and a status. It is dedicated to the public domain
  under CC0 1.0, as the conformance suite is.
- **Published at three addresses:**
  - `/developers/conventions/`, where every id has an anchor of its own.
    Its address is the page's URL with the id as the fragment:
    `https://zodiacs.org/developers/conventions/#zodiac:tropical`.
  - `/developers/conventions/registry.json`, the registry with each id's
    address.
  - `/developers/conventions.md`, its Markdown twin.

  `/developers/`, the conformance page, both llms files and the sitemap list
  it.
- **An id** is a namespace, a colon and a value. The value is everything
  after the first colon and may hold semicolons, slashes or an @.

## How receipts and vectors use its ids

The registry began as the receipts' own vocabulary, so it holds the values
the receipts already write.

- **Calc receipts** (`zodiacs.calc-receipt.v1`) list their conventions as
  ids already, such as `frame:ecliptic-j2000`. `docs/calc.md` in the engine
  defines them. The registry holds every one of them.
- **Natal receipts** (`zodiacs.calculation-receipt.draft-v1`) hold a
  conventions set, one value per field. A receipt whose `conventions.zodiac`
  is `tropical` names `zodiac:tropical`. The registry holds every value of
  the five sets the engine reads.
  - **Current:** 13 ids, written since 0.1.1-rc.16.
  - **Superseded:** 7 ids, written by rc.3 to rc.15 and still read, each with
    the versions that wrote it.
  - **Other fields:** the house systems, the reason a chart has no houses,
    the chart flags, the reference instant, the instant's scale, the
    ephemeris (`ephemeris:astronomy-engine@2.1.19`), and the coverage
    statements.
- **The time records** of each instant: the ΔT model and segment, the time
  basis, and the source of UT1 − UTC. `deltat-segment:fallback` is marked
  superseded: only rc.15's first cut wrote it.
- **Compute API receipts** (`zodiacs.compute-receipt.v1`) carry the engine's
  conventions and coverage. They add the endpoint, the local-time policy,
  the search solver, window and completeness, and the election search's
  void-of-course rule and bodies.
- **Conformance vectors** name a `kind` and an `arbiter`. The registry holds
  each as `kind:<kind>` and `arbiter:<arbiter>`, tied to its vector file by
  that file's SHA-256 in `src/data/conformance/summary.json`. Each arbiter's
  entry carries the source the suite gives it.

The definitions are taken from the engine's own documentation and source:
`docs/calc.md`, `docs/vedic.md`, `docs/time.md`, the README's house systems,
`src/receipt.ts` and `src/deltat.ts`. They cite those, at commit `7307665`,
and the primary sources they name, such as the IAU 2006 precession, the IAU
2000B nutation and Stephenson, Morrison and Hohenkerk (2016). Each ayanamsa
takes its label and citation from the engine's `AYANAMSAS`.

## Tests

`tests/conventions-registry.test.ts` runs the engine and reads the compute
API's documented answers.

- **Hygiene.** Every id is its namespace and value, once, with a definition,
  a source and a status. A superseded id names the versions that wrote it.
- **The natal sets.** Every value of every natal conventions set is in the
  registry. It is current exactly when 1.0.0 writes it, and it names the
  versions that wrote it.
- **Calc ids.** The calculation conventions are exactly the ids calc
  receipts write, beside the natal sets' values. The test calls calc for
  every frame, center and correction, every body, each ayanamsa, a pinned
  ΔT, both scales, each house system, a polar fallback, a chart and an event
  search, and finds 66 ids.
- **Engine values.** Ayanamsas, house systems and frames match the engine's
  exports. The ayanamsas' labels and citations are the engine's.
- **Closed vocabularies.** The flags, references, scales, ΔT segments,
  absence reasons, time bases, ΔT models and UT1 sources are exactly the
  engine's TypeScript unions. A compile-time check fails if the engine adds
  a value.
- **Every receipt's ids.** Every id these receipts name is in the registry:
  - natal receipts across untimed, polar, outside-the-span, flagged,
    utc-noon and TT and UT1 charts;
  - the calc receipts above;
  - the compute API's documented receipt for every endpoint.
- **The conformance vectors.** The kinds and arbiters are exactly the
  suite's, each tied to its vector file.
- **The JSON.** It gives every id an address that decodes back to the id.

With an id a receipt uses removed, an id calc does not write added, and an
ayanamsa's label changed, four of the eight tests fail.

`scripts/check-dist.mjs` checks the built site. Every id must have its anchor
on the page, and `registry.json` must give every id, in order, with its
address. `scripts/check-developer-authorship.mjs` lists the page and both
twins.

`docs/claims/ledger.json` lists the 84 sentences that the claims extractor
selects from the registry, its page and its llms line:

- 46 make claims the ledger already evidences, such as the time basis, the
  ΔT model, the reference span and the conformance suite;
- 3 make a new claim, `product.conventions-registry`, whose evidence is the
  registry, its tests and the check on the built site;
- 35 are definitions, citations of the engine's documents, or third parties'
  sources.

## In production

To be recorded after the merge.
