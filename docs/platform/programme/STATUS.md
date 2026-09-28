# Programme status

Checkpoint 1: the first audit, 2026-09-28. The next session should start here.

**Overall delivery: 7%** — 13.0 of 182.45 weighted units accepted; blocked on owner or external action: 10% (18.0).

The figure is computed by `node scripts/programme-ledger.mjs --summary` from [`acceptance-ledger.json`](acceptance-ledger.json). The method is in [README.md](README.md) and the unit list in [LEDGER.md](LEDGER.md).

## Why the figure fell

The previous handoff estimated about 30%. That was a rough figure, and no audit stood behind it. This ledger fixes a denominator of 151 units from the brief before assigning any status, and a unit counts only when its gate has committed evidence and the unit is in its release state.

What counts now:

| part | accepted |
| --- | --- |
| Phase 0 | six of its seven items |
| Phase 1 | ten steps or halves of steps |
| Phase 2 | twelve of the thirteen house systems, the polar policy, the Vertex and East Point, the mean node and Lilith, the lots, antiscia and midpoints |
| Track S | `robots.txt` |

Three kinds of work are real but do not count yet:

- Merged work that production does not serve: engine rc.11 aspects and declinations, and rc.12 progressions.
- Passes that exist only under amendments adopted after their residuals were seen: steps 1.3 and 1.8.
- The platform, which is largely unstarted: nothing is published, there is no hosted compute, no remote MCP, and no conformance suite.

An earlier report in this session gave "94%". That was toward a narrower, self-set goal (house systems and points at Swiss parity), not this programme, and it does not carry over.

| area | accepted | of |
| --- | ---: | ---: |
| Phase 0 | 2.0 | 2.5 |
| Phase 1 | 6.0 | 14.5 |
| Phase 2 | 4.9 | 47.6 |
| Phase 3 | 0 | 24.5 |
| Phase 4 | 0 | 30.5 |
| Tracks A, S, G | 0.1 | 20.35 |
| Bets B1–B5 (first slices) | 0 | 41.0 |
| §4.4 | 0 | 1.5 |

## Identities verified at this checkpoint

