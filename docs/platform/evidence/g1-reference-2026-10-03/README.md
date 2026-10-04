# G1: rc16 API reference outside /sdk/

Local implementation for independent review, based on site
`076540b69123b353b6cdbac9054b3c60fb438846`. No push, pull request, deployment,
repository settings change or programme acceptance is part of this record.
`acceptance-ledger.json`, `LEDGER.md` and `STATUS.md` remain unchanged under the
owner's bookkeeping publication hold.

## Contract and provenance

The original gate is Track G, G1 in `docs/platform/ENGINE-AND-PLATFORM-BRIEF.md`:
an engine documentation home outside `/sdk/`, a suitable repository identity,
and no ownership or token framing. Repository description/topics/homepage were
freshly checked by the parent task; this implementation makes no metadata
mutation and does not independently claim a new remote metadata verification.

At the base commit, the site's only committed generated engine reference is
`public/sdk/engine/`: its index says `0.1.1-rc.1` and canonicalizes to
`https://zodiacs.org/sdk/engine/`. There is no newer reference in the site's
committed developer tree. The engine's existing `typedoc.json` and
`scripts/typedoc-canonical.mjs` at the rc16 source already target
`/developers/engine/reference/`, with `noindex,follow`, but do not put that
output into the site. The existing dense sign-rail footer is a sanctioned
TypeDoc exception in `CLAUDE.md`.

Live route checks in this environment could not verify deployment: the HTTP
proxy rejected the CONNECT request with 403. No retry or alternate route was
used after identifying that restriction. Repository evidence establishes the
implementation gap here; it does not establish current production state.

Release identities:

- Version: `@zodiacs/engine` `0.1.1-rc.16`.
- Source: `zodiacs-org/engine` commit
  `ddbbaa0b1d21e16834722f81e8708816849c6726`.
- Archive carrier: `ef44477f85f28a57d5ec7f61ed6ea6a99c4be563`,
  `artifacts/zodiacs-engine-0.1.1-rc.16.tgz`.
- Archive SHA-256:
  `43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`.
- Local archive: `vendor/zodiacs-engine-0.1.1-rc.16.tgz`, unchanged.

The source commit was extracted with `git archive`, installed using its own
lockfile and rebuilt on Node **22.22.2**. All **69** packed files, including
compiled JS, declarations, manifest, README and notices, equal the rebuilt
source tree byte for byte: `source-comparison.json`. This is a package/source
binding check, not new accuracy evidence or a new package publication.

## Generation and API boundaries

`node scripts/build-engine-reference.mjs` delegates to the isolated generator
in `scripts/engine-reference/build.mjs`. TypeDoc **0.28.20** and TypeScript
**5.9.3**, plus transitive tools, are pinned by that directory's lockfile.
The site's root package manifest and lockfile stay unchanged.

The generator verifies the candidate's version, source, archive URL and digest
against explicit rc16 pins, extracts the existing archive to a temporary
directory, and documents its unmodified declarations. These declarations are
exactly what consumers receive, including their documentation comments.
TypeScript independently enumerates every export of each public entry point;
the generator refuses a mismatch with TypeDoc's reflected names. The result
covers **12 public entry points and 521 exported names across those entries**
(some names are re-exported in multiple entries), rendered as **514 HTML pages**.

The original generator listed ten source entry points. The two additions,
`/crossings` and `/deltat`, are explicitly documented public standalone imports
in the source and CONTRIBUTING contract and appear in the package exports.
`/internal` and `/internal/math` remain excluded: their source comments and
CONTRIBUTING say they exist for site compatibility and carry no public API or
semantic-versioning promise. Their exclusion is explicit on the reference
home and in `provenance.json`; no public API was invented from private source.

The package's **MIT AND CC-BY-4.0** expression stays explicit. The release's
`LICENSE`, `LICENSING.md`, `NOTICE` and `README.md` are copied byte for byte into
`release/*.txt`, with hashes in `provenance.json`. Unsettled licensing conditions
are preserved, not treated as resolved. The README is labelled a historical
release snapshot because its original registry statements remain unchanged.
TypeDoc's Apache-2.0 licence is included for its generated presentation.
No individual author or reviewer is invented.

The TypeDoc CSS follows the existing engine stylesheet's layout and compact
footer, with neutral accents and the site's self-hosted display/body/code
fonts. Long source commits and archive digests wrap on mobile. Original
`public/sdk/` bytes are untouched. The new route retains the existing generator's
self-canonical, `noindex,follow` contract and links back to the engine landing,
current editorial-system anchor, source and notices.

## Checks and reproduction

Use the repository's Node 22 runtime (`.nvmrc`; this run used 22.22.2):

```sh
npm ci
npm ci --prefix scripts/engine-reference --ignore-scripts
node scripts/build-engine-reference.mjs --check
npm run build
npm run check
npx vitest run scripts/engine-reference.test.mjs scripts/check-developer-authorship.test.mjs scripts/consumer-copy-lib.test.mjs scripts/engine-demo.test.mjs scripts/engine-install-block.test.mjs
node scripts/check-engine-reference.mjs dist
node scripts/check-developer-authorship.mjs
node tests/engine-reference-drive.mjs
node tests/platform-developers-drive.mjs
node scripts/phase1-scope-guard.mjs --base 076540b69123b353b6cdbac9054b3c60fb438846
node scripts/programme-ledger.mjs --summary
```

The generator's `--check` rebuilds into a new temporary directory and compares
all output paths and bytes. CI runs this after the ordinary build, together
with the reference output validator, focused regression tests and browser
drive. S6 stays immediately after the build; its required route inventory now
includes the reference index, module index, provenance and all four unchanged
release documents, while recursive scanning covers every reference page.
Its negative controls now also inject forbidden authorship in the new tree.

The built-site link gate exposed an incorrect guessed editorial anchor; it was
corrected to the existing `#editorial-system`. The unchanged release comment
“fail-closed” is technical API documentation. The consumer-copy method-first
allowlist now includes only `/developers/engine/reference/`, matching the
existing `/sdk/` treatment; negative tests retain checking of the developer
landing and similarly named neighbouring routes. No token-boundary rule was
relaxed and no release limitation was rewritten to satisfy a copy guard.

Validation outcomes and limitations are in `verification.json`. The earlier
attempt to use root devDependencies invalidated editorial provenance; that
approach was removed, the original root manifests restored, and the final
build uses isolated documentation tooling. Astro telemetry was disabled for
this environment's build (`ASTRO_TELEMETRY_DISABLED=1`) rather than creating
configuration outside the workspace. No application feature flag was changed.
