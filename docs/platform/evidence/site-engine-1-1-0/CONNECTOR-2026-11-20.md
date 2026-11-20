# Published MCP bundle 0.6.9, 20 November 2026

Dias approved the tap-target, horoscope disclosure and dash fixes at 10:37
Asia/Bangkok on 20 November 2026.

- RED-1 sets 44px hit areas for the controls identified by the 375px phone
  audit. The gate now requires 44px on both dimensions of every measured
  control outside the inline-link exception.
- RED-9 displays the horoscope answer's full disclosure, including its
  Reading confidence label, in the new horoscope panel.
- RED-10 uses `1800 to 2199` in the five approved tools' input descriptions
  and `to` between dates in the sky calendar heading. The gate rejects en
  and em dashes in these descriptions and in rendered panels.

The six current resource addresses are `sky-events-v5`, `chart-studio-v7`,
`horoscopes-v8`, `occasions-v9`, `readings-v5` and `readings-v6`. Each
earlier served address remains available as an alias, following the existing
resource behavior. `readings-v6` displays the lunar nodes and Chiron when the
existing sky events switch is on. Chart Studio's new address ends the v6 build
pin and uses the site browser build, which selects Astronomy Engine.

As in ZOD-63, the published connector comes from a frozen source snapshot.
`connector-transition.json` records the original source
`07269a76e1ec1c43032af088e056a1c2ba8dfff4` and the source change
`7245bce067c9fc25e600811f19d458f0b696b680`. The old runtime reproduced byte
for byte with the original hosted build and vendored engine 1.1.0-rc.2.
Apply that change's runtime edits to `src/ai-tools/contracts.ts`, `server.ts`,
`http.ts`, `features/compatibility.ts` and `horoscope/reading.ts` on the original
source, then supply the six updated `integrations/generated/` panels from
`npm run ai:build` at the source change. Build the `src/ai-tools/http.ts`
entry with the original `scripts/build-ai-integrations.mjs` hosted settings
and lifetime boundary, and copy the result to `api/_ai/published/runtime.mjs`.

| Published runtime | SHA-256 |
| --- | --- |
| 0.6.8 | `1effa2796fd6eb59f50316479141c1ad89e024f404878ca01d10119fb787ed95` |
| 0.6.9 | `5a72f3f73ca1dc8944a8782ed6b995cf771804bc340a8e70e8cba992e01fa014` |

The transition fixture captures initialize, tool listing, resource listing,
capabilities and the two accounts-off checks for each of three scenarios.
An in-process comparison reproduced all 18 prior replies, then verified all
18 regenerated replies against the approved differences. The production
Neptune path continues to use Astronomy Engine and the DE440 route keeps its
separate calculation. The server reports 0.6.9. The portable plugin and
registry record retain their existing versions.
