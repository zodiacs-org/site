# Streamed edition-label parser correction

On a current edition, `Base.astro` converts EditionText's dated no-JavaScript fallback to its current label while HTML is parsed. The parser can append to a text node the observer has already filled. Observing only added nodes misses that character-data mutation, leaving a combined current/dated label until DOMContentLoaded. The heading can wrap temporarily and shift the completed reading shell.

Source `c40b75065eb2240bfa46d6b2dc89143a97741b3b`, based on released main `66eb6712d692b7e4fe6a1367b12ee197f4d8c95d`, observes character-data mutations and passes their target through the existing guarded synchronizer. Its equality check prevents repeated writes. The existing dated fallback and edition/profile behavior are preserved.

`tests/edition-parser-drive.mjs` serves the real build over local HTTP, pausing 300 ms after opening the edition span and 300 ms before ending the document. It fixes the browser clock to the publication date so it exercises a current edition on future runs. It requires the final current label and exactly zero CLS, then the existing Today browser drive runs.

The regression fails on the old product source (whose relevant blobs equal main) with CLS 0.0261823537414966 and a one-line height change. On corrected source and exact CI Chromium 149.0.7827.55 it passes with CLS 0; all existing Today checks pass. The original main CI failure remains recorded: run 37807709612, job 113416228540, CLS 0.025757519876700677, one shift. Its trace does not capture the intermediate label, so the controlled result is not asserted to prove that exact original text state.

The default build, typecheck and full suite pass: 6,937 tests, five existing skips; 537 passing files and one existing skipped file. All eighteen acceptance captures are refreshed with unchanged PNG bytes, and all seven engine asset bytes are unchanged. The protected-scope guard passes. `validation.json` is an assembled summary of those runs, not raw tool output. Raw logs remain outside Git.

New PR/main CI and deployment verification remain required. No budget, assertion or skip was weakened; no engine archive was rebuilt. The fresh private release search completed without read errors. Both supplied sets have zero history data/name matches; existing whole-tree positives remain reported in `history-check.txt`. A final staged evidence delta is checked separately.
