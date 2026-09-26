# zodiacs-mcp-server

A local MCP server that lets an AI assistant you connect it to calculate natal
charts with the Zodiacs engine, and compare two calculation records to find out
why they disagree.

It speaks MCP over stdio. It opens no listener, binds no port, makes no outbound
request, and reads and writes no files. Three tools, one process, started by
whatever host you point at it.

**Unpublished release candidate.** There is no `npm install zodiacs-mcp-server`:
the package is not on npm under this or any other name, and an install command
for a name that does not exist would be worse than none. Install from the
versioned archive, as below.

## The privacy distinction, before anything else

The calculation is local. The conversation is not necessarily.

This server runs on your machine and calculates there. No birth detail reaches
zodiacs.org, and nothing is uploaded, saved or logged by it.

That is not the same as a local AI experience. Whatever assistant you connect
this to decides what reaches its model provider: your message, the arguments it
builds for these tools, and the results it reads back. If that assistant runs in
the cloud — and most do — assume the birth details in a request reach it, under
that provider's terms and not ours. A local MCP server does not make a cloud
assistant local.

Two smaller points in the same family:

- A comparison reports the **exact** difference between two charts. Anyone
  holding one of the two can reconstruct the other from it. That output is safer
  to pass on than a full record; it is not anonymous — and that stays true of the
  default summary, which leaves out absolute values but keeps the differences
  between them.
- A version, checksum or source URL inside a record you supply is a claim that
  record makes about itself. Nothing here authenticates it.

## Install and start

The download URL and the expected SHA-256 are published on
<https://zodiacs.org/developers/mcp/>. They are not repeated here: this README
travels inside the archive, so printing the archive's own digest in it would
change the digest.

**If you have not installed yet, use the block on that page.** It compares the
digest and stops before extracting anything if it does not match. An earlier
version of this README printed the digest with `shasum` and left you to check it
by eye, with the extract and install steps on unguarded lines below it — which
meant a tampered archive extracted and installed anyway. `npm run verify` is no backstop for that: it tests that the server
behaves, not that these are the published bytes, so a tampered archive passes it.

If you are already reading this you have extracted, so the digest check has to
happen against the `.tgz` you still have:

```sh
# from the directory holding the archive, against the SHA-256 on the page above
node -e 'const e=process.argv[2];const a=require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex");if(a!==e){console.error("Mismatch. Delete this copy and install again from the page.\n  expected "+e+"\n  got      "+a);process.exit(1)}console.log("Archive verified: "+a)' \
  zodiacs-mcp-server-0.1.0-rc.9.tgz '<the SHA-256 published on the page>'
```

Then, inside the extracted directory:

```sh
npm ci          # exactly the tree in npm-shrinkwrap.json, which ships in here
npm run verify  # proves the install runs
```

The install brings 14 packages. Three are the server's own, pinned exactly —
`@modelcontextprotocol/server`, `@modelcontextprotocol/core`, `zod` — and the
other eleven are development dependencies of the MCP *client*, which only
`npm run verify` uses. `npm ls --omit=dev` lists the three the server actually
loads. If you would rather not have the client's OAuth and SSE dependencies on
disk, `npm ci --omit=dev` installs the three and `npm start` works; only
`npm run verify` needs the rest.

`npm run verify` launches `server.mjs` as a real child process, speaks MCP to it
with the official client SDK, calls all three tools with synthetic charts,
refuses two bad requests, and confirms the session still works afterwards. It
prints one line per check and exits 0 when they all pass. That is the
clean-environment verification: if it passes in a directory you just extracted,
the install is good.

`npm start` runs the server in the foreground, waiting for MCP messages on
stdin. A host normally starts it for you.

**Do not configure `npm start` as a host's command.** npm prints two banner
lines to stdout before the server begins, and a host reading stdout as the
protocol stream will fail to parse them and drop the session. Point the host at
`node /absolute/path/to/package/server.mjs`, as below.

## Connect it to a host

### Claude Code, which is the host this was tested against

```sh
claude mcp add zodiacs -- node /absolute/path/to/package/server.mjs
claude mcp list          # expect: zodiacs: node … - ✓ Connected
```

Use `--scope project` instead to write it into a `.mcp.json` your repository
shares, or `--scope user` for every project on the machine. The default is
private to you in the current project.

### Other hosts, from their own documentation

