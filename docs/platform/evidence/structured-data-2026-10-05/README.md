# Structured data on the developer pages, 2026-10-05 (S1)

The ledger unit S1 asks for SoftwareApplication, SoftwareSourceCode, WebAPI
and Dataset markup on the developer pages, and that the markup validates.
Two checks hold it.

## The site's own check, on every build

`scripts/validate-schema.mjs` runs over the production build. It holds each
of the six developer pages to its contract in
`scripts/developer-structured-data-checks.mjs`, with the constants the pages
use (`src/lib/developer-structured-data.mjs`):

| page | nodes |
| --- | --- |
| `/developers/` | WebAPI (the static sky data), Dataset (its 43 files) |
| `/developers/engine/` | SoftwareApplication, SoftwareSourceCode |
| `/developers/mcp/` | SoftwareApplication |
| `/developers/compute/` | WebAPI |
| `/developers/conformance/` | Dataset (the three vector files) |
| `/developers/sky-benchmark/` | Dataset (items, key, tool answers) |

Every value the markup states is held to the record it comes from: versions
and downloads to the engine's candidate record and the MCP manifest, the
conformance files to the commit they were copied from, each licence to the
release's, spans and file lists to the data, and every URL on zodiacs.org to a
file the build serves. `scripts/developer-structured-data-checks.test.mjs`
tests the check. Fifteen faults put into a built copy of the pages, one at a
time, each failed it; the pull request lists them.

## schema.org's vocabulary, once

`tools/check-vocab.py` reads schema.org's vocabulary and holds every JSON-LD
node on the six built pages to it: each type is a schema.org type, each
property a schema.org property that applies to the node's type or a type it
inherits from, and each typed value a type the property takes. The
vocabulary was schema.org's current release on 2026-10-05, listed as V30.1
on its releases page: `schemaorg-current-https.jsonld`, 1,521,575 bytes,
SHA-256 `0a4b8c4c910fc831ec8695196510973390906a5ee34dc6b862dfec4d21a12f74`.
It is schema.org's file and is not copied here.

The result is in `vocab-check.txt`: 97 typed nodes of eleven types, 0
errors. The 29 notes are two forms that schema.org lists as other types and
that the site uses on every page: the logo's width and height as numbers, and
each breadcrumb item as its URL, which is the form Google's breadcrumb
documentation shows. The same script, given a page with an unknown property,
a property on the wrong type, a value of the wrong type and an unknown type,
reported all four.

## Not checked

- Google's Rich Results Test and other search engines' validators were not
  run; they read some properties more narrowly than schema.org.
- The vocabulary check ran on one build, not on every build.
