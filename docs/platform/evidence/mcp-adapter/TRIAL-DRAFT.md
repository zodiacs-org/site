# External builder trial — prepared, not sent

Nothing here has been sent, posted or published. No outreach was performed, no
advertising was bought, no partner was named, and nobody outside this work has
used the adapter. Our own drives are ours and are not adoption. This supersedes
[`INVITATION-DRAFT.md`](INVITATION-DRAFT.md) in this directory and keeps every
constraint that draft set.

## Two gates. One has passed.

**Availability — passed.** `https://zodiacs.org/developers/mcp/` returns 200 in
production and publishes a pinned archive whose digest matches what the page
prints. The install instructions point at something real. Every expected value
below was measured against **0.1.0-rc.9**. Before sending, check that the page
still advertises rc.9; if a later archive has shipped, re-measure steps 2 to 4
against whatever it names, because the `reproduced` wording and the withholding
have both changed between candidates before.

**Approval to send — not given.** Nobody may send this without the owner saying
so. Three to five people is small enough to feel like nothing and still be
outreach.

## Who, and how many

Three to five independent builders, none of them us. Fewer than three and the
first person's laptop is the whole result; more than five and the reports stop
being read properly.

There is no mailing list, no announcement channel and no ad budget in scope here,
and none is being created. So the invitation can only go to builders the sender
can already reach directly. Who those people are is the owner's call, and this
draft does not supply it — there are no names here and none are to be invented.
If there is nobody to send it to, the trial does not run. That is a real outcome,
not a problem to be solved by buying reach.

Whatever comes back, five reports are five reports. Not users, not adoption, and
not a number to round up.

## The contact route

The existing approved one: issues on
<https://github.com/ZodiacsOfficial/site/issues>. That is the channel
`/developers/support/` already names and the one `/developers/mcp/` already
points builders at. Engine issues belong in the SDK repository, but the adapter
is a site artifact and the site tracker takes all five steps.

One issue per builder, titled `MCP adapter trial: <host>`. It is public, so:
synthetic charts only.

## What runs where, and what the builder should tell people

This matters more than any single step, and a builder who gets it wrong will
describe the tool wrongly to the next person.

**Local.** The chart arithmetic. The server is a process on the builder's own
machine, speaking stdio to the host that launched it. It opens no listener, makes
no network request, writes no file, and holds nothing between calls. The engine
and the comparison rules are bundled into `server.mjs`; nothing is fetched to run
them.

**Not local.** The conversation. The host decides what to send its model
provider, and on a cloud assistant that normally includes the arguments the model
produced and the results the tool returned. So a birth instant typed into the
chat, and a chart handed back, travel wherever that host sends them. Running the
calculation locally does not change that, and the server cannot control it.

The default comparison answer withholds absolute values, which shortens what
travels onward — but it is minimisation, not anonymisation, and it hides nothing
from an assistant that already received both records as arguments. The exact
differences are still in it, so anyone holding one of the two records can
reconstruct the other.

## The trial

Five steps. Each has something to check, so a builder can tell whether it worked
without asking us.

It is an unpublished candidate. Install it from the versioned archive linked on
the page — there is no `npm install` for it, because it is not on npm under this
or any other name.

### 1. Install from the public instructions

Work only from <https://zodiacs.org/developers/mcp/>. Run the commands it
prints, in order: download the archive, check its SHA-256 **before** extracting,
extract, `npm install`, then `npm run verify`.

Then connect it to your host. For Claude Code, from the extracted directory:

```sh
claude mcp add zodiacs -- node "$PWD/server.mjs"
claude mcp list
```

Checks:

- the digest you compute matches the one the page prints;
- `npm install` reports fourteen packages — three are the server's, eleven
  belong to the MCP client the verifier uses;
- `npm run verify` prints seventeen check lines and exits 0 — note the page's
  block now compares the digest itself and stops before extracting if it does not
  match, so a corrupted download should never reach this step;
- `claude mcp list` shows `zodiacs: node … - ✓ Connected`.

If your host is Claude Desktop, VS Code or Cursor, the config shapes on the page
come from those projects' own documentation rather than from a run here. Whether
they are right is one of the things we do not know. Point the host at
`node /absolute/path/to/package/server.mjs` — not at `npm start`, which prints
two banner lines to stdout before the server starts and will break the protocol
stream.

