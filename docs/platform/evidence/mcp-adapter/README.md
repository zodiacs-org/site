# The local MCP adapter: what was built, and what was actually established

`zodiacs-mcp-server@0.1.0-rc.4`. A local stdio MCP server that lets an
explicitly connected AI client use the Zodiacs engine and the site's own chart
comparison. Source in `src/mcp/`, bundled to `examples/mcp-server/server.mjs`,
distributed as `public/examples/zodiacs-mcp-server-0.1.0-rc.4.tgz`.

rc.1, rc.2 and rc.3 are unchanged and still on disk: each archive is immutable
and a superseded one is never overwritten, including one that was never
advertised. rc.4's executable bundle differs from rc.3's only in the version
string it reports; what changed is the README travelling inside it. rc.2 carried a defect worth recording
rather than quietly retiring — its own README told a downloader to verify and
extract an rc.1 filename and named the adapter as rc.1, because the install
block and the versions table were not touched at the bump. An AI review of the
shipped archive found it. `scripts/mcp-artifact.test.mjs` now fails if the
README names any version but the one being packed, so the bump cannot leave
them behind again. `public/examples/mcp-server.json` points at rc.3.

## Why it lives in this repository

Not because anything blocked it elsewhere. Write access to the SDK repository
was verified as available in this session. The adapter is here because the
comparison it exposes is `src/lib/compare/diff.ts` — unpublished TypeScript in
this repository — and the alternative was a second copy of the explanation rules
in a second repository, which is exactly the thing that drifts. The engine is
also not on the SDK repository's `main`; its pinned source commit is
`fb57af7a`, on the branch `codex/platform-time-seconds`.

So the adapter imports the real functions: `natalChart` and the envelope codec
from the pinned `@zodiacs/engine` candidate, `compareEnvelopes` and `replay`
from `src/lib/compare/`. No numerical formula, validator or explanation rule is
re-derived. A change to the browser tool's rules is a change to the adapter's,
by construction rather than by discipline.

It calls `natalChart` and `createNatalEnvelope` directly rather than
`computePortableChart`, which flattens every failure into an argument-free
`PortableChartError` with `code: 'calculation_failed'`. Going through it would
have turned "latitude must be within -90 to 90" into "calculation failed".

## What each record establishes

Kept separate because they are separate claims, and collapsing them is the
usual way this kind of work gets overstated.

| record | establishes | result |
| --- | --- | --- |
| `protocol-drive.json` | the official SDK client interoperates with the real server process | 84/84 checks |
| `host-drive.json` | a named end-user host launches it and reports it connected | 7/7 checks |
| `host-interop.md` | a model, in that host, called the tools and used the answers | one run, recorded verbatim |
| `benchmark.json` | the comparison classifies the cases its rules describe | 18/18 scenarios, 112/112 assertions |
| `benchmark-expectations.json` | those classifications, written before the candidate ran | 18 scenarios, 112 assertions, with every post-hoc change recorded under `amendments` |
| `../chart-compare/` | the same comparison rules, driven through the browser surface | 34/34 checks |

Re-run them with `npm run test:mcp:protocol`, `npm run test:mcp:host` and
`npm run test:mcp:benchmark`. The first and last refuse to run against a stale
bundle, because the first two drafts of this work silently measured the
previous one.

That guard protected the *run* and not the *record*, which an AI review caught:
`protocol-drive.json` was committed naming a superseded artifact while this page
quoted its result as established for the current one. `scripts/mcp-artifact.test.mjs`
now asserts that all three records name the bundle that ships, so the same
mistake fails the suite instead of reaching a reader. All three have been
re-measured against the shipped bundle.

## Versions, pinned and recorded

| | |
| --- | --- |
| adapter | `0.1.0-rc.4`, unpublished candidate, not on npm |
| engine | `@zodiacs/engine` `0.1.1-rc.6`, unpublished candidate, bundled |
| ephemeris | `astronomy-engine` 2.1.19, inside the engine |
| MCP SDK | `@modelcontextprotocol/server` **2.0.0**, external and pinned exactly |
| validation | `zod` **4.6.5**, external and pinned exactly |
| bundler | esbuild 0.28.1, `platform=node format=esm target=node22` |
| runtime | Node v22.22.2 |
| archive | sha256 published in `public/examples/mcp-server.json`, pinned to a commit |

