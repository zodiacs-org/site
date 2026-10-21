# The conventions registry (R44), 2026-10-18

R44 asks for a "conventions registry begun as the receipt vocabulary, with
ids, definitions and URIs on zodiacs.org". Its gate is "registry published;
receipts and conformance vectors use its ids". The brief (§4.4) describes it
as a canonical id and definition for every convention, such as
`zodiac:tropical`, `house:placidus` or the ΔT model, each citing its source,
with the URIs on zodiacs.org.

## What it is

- **The registry.** `src/data/conventions/registry.json`, version
  2026-10-18. It holds 154 ids in 57 namespaces, from @zodiacs/engine 1.0.0
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
  void-of-course rule and bodies. The chart and houses endpoints answer with
  the engine's own natal receipt instead, which names no endpoint, so
  `endpoint` holds the other five.
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

  It also checks the other way, for the namespaces whose values only
  receipts give: the coverage statements, the compute API's own fields and
  the ephemeris. Each of their ids must be one these receipts name. A
  review found `endpoint:chart` and `endpoint:houses` listed, though no
  receipt names them.
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

#781 merged as `e024e602` on 2026-10-20 at 17:51 (Asia/Bangkok). Before the
merge, this branch took main five times, most recently `4a12a5d0`. Eight
code reviews found two things, both fixed:

- two endpoint ids that no receipt names;
- the page missing from the structured-data contract.

The full suite and the private search passed before each push, and CI
passed 22 of 22 on the last head, `aebbc2db`. Along the way the CI runs met
timing checks on pages this change does not touch:

- the WebKit sharing drive;
- Lighthouse on `/thesis/` and `/ru/birth-chart/`;
- the `/es/learn/` footer drive, which #790 fixed;
- the `/today/` fixture for 2026-10-20, which #800 fixed.

Built from main and from the branch, those pages and every asset they load
are byte-identical.

`tools/conventions-check.mjs` reads the registry at a commit and checks what
a site serves of it:

- the page, with exactly one anchor per id and a link to each id's address;
- Chromium opening every id's address, the page's URL with the id as its
  fragment, and landing on that id's entry (`:target`), and landing on
  nothing for a made-up id;
- `registry.json`, equal to the commit's registry with each id's address
  added;
- the Markdown twin, which names every id;
- the links from the developer index, the conformance page, `llms.txt` and
  the sitemap.

Given the alias facts, it first checks that zodiacs.org's alias names a
READY production deployment built from a commit that contains the given
one. Run it from the repository's root after `npm ci`:
`node docs/platform/evidence/conventions-registry-20261018/tools/conventions-check.mjs <alias.json or -> <commit> <out.json> [base URL]`.
With `CONVENTIONS_CHECK_CONTROL=renamed-id` it expects the registry with its
first id renamed.

| Report | Against | Passed |
| --- | --- | --- |
| `production/production.json` | zodiacs.org at `dpl_FDD6j9M53T9Hr1bKC4y18AsjuY97`, built from `81c8a38f`, which contains the merge | 12 of 12 |
| `production/control-renamed-id.json` | the same, expecting the merge's registry with its first id renamed | 7 of 12 |
| `production/production-at-merge.json` | zodiacs.org at `dpl_CWXDN5g3RDHy9UaWBT5DYmWGY5Kg`, built from the merge `e024e602` | 12 of 12 |
| `production/control-renamed-id-at-merge.json` | the same, with the first id renamed | 7 of 12 |
| `production/control-before.json` | zodiacs.org after the merge, before its deployment: `dpl_4SDHRDx97…`, built from `b35d0f01` | 0 of 11 |
| `production/local.json` | the record branch's build (`91846898`, the merge's registry), served locally | 11 of 11 |

- **The control with one id renamed** fails exactly the five checks that
  read the ids: the anchor, the link, Chromium's landing, the JSON and the
  twin.
- **The twin's check** counts whole entries, each `` - `id`: ``, since the
  review of #813. A substring match would pass a twin that lost
  `house:equal` but kept `house:equal-mc`.
  - `production.json`, `control-renamed-id.json` and `local.json` were
    written with that check.
  - The `-at-merge` reports and `control-before.json` were written before
    it.
  - The page, the JSON and the twin served at the merge's deployment are
    byte for byte the ones served at `dpl_FDD6j9M5…`: the reports' SHA-256
    digests match, and no file of the registry changed between `e024e602`
    and `81c8a38f`.
- **Before the deployment** the page, the JSON and the twin were 404, and
  nothing linked to them.
- **The alias facts** are in `production/alias.json` (at the check),
  `production/alias-at-merge.json` and `production/alias-before.json`. Each records only the deployment, when the
  alias last moved, its state, its target and its commit.

Main's Site Check on the merge, [run 39410915393](https://github.com/zodiacs-org/site/actions/runs/39410915393),
passed on its second attempt, at 21:02 (Asia/Bangkok). Its first attempt
failed only the Phase 3 push drive, on the `/today/` sky ticker's known
layout shift of 0.00087. `AGENTS.md` gives that check exactly one rerun.

## What R44 still needs

The brief's §4.4 asks that "every receipt, API field and conformance vector
uses these ids". The registry is published, and its tests hold it to every
value these payloads carry. But only calc receipts write the ids themselves,
such as `frame:ecliptic-j2000`. Natal and compute API receipts and the
conformance vectors hold a field and a bare value, such as
`conventions.zodiac` "tropical" or `kind` "houses.cusps". The registry's
rule maps each to an id, but the payloads do not carry the id (the review
of #813). R44 stays partial until they do, or until the owner revises
the gate. Carrying the ids needs three things:

- an engine release whose natal receipts carry them;
- a change to the site's compute receipts;
- a conformance suite release whose vectors carry them.