### 2. Calculate one synthetic chart

Ask your assistant, in your own words:

> Calculate a natal chart for 1988-03-21T06:45:00Z at latitude 40.7128,
> longitude -74.0060, with Placidus houses.

Synthetic: round public coordinates for New York, on a date chosen for what it
exercises. Nobody's birth details.

Checks, on rc.9 with engine 0.1.1-rc.9 — `get_capabilities` will tell you what
you actually have:

- twelve bodies, four angles, twelve cusps;
- Sun longitude `0.8733377803906706` — Aries, 0°52′;
- ascendant `274.0440394309899` — Capricorn;
- `houses` reads `{ requested: "placidus", actual: "placidus", absenceReason: null }`;
- the result contains neither `1988-03-21` nor `40.7128`. The summary returns the
  chart, not your inputs read back at you. Search the raw output and confirm that
  yourself rather than taking the sentence for it.

### 3. Observe one useful error

Ask for the same chart with the zone dropped:

> Same chart, but use the time 1988-03-21T06:45:00 — no Z, no offset.

The server refuses, with exactly this text:

```
utc must be an ISO-8601 instant with an explicit zone, such as 2000-01-01T00:00:00Z or 2000-01-01T05:30:00+05:30.
```

This is the error worth a minute of your attention, because it is the limit you
would hit first for real. The adapter resolves no timezones. It will not turn a
place name and a wall clock into a moment, and it will not quietly assume a naked
wall time is UTC. Converting is the caller's job, and getting it wrong yields a
chart that is wrong by hours while looking perfectly normal — so it refuses
instead, and the sentence names both accepted shapes.

Checks:

- does your host actually show you that sentence, or swallow it into a generic
  tool failure?
- what does the assistant do next? Asking you for the zone is right. Silently
  substituting `Z`, or guessing an offset from the coordinates, is not — and if
  yours does that, say so. That is the assistant's behaviour rather than the
  server's, and it is exactly what we cannot see from here.
- does a valid request still work straight afterwards? Repeat step 2. The session
  should have survived the refusal.

### 4. Compare two supported records

Build two records from the same instant and place, differing in one setting. Ask
for `output: "record"` both times, then pass the two record contents to the
comparison as `left` and `right`.

```json
{ "utc": "1988-03-21T06:45:00Z", "latitude": 40.7128, "longitude": -74.0060,
  "houseSystem": "placidus", "output": "record" }
```

```json
{ "utc": "1988-03-21T06:45:00Z", "latitude": 40.7128, "longitude": -74.0060,
  "houseSystem": "whole", "output": "record" }
```

A correct answer, in full — this is what rc.9 returns:

- `identical: false`, and
  `counts: { differences: 15, substantive: 15, displayOnly: 0, explanations: 1 }`.
- All fifteen rows are in area `Houses`: three metadata rows —
  `houses-requested`, `houses-actual`, `houses-system`, each `placidus` →
  `whole` — and the twelve cusps.
- **Not one body and not one angle appears.** That is the invariant: a house
  system cannot move a planet or an angle, so a body or angle row here would mean
  the tool is wrong.
- The three metadata rows keep their values. The twelve cusp rows do not: each
  carries `"valuesWithheld": true` and its `delta`, and `cusp-1`'s delta is
  `-4.044039430989869`. That is the default, and it is minimisation rather than
  anonymisation — it shortens what travels onward and hides nothing from the
  assistant, which already received both records as arguments.
- Exactly one explanation, `id: "house-system"`, `evidence: "reproduced"`,
  covering all fifteen rows:

  > Each chart's own recorded values were reproduced from its own declared inputs
  > on engine 0.1.1-rc.9, and changing only the house system turns each one into
  > the other, in both directions.

  Read that sentence for what it claims and what it does not. It says the engine
  on **your** machine turned each record's declared inputs into that record's
  values, and that one setting accounts for the difference. It says nothing about
  where either record came from. A version or checksum inside a record is the
  record's claim about itself, and reproducing some of its values locally does not
  authenticate it.

- Two `limits` lines, worth reading rather than skipping. `limits` is not an
  error channel; it is where the comparison says what it could not settle. One of
  them says both records name the same engine, so their agreement shows
  consistency rather than independent astronomical accuracy.
