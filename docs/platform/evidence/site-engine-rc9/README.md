# Engine rc.9 site adoption evidence

The site installs the exact archive
[zodiacs-engine-0.1.1-rc.9.tgz](https://raw.githubusercontent.com/zodiacs-org/engine/fa1050e033a197b117868ce546d85352bff35376/artifacts/zodiacs-engine-0.1.1-rc.9.tgz),
SHA-256 `bb5592302b1fa542cc745a9410b5a77faf49bbf4e205347ab771810efc300a20`,
from `vendor/`.

- It was packed from the root of [zodiacs-org/engine](https://github.com/zodiacs-org/engine) at source commit `82aad2fcc9b204a687e0b67f709681e62f9e889a`.
- The artifact carrier is `fa1050e033a197b117868ce546d85352bff35376`.
- The engine's merge commit `51523728679d5c1eed219283cc74d5adba54ec9e` carries the same bytes.
- Two clean clones of the source commit packed the same bytes.
- An anonymous read of that address on 2026-09-26 returned HTTP 200 and the same 55,576 bytes, with 30 archive members.

The package is an unpublished candidate: `npm view @zodiacs/engine` returns 404.

## What rc.9 changes

rc.9 adds nine house systems, for twelve:

- the three the engine already had: whole sign, Placidus and Porphyry;
- Koch, Regiomontanus, Campanus, Topocentric (Polich–Page), Alcabitius, Equal, Vehlow, Meridian (axial rotation) and Morinus.

Each follows the definition Swiss Ephemeris uses. [`../houses-2026-09-26/`](../houses-2026-09-26/README.md) measures them against Swiss. Given the same sidereal time, latitude and obliquity, the new systems agree with Swiss to within 0.00005″, and Placidus to 0.0096″. Polar status agrees in every case.

Nothing else moves:

- no position, angle or event changes;
- whole-sign, Placidus and Porphyry cusps are unchanged;
- the receipt conventions set is rc.8's.

Receipts accept the new systems and check each one's cusp shape. A receipt naming an engine before rc.9 cannot carry one.

## What the site does with it

The engine's full chunk grows by 663 B gzip, from 26,085 to 26,748 B. That is over its 26 KB budget, which moves to 27 KB.

The 2026-09-26 edition is rebuilt on rc.9. Its manifest records the new engine and generator hashes, and the publication itself is unchanged.

The MCP adapter moves to 0.1.0-rc.9 with the engine inside it, and `calculate_natal_chart` offers all twelve systems where it offered whole sign and Placidus. The official-SDK protocol drive passes 87 of 87 checks, the Claude Code host drive 7 of 7, and the synthetic benchmark 18 of 18 scenarios. A clean extraction of the new archive installs 14 packages and passes its own 17 checks. The external-trial values, re-measured on it, are unchanged apart from the engine the `reproduced` sentence names.

The every-tenth-day comparison with Swiss from 1800 to 2199 was run again on rc.9. Every statistic is unchanged; only the engine named and the digest of the engine's dump, whose first line names it, differ.

## Records

[node22-parity.json](node22-parity.json) and [node24-parity.json](node24-parity.json) are `scripts/platform-engine-report.mjs` run against the vendored archive:

- on Node 22.22.2 (tzdata 2025c);
- on Node 24.21.0 (tzdata 2026c).

Both passed on the frozen Swiss node and polar pack. Apart from the archive's identity, the figures are rc.8's.

[public-candidate-consumer.log](public-candidate-consumer.log) records the engine repository's own `scripts/verify-packed-consumer.mjs`, run at the source commit against the vendored archive on both Node versions.

- Each run installs the archive into a fresh directory.
- It uses only the root, geo, receipt and crossings exports and the archive's declarations, with TypeScript 5.9.3.
- All 16 checks passed.

It is an automated check run by the integrator, not an independent review.

## Limits

- The site's forms still offer whole sign and Placidus; the new systems reach its readers in a later change. The engine package and the MCP adapter offer all twelve now.
- Koch, like Placidus, is undefined inside the polar circle and falls back to whole sign there with the `polar-fallback` flag.
- End to end, the site's houses carry the same sidereal-time and obliquity inputs as its angles. Those match ERFA's IAU 2006/2000A sidereal time to about 0.1″.
- Swiss's sidereal time leaves the IAU model outside 1850–2050, so end-to-end comparisons with Swiss there measure Swiss's model rather than the houses.
