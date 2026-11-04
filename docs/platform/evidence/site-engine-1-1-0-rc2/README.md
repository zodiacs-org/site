# Site adoption of engine 1.1.0-rc.2

The site's adoption of `@zodiacs/engine` 1.1.0-rc.2: the vendored archive and
its identity, the checks the candidate's preregistrations ask of the site,
and their records. Written as a skeleton on 2026-11-04; each section below
is filled by the commit that makes its runs.

- **Engine.** Source commit `806f76b43c0ee652016fe1b522c02d6f6e9c7ae5`,
  carrier `59c6ea9d9a4e7845a2880aa8303fcaadbd645170`, merged into engine
  main by `883371f5d592cd952873422f13766038fcfa7b68` (zodiacs-org/engine#82);
  archive SHA-256
  `c5aef0e3f20a19cf7ffabc99112cf592045199d6803814cf4ef6ea013615351c`. The
  units it carries, each with its preregistration and results in the
  engine's `docs/evidence/1.1.0-rc.2-20261102/`: F-89's nine corrections,
  F-53 (`@zodiacs/engine/time`), P1.M3c (the time bands), the four P2.E
  units (`@zodiacs/engine/lite`) and P2.B.vargas (`vargaSensitivity`).
- **Base.** Site main `0bf69bd56aaec8fbfd99bd4b45877064dc1234df` (#877, on
  2026-11-04), the commit every comparison here is made against. The
  adoption plan was written on `43b88e7d`; #877, between the two, changes
  none of the site files the preregistrations cite.

## What this folder holds

| Path | What | Commit |
| --- | --- | --- |
| [ARTIFACT-IDENTITY.md](ARTIFACT-IDENTITY.md), `npm-view.txt`, `npm-registry-1-0-0.json`, `public-consumer.log`, `node22-parity.json`, `node24-parity.json` | the archive's identity, npm's state and the consumer and parity checks | the carry |
| [PRODUCTION-CHECKS.md](PRODUCTION-CHECKS.md) | every production check, named before it runs | the preregistrations of the site's checks |
| [time-entry/](time-entry/) | F-53's S1 and S1b tools; later their outputs, then S2's | the same, then the parity of F-53 |
| [lite/](lite/) | the lite preregistration's copy, the parity tool and its controls, B5's version 2; later the parity record and the bundle reports | the same, then the site checks |

Still to come, each by the commit that makes it: the private-state review,
the regenerated outputs and their check, the entry graphs, the MCP adapter's
comparison, the accuracy refresh, the claims, the local gate and the private
search, the Phase 1 captures, and production.

## Decisions taken without asking, under the owner's delegation

From the adoption plan's section 11 (programme notes,
`notes/rc2-2026-11-01/adoption/PLAN.md`), under the owner's delegation of
2026-11-04. None of them accepts a reading: OQ5, the ratification of the
readings each unit chose after its scoping runs, stays with the owner, and
so does OQ10's Q5.

- **D-1.** Time-bands C8's version 2 is not run here. P1.M3c's version 1
  failed C1b in the engine's formal run, so C8 cannot change its verdict; C8's
  version 2 goes into P1.M3c's version 2, with C1b's fix, in a later
  candidate. No lexicon change: that is step 1.14h, with the owner. The band
  sentences the extractor does not select are to be listed here with their
  backing, as SR listed them.
- **D-2.** Lite B5's version 2 runs here ([lite/B5-VERSION-2.md](lite/B5-VERSION-2.md)).
- **D-3.** F-89's items 2, 6 and 7: their corrected sentences carry no
  trigger word, so their old records go and their claims leave the ledger;
  the ratchet of overstated claims goes from 11 to 2.
- **D-4.** P1.M3c is recorded `failed` (version 1), its release `deployed`
  once production serves rc.2; time-bands C9 is read in production for the
  record only.
- **D-5.** The MCP adapter's 0.1.0-rc.26 archive rides the adoption commit,
  after the switch to `@zodiacs/engine/time` that it bundles, and is pinned
  in the commit of the site checks; 1.1.0-rc.1's carry commit carried its
  adapter archive instead.
- **D-6.** S2's check of the packaged functions uses `npx vercel build` only
  with a hand-written project link and never `vercel pull`, which would write
  decrypted environment values; if the command asks for a pull, a login or a
  link, the check is made on esbuild bundles of the two functions instead,
  and recorded as a departure.
- **D-7.** S2's search leaves out the immutable archives
  (`integrations/packages/`, and `public/examples/*.tgz` up to rc.25), as it
  leaves out frozen evidence tools; the new archives are checked member by
  member.
- **D-8.** The live tool `docs/platform/evidence/swiss-benchmark/tools/multiyear-zodiacs.mjs`
  is switched with the importers: the accuracy refresh runs it on every
  engine version.
- **D-9.** Where only this Mac's arm64 arithmetic changes last bits of a
  regenerated file, the base's bytes stay and only version fields change, as
  for 1.1.0-rc.1; CI's x86-64 jobs check them.
- **D-10.** Both pull requests are merged with merge commits when every
  check is green; the units are recorded `validated`, with the owner's
  ratification as their blocker, and nothing is recorded `accepted`.