**Why SDK v2 and not v1.** Both were installed and run on this Node. The
monolith `@modelcontextprotocol/sdk@1.30.0` and the split
`@modelcontextprotocol/{core,client,server}@2.0.0` both implement protocol
`2025-11-25`. v2 was chosen because it is what the current official tutorial
teaches, it declares `node>=20` against this environment's 22.x, it has no peer
dependencies to satisfy, and its runtime tree here is three packages. `zod` is a
plain dependency of it, not a peer.

`zod` was a deliberate second attempt. The first install pinned `zod@4.2.0`
exactly and put both packages in **production** dependencies, which downgraded
an already-hoisted transitive 4.5.4. Reverted: the two MCP packages are
devDependencies of the site (the adapter is not part of the site's production
tree) and `zod` is a range that resolved to 4.6.5, higher than what was there
before. Both CI audit gates were re-run after the change: the production tree
reports 0 vulnerabilities, and the full tree at `--audit-level=high` exits 0.

## The bounds, and why they are shaped this way

Every argument crosses `src/mcp/bounds.ts` before it reaches a calculation.

- **Instant.** ISO-8601 with an explicit zone, validated as a calendar date
  before it is parsed as a timestamp, within 1800-01-01 to 2199-12-31 — the
  epoch every date input on this site already carries, adopted rather than
  widened, because the engine's own receipts record
  `broadDateRange: "not-certified"`. A naked wall time is refused rather than
  read as UTC. `2001-02-29` is refused rather than rolled into March.
- **Coordinates.** A pair or neither. One alone is refused rather than defaulted:
  a chart at longitude zero is a different chart, and the engine's own
  `missing-location` path is the honest answer when a place is unknown.
- **Options.** Enumerated: two house systems, three references, two output
  modes. `z.strictObject`, so an argument the schema does not know is refused
  rather than ignored — and the JSON Schema a host reads says
  `additionalProperties: false`, so the model sees the same boundary the server
  enforces.
- **Records.** The engine's own envelope limits: 65536 bytes, depth 12, 4096
  nodes. The byte gate runs before `JSON.parse`, and it counts **bytes**: a cap
  in characters lets 40000 three-byte characters through, which is a case the
  tests cover on purpose.
- **Request.** 1 MB, the longest line the server will read — enforced by a gate
  in front of the transport rather than by the SDK's read buffer, for the reason
  below. Two records at the byte limit escape to at most 2 × 65536 × 6 ≈ 786 KB
  of JSON string, so every valid request fits.
- **Result.** 256 KB, refused with its size named rather than trimmed into
  something that reads complete. This one is **headroom, not an operative
  bound**, and an AI review was right that describing it otherwise overstates:
  the comparison's structure caps it near 206 rows, and the largest result
  anyone has produced from it is 20,756 bytes — under 8% of the cap. The same
  goes for the row and explanation counts. They are here so the bound is a fixed
  number rather than an assumption, and so an engine change that made results
  much larger is refused rather than returned.

Four things a model-supplied argument never becomes: a command, a path, a module
name, a URL. **The bundle** imports no filesystem, process, network, `vm` or
`worker_threads` module, and carries no `require(`, no `createRequire`, no
dynamic `import(`, no `eval`, no `new Function` and no `fetch`.
`scripts/mcp-artifact.test.mjs` asserts each of those against the built
artifact. The adapter takes record **content**, never a path. `node:stream` is
the one Node module it does import, for the line gate below; a stream transform
cannot run a command, open a file or reach a network.

That is a statement about the bundle, and it is worth saying so rather than
calling the property "structural" as an earlier draft of this page did. The
running process is larger than the bundle: the MCP SDK is external and pinned
on purpose, and inside it Ajv generates validators with `new Function`. An AI
review looked for a route from a tool argument to that call and found none —
Ajv compiles schemas, which come from this server's own code, and the server
registers no resources, prompts or output schemas whose shapes a caller could
influence. So the claim holds; the word "structural" was doing more work than
the evidence behind it.

