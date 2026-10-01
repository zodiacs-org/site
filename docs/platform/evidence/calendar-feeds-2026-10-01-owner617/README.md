# Calendar candidate after owner PR617

This integration carries the reviewed calendar implementation onto owner main `6ca4269a5f536f11365d3ca9edfef05b215d2fa1`. It preserves the owner's new frontend, all 19 active Phase 1 capture files and all 30 Linux/Darwin visual baseline PNGs byte-for-byte. The earlier local `14e71850` capture import is superseded historical work and is not in this integration's ancestry. Its old PNG publication/carrier plan is stopped.

## Source and preserved scope

Local merge `0fa7e8b1ff994cd20a6f705a45fbc8bb3b1ba33a` has parents local calendar `7d6174a0096909c0d3e7f3322dd56f31f59911a6` (exact tree of public `3f47799e6491dcfae10a56b11dc43070c18c38eb`) and owner `6ca4269a`. Publication retains public parents `3f47799e` and `6ca4269a`; later metadata does not change render inputs.

The owner changed 134 paths. Independent review confirms 132 are byte-identical in this integration. The only deliberate reconciliations are:

- `.github/phase1-scope-allowance.json`: retain the calendar authorization, pin the full new main SHA, and cover only ES/FR/IT/PT privacy pages. The owner's prior 28-path frontend allowance is spent and is not broadened or reused
- `src/styles/calculator.css`: preserve every owner rule and add only the same 47 `calendar-subscribe` lines already present in the calendar parent, with zero deletions

No Guide source/test repair, homepage rollback, platform-baseline refresh or production change is included. `source-binding.json` provides the 132 path hashes and the independent review result.

## Validation and capture implications

- Node 22.22.2: all 162 focused calendar/store/clear-all/UI/claims tests pass across seven files
- Full build passes all unchanged route, chunk and engine-isolation budgets
- Typecheck passes: 1,186 files, 0 errors, 0 warnings, 19 hints
- Scope guard passes against exact main6ca: four protected paths only
- Transit/calendar fixture build preflight passes; no local browser was launched
- The ledger remains 43.5/182.45 accepted (23.842%), blocked 3.5. This preserves the current public G4 snapshot and advances no calendar acceptance

Owner main's [Site Check 36873074316](https://github.com/zodiacs-org/site/actions/runs/36873074316) passes all 19 jobs, including its full suite, Phase 1 evidence, visual comparisons and Lighthouse. That main does not contain the calendar implementation, so its green result is not substituted for new integrated calendar checks.

The owner changed 22 render-contract inputs. Its preserved active captures bind to `8357207ef6aa9a556bc1dbff8cbc077d1d83d6efc2401a844e40c8e7586ab6cb`, from Chromium 154.0.8037.58. The combined calendar source and verified build bind to **`c711dcb773b7b18ab377c4acc056d2864311c476155a79e4cf2553f76ea35858`**. Therefore the active-capture mismatch is expected until genuine captures are generated from this integrated build, inspected, and adopted in a later scoped evidence change. Neither the old `d861b489…` calendar images nor a rewritten hash may replace that work.

Fresh CI must run the unchanged 34-case cross-tab drive, 25-case transit/calendar UI drive, PostgreSQL 17 calendar SQL gate and full source suite. Browser Evidence must build the exact published head and capture last; any source change or later main integration requires fresh source-bound evidence. Comparison failures remain failures for review, and the owner's platform baseline files stay intact. No full local suite was repeated before this draft checkpoint; required CI supplies the integrated run.

## Remaining release gates

The [earlier evidence packet](../calendar-feeds-2026-10-01-idb/README.md) retains the transaction diagnosis, reviewed code, historical native/SQL results and the first valid live-project metadata observation. Its old frontend-failure and capture statements describe those earlier heads. Current integrated outcomes will be recorded from fresh CI.

Production migration, deployment, sweep and live synthetic create/read/CDN-hit/remove/404 checks remain unperformed. Server Production target confirmation and exact release authorization still precede those actions. If deployment moves beyond October 1 UTC, re-date the legacy window and privacy/sitemap expectations together, rebuild, and capture last. The older capture-import candidate and its cancelled PNG upload do not establish rollout or acceptance.