**Site.** `main` = `817132f7` (#586 on top of #593's `f2bd0dd4`). Production is `dpl_GNiCYhHNi5daRWqT3ra4qSzT8XZf`, READY, built from `817132f7`.
- The live `llms.txt`, `llms-full.txt`, MCP manifest and MCP archive are byte-identical to the repository.
- The post-merge CI of `f2bd0dd4` (run 36409805328) succeeded.

**Engine.** `main` = `df01d2d7`, which merged PR #8 (rc.12) after an independent review.
- Every archive reproduces byte for byte from its source commit on Node 20, 22 and 24.

| archive | SHA-256 | source | status |
| --- | --- | --- | --- |
| rc.10 | `a377cdc8…565c` | `9c4f3fd7`, carried by `d0c5cd0c` | the site vendors it; production serves it |
| rc.11 | `d88e0ff8…7862` | `be3585b3` (merge `537ecaf4`) | merged; not adopted |
| rc.11 (superseded) | `13d637db…` | `00bdae79` | never merged; a second archive under the same version (F-01) |
| rc.12 | `c4cf150f…f7f0` | `a1d0f2c6` (merge `df01d2d7`) | merged; not adopted |

**MCP.** `0.1.0-rc.10`, `0405ecf4…3568`, 71,472 bytes; artifact commit `92162624`.

**Registries.** Nothing is published. npm returns 404 for `@zodiacs/engine`, `@zodiacs/mcp-server` and `@zodiacs/cli`. PyPI `zodiacs` and the JSR `@zodiacs` scope do not exist. The MCP Registry has no entry.

**Flag drift.** None between Vercel's Production variables and the production-flags CI job. The check now includes the server-side daily-email gates.

## Audit

Seven independent reviews ran. They are listed with their findings in [FINDINGS.md](FINDINGS.md), which has 42 findings, 14 of them major; none is a blocker. Fixed or in progress:

- **Fixed:** the rc.10 points and Equal-MC record was published and rerun (F-32).
- **In progress as engine rc.13:**
  - the configured-aspect exactness (F-06);
  - the Sun's out-of-bounds flag (F-07);
  - the rc.12 review follow-ups (F-13–F-16);
  - artifact identity and a CI rebuild check (F-01, F-02);
  - the token framing on engine surfaces (part of F-21).

Open majors:

- **Privacy:** F-17, F-18, F-19, F-20 and F-40.
- **Engine:** the SDK's time resolution lacks steps 1.1, 1.12 and 1.13 (F-35, F-36).
- **Licensing:** committed Swiss output (F-22).
- **Process:** the amendments (F-29).
- **Engine:** Koch's end-to-end FAIL (F-33).
- **Records:** seven audit findings without a disposition (F-34).

## In progress

- **Engine rc.13** is on a local branch, `rc13-work`, and not yet pushed. It takes the fixes above to a new archive under a new version. The rc.12 bytes stay frozen.
- **Site privacy fixes** have a planned branch. The plan:
  - time-unknown share codes built at a place-independent instant;
  - a sign-icon request set that is identical for every chart;
  - Guide angles at whole degrees;
  - truthful copy in every locale.

## Owner actions

Each of these is the owner's call under the brief (§10) or the handoff. Everything else continues without waiting.

1. **Amendments A1 and A3.** Ratify or reject them.
   - A1 is rule 1b: 8″ at 66° instead of 5″.
   - A3 is rule 1g: 1.5″ a day instead of 1″.
   - Both were adopted by an agent under "stop asking me for permissions", after the residuals were seen. Until the owner decides, steps 1.3 and 1.8 count as validated, not accepted.
2. **The share code and calendar feed (§10.4, F-20).** Choose one:
   - coarsen feed codes to a stated window, with a decoder test; or
   - replace them with random feed ids, which makes the feed stateful.
3. **Committed Swiss output (F-22).** Keep the statistics and hashes public and move the raw fixtures to a private store, or state another disposition.
4. **npm (§10.3).**
   - Choose the scope: shared `@zodiacs` beside the token SDK, or a separate one.
   - Confirm control of the `zodiacs` account.
   - Do the first two-factor publish of each new name.
   - Reserve `zodiacs` on PyPI and `@zodiacs` on JSR.
5. **The hosted API (§10.5).** Set the free-tier level and the hosting budget.
6. **The site repository's licence (§10.6).**
7. **Data licences for the atlas and the conformance suite (§10.10).** The brief suggests CC BY or ODbL for the atlas and CC0 for the vectors.
8. **Search Console, Bing Webmaster Tools and Plausible.** Give read access or exports, for the §9 baselines (P0.7b, S8).
9. **Access to the assistants** for the monthly panel and the benchmark (A8, B4.b).
10. **Zenodo.** Connect it to the engine repository (G4).
11. **NAIF (§10.8).** Send the derived-coefficient question drafted for version 1's M2.2. This only matters for distributing a pack; the hosted backend does not wait on it.

## Next

1. Review the rc.13 branch, push it, open the engine PR, and merge it when CI and an independent check pass.
2. Adopt rc.13 on the site:
   - vendor it and update the pins;
   - route progressions through the package, keeping ChartLens's dynamic import;
   - rebuild the MCP archive under a new version;
   - update the docs and claims;
   - run a production-flags build and measure `/birth-chart/` against 71 KB without raising the gate.
3. Open the site privacy-fix PR.
4. Port the site's time steps into the engine (1.1, 1.12, 1.13 package halves).
5. Start conformance v0 (B1) from the committed corpora, with independent arbiters.

**To resume.** Read this file, then `LEDGER.md` and `FINDINGS.md`. Check `git log` on site `main` and engine `main` against the identities above, and read the open PRs in both repositories.