One smaller precision from the same review. The argument object is closed, and
the schema refuses `__proto__`, `constructor` and `prototype` as it refuses any
other unknown key — but end to end, `__proto__` never reaches the schema: the
SDK's own parse of `params.arguments` drops it first, so that one key is
silently ignored rather than reported. Nothing smuggled through it takes effect,
which the drive checks by asserting the smuggled value did not change the
result. Recorded as observed rather than described as a closed object with no
exceptions.

**Stdout.** The stdio binding is normative: a server must write nothing to
stdout that is not a protocol message, and one stray `console.log` becomes a
JSON parse error that takes the session down. `process.stdout` appears exactly
once in the 159 KB bundle — handing it to the transport — and the test pins that
line. No `console.log`/`info`/`debug`/`dir`/`table` anywhere. The only `console`
calls in the bundle are two argument-free `console.trace()` in the vendored
ephemeris's own validators; `trace` is stderr-family in Node, carries no
arguments, and is followed immediately by a throw the handler catches. The
adapter's own diagnostic channel is one function, `note`, which writes fixed
strings, version numbers and error **class** names to stderr — never an
argument, a record or a birth detail. The protocol drive asserts that, by
looking for the test's own coordinates in what stderr produced.

**A line gate in front of the transport.** A request is one JSON message on one
line, and a line longer than the SDK's read buffer makes that buffer throw —
which its stdio transport answers by closing the connection. An AI review
measured the consequence: 1,048,577 bytes in, no response, process gone, and the
next valid request never answered. Setting the buffer to 1 MB instead of the
SDK's 10 MB default had made that ten times easier to reach, while the comment
justifying it claimed the limit *refused* oversized requests. It did not; it
terminated the session.

A gate now holds each line until it is complete and forwards it whole, or
discards it whole once it passes the limit and resynchronises at the next
newline. A partly-forwarded line would be worse than the crash, because its
fragment would join the following line and destroy a legitimate request. A
discarded line gets no reply: it was never parsed, so there is no request id to
answer with. Only its length is ever inspected.

The gate also removed a second, separate failure, found while measuring the
first. Two large lines in sequence — 75 KB then 125 KB, each of which is
answered fine on its own connection — left the second and everything after it
unanswered, with no error, no note and exit 0. Reproduced with a raw harness and
no client library, so it is server-side, and reproduced at the SDK's 10 MB
default, so it is not the buffer limit. **Its mechanism is not isolated.** What
is established is that the gate removes it and the drive now fails without the
gate: that exact pair is one of its raw-line cases, and both lines must come back
answered rather than merely survived.

**No timeout.** `natalChart` is synchronous, so a timer could not interrupt it
mid-way. Rather than ship a timeout that would not honour its own promise, there
is none, and `get_capabilities` says so in the `unsupported` list. The work is
bounded by refusing unbounded operations — no searches, no date ranges, one
chart per call.

## What the benchmark is, and is not

Ten constructed record pairs with the classification each should receive,
written from the comparison's rules and committed in
`benchmark-expectations.json` **before** the candidate was run against any of
them. Result: **10/10 scenarios, 59/59 assertions.**

It covers every case the brief names: identical records, a real house-system
difference, equivalent instants written with different offsets, unknown time,
circular wraparound, mixed versions, unrelated simultaneous differences, and
insufficient evidence — plus two regression cases an earlier review found (a
polar pair whose cusps never move, and a pair ten milliseconds apart where the
smallest real difference is smaller than the largest rounding one).

**This is a synthetic regression corpus, not an accuracy rate.** Both sides of
every pair are produced by the same engine from synthetic inputs. It measures
whether the comparison classifies the cases its own rules describe. It says
nothing about how often the tool is right about a disagreement between
independently authored astrology engines, and nothing at all about real users,
whose charts are not in it. No numerical feature was added to move the score.

## What the benchmark found

Writing the expectations first was not a formality. One scenario failed on the
first run, and the expectation was the correct one.

