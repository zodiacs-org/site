# Published MCP bundle 0.6.9, 20 November 2026

Dias approved the tap-target, horoscope disclosure and dash fixes at 10:37
Asia/Bangkok on 20 November 2026.

- RED-1 sets 44px hit areas for the controls identified by the 375px phone
  audit outside Chart Studio. The gate requires 44px on both dimensions
  apart from the three recorded Chart Studio controls and inline links.
- RED-9 displays the horoscope answer's full disclosure, including its
  Reading confidence label, in the new horoscope panel. After a minor's
  horoscope, the panel retains that disclosure when the host sends a later
  result without the minor flag. The repeated-result regression exercises
  the original host subscription and checks the disclosure after both results.
- RED-10 uses `1800 to 2199` in the five approved tools' input descriptions
  and `to` between dates in the sky calendar heading. The gate rejects en
  and em dashes in these descriptions and in rendered panels.

The five updated resource addresses are `sky-events-v5`, `horoscopes-v8`,
`occasions-v9`, `readings-v5` and `readings-v6`. Their earlier served addresses
remain available as aliases. `readings-v6` displays the lunar nodes and Chiron
when the existing sky events switch is on. Chart Studio stays byte for byte
at `chart-studio-v6.html` with its source pin and embedded engine 1.1.0-rc.1.
Publishing the current browser build would change engine flags and receipt
convention IDs. That change needs the owner's approval.

As in ZOD-63, the published connector comes from a frozen source snapshot.
`connector-transition.json` records the original source
`07269a76e1ec1c43032af088e056a1c2ba8dfff4` and the initial source change
`7245bce067c9fc25e600811f19d458f0b696b680`. The old runtime reproduced byte
for byte with the original hosted build and vendored engine 1.1.0-rc.2.
For the recut, take a one-line-context diff from `runtimeSource.changesBase`
through this fix for `src/ai-tools/contracts.ts`, `server.ts`, `http.ts`,
`features/compatibility.ts` and `horoscope/reading.ts`. Apply it to the original
source. Supply the five updated `integrations/generated/` panels from
`npm run ai:build` and keep `chart-studio.mjs` from `runtimeSource.chartStudioSource`.
Build the `src/ai-tools/http.ts` entry with the original
`scripts/build-ai-integrations.mjs` hosted settings and lifetime boundary,
and copy the result to `api/_ai/published/runtime.mjs`.

| Published runtime | SHA-256 |
| --- | --- |
| 0.6.8 | `1effa2796fd6eb59f50316479141c1ad89e024f404878ca01d10119fb787ed95` |
| 0.6.9 | `35ec7fee9454408aeb99215ac11e546184f775f0ce057f79252a216301bd179e` |

The transition fixture captures initialize, tool listing, resource listing,
capabilities and the two accounts-off checks for each of three scenarios.
An in-process comparison reproduced all 18 prior replies, then verified all
18 regenerated replies against the approved differences. The round 2 recut
reproduced the committed 0.6.9 fixture byte for byte. The production
Neptune path continues to use Astronomy Engine and the DE440 route keeps its
separate calculation. The server reports 0.6.9. The portable plugin and
registry record retain their existing versions.
