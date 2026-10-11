# Engine 1.0.0 artifact and consumer evidence

This record binds the vendored archive to its engine carrier, to the tarball
npm publishes, and to finite consumer checks. It is not a production-adoption
record.

- Archive: `vendor/zodiacs-engine-1.0.0.tgz`, with its receipt
  `vendor/zodiacs-engine-1.0.0.sha256`.
- SHA-256: `c4d3754de899fb98882331e6d7b9ce3ce77fb2072baeb002aa0ef8c77b0ab0f6`.
- [Immutable engine carrier](https://raw.githubusercontent.com/zodiacs-org/engine/38d31854e5716454921b6ce8a211788a0984328e/artifacts/zodiacs-engine-1.0.0.tgz).
  The archive and receipt are written from the carrier's git objects (blob
  ids `5912e2405529bedee7ad98b637dda04cbed83134` and
  `4595a764df627415b6ea10f863042d19d0444239`).
- Source commit: `ca2c8cefbaa1a9d6f5f78ee86713e813633942ca`. Carrier
  `38d31854e5716454921b6ce8a211788a0984328e`, merged into engine main by
  `f8992a4c1dfedd9e69c0783e2c185e22580460f7` (zodiacs-org/engine#39).
- 288,063 packed bytes; 74 files; 991,915 unpacked bytes.
- Licence: **MIT AND CC-BY-4.0**; the full NOTICE ships inside the archive.
- npm: `@zodiacs/engine@1.0.0`, published at 2026-10-11T13:54:56Z under
  `latest` by the engine's Release workflow (run 38144970198).
  [npm-registry.json](npm-registry.json) is the site's registry tool's read of
  2026-10-11T14:20:52Z:
  - npm's SHA-1 and SHA-512 are this archive's;
  - the SLSA provenance names `.github/workflows/release.yml` on engine main at
    `f8992a4c1dfedd9e69c0783e2c185e22580460f7`, with this archive's SHA-512 as
    its subject;
  - `npm audit signatures`, in a clean install of the version, found no invalid
    or missing signature and one verified attestation.

The engine's packed-consumer harness passes every check, its public examples
and its TypeScript check, on Node 22.22.2 and 24.21.0 (macOS arm64):
[public-consumer.log](public-consumer.log). The harness is
`scripts/verify-packed-consumer.mjs` at engine `f8992a4c`, SHA-256
`a484a038…e4d7`, the same file the 1.0.0-rc.2 record used. The log is
assembled from the two reports, with temporary paths redacted.

[node22-parity.json](node22-parity.json) and
[node24-parity.json](node24-parity.json) state the engine and archive
identity and the independent node/polar residuals; both pass. They were
measured on arm64. Two of their 28 residual numbers differ from 1.0.0-rc.2's
x86-64 report, by at most 1.14e-13 degree per day (site FINDINGS F-82). Node
22 and 24 agree exactly. Finite agreement establishes consistency, not
independent astronomical accuracy.

This commit also carries the MCP adapter 0.1.0-rc.19 archive. These checks
publish neither package; the adapter is not on npm.