**`unknown-time` left `cusps-shape` unresolved.** Comparing a chart with a known
birth time against one without, the comparison reported "Some differences are
not accounted for by anything in either file" about the missing house-cusp
list — whose cause, an absent birth time, was printed two rows above it in the
same output, and is stated in a receipt field the comparison had already read.
The `time-known` explanation covered `angles-presence` and `houses-absence` but
not `cusps-shape`, which belongs with them. Fixed in
`src/lib/compare/diff.ts`; the browser tool at `/developers/compare/` gets the
same fix, which is the point of one shared module.

**And the test that should have caught it could not.** The coverage suite in
`src/lib/compare/diff.test.ts` asserted that every substantive row is "claimed
by somebody" — building the claimed set from *all* explanations, including the
unresolved bucket. But that bucket is constructed from whatever no other
explanation claimed, so it claims every leftover row by definition: no row could
ever fail that assertion. The loop was unfalsifiable, and passed while rows were
being reported as explained by nothing. It now excludes the unresolved bucket
and asserts the bucket is empty, and the two unknown-time pairs join the suite —
every pair in it had a known time on both sides, which is how the gap survived.

Both fixes were verified by mutation: reverting the one-line `diff.ts` change
fails the two new cases by name, with the cache cleared so the run could not be
measuring the old transform. The first mutation attempt did pass, from a stale
vitest transform cache, which is worth recording because a "verified to fail"
claim built on a cached run is worth nothing.

## What the two AI reviews found

Two bounded adversarial reviews ran against candidate `0314e6c8`: one on
protocol correctness, security, input handling and privacy boundaries; one on
clean installation, output correctness, documentation and developer usability.
**This is AI review, not human, practitioner, attorney, customer or
independent-auditor signoff**, and it is recorded as such. Every finding below
was reproduced independently before it was acted on, and each fix has a test
verified to fail without it.

Both reviewers were told to report and not to edit. The integration was one
person's; the reviews did not touch the branch.

### Release-blocking

| Finding | Consequence on `0314e6c8` |
| --- | --- |
| A single request line over 1 MB ended the session | no response, no error a caller could read, process exit 0, and every later request unanswered. Lowering the buffer from the SDK's 10 MB default had made it ten times easier to reach, while the comment justifying it said the limit "refuses" such requests |
| Two large lines in sequence ended the session | 75 KB then 125 KB, each fine alone, left the second and everything after it unanswered. Server-side, and not the buffer limit |
| The house system was offered as the cause of the *angles* | "This is the obvious candidate for the **angle** and cusp differences" on a pair one hour apart — a hypothesis refuted by a recalculation the tool already runs, since every house system here derives from the same ascendant and midheaven. Present in four of the five mixed scenarios |
| `reference: "local-noon"` was advertised and unusable | refused in all eight combinations of time-known and place; the codec needs a captured local resolution this adapter cannot supply. `get_capabilities` — the tool whose job is to say what is supported — named it |
| `reference: "utc-noon"` had two unstated preconditions | needs `timeKnown: false` *and* an instant at exactly 12:00:00Z. Neither was documented, and the refusal was `Natal envelope rejected: invalid_context..` — an internal code, and a doubled full stop |
| `latitude: ±90` was advertised and refused | refused at every instant and both house systems when a time is known, with the same internal code. The engine's own records state the exclusion; the published bound did not |
| `protocol-drive.json` named a superseded bundle | this page quoted its result as established for the shipped artifact. The guard protected the run, not the record |
| The page said `npm install` fetches three packages "and nothing else" | it fetches fourteen. A reader auditing the no-network claim finds `eventsource` and `jose` in `node_modules` after being told nothing would be there |
| README example 3 showed `limits: []` | the server returns two limits for those exact arguments, and the surrounding prose leans on that field being where a limit is stated |

### And the tests that should have caught three of them

The same shape as the unfalsifiable coverage loop the benchmark found earlier,
and worth naming because it is the recurring failure of this work:

- **`bounds.test.ts` tested the poles at the wrong layer.** A test titled
  "accepts the poles and the dateline exactly" asserted
  `parseCoordinates(90, 180).ok === true` — true of that module, while every
  ordinary request at ±90 was refused. It tested the bound, not the product.
