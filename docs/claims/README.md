# Claims ledger

`ledger.json` lists the public sentences on zodiacs.org that state something
about accuracy, time handling or privacy, as the trigger lists below find
them, with the claim each makes, and every claim with its status and the
evidence behind it. `scripts/claims-ledger.test.mjs`
holds the ledger and the copy to each other, so a sentence cannot change, and a
new one cannot appear, without someone deciding what it claims. Step 1.14 of
the engine brief (`docs/platform/ENGINE-AND-PLATFORM-BRIEF.md`) asked for it.

## What is in it

- **claims**: `{id, topic, statement, status, evidence, binds?, enforcedBy?, resolution?}`.
  The statement is what the claim says, worded to match the evidence. Topics
  are `accuracy`, `time`, `privacy` and `product`.
- **machine**: the conventions and coverage the engine writes into every
  receipt (`createNatalEnvelope(...).receipt`), each with the claim it makes.
- **sentences**: `{path, text, claim}`, or `{path, text, exempt}` with a
  reason from the closed list below. Records carry no line numbers.

Arrays are sorted (claims by id, sentences by path and then text) and each
record is one line, so a diff reads as a list of changed claims.

### Statuses

| status | meaning | allowed |
| --- | --- | --- |
| `supported` | the evidence bears the claim out as worded | anywhere |
| `overstated` | true in part, or truer than the evidence shows | with a resolution, and counted against `maxOpenOverstated` |
| `false` | untrue as worded | only where every sentence sits on a protected path |
| `stale` | a translation the English has moved past | only on protected translated pages |
| `historical` | a measurement on an earlier engine or a retired reference | only in the engine validation record, with the evidence and correction recorded |

A resolution names what closes the claim: an engine brief step (`step: '1.11'`),
an owner decision (`owner: '10.4'`), or an allowance to change protected pages
(`allowance: '<id>'`), with a note. `maxOpenOverstated` is a ratchet: it must
equal the number of open overstated claims, so resolving one means lowering it.

### Evidence

Each item is one of:

- `test`: a test file and the title of an `it()` or `describe()` in it, or,
  for a browser drive or SQL test, a check name in the file. The file has to
  be run by CI, directly or through a script CI runs.
- `code` or `data`: a file and a literal `match` it must contain (`data` may
  also pin a `sha256`). Engine code is cited as
  `node_modules/@zodiacs/engine/dist/*.js`, never a hashed chunk name.
- `finding`: an id in the engine audit's `LEDGER.md` or an R-row of the brief.
- `external`: a URL and the date it was read.

`binds` are facts in code or data that the copy restates. When the fact
changes, the test fails and the copy has to be looked at again.

### Exemptions

A selected sentence that makes no claim says why, from a closed list:
`not-a-claim`, `interpretive`, `definitional`, `navigation`,
`input-validation`, `limitation` (it narrows or disclaims rather than claims),
`legal`, and `third-party`, which must cite that party's published source.

## Which sentences are selected

`scripts/claims-ledger-lib.mjs` reads the consumer surface (the same files the
consumer-boundary scanner reads), plus `docs/engine-validation/README.md`,
`public/llms-full.txt` and `scripts/build-assistant-context.mjs`. Generated
output whose source is read instead, sky data and test fixtures are left out,
each with its reason in `SCOPE_DROP`.

Each file becomes text blocks the way a reader meets them: an Astro or JSX
paragraph is one block however much inline markup it holds. Blocks are split
into sentences, and a sentence is selected when a trigger list matches it:

- **FULL** on the trust files (the methodology, privacy and developer pages,
  the homepage, About, Terms, the birth chart page, the MCP adapter, the sky
  API text, the llms files and the assistant's site guide). On the dense
  files (the methodology and privacy pages, the engine page, the llms files
  and the validation report), a triggered sentence brings every sentence of
  its paragraph, because a claim often leans on its neighbour.
- **HARD** everywhere else: the unambiguous subset.
- **NEUTRAL** on translated pages and catalogs: names and figures that read
  the same in any language (JPL, IANA, OpenAI, 12:00, UTC). A translated
  sentence that states a claim with none of those is not selected; that is a
  known gap.

The lists are versioned (`LEXICON_VERSION`). Changing one changes which
sentences must be listed, so the ledger records the version it was built on.

## The rules

| rule | fails when |
| --- | --- |
| R1 | a selected sentence is not listed (a new or edited claim); the nearest listed sentence is shown |
| R2 | a listed sentence is no longer in its file, or no longer selected |
| R3 | a claim has no evidence, or an item does not resolve |
| R4 | a binding's text is no longer in its file |
| R5 | a false or stale claim reaches an unprotected page, a historical claim leaves the validation record, a claim requiring resolution lacks one, or the overstated count differs from the ratchet |
| R6 | a translated sentence makes a claim no English copy makes, or a stale claim sits on an English page |
| R7 | the engine's receipt conventions or coverage differ from `machine` |
| R8 | an exemption has an unlisted reason, or a third-party one has no source |
| R9 | a claim nothing states, or a sentence naming an unknown claim |
| R10 | the extractor misses a planted sentence, or the splitter's examples change |

## Changing a sentence

1. Edit the copy.
2. `npm test -- scripts/claims-ledger.test.mjs` fails on R1 and R2, naming the
   new text and the old one it probably replaced.
3. In `ledger.json`, replace the old record with the new text, keeping it in
   sorted order. If the sentence now claims something else, point it at that
   claim, or add one with its evidence.
4. If the claim's status changes, change its resolution and the ratchet with
   it.

`node scripts/claims-ledger.mjs --unlisted` prints what R1 would, and
`--skeleton <path>` prints draft records for a file's unlisted sentences.
`--orphans` shows listed sentences that are no longer selected and claims
that nothing states. `--summary` prints the count of claims by topic and
status, and every claim that is not supported, with what resolves it. The
command never writes the ledger.

## Not covered yet

The ledger reads source files. Text assembled at runtime from several
strings, and pages built from data, are checked only as far as their source
reads as sentences; a complement over the built HTML is planned (step 1.14h).