- A `disclosure` line saying the output is not anonymous. It is true and it
  matters: a comparison carries the *exact* difference between two charts, so
  anyone holding one of them can reconstruct the other. Safer to pass on than a
  full record; not something to treat as anonymised.

Then ask for the values, which is an explicit choice rather than the default:

> Compare them again with output: "full".

- Every cusp row now carries `left` and `right`, and `withheld` is gone.
- `cusp-1` is left `274.044039`, right `270.000000`.
- **You can check the right-hand value without trusting us.** A whole-sign first
  cusp is 0° of the sign the ascendant falls in; the ascendant is 274.044039°;
  that is Capricorn; so 270.000000 is the only correct answer — and the other
  eleven follow at exact thirty-degree steps: 300, 330, 0, 30, 60, 90, 120, 150,
  180, 210, 240.

`reproduced` is the strongest claim this tool makes and the most expensive one to
get wrong. Two AI reviews have already found it reaching that word when it should
not have. If any part of it looks wrong to you, that is the most useful thing in
the whole trial.

### 5. Report

Open the issue. Two questions are the point; the other two only if you hit them.
Under ten minutes.

```
Host and OS:
Versions (from get_capabilities):

1. Where did setup snag? The first place between the page and "✓ Connected"
   where you had to stop and work something out — a command that failed, a
   message you had to interpret, a step that assumed something you didn't
   have. Quote it. "Nothing snagged" is a real answer and worth sending.

2. What did you need that it does not do? One thing, not a wish list: the
   thing that would have stopped you if you were building this for real.

3. (If you hit it) Step 3 — what did your host show you, and what did the
   assistant do next?

4. (If you hit it) Step 4 — anything in the fifteen rows or the one
   explanation you'd dispute?
```

Synthetic charts only in a public issue. No names, no real birth details. If
something needs real data to explain, say so in the issue without the data in it.

## What each step is measuring

1. **Install** — whether the published page is enough on a machine that is not
   ours. It measures the instructions, not the code: every step from the digest
   to `✓ Connected` has been driven here, and never by someone reading the page
   cold.
2. **Chart** — whether a documented call produces the documented numbers through
   a host we have not tested, and whether the summary really withholds the inputs
   rather than only claiming to.
3. **Error** — whether a refusal survives the trip through an unfamiliar host: is
   the sentence shown or swallowed, does the assistant recover honestly or invent
   a zone, does the session continue. Our drives stop at the server; this is the
   part past it.
4. **Comparison** — whether the strongest claim the tool makes, `reproduced`,
   holds for someone positioned to check it; whether the invariant holds that no
   body and no angle moves; and whether the default answer and the explicit
   `full` answer behave as documented.
5. **Report** — the two things no internal test can produce: where setup actually
   snagged for someone who had not seen it before, and one capability that is
   genuinely missing.

## The outreach

Short. It links the protocol rather than repeating it.

> There is now a local MCP server for the Zodiacs engine:
> <https://zodiacs.org/developers/mcp/>. Point an assistant at it and it will
> calculate a natal chart, or read two calculation records and tell you what
> differs between them and how much of it the records can account for. It runs on
> your machine over stdio — no listener, no port, nothing uploaded. The
> calculation is local; whatever assistant you connect it to is a separate
> question, and the page is explicit about that.
>
> It is an unpublished candidate: install it from the versioned archive on that
> page and check the published digest first. It is not on npm.
>
> I'm asking three to five people to run the same short trial, so the reports can
> be read against each other: install from the page, calculate one synthetic
> chart, make one deliberately bad request, compare two records that differ in a
> single setting, then answer two questions. The protocol has the exact inputs and
> the exact expected output for every step, so you can tell whether it worked
> without asking me.
>
> The two questions are the ones I can't answer from here: where setup actually
> snagged, and one thing you needed that it doesn't do. Ten minutes.
>
> Report as an issue: <https://github.com/ZodiacsOfficial/site/issues>. Use a
> synthetic chart — a public issue shouldn't carry anyone's name or real birth
> details.
>
> No deadline, and no support commitment behind it. This is a candidate and the
> page says so.

## What not to say when sending it