- **The request-bound assertion was six times weaker than its own comment.** The
  comment justified 1 MB by six-bytes-per-byte JSON escaping; the assertion only
  required `> 2 × recordBytes`, which a limit that refused legitimate requests
  would still satisfy.
- **`reference` was never exercised end to end.** One unit test asserted it was
  `undefined` by default. Nothing called a tool with it set, which is why two of
  three advertised values shipped unusable.

### Non-blocking, and acted on

The refusal for an envelope rejection now reads as a sentence instead of a code,
and no longer ends in two full stops. A record that is really a chart summary —
the likeliest mistake a model makes here — is now told so by name, with the
argument that fixes it. A zone offset with more than 59 minutes gets its own
reason instead of being called an offset beyond ±14:00. Four drive assertions
were rewritten rather than kept: one where a dropped handshake satisfied a check
named "answered rather than dropped", one that searched only the first 200
characters of a refusal for an echoed value and did not look for the instant at
all, two stderr checks that would both have passed on a capture that never
arrived, and one that counted an unobserved process id as a pass. Documentation:
`npm start` is now marked as the wrong thing to give a host — npm's two banner
lines land on the protocol stream — the `delta` sign convention is stated, the
absent body-to-house mapping and absent `outputSchema` are stated as limits, and
three privacy sentences were narrowed: "nothing is logged" (the server writes a
version line and an error class to stderr, and hosts keep those), "it is not
given any environment variables" (a host passes what it likes; nothing here
reads it), and "no cache" (npm's own cache is populated by the install
instruction four lines above). Two stale references fixed: a test file named
that does not exist, and "fourteen" malformed requests where there are eighteen.

### Reported and deliberately not changed

- The comparison names a *house-system* cause for `houses-actual` and
  `houses-system` when one chart simply has no house table. The sentence was
  wrong and is fixed — it now says one chart has no house table at all — but the
  underlying attribution stands: those rows need a claimant, and giving them a
  proper absence cause means adding an explanation to the shared comparison,
  which is past this slice.
- No body-to-house mapping in the chart summary. Genuinely useful, and a new
  numerical feature; stated as a limit instead.
- No `outputSchema` on the tools. A declared shape that drifted from the handler
  turns a correct result into a protocol error; the shapes are documented.
- Four request shapes get no response at all — a JSON-RPC batch, `jsonrpc: "1.0"`,
  `id: null`, and invalid JSON. That is the SDK's behaviour and spec-defensible,
  the session survives each, and three of them are now drive cases so a change
  would be visible.

## Not done, and not claimed

- **Not published.** Neither the adapter nor the engine is on npm. Both report
  `unpublished-candidate` from `get_capabilities`, and will keep doing so until
  that changes. There is no `npm install` command anywhere in the package or on
  the site page for a name that does not exist.
- **One host.** Claude Code. Claude Desktop is macOS and Windows only and cannot
  run here; VS Code and Cursor are not installed. Their config shapes are quoted
  from their own documentation and labelled as untested.
- **One model run.** Recorded verbatim in `host-interop.md`. Not a measure of
  how reliably a model uses these tools.
- **No adoption.** Our own tests are ours. The site page invites builders through
  the existing route — issues on this repository — and nothing was sent anywhere.
- **No authentication of anything.** Not of a record, not of an engine version,
  not of the claim that two records came from independent software.

## 0.1.0-rc.16.1, 2026-10-04

Appended; the sections above describe rc.4 and stay as written. rc.1 to rc.10,
rc.14, rc.15 and rc.16 stay on disk as released; there were no rc.11 to rc.13
archives. rc.16.1 bundles the same engine, 0.1.1-rc.16, so
every position, angle, cusp and comparison is rc.16's. What changed:

