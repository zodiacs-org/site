# Independent audit of checkpoints 9 to 12, 4 October 2026

The owner asked the agent taking the programme over to audit the previous
agent's work before continuing: the seven acceptances of checkpoint 12 (#637),
the API reference (#635), the sky API test repair it shares with #636, the developer-docs
authorship guard (#632), the Agent Skill (engine #23), the rc.16 adoption
(#620), the release blockers and the post-merge CI failure. This is that
record. It changes no gate, weight or denominator. It finds one acceptance
premature, so P2.E.returns returns to validated (F-67): delivery is 47 of
182.45 (25.760%), not 47.5 (26.035%), until production serves the fix.

Audited source: site `main` at `9d7dd31daa673fd1a21675ce359f9f4a69eac1cd`
(#637), engine `main` at `23660f509fd9552d596966419fc982544fe06019` (#25).

## Method

Five reviewers, each an AI agent with a fresh context and a separate brief
(not a person and not another model family), audited #635 and G1, the sky API
repair, S6, the rc.16 adoption and its production build, each in a read-only
checkout or its own worktree, with mutation and bypass probes. Two more
reviewed this change itself before it was published, the second after the
first's findings were fixed. The programme agent checked the
ledger, CI, the registries, the deployment, A4 and the CI failure itself, and
reproduced every finding it acted on before changing anything. Raw reviewer
logs are working files and are not committed.

## What held

| Claim | Check | Result |
| --- | --- | --- |
| Checkpoint 12's arithmetic: 26.035% delivered, 1.644% blocked | `programme-ledger.mjs --summary` and `--check`, and an independent sum over the 151 units | 47.5 and 3 of 182.45; the denominator digest is unchanged; #637 changed only the seven units' state, release, evidence and notes, and removed A4's blocker, which is why blocked weight fell from 3.5 to 3 |
| #637, #635, #632 passed CI before merging | GitHub runs 37196814758 (head `4a08bb1e`), 37191270664 (`a5d66b99`), 37143121771 (`4e4662f1`) | all `success` |
| #636 | its files and run 37187080526 (head `e2c7c8c9`) | 19 of 19 jobs passed; its programme part is the sky API test repair; the rest, the owner-approved October 4 chart of the day, belongs to the frontend session and is not audited here |
| Production serves main | Vercel | `dpl_9pVLB8brkRDrtKu2cA5zLMnf6eKM` READY at `9d7dd31d` |
| rc.16 identity | npm registry, the vendored archive | `0.1.1-rc.16` under `next`, SHA-1 `f57e312b…3afa` and SHA-512 equal to the archive `43a72d30…15d8`; SLSA provenance from the trusted publisher; `latest` stays rc.15 |
| JSR | JSR API; GitHub runs 37111251733 and 37111638537; jsr-io/jsr#1563 | no version published; dry run passed, publish failed at its publish step; the issue was open, untriaged and without comments; no retry |
| A4, the published skill | the three manifest hashes; check runs on `c8a390ee` | all three match; 21 of 21 check runs succeeded |
| A4's final private rescan | a new run of the engine's `history-check.mjs` with the owner's patterns, outside the repository | no birth data in the published commits or trees; [aggregates only](a4-history-rescan.json); this is a new check, not the missing receipt |
| The sky API repair was test-only | `src/lib/sky-api` tree hash at every commit from `a7ecab9a` to `9d7dd31d` | unchanged; the CI failure of run 37163965698 was the old `daysAway > 0` assertion; a local run of `9d7dd31d` without the DE kernel gave "6507 passed, 4 skipped" (6,511 tests) |
| #635's reference | regeneration, coverage count, link check, live comparison | byte-identical rebuild from the digest-checked archive; 12 entry points, 521 export names, 514 pages, 530 files; the 69 archive files equal a clean pack of `ddbbaa0`; its 514 pages held 38,333 link values, one of them the dead `http://LICENSING.md` (F-64); at this head the other 38,332 hold, 37,814 resolving to files on zodiacs.org (13,021 with a fragment that reaches its anchor) and 518 going over HTTPS to the three named hosts, all now checked in CI by `check-engine-reference.mjs`; 13 live files equal the commit; `/sdk/` bytes unchanged |
| S6 covers developer docs | the scanner over a fresh build; its 91 tests | 676 files, the 514 reference pages among them, after the build in the required job; fails closed on symlinks and missing output |
| Moon candidates: own implementation removed | `git grep` at #620's parent | the removed helpers had no production caller; the share card's own sampling is replaced by the package; the calculator's withholding predates #620 (`9d180c9f`) |
| The rc.16 adoption's package and production | the vendored archive, the installed package, npm, the production chunks | all 69 installed files equal the archive's; npm's SHA-512 and its SLSA subject equal the archive's; every chunk on the four adoption paths in production equals a local build of `9d7dd31d` byte for byte |
| The adoption's parity record | a rerun of `compare-techniques.mjs` against `2197e696` | identical to the committed `techniques-parity.json` except `generatedAt`; returns 1,980/1,930/50, void-of-course 156/156, patterns 1,840/1,840, Moon 5,147/5,134/13 |
| Void-of-course from the package | the production page's windows | its 40 windows equal the package's `voidOfCourseWindows` for the same range; the old implementation is deleted |
| G4 | tag and DOI | `v0.1.1-rc.15` points at `93ebae9`; DOI 10.5281/zenodo.23080134 resolves |
| PR613 | GitHub | closed unmerged, as a draft, on 2026-10-03 |

## Findings

Ranked by severity; each is in [FINDINGS.md](../../programme/FINDINGS.md).

| id | severity | finding | disposition |
| --- | --- | --- | --- |
| F-62 | major | The authorship guards missed wrapped or capitalised persona names, other spellings of the editor anchor and single-quoted Person markup in `src/`; the source guard failed open | fixed here, with one recorded allowance for the People template's subject; the known limits are listed in the finding |
| F-67 | major | P2.E.returns was accepted while the year ahead on `/profile/` still found solar returns with the site's own Sun crossing scan | fixed here: the package's search, [parity on 1,000 windows](year-scan-parity.json), a regression test; validated until production serves it |
| F-63 | major | The engine repository's description says "MIT-licensed" and its `.zenodo.json` says `mit` | owner action, wording prepared |
| F-61 | minor | One WebKit sharing drive failure on main | preserved, retried once (passed), handoff prepared for the frontend session |
| F-64 | minor | A dead `http://LICENSING.md` link in the reference, which its checker skipped; discovery files that did not link the rc.16 reference | fixed here; the checker resolves every link |
| F-65 | minor | Sky API tests did not hold `nextByKind` to the first event of each kind; `daysAway`'s rounding undocumented | fixed here; no computed value changes |
| F-68 | minor | The Moon candidates' parity figure mixes the adopted path, M-A (3,002 of 3,005), with sections for removed helpers | dated ledger note |
| F-69 | minor | Checkpoint 12 called the returns removal complete; two P2.A notes predated rc.16 | dated notes and a correction section |
| F-66 | info | STATUS.md's living sections and four ledger notes described an earlier state | corrected by dated notes |
| F-70 | info | The People pilot's frozen tools compute Moon-sign uncertainty and two aspect patterns themselves; smaller adoption notes | recorded; the pilot's 501 Moon verdicts equal the package's ([people-moon-parity.json](people-moon-parity.json)) |

Other observations, not defects of the audited work:

- The F-60 diagnosis branch named in the handoff, `codex/f60-local-limiter-diagnosis` at `42e19dd4`, is on no remote and its commit is not available here, so its fourteen local tests cannot be checked. Nothing on main cites it. F-60 stays open; no inference about client addresses is made.
- The MCP archive 0.1.0-rc.16 labels its bundled engine an unpublished candidate. It was carried at 10:38 UTC on 2026-10-01, before rc.16 reached npm at 12:02, and `/developers/mcp/` says so; the archive's bytes stay as released.
- The original private acceptance checkpoint of 2 October and its six-request live receipt remain missing. Nothing here reconstructs them.

## Owner actions

1. **The engine repository's description** (F-63): replace "MIT-licensed astrology calculation engine" with wording that names both licences, for example "Astrology calculation engine (MIT code; its ΔT data are CC BY 4.0): positions, houses, points and timing techniques, with receipts and a public conformance suite".
2. **Zenodo's licence field** (F-63): decide how the record for v0.1.1-rc.15 and `.zenodo.json` state both licences before the next release mints a DOI.
3. **JSR**: no action until JSR answers jsr-io/jsr#1563 or the owner chooses a faithful alternative.

## Limits

- WebKit is not installed here, so F-61's cause is inferred from the log, the built chunk and the code, not reproduced.
- The rc.16 archive was not rebuilt from engine source here; its identity rests on the digests and npm's SLSA provenance. The adoption paths were not driven in a browser, and the production build was compared with a local build made with the default feature flags; every chunk on the adoption paths matched.
- Which checks `main`'s ruleset requires could not be read here (HTTP 403); Vercel deploys `main` whatever CI says.
- The reviewers' live checks ran through this environment's proxy; one transient 502 on a reference asset was refetched successfully.
- Live and production observations (the reference's 13 live files, the production chunk comparison, the void-of-course page's windows) and test-run counts are dated observations by the reviewers or the programme agent; they cannot be reproduced from the repository. The parity tools in `tools/` can be, with their committed outputs.