- Not "your birth data never leaves your device". The calculation is local; a
  cloud assistant's conversation is not. The page draws that distinction and
  neither the invitation nor the protocol may undo it.
- Not that the default comparison output is anonymous, or anonymised. It leaves
  out absolute values and keeps the exact differences between them. That is
  minimisation. The tool says so itself, in every answer.
- Not "npm install". The package is not published, under this or any name.
- Not a count of tests as a count of users — and not a count of trial runs
  either. Three to five builders following a protocol are three to five trial
  runs.
- Not an accuracy figure from the synthetic benchmark. It is a regression corpus
  over pairs one engine produced, and says nothing about how often the tool is
  right about a disagreement between independently written software.
- Not a deadline, an SLA or a response-time promise. `/developers/support/`
  already states there is none for this candidate; the outreach must not
  contradict it.
- No partner names, no advertising, no announcement channel, no mailing list.
  None of those is being created for this.

## Where the expected values came from

Every value in steps 2 to 4 was read off a clean extraction of the published
archive, installed and verified from it rather than run out of the working tree
— the distinction mattered once already, when a draft of this protocol quoted a
sentence that existed only in unreleased source. Driven over stdio with the
official `@modelcontextprotocol/client`.

They were first measured against `zodiacs-mcp-server-0.1.0-rc.5.tgz` (sha256
`24e167bd…`) and re-measured against `zodiacs-mcp-server-0.1.0-rc.6.tgz` (sha256
`12382917…`) when that candidate shipped, following the rule at the top of this
file. Every value above came back unchanged: same counts, same fifteen rows,
same `cusp-1` delta, same `reproduced` sentence, same two limits, same refusal
text, and `npm run verify` still prints seventeen check lines. What rc.6 changed
is not exercised by this protocol — a refusal hint for a mistake step 4 does not
make, because it names the `record` field rather than passing the whole reply.

They were measured again against `zodiacs-mcp-server-0.1.0-rc.7.tgz` (sha256
`44c19b81…`), from a clean extraction of that archive before it shipped. Its
engine, 0.1.1-rc.7, builds the angles on the true obliquity, so three things
moved: the ascendant in step 2 (from `274.04690998258377`), `cusp-1`'s delta
and left value in step 4 (from `-4.04690998258377` and `274.046910`), and the
engine the `reproduced` sentence names. Everything else came back unchanged:
the Sun, the counts, the fifteen rows, the whole-sign cusps, the two limits,
the refusal text, fourteen installed packages and seventeen verifier lines.

And again against `zodiacs-mcp-server-0.1.0-rc.8.tgz` (sha256 `7887a662…`), from
a clean extraction of that archive before it shipped. Its engine, 0.1.1-rc.8,
takes ΔT from an observed model rather than astronomy-engine's 2004 polynomial,
so positions moved by the change in ΔT: the Sun in step 2 (from
`0.8733370932176285`), the ascendant (from `274.04403943096713`), and `cusp-1`'s
delta in step 4 (from `-4.044039430967132`). The `reproduced` sentence names
the new engine. Everything else came back unchanged: the Sun's sign and degree,
the ascendant and `cusp-1` at six decimals, the counts, the fifteen rows, the
whole-sign cusps, the two limits, the refusal text, fourteen installed packages
and seventeen verifier lines. Two things rc.8 changed are not exercised by
these checks: the chart summary's `engine` field now also names the ephemeris,
`astronomy-engine` 2.1.19, and the comparison now lists and explains
differences in ΔT, which two records of one instant, each taking ΔT from the
engine's model, do not have.

And again against `zodiacs-mcp-server-0.1.0-rc.9.tgz` (sha256 `a1b86029…`), from
a clean extraction of that archive before it shipped. Its engine, 0.1.1-rc.9,
adds nine house systems and moves no position, angle or cusp that rc.8
computed, and the adapter now offers all twelve systems where it offered two.
Only the engine the `reproduced` sentence names changed. Everything else came
back unchanged: the Sun and ascendant in step 2, the counts, the fifteen rows,
`cusp-1`'s delta, the whole-sign cusps, the two limits, the refusal text,
fourteen installed packages and seventeen verifier lines. These checks use
Placidus and whole sign, so they do not exercise the new systems.