- **Output schemas.** Each tool declares one (`src/mcp/outputs.ts`), and the
  SDK checks every result other than a refusal against it before sending it.
  The rc.4 limit above, "No `outputSchema` on the tools", is superseded: the
  programme's brief asks for an output schema on every tool (Track A1). The
  risk that limit named, a declared shape drifting from the handler, is held
  by `src/mcp/outputs.test.ts`, which runs every result over a seeded
  synthetic corpus of 520 requests and 170 comparisons through the schemas,
  both in zod and as the JSON Schema a host reads, and drives the real
  registrations through the SDK's own client. The objects are closed, as the
  advertised schema says. A difference too large for a number, which two
  records may hold, is sent as `delta: null`, as the text reply always wrote
  it, rather than failing the schema.
- **Citations.** Every result other than a refusal carries
  `cite: { url, receipt, engine, version }`,
  the compute API's shape and digest (`src/lib/receipt-digest.ts`, moved out of
  the compute API so both use one function). A chart cites the engine's
  calculation receipt; the capabilities reply and a comparison cite the
  adapter's own receipt, `zodiacs.mcp-receipt.v1`, which they carry and which
  holds nothing from a record. The bundle now imports `createHash` from
  `node:crypto`, and nothing else from it. A chart's digest identifies the
  birth details from either side: with the date and the place, trying each
  time of day finds the time; with the instant, which the positions give away,
  trying places finds the place, even for a chart with no known time, whose
  summary shows nothing that depends on the place. The privacy text, the
  schema a model reads and the tool's description say so, and
  `src/mcp/outputs.test.ts` holds both directions on synthetic charts.
- **Resources.** `zodiacs://conventions` and `zodiacs://methodology`
  (`src/mcp/resources.ts`).
- **The engine's label.** `get_capabilities` reports the engine as
  `published` on `npm`; rc.16 said `unpublished-candidate`, carried at 10:38
  UTC on 2026-10-01, before the engine reached npm: npm's own `time` field
  for the version reads 2026-10-01T12:02:05.117Z. The committed registry
  receipt, `docs/platform/evidence/site-engine-rc16/npm-release/verification-receipt.json`
  (read at 12:12 UTC that day), has 0.1.1-rc.16 under `next` and 0.1.1-rc.15
  under `latest`. The adapter is still not on npm.

Three reviews of the first build of rc.16.1, of the code and tests, of the
claims and the privacy text, and of the release packaging, found the
birthplace direction above, a comparison that a non-finite difference turned
into an error, overstated sentences in the resources and the documents, and
gaps in the tests and the artifact checks. All were fixed before this build;
`node scripts/pack-mcp-server.mjs --check` now also refuses the all-zero
placeholder commit, so an unpinned archive fails on the pull request rather
than in the production build.

The records, each against this bundle (`server.mjs` SHA-256 `b061f266…`):

| record | result |
| --- | --- |
| `protocol-drive.json` | 95/95 checks, including the output schemas, the citations and the two resources |
| `host-drive.json` | 7/7 checks, Claude Code 2.1.289 |
| `benchmark.json` | 18/18 scenarios, 112/112 assertions |
| a fresh extraction of the archive | `npm ci` installs 14 packages, and `npm run verify` passes its 18 checks |

`host-interop.md`, the one model-driven run, is from an earlier candidate and
was not repeated.

## 0.1.0-rc.16.2, 2026-10-05

Appended, like rc.16.1's section. rc.16.1 stays on disk as released, and the
records its table quotes are at commit `fcc41d97`; the three files now hold
rc.16.2's. The engine is still 0.1.1-rc.16. What changed:

- **Three tools from the compute API.** `get_positions`, `find_events` and
  `check_sky_fact` (`src/mcp/sky-tools.ts`) parse their arguments with the
  hosted compute API's own parsers and calculate with its own functions in
  `src/lib/compute-api/`, which are now inlined into the bundle. For the same
  JSON, a call returns the body that POST `/api/v1/positions`, `/events` or
  `/sky-fact` returns: the same result and the same receipt, and so the same
  `cite.receipt` digest. Only `cite.url` differs; it names the tool's entry on
  the developer page. A request the compute API's parser refuses gets its own
  fixed sentence, after the JSON Pointer of the field it refused; one the
  tool's input schema refuses first, such as an unknown argument or a value
  outside a list, gets the MCP SDK's validation message.
  `src/mcp/sky-tools.test.ts` holds this over a seeded synthetic corpus of 252
  requests (61 for positions, 25 event windows and 166 sky facts), each run
  through the tool and through the compute API's own request handler, over 17
  refused requests, and over 43 more at the two ends of the accepted dates.
  Every result is checked against the tool's output schema, in zod and as the
  JSON Schema a host reads, against the compute API's OpenAPI components, and
  through the SDK's own client.
