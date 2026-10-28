# Engine 1.1.0-rc.1 artifact and consumer evidence

This record binds the vendored archive to its engine carrier and to finite
consumer checks, and records that npm does not carry it. It is not a
production-adoption record.

- Archive: `vendor/zodiacs-engine-1.1.0-rc.1.tgz`, with its receipt
  `vendor/zodiacs-engine-1.1.0-rc.1.sha256`.
- SHA-256: `52352d3f8fde4a262483e4a5a6217e02d814aa53269b49c0333325e6c0d6a7b6`.
- [Immutable engine carrier](https://raw.githubusercontent.com/zodiacs-org/engine/6ec3464c22581beca1b151b5bcd70fc040ca4adb/artifacts/zodiacs-engine-1.1.0-rc.1.tgz).
  The archive and receipt are written from the carrier's git objects (blob
  ids `d7167502a11e1ede20f6498de7d44b4e353a0241` and
  `8abeaeacd1a446ab71bdb35fdfc14fa5b0f1e0ee`).
- Source commit: `c41706266caf4dde7e03aaa18c08acd569d19a7e`. Carrier
  `6ec3464c22581beca1b151b5bcd70fc040ca4adb`, merged into engine main by
  `d9fc39cd4a81488b1bbee7e205901cdf2d755ef4` (zodiacs-org/engine#75).
  Conformance suite 0.2.0, whose summary the site copies, was merged by
  `7e64717bc7dd17f76d124138e811742b055c183a` (zodiacs-org/engine#76).
- 292,721 packed bytes; 77 files; 1,006,494 unpacked bytes.
- Licence: **MIT AND CC-BY-4.0**; the full NOTICE ships inside the archive,
  byte for byte 1.0.0's, as is LICENSING.md.
- npm: not published. [npm-view.txt](npm-view.txt), read on 2026-10-27, lists
  0.1.1-rc.14, 0.1.1-rc.15, 0.1.1-rc.16 and 1.0.0, with 1.0.0 under `latest`
  and 0.1.1-rc.16 under `next`, and answers that
  `@zodiacs/engine@1.1.0-rc.1` is not in the registry.
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
`scripts/verify-packed-consumer.mjs` at engine `d9fc39cd`, SHA-256
`a34d84fc…534f`; it adds a `conventionIds` check to the 1.0.0 record's. The
log is assembled from the two reports, with temporary paths redacted.

[node22-parity.json](node22-parity.json) and
[node24-parity.json](node24-parity.json) state the engine and archive
identity and the independent node/polar residuals; both pass. They were
measured on arm64, and their residuals are 1.0.0's arm64 reports' exactly.
Node 22 and 24 agree exactly. Finite agreement establishes consistency, not
independent astronomical accuracy.

This commit also carries the MCP adapter 0.1.0-rc.25 archive. These checks
publish neither package; neither is on npm.