These file locations and shapes come from each host's documentation, not from a
run here. They are not tested claims:

- **Claude Desktop** — `claude_desktop_config.json`, under `"mcpServers"`.
  macOS and Windows only, so it could not be exercised on the Linux machine this
  was built on.
- **VS Code** — `.vscode/mcp.json`, under a top-level `"servers"` key.
- **Cursor** — `.cursor/mcp.json` or `~/.cursor/mcp.json`, under `"mcpServers"`.

The entry itself is the same everywhere:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/package/server.mjs"]
}
```

Use an absolute path. The server reads no environment variable and there is no
key, credential or secret anywhere in this package. What a host passes it is the
host's business — most pass their whole environment — but nothing here looks at
it.

## The three tools

### `get_capabilities`

Takes no arguments. Returns the engine and adapter versions and their release
status, the record schemas, every limit a request must respect, the list of what
this adapter deliberately does not do, and the privacy text above. Worth calling
first rather than guessing at supported options.

### `calculate_natal_chart`

| argument | type | notes |
| --- | --- | --- |
| `utc` | string, required | ISO-8601 with an explicit zone: `1990-06-15T13:30:00Z` or `1990-06-15T19:00:00+05:30`. A wall time with no zone is refused, not assumed to be UTC. Within 1800-01-01 to 2199-12-31. |
| `latitude` | number | −90 to 90. Supply both coordinates or neither. Exactly 90 or −90 needs `timeKnown: false`: the engine does not compute angles at the poles, which its own records state as `angleExclusions`. |
| `longitude` | number | −180 to 180. |
| `houseSystem` | `placidus` \| `whole` \| `porphyry` \| `equal` \| `vehlow` \| `koch` \| `regiomontanus` \| `campanus` \| `topocentric` \| `alcabitius` \| `morinus` \| `meridian` | Default `placidus`. Placidus and Koch fall back to whole sign inside the polar circle. |
| `timeKnown` | boolean | Default `true`. `false` makes `utc` a reference instant and suppresses angles and houses. It does not imply noon. |
| `reference` | `supplied-instant` \| `utc-noon` | Recorded in the calculation record, not in the summary. Omitting it is the usual case and infers nothing. `utc-noon` means no birth time was known and midday UTC stands in, so it needs `timeKnown: false` and `utc` at exactly `12:00:00Z`. The envelope's third value, `local-noon`, is not offered: it requires a captured local date, wall time, zone and offset, and this adapter resolves no timezones. |
| `output` | `summary` \| `record` | Default `summary`. |

`summary` returns the computed chart — twelve bodies, four angles, twelve cusps,
the aspect list — plus the four fields you need to read it: whether the time was
known, which house system was requested, which one the engine could actually
use, and why one is absent. It does not repeat your birth details back at you.

`output: "record"` returns `{ engine, schema, record }`. The record itself is
the `record` field, as text — the full `zodiacs.natal-envelope.draft-v1` record,
which does contain every input — and the two keys beside it name the engine that
produced it and the vocabulary it speaks. **Pass the field, not the reply around
it:** `compare_calculation_records` takes record text, and the reply as a whole
is a different object, so it is refused. Asking for the record is the explicit
choice: make it when the record is what you need, which in practice means
feeding two of them to the comparison below.

### `compare_calculation_records`

Takes `left` and `right`: the **content** of two calculation records, as JSON
text. Not paths, not URLs, not identifiers — this adapter reads no files and
fetches nothing. At most 65536 bytes each.

Names every field that differs, and then what accounts for it, labelled by the
evidence behind each claim:

- **reproduced** — recalculated here, changing one setting and nothing else, and
  the result matched.
- **reported** — stated by the records themselves, with nothing to compute.
- **hypothesis** — fits the evidence, not demonstrated. Several can fit one
  difference, and all of them are listed.
- **unresolved** — nothing in either record accounts for it.

A cause reaches **reproduced** only when three things hold: both records name a
version this installation actually has, each record's own recorded values —
cusps, angles and body positions — are reproduced from its own declared inputs,
and changing only the house system turns each chart into the other, checked in
both directions so the answer cannot depend on which record you passed first.

That is a statement about this installation and these values. It does not
establish where either record came from, and nothing here can: a version,
checksum or source URL inside a record is a claim the record makes about itself.
If the two records claim different builds of the same version, the answer says so
in `limits` and the verdict still rests on the recalculation, not on the claim.
When the arithmetic works and only the identity behind it cannot be established,
the cause stays a hypothesis and says what the installed engine does, which is a
different claim from saying that setting explains the difference.

Each angular row carries `delta` as **right minus left**, the shortest way round
the circle: from 191.24° to 180.00° is −11.24°, and from 359.19° to 1.18° is
+1.99°, not −358°. Longitudes are compared around the circle throughout.
Two numbers that print the same at the six decimals these records carry are
called a rounding difference rather than a different calculation, decided on what
they print rather than on a tolerance. A record naming an engine version other
than the one bundled here is not re-run on this engine and offered as the
original: the cause stays a hypothesis and the limit is stated.

## Three requests, and what comes back

**1. An ordinary chart.**

```json
{ "name": "calculate_natal_chart",
  "arguments": { "utc": "1990-06-15T13:30:00Z", "latitude": 51.5074, "longitude": -0.1278 } }
