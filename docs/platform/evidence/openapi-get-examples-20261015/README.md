# OpenAPI examples for the static sky files (P3.4), 2026-10-15

P3.4 is not accepted: its gate also asks for a clean-consumer test of a
TypeScript and a Python client, and the clients are not released (below).

P3.4's gate is "schema validates every example; clean-consumer test per
client".

## The examples

`/api/v1/openapi.json` described its eleven GET operations, the static sky
files, with no example. Each now names one, `served`: its `externalValue` is
the file zodiacs.org serves at that path (`src/lib/sky-api/schemas.ts`).

- The daily files: `index.json`, `sky/today.json`, `sky/upcoming.json` and
  `signs.json`, and `planets/sun.json` for the body.
- The six yearly families: the edition's year where the family covers it,
  otherwise the first year it covers.
- The document grows from 422,364 to 425,196 bytes; the eleven files it points
  to come to 159,213 bytes (`aspects/2026.json` alone 57,482).

`scripts/sky-api.test.mjs` builds the files and takes the document's own
component schemas. For each GET operation, it checks that the example's file
matches the path template and that the response schema, resolved as the
document references it, validates the file. It runs in every build's test
suite.

The seven compute endpoints already carry an example of every request and
response, produced by their handler, and `tests/api/compute-api-openapi.test.ts`
validates each against its schema. So every body the document describes has an
example its schema validates; the CORS preflights (`OPTIONS`, 204) and the
files' 404s have no body.

## The clients

The TypeScript and Python clients exist in the engine repository as private
preparations, `@zodiacs/compute-client` 0.0.0 and `zodiacs-compute-client`
0.0.0, marked private and not for upload, with clean-consumer checks in its CI
(engine #34, #35). Releasing them is the owner's decision.

## Phase 1 captures

`src/lib/sky-api/schemas.ts` is one of the template sources the Phase 1
capture digest covers, so CI took the 18 captures again.

- **Committed captures.** Browser Evidence run 38645626700 took them on
  `98e3e63e`, the branch with main `75933efb` merged in, with Chromium
  149.0.7827.55 at 2026-10-14T22:14:14Z, for the 2026-10-14 edition, bound to
  template source digest `4fa75b03…`. Its build, acceptance captures,
  receipt, visual comparison, Lighthouse and explorer drive passed
  ([browser-evidence-provenance.json](browser-evidence-provenance.json) is the
  run's own record).
- **Against main's captures.** They show the same pages, layout and edition as
  main's, taken at 10:16Z the same day. Each differs from them in 0.17% to
  0.87% of its pixels, at the edges of glyphs across the page, as the two runs
  rasterized the text slightly differently. No layout or wording differs.
