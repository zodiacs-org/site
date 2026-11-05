# Lite B5, version 2: the claims extractor's control

Written on 2026-11-04 and committed before B5 runs in the site's adoption.
It replaces only the claims extractor's control of B5
([PREREGISTRATION.md](PREREGISTRATION.md), section 5); the rest of B5, and the
engine's text, do not change.

## Why a version 2

B5 asks that "the claims extractor must list a sentence planted in a scratch
copy of the reference (as time-bands C8's control does)". C8's planted
sentence is "The band bounds the error of every position.".

- **SR** (programme notes, `notes/rc2-2026-11-01/sr/REPORT.md`, section 5,
  runs 17 and 17b, on engine `b11c5e8`, 2026-11-03): planted as a paragraph
  at the end of `release/README.txt` and as the first paragraph of the
  comment of `functions/time.timeBands.html` in the rc.2 reference, the
  sentence was not listed: none of its words is a trigger of the extractor's
  lexicon (`LEXICON_VERSION` 2). With ", in arcseconds" added it was listed
  in both places, so the plants were in text the extractor reads.
- **SR2** (`sr2/REPORT.md`, on `4f4c1e8`) and **SR3** (`sr3/REPORT.md`, on
  `5c00cb8`, the packed bytes of the carried archive): the planted sentence
  was again not listed.
- **The lite amendment of 2026-11-03** ("the site run (SR) on b11c5e8: B5's
  planted sentence", PREREGISTRATION.md section 11) records that B5's
  control did not behave as run there, and that "Its version 2 is due in the
  site's adoption, with a planted sentence the extractor's lexicon selects".

The adoption plan takes this version under the owner's delegation of
2026-11-04 (decision D-2). The sentence below was chosen after SR saw it
listed, so B5's reading under this version is `validated` only until the
owner ratifies it; the four units are `validated` at most anyway, while OQ5
is with the owner.

## The control, version 2

- **Planted sentence**, exactly: "The band bounds the error of every
  position, in arcseconds." (SR's run 17b showed this form is selected.)
- **Where.** In the adoption head's generated reference
  (`public/developers/engine/reference/`, built from the vendored rc.2
  archive), two plants made at once: a paragraph at the end of
  `release/README.txt`, and the first paragraph (`<p>...</p>`) of the
  comment on the `./lite` page for `sectReading`
  (`functions/lite.sectReading.html`, as the reference build names it). Each
  file's SHA-256 is taken before the plant and checked after it is put back.
- **Run.** `node scripts/claims-ledger.mjs --unlisted` with the plants, and
  the same without them (the reference as built).
- **Pass.** With the plants, the listing names the planted sentence in both
  files; without them, it names it in neither. Otherwise the control has not
  behaved, and B5 is void as run.

## The rest of B5, unchanged

- The export-coverage control: `sectReading` left out of `./lite`'s
  documented names in `scripts/engine-reference/build.mjs`, then
  `node scripts/engine-reference/build.mjs --check`, must fail its
  export-coverage assertion (SR's run 14c: "Export coverage differs for
  ./lite: sectReading"); `build.mjs` is put back and checked by its SHA-256.
- `node scripts/validate-people-pilot.mjs` passes with check 16 retargeted
  (B6); the engine reference builds from the rc.2 archive with its
  export-coverage assertion; the claims ledger's rules pass with
  `product.engine-analyses` restated.

## Not changed here

The lexicon is not changed: a lexicon that selects the band sentences is step
1.14h, which OQ10's Q5 keeps with the owner. Time-bands C8's version 2 is not
run in this adoption (decision D-1): it goes into P1.M3c's version 2, with
C1b's fix, in a later engine candidate.
