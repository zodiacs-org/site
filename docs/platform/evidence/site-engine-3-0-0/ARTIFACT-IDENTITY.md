# Engine 3.0.0 archive identity

The site installs `vendor/zodiacs-engine-3.0.0.tgz`, the engine's 3.0.0
archive. It is a vendored candidate: the engine records it as awaiting the
owner's review, neither tagged nor published, and npm has no 3.0.0. The
registry read of 2026-11-26 records `2.1.0` under `latest` and `2.0.0-rc.3`
under `next` ([npm-view.txt](npm-view.txt)).

- SHA-256: `0addb2f4d39ea4d8e87f54ad82a033a16a94859c78845f055d2208e04259a9a3`
- SHA-512 (the lockfile's `integrity`): `sha512-KzFYG4fnFEz88qW7gM1Sc0rMqDecjXmnap98pvje8yCVXIf0wmlIsLtk+6uviPIQqNxuDTQ2CicacMF8+/z/Mw==`
- SHA-1: `6f6daebda8183efa07a5e79d6e8574c1fdf8c617`
- 2,891,330 bytes packed; 107 files; 4,909,803 bytes unpacked
- Source commit: `2e4310ff42d4bc85cb5e33a5a4d9f3295fd36322` ("Cut 3.0.0: lightweight default, minor bodies, True Lilith, require(esm), ratchet and wheel 1.0.0")
- Carrier commit: `b5bfdb473b396a4f8c083e5689cf9560789784dd` ("Carry the packed 3.0.0 tarball"), on the engine's `admin/engine-3.0.0-r4` branch
- Immutable download: https://raw.githubusercontent.com/zodiacs-org/engine/b5bfdb473b396a4f8c083e5689cf9560789784dd/artifacts/zodiacs-engine-3.0.0.tgz

The archive and its SHA-256 receipt were copied from the engine repository's
carried files at the carrier (blobs `6682ca24f86ad2b0dc217c81694f55654d1dc79d`
and `b98b6e3e637b087ed143a96307b7be2cad39c662`), not downloaded.

The engine's own record of the release is its `CHANGELOG.md` (3.0.0) and the
"What 3.0.0 changes" section of its `docs/guide.md`. 3.0.0 computes on
astronomy-engine until `useDe440()` installs the shipped DE440 pack; the site
does that in every server process (`src/lib/engine/server-de440.mjs`).

- [values.json](values.json), written by [values.mjs](values.mjs), compares
  2.1.0 and 3.0.0 at 177 instants from 1795 to 2205, on DE440 (2.1.0's default,
  3.0.0 after `useDe440()`) and on astronomy-engine (each release's browser
  ephemeris): 1,416 results on each, and none differs in any field but
  `engineVersion`. `chartPoints` gains one row, True Black Moon Lilith, which
  no site code reads.
- Parity on Node 22 and Node 24 is in [node22-parity.json](node22-parity.json)
  and [node24-parity.json](node24-parity.json), written by
  [parity.mjs](parity.mjs): both give the January Neptune ingress at
  2026-01-26T17:34:38.263Z on DE440, as 2.1.0 does.
- Natal receipts name the same conventions as 2.1.0's
  ([de440-receipt-conventions.json](de440-receipt-conventions.json)).
- A separate consumer directory type-checked and ran the public chart, receipt
  and crossing example, with `useDe440()`:
  [public-consumer.log](public-consumer.log).
- The private-state review of the bundled compute and AI runtime inputs is
  [PRIVATE-STATE.md](PRIVATE-STATE.md).