```

```json
{ "engine": { "name": "@zodiacs/engine", "version": "0.1.1-rc.9",
              "ephemeris": { "name": "astronomy-engine", "version": "2.1.19" } },
  "timeKnown": true,
  "houses": { "requested": "placidus", "actual": "placidus", "absenceReason": null },
  "inputFlags": [], "resultFlags": [],
  "bodies": [ { "body": "Sun", "lon": 84.18908525028257, "lat": -0.00001828523261306459,
                "speed": 0.955129533139143, "retrograde": false,
                "sign": "gemini", "degree": 24.189085250282574 }, "…11 more" ],
  "angles": { "asc": 191.23958686972654, "mc": 104.68854484640235,
              "dsc": 11.239586869726509, "ic": 284.68854484640235 },
  "cusps": [ 191.23958686972654, 216.4090845076203, "…10 more" ],
  "aspects": [ { "a": "Moon", "b": "Jupiter", "type": "trine",
                 "orb": 0.29106013758928384, "applying": false }, "…16 more" ] }
```

**2. The same chart at 78° north, asking for Placidus.**

```json
{ "name": "calculate_natal_chart",
  "arguments": { "utc": "1990-12-15T09:00:00Z", "latitude": 78.2232, "longitude": 15.6267,
                 "houseSystem": "placidus" } }
```

Placidus cannot be computed there, so `houses` comes back
`{ "requested": "placidus", "actual": "whole", "absenceReason": null }` and
`resultFlags` carries `"polar-fallback"`. The requested system and the one used
are separate fields, so a fallback is visible rather than silent.

**3. Two records that differ only in house system.**

```json
{ "name": "compare_calculation_records", "arguments": { "left": "{…}", "right": "{…}" } }
```

```json
{ "identical": false,
  "counts": { "differences": 15, "substantive": 15, "displayOnly": 0, "explanations": 1 },
  "output": "summary",
  "differences": [
    { "id": "houses-requested", "area": "Houses", "label": "House system requested",
      "left": "placidus", "right": "whole", "delta": null, "kind": "metadata" },
    { "id": "houses-actual", "…": "same two values" },
    { "id": "houses-system", "…": "same two values" },
    { "id": "cusp-1", "area": "Houses", "label": "House 1 cusp",
      "delta": -11.239586869726509, "kind": "numeric", "valuesWithheld": true },
    "…cusp-2 through cusp-12" ],
  "explanations": [
    { "id": "house-system", "evidence": "reproduced",
      "statement": "The different house system accounts for the house cusps.",
      "covers": [ "cusp-1", "…cusp-12", "houses-requested", "houses-actual", "houses-system" ],
      "detail": "Each chart's own recorded values were reproduced from its own declared inputs on engine 0.1.1-rc.9, and changing only the house system turns each one into the other, in both directions." } ],
  "limits": [
    "Only the house system is re-run here. A different moment or place is never promoted past a hypothesis, even when both records name the same engine.",
    "Both receipts name the same engine, so agreement between them would show consistency, not independent astronomical accuracy." ],
  "disclosure": "A comparison reports the exact difference between two charts. …not anonymous.",
  "withheld": "By default a comparison names which fields differ and by how much, …" }