- **One difference in what is accepted.** The adapter looks up no time zone,
  so `check_sky_fact` has no zone argument, and its input schema refuses one
  before any calculation. A date is read the way the compute API reads a date
  without a zone: as that day in every UTC offset in use today, −12:00 to
  +14:00, at once, from 14 hours before its midnight UTC to 36 hours after, and
  `depends` when the answer turns on the time of day or on the offset. Before
  1868 some places kept a local time further from UTC than either end (Manila
  until 1844, Alaska until 1867), so their date is not covered without a zone,
  here or by the compute API.
- **The compute API's limits.** Up to 100 instants in a call, a window of at
  most 92 days, and at most 12,000 search evaluations for an events request
  and 1,000 for a fact. A search samples every 5 days, or every day for the
  Moon and for new and full moons, and narrows each crossing it finds to the
  step divided by 2^24. It can miss a pair of crossings that both fall between
  two samples, such as a body that crosses a sign boundary and crosses back
  around a station. The receipt records the step, the evaluations used and
  the limit, and calls the search tested, not proven complete.
- **What a citation identifies.** The receipt these three tools cite holds no
  instant, date or body from the request. Every positions call cites the same
  receipt, and so does every fact at an instant; a window or a fact on a date
  differs only in how many evaluations its search made.
- **The result limit is now nearly reached.** The largest answer the limits
  allow, 100 instants of all twelve rows in the IERS era, is about 230 KB:
  228,731 bytes for the instants the test uses, and 231,294 for the largest
  set a review could find, 88% of the 256 KB limit, which until now was only
  headroom. The test keeps it under 90%. The reply carries the result again as
  indented text, about 330 KB more, and the README and the developer page say
  a host may warn about a reply that size or keep it out of the conversation.
  `bounded`, which applies the limit, moved from `src/mcp/tools.ts` to
  `src/mcp/bounds.ts` so the new module can use it without importing the tools
  module back.
- **A guard kept honest.** `tests/api/compute-api-privacy.test.ts` keeps every
  module of the site outside the compute API from importing it, so its request
  data cannot reach another surface. The adapter is now the one exception,
  named in the test, which also checks that the adapter does import it and
  that nothing outside `src/mcp/` imports the adapter.

Two reviews of the first build, one of the code and tests and one of the
documents and the claims ledger, found:

- **The install check could never pass.** `npm run verify` compared the
  positions at an instant with the chart's bodies as JSON text, and the two
  answers write the same values in a different key order, so it failed on
  every good install. No test ran it. It now compares them by value, and
  `scripts/mcp-artifact.test.mjs` runs it against the committed bundle, which
  fails on the first build.
- **Untested paths.** No request in the corpus reached the ends of the
  accepted dates, where every fact on a date is flagged
  `outside-reference-span`, so a schema refusing that flag passed every test;
  the 43 requests above now cover both ends. A sky tool's calculation that
  throws, or rejects, for a reason nobody foresaw had no test either, so
  reporting its message, which may quote an argument, or letting a rejection
  past the guard passed every test; `src/mcp/create-server.test.ts` now covers
  both. The sentence about dates was compared only with itself; its numbers
  are now checked against a reply's window.
- **Holes in the privacy guard.** The test above skipped `.mdx` files and
  read only `from` and quoted dynamic imports, so a side-effect import, a
  template-literal import or an `.mdx` page could import the compute API or
  the adapter unnoticed. It now reads `.mdx`, `.cjs`, `.mts` and `.cts` files
  and every import form, and each of the six bypasses fails it.
- **Sentences that said more than the code.** "The day in every zone" is
  wrong before 1868, as above, and the compute API's own page said "every UTC
  offset in use" without "today"; both now say today's offsets. A refusal
  from the input schema is the SDK's message, not the compute API's. Whether an
  ingress or a phase falls on a date is never `true` without a zone, and an
  instant is refused for those two kinds.

