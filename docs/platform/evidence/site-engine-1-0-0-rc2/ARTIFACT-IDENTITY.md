# Engine 1.0.0-rc.2 artifact and consumer evidence

This record binds the vendored candidate to its existing engine carrier and
finite consumer checks. It is not a production-adoption or npm-release record.

- Archive: `vendor/zodiacs-engine-1.0.0-rc.2.tgz`.
- SHA-256: `4cd834b2dca085cd5732ecad6edbd82b61d7625d9a0647900c160a0747810002`.
- [Immutable engine carrier](https://raw.githubusercontent.com/zodiacs-org/engine/e790362bddf28016405df4164e66baea057c4f19/artifacts/zodiacs-engine-1.0.0-rc.2.tgz).
- Source commit: `7fa964d2a77d09dbb819b5733b36e303fc7fc513`.
- 287,011 packed bytes; 74 files; 989,528 unpacked bytes.
- Licence: **MIT AND CC-BY-4.0**; the full NOTICE ships inside the archive.

The actual packed consumer harness passes public examples and TypeScript
checks on Node 22.22.2 and 24.19.0. [public-candidate-consumer.log](public-candidate-consumer.log)
is assembled from those two reports, with temporary directory names redacted.
[node22-parity.json](node22-parity.json) and [node24-parity.json](node24-parity.json)
state the engine and archive identity, exact same-process comparisons, and
independent node/polar residuals. Finite agreement establishes consistency,
not independent astronomical accuracy or a universal guarantee.

The engine is an unpublished candidate. This carrier preserves the MCP
0.1.0-rc.18 archive as well; neither package is published by these checks.
