# Current-main integration of engine rc.2

Source: `71ab060a8614e58d619b5baeb2e009245c0ef354`. Merge parent `254bf7fe223c2b153b6ea36d238577fd8a4516cb` retains current AI panel sizing, host links and anonymous MCP usage work from main. Generated bundles are rebuilt from the combined sources. The developer review candidate is 0.3.6; all inherited engine, MCP and AI archive bytes remain available. Main's 0.3.3 developer archive stays at its current path; the earlier PR's different 0.3.3 bytes remain under `integrations/packages/history/`.

The final default build, 18 fresh captures and full suite pass: 6,937 tests, with five existing skips; 537 files pass, one existing file is skipped. The capture PNGs are byte-identical; their source binding is refreshed. Production-flags build and typecheck pass on combined source before the test-only follow-up. Compatibility browser checks pass in twelve locale/width contexts. The disclosure test now checks the required root language while allowing enabled lifecycle attributes; this retains the locale/content contract. The two preceding local failures and their corrections remain recorded in `validation-status.json`.

Seven engine assets remain byte-identical to the preceding candidate, totaling 33,193 level-9 gzip bytes under the unchanged gate. These are local results; the preceding PR head's CI Lighthouse failure remains observed and is not cleared by this build.

Protocol: 106 checks passed. Synthetic benchmark: 18 scenarios and 112 assertions passed. The named-host drive was invoked but could not run because Claude Code is absent; this is not a successful host check. The immutable MCP rc.18 archive reproduces. This refresh does not claim programme acceptance, public directory acceptance, preview availability or production deployment.

The fresh private release search covers the final source range and decompressed archives. Its rebuilt-wrapper scope, positive counts, public-geography proof and citation-validation limitation are explicit in `history-check.txt`. No private input or raw match is included. The final staged evidence blobs receive a separate count-only check before publication.