The records, each against this bundle (`server.mjs` SHA-256 `7209455d…`):

| record | result |
| --- | --- |
| `protocol-drive.json` | 106/106 checks, including each new tool's result and citation against its schema, the zone refusal, and refusals in the compute API's words |
| `host-drive.json` | 7/7 checks, Claude Code 2.1.289 |
| `benchmark.json` | 18/18 scenarios, 112/112 assertions |
| a fresh extraction of the archive | `npm ci` installs 14 packages, and `npm run verify` passes its 21 checks |

`host-interop.md`, the one model-driven run, is from an earlier candidate and
was not repeated.

## 0.1.0-rc.16.3, 2026-10-05

Appended, like the sections above. rc.16.2 stays on disk as released, and the
records its table quotes are at commit `3acfae47`; the three files now hold
rc.16.3's. The engine is still 0.1.1-rc.16. No tool changed. What did:

- **Why there is a new candidate.** The compute API gained
  `POST /api/v1/elections`. The modules of `src/lib/compute-api/` that this
  adapter inlines hold the compute API's list of endpoints, its limits and
  their sentences, its validation sentences and JSON Pointers, its receipt and
  the allowance its searches share, and each gained the elections endpoint's
  entries. The function that reads an elections request and the search itself
  are not in the bundle, since nothing here calls them.
  `scripts/mcp-artifact.test.mjs` requires the committed `server.mjs` to be
  what the generator builds from the current source, so the bundle changed,
  and a changed bundle is a new archive under a new version: rc.16.2's archive
  keeps its bytes.
- **What a host sees.** The adapter's version, wherever it is named: the
  server information a host receives when it connects, the `get_capabilities`
  reply, the receipt that reply and a comparison carry, and so their
  `cite.receipt` digests, the methodology resource, and the line the server
  writes to stderr when it starts. Every tool's arguments, results and
  receipts are otherwise rc.16.2's. The receipts of `get_positions`,
  `find_events` and `check_sky_fact` are the compute API's, which do not name
  the adapter, so they are unchanged.
- **One reply kept as it was.** `get_capabilities` copied the compute API's
  whole table of limits into `sky.limits`. With the elections endpoint's two
  limits in that table, it named limits of an endpoint this adapter has no
  tool for, and its output schema, which lists the four limits of the three
  sky tools and allows no others, refused the reply: three tests in
  `src/mcp/outputs.test.ts`, one in `src/mcp/create-server.test.ts` and the
  bundle check failed. It now names those four limits one by one, so the
  reply is rc.16.2's, and `src/mcp/sky-tools.test.ts` holds it to exactly
  those four.
- **The allowance.** Its `settle` now also refuses a search whose steps would
  pass what is left, for the elections endpoint, whose station search spends
  while it runs. A search for `find_events` or `check_sky_fact` is given what
  is left when it begins, and the engine's crossing search stops before it
  takes a step past that, so the new condition cannot refuse a request of
  theirs that rc.16.2 answered.
- **A digest in the README.** Under its example comparison, the README
  printed the `cite.receipt` of rc.16.1's receipt: rc.16.2 moved the
  receipt's version line to rc.16.2 and left the digest below it, and this
  candidate's first build did the same, so a reader who recomputed it, as the
  README invites, got another digest. It now prints the digest of the receipt
  it shows, and `scripts/mcp-artifact.test.mjs` recomputes it, and runs the
  example chart and holds the citation printed under it to the one the tool
  returns. rc.16.2's archive keeps its README as released.

The records, each against this bundle (`server.mjs` SHA-256 `a59382d0…`):

| record | result |
| --- | --- |
| `protocol-drive.json` | 106/106 checks |
| `host-drive.json` | 7/7 checks, Claude Code 2.1.289 |
| `benchmark.json` | 18/18 scenarios, 112/112 assertions |
| a fresh extraction of the archive | `npm ci` installs 14 packages, and `npm run verify` passes its 21 checks |

`host-interop.md`, the one model-driven run, is from an earlier candidate and
was not repeated.
