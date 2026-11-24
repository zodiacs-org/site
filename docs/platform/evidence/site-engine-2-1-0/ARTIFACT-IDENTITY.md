# Engine 2.1.0 archive identity

The site installs `vendor/zodiacs-engine-2.1.0.tgz`. It is the archive npm
serves for `@zodiacs/engine@2.1.0`, the `latest` release since 2026-11-23.

- SHA-256: `272bf36f705d033a19a5ad87e0e17113d6e53f96a02331cddefe7b41597b4afc`
- SHA-512 (npm `dist.integrity`): `sha512-Gf6OVAL3UJYDdOBqet5JKXd0Y4BTspndHvHyigmdb15jxlz9Hlah3kM+hVJpI1g5+/tG8gD4x3josmLtA3hkBg==`
- SHA-1 (npm `dist.shasum`): `6e1e9ff0b67b09c1f02e7f217b7325049e62bb70`
- 2,790,732 bytes packed; 101 files; 4,781,846 bytes unpacked ([pack record](npm-pack.json), [registry read](npm-registry-2-1-0.json))
- Source commit: `92825deeeb5c74c5f56b37d5d612c3439347087e` ("Cut 2.1.0 for station and lunation search")
- Carrier commit: `933f953dae1b9523c2752ceafcd031b3e8c6e782`, merged into engine `main` by `566f858dde594439d5f78724f1d2e2df595da2c6` (engine pull request 153)
- Immutable download: https://raw.githubusercontent.com/zodiacs-org/engine/933f953dae1b9523c2752ceafcd031b3e8c6e782/artifacts/zodiacs-engine-2.1.0.tgz

The archive was copied from the carrier's git object (blob `906c2355df3e9cf8084f5b653280528f9017ded9`),
not downloaded. Its SHA-512 equals the registry's `dist.integrity`, so npm serves the same bytes.

The engine's own record of the release is its `CHANGELOG.md` (2.0.0 and 2.1.0) and
`docs/migrating-to-2.md`. Parity on Node 22 and Node 24 is in [node22-parity.json](node22-parity.json)
and [node24-parity.json](node24-parity.json), written by [parity.mjs](parity.mjs). A separate consumer
directory type-checked and ran the public chart, receipt and crossing example:
[public-consumer.log](public-consumer.log).
