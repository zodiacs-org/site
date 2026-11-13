# Engine 1.1.0-rc.2 artifact and consumer evidence

This record binds the vendored archive to its engine carrier and to finite
consumer checks, and records that npm does not carry it. It is not a
production-adoption record.

- Archive: `vendor/zodiacs-engine-1.1.0-rc.2.tgz`, with its receipt
  `vendor/zodiacs-engine-1.1.0-rc.2.sha256`.
- SHA-256: `c5aef0e3f20a19cf7ffabc99112cf592045199d6803814cf4ef6ea013615351c`.
- [Immutable engine carrier](https://raw.githubusercontent.com/zodiacs-org/engine/59c6ea9d9a4e7845a2880aa8303fcaadbd645170/artifacts/zodiacs-engine-1.1.0-rc.2.tgz).
  The archive and receipt are written from local git objects of the engine
  (blob ids `413e847346536b23c089e7f63c87f3be344a7c21` and
  `34ba7c9a77f0e5574e7e32f32895636ce828fc53`), not downloaded. Those are the
  blobs of `artifacts/zodiacs-engine-1.1.0-rc.2.tgz` and
  `artifacts/zodiacs-engine-1.1.0-rc.2.sha256` at the carrier and, read from
  GitHub on 2026-11-04, at engine main `883371f5`.
- Source commit: `806f76b43c0ee652016fe1b522c02d6f6e9c7ae5`. Carrier
  `59c6ea9d9a4e7845a2880aa8303fcaadbd645170`, merged into engine main by
  `883371f5d592cd952873422f13766038fcfa7b68` (zodiacs-org/engine#82, a merge
  commit with parents `a2539735` and `d8770a15`).
- 318,004 packed bytes; 90 files; 1,096,783 unpacked bytes. The receipt
  checks (`shasum -a 256 -c`), and the package npm installed from the archive
  (`npm install --no-audit --no-fund file:vendor/zodiacs-engine-1.1.0-rc.2.tgz`)
  equals the archive's files byte for byte (`diff -r` against the extracted
  archive). The install changes one dependency line of `package.json` and
  four lines of the lock; those two files are committed later, with F-53's
  parity record (`time-entry/`), before any import changes.
- Licence: **MIT AND CC-BY-4.0**; the full NOTICE and LICENSING.md ship
  inside the archive. Both differ from 1.1.0-rc.1's, which the F-89 wording
  corrections of this candidate change; LICENSE is byte for byte
  1.1.0-rc.1's.
- npm: not published. [npm-view.txt](npm-view.txt), read on 2026-11-04,
  lists 0.1.1-rc.14, 0.1.1-rc.15, 0.1.1-rc.16 and 1.0.0, with 1.0.0 under
  `latest` and 0.1.1-rc.16 under `next`, and answers that
  `@zodiacs/engine@1.1.0-rc.2` is not in the registry.
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
`scripts/verify-packed-consumer.mjs` at engine main `883371f5` (blob
`04872ed16b51d974eab31c1e8ef7641b1c446b1e`, the same at the source commit),
SHA-256 `9394eea8…87a5`; beside 1.1.0-rc.1's checks it imports the two new
entry points, `./time` (`timeEntry`) and `./lite` (`liteEntry`). Each run
installed the archive and TypeScript 5.9.3 offline, from npm's cache, into a
temporary consumer that it removed. The log is assembled from the two
reports, with temporary paths redacted.

[node22-parity.json](node22-parity.json) and
[node24-parity.json](node24-parity.json) state the engine and archive
identity and the independent node/polar residuals; both pass. They were
measured on arm64, and their residuals, maxima and fixture and policy digests
are 1.1.0-rc.1's arm64 reports' exactly. Node 22 and 24 agree exactly; the two reports
differ only in `generatedAt`, `node`, `icu` and `tzdata`. Finite agreement
establishes consistency, not independent astronomical accuracy.

Controls, each run once and each failing as it must:

- the receipt, checked against a scratch copy of the archive with one byte
  changed (byte 1,000), reports `FAILED`;
- the parity report, run on a scratch copy of its fixture with one digit
  changed, stops at its own pin of the fixture's SHA-256 (`AssertionError`)
  before it measures anything.

Unlike 1.1.0-rc.1's carry, this commit carries no MCP adapter archive: the
adapter bundles the site's time basis, so its 0.1.0-rc.26 archive is built
after the switch to `@zodiacs/engine/time`, in the adoption commit. These
checks publish no package; nothing here is on npm.
