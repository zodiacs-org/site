# Engine 1.1.0-rc.3 artifact and consumer evidence

This record binds the vendored archive to its engine carrier and to finite
consumer checks, and records that npm does not carry it. It is not a
production-adoption record; P4.1's own record is
[../de440-hosted-20261109/README.md](../de440-hosted-20261109/README.md).

- Archive: `vendor/zodiacs-engine-1.1.0-rc.3.tgz`, with its receipt
  `vendor/zodiacs-engine-1.1.0-rc.3.sha256`.
- SHA-256: `3272dcd30264a153c6a89412bb6bc2ba3b6f72b7e9284f95e29b44d73bdff590`.
- [Immutable engine carrier](https://raw.githubusercontent.com/zodiacs-org/engine/d2794d2def08480510b59753b59b5b9763411647/artifacts/zodiacs-engine-1.1.0-rc.3.tgz).
  The archive and receipt are written from local git objects of the engine
  (blob ids `0c3ed7a360ae6191385eb5ac8e927f963f974739` and
  `fc4e3cb354a4eee340183228a1a3284e01a96a8f`), not downloaded. Those are the
  blobs of `artifacts/zodiacs-engine-1.1.0-rc.3.tgz` and
  `artifacts/zodiacs-engine-1.1.0-rc.3.sha256` at the carrier and, read from
  GitHub on 2026-11-10, at engine main `bc0b5a76`.
- Source commit: `cc910b3775e279222e23af0b395bb6f2b51a3c3a`. Carrier
  `d2794d2def08480510b59753b59b5b9763411647`, merged into engine main by
  `bc0b5a769ad2cfb17e1f853b94d94eb271fdd56d` (zodiacs-org/engine#84, a merge
  commit with parents `883371f5` and `a9ec699e`; `a9ec699e` records the gates
  on the carrier).
- 331,979 packed bytes; 94 files; 1,142,818 unpacked bytes. The receipt
  checks (`shasum -a 256 -c`), and the package npm installed from the archive
  (`npm install --no-audit --no-fund file:vendor/zodiacs-engine-1.1.0-rc.3.tgz`)
  equals the archive's files byte for byte (`diff -r` against the extracted
  archive, checked again on 2026-11-10 after the regeneration).
- Licence: **MIT AND CC-BY-4.0**; the full NOTICE and LICENSING.md ship
  inside the archive. Both differ from 1.1.0-rc.2's, which they extend with
  the DE440 entry's attribution and the chunk the nutation module is built
  into; LICENSE is byte for byte 1.1.0-rc.2's.
- npm: not published. [npm-view.txt](npm-view.txt), read on 2026-11-10,
  lists 1.0.0 under `latest` and 0.1.1-rc.16 under `next`, and answers that
  `@zodiacs/engine@1.1.0-rc.3` is not in the registry.
  [npm-registry-1-0-0.json](npm-registry-1-0-0.json) is the site's registry
  tool's read of 1.0.0 the same day (`site-engine-1-0-0-rc2/tools/npm-registry-read.mjs`):
  - npm's SHA-1 and SHA-512 are still those of `vendor/zodiacs-engine-1.0.0.tgz`;
  - the SLSA provenance names `.github/workflows/release.yml` on engine main
    at `f8992a4c1dfedd9e69c0783e2c185e22580460f7`, as on 2026-10-11;
  - `npm audit signatures`, in a clean install of 1.0.0, found no invalid or
    missing signature and one verified attestation.

The engine's packed-consumer harness passes every check, its public examples
and its TypeScript check, on Node 22.22.2 and 24.21.0 (macOS arm64):
[public-consumer.log](public-consumer.log). The harness is
`scripts/verify-packed-consumer.mjs` at the source commit `cc910b3` (blob
`1bd4843fd2ca8f34630b21544ea13a115ef91f72`, the same at engine main
`bc0b5a76`), SHA-256 `1db77e07…d7f4`; beside 1.1.0-rc.2's checks it imports
the new entry point, `./de440`, which must refuse bytes that are not a pack,
and runs `positions` inside the root's `withEphemeris` with a stand-in source
(`de440`), and its TypeScript check types both. Each run installed
the archive and TypeScript 5.9.3 offline, from npm's cache, into a temporary
consumer that it removed. The log is assembled from the two reports, with
temporary paths redacted.

[node22-parity.json](node22-parity.json) and
[node24-parity.json](node24-parity.json) state the engine and archive
identity and the independent node/polar residuals; both pass. They were
measured on arm64, and their residuals and maxima are 1.1.0-rc.2's arm64
reports' exactly; the fixture's digest moved only because the rebuilt
reference records the new engine version (D-9 kept the base's bytes
otherwise). Node 22 and 24 agree exactly; the two reports differ only in
`generatedAt`, `node`, `icu` and `tzdata`. Finite agreement establishes
consistency, not independent astronomical accuracy.

Controls, each run once on 2026-11-10 and each failing as it must:

- the receipt, checked against a scratch copy of the archive with one byte
  changed (byte 1,000), reports `FAILED`;
- the parity report, run on a scratch copy of its fixture with one digit
  changed, stops at its own pin of the fixture's SHA-256 (`AssertionError`)
  before it measures anything.

The MCP adapter's 0.1.0-rc.27 archive, which bundles 1.1.0-rc.3, is built in
the adoption commit, as rc.26's was. These checks publish no package;
nothing here is on npm.