```

The house-system rows keep their values; the twelve cusp rows do not, because a
cusp longitude is a computed position. Each still carries its label and its
signed difference, which is what tells you what moved and by how much.

Not one body and not one angle appears in those fifteen rows, because a house
system cannot move them — and the `house-system` cause claims none of them
either, for the same reason.

`limits` is not an error channel. It is where the comparison says what it could
not settle, and it is worth reading even when everything else looks resolved.

## Versions

| | |
| --- | --- |
| adapter | `0.1.0-rc.9`, unpublished candidate |
| engine | `@zodiacs/engine` `0.1.1-rc.9`, unpublished candidate, bundled into `server.mjs` |
| ephemeris | `astronomy-engine` 2.1.19, inside the engine |
| MCP SDK | `@modelcontextprotocol/server` 2.0.0, pinned exactly, installed from npm |
| validation | `zod` 4.6.5, pinned exactly |
| protocol | stdio. Negotiated on the wire in testing: 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05, 2024-10-07 |
| node | built for and tested on Node 22 (v22.22.2). `package.json` requires `>=22` |
| record schema | `zodiacs.natal-envelope.draft-v1` — Zodiacs-owned draft vocabulary, not an industry interoperability standard |

`candidate.json` carries the same identities in machine-readable form, including
the engine artifact's own SHA-256 and the source paths every part was built from.

## Known limits

- **One chart at a time, no searches.** No transits, progressions, returns or
  eclipses; nothing that scans a date range.
- **No interpretation.** Positions and differences, no readings.
- **No timezone resolution.** Supply an instant with an explicit offset. This
  adapter does not turn a place name and a wall clock into a moment.
- **No file access and no fetching.** Records are passed as content. The adapter
  imports no filesystem, process or network module at all.
- **No cancellation and no timeout.** A calculation is synchronous, so a timer
  could not interrupt it mid-way. The work is bounded by refusing unbounded
  operations: one chart per call, no searches, no date ranges.
- **No authentication of anything.** Not of a record, not of an engine version,
  not of the claim that two records came from independent software. Two records
  from one engine agreeing shows consistency, not independent astronomical
  accuracy.
- **No body-to-house mapping.** The summary returns the cusps and the body
  longitudes; which house a body falls in is left to the caller, and getting it
  right needs the same wraparound care as everything else here. Worth adding;
  not in this first integration.
- **No `outputSchema` on the tools.** Arguments are schema-bounded and a host
  reads those; results come back as `structuredContent` with their shapes
  documented here rather than declared, so a shape that drifted from the handler
  could not turn a correct result into a protocol error.
- **1800 to 2199.** The engine's own records state
  `broadDateRange: "not-certified"`; this is the range the rest of Zodiacs
  supports and the adapter adopts it rather than inventing a wider one.
- **Not published.** Neither this adapter nor the engine is on npm. Both are
  labelled `unpublished-candidate` in `get_capabilities`, and will keep saying
  so until that changes.

## Uninstall

The server writes nothing anywhere: no config of its own, no cache, no database,
no state. `npm install` does use npm's own cache under `~/.npm`, as any install
does, and that survives deleting this directory. Removal is two steps.

```sh
claude mcp remove zodiacs           # or delete the entry from your host's config file
rm -rf /path/to/package             # the extracted archive and its node_modules
```

For Claude Desktop, VS Code or Cursor, delete the `zodiacs` entry from the
config file you added it to and restart the host. There is nothing else to
clean up.

## How this was tested

Recorded in the site repository under
`docs/platform/evidence/mcp-adapter/`, kept as three separate records because
they establish three different things:

- **`protocol-drive.json`** — the official SDK client against the real server
  process: initialize, list, all three tools, eighteen malformed or refused
  requests each followed by a valid one, the diagnostic channel, a clean close,
  and a raw handshake at every protocol revision the SDK supports.
- **`host-drive.json`** — the Claude Code CLI launching the adapter and
  reporting it connected, inside a throwaway config directory, with the
  machine's real configuration proved byte-identical afterwards.
- **`host-interop.md`** — a model actually calling these tools through that
  host, with the exact command and the exact reply.
- **`benchmark.json`** — a fixed synthetic corpus of ten record pairs with the
  classification each should receive, written from the comparison's rules before
  the candidate ran against any of them. It is a regression corpus, not an
  accuracy rate: both sides of every pair come from the same engine.

Every chart in every test is synthetic — round coordinates for well-known cities
on dates chosen for what they exercise.

## Licence

MIT. `candidate.json` records what is bundled and where it came from.
