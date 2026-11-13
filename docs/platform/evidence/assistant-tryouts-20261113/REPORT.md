# Assistant tryouts: 200 questions, which tool each assistant picks (ZOD-207)

13 November 2026, Asia/Bangkok. A draft. Nothing here is merged, published, submitted or sent, and the live
connector was only read.

This branch (`audit/fable-job11-assistant-tryouts`) starts from draft PR 971 (`admin/zod-58-tool-descriptions`) at
`2d1f90f01`, its head when the job began. PR 971 and its branch were not edited, rebased or pushed to by this job.
PR 971 was pushed forward by another session during the job; see "PR 971 moved while this ran".

## What was done

1. The live connector's `initialize` and `tools/list` were fetched from `https://zodiacs.org/mcp`
   (`raw/live/`: version 0.6.6, 19 tools).
2. 200 synthetic questions were written the way people type into ChatGPT or Claude: lower case, typos, half a
   request, two in Spanish (`questions.json`). They cover all 19 tools (4 to 16 questions each) and 20 requests where
   the right answer is no tool call: stock, crypto and lottery picks, bets, an election, medical outcomes, a
   guarantee, reminders and schedules, two children under 13, a romance reading for two people under 18, the
   weather, and a booking. Each question has one expected tool. 29 of them also accept another first call that
   the descriptions themselves send the assistant to (for example `find_birthplace` before a chart when a city is
   named, or `get_sky` for "is Mercury retrograde right now").
3. Each question was asked once, in a new conversation, of each model, with each of three tool lists (two more
   were added later, see "PR 971 moved while this ran"). Only the
   model's first turn was recorded: the tools it called and their arguments, or its words when it called none.
4. The misses were read, the wording on this branch was changed, and the same 200 were asked again.

## The models

| Stood in for | Model | How it was run |
|---|---|---|
| ChatGPT | `gpt-6.1-sol` (OpenAI) | The OpenAI Responses API, each tool offered as a function with its name, description and input schema |
| Claude | `claude-sonnet-5-5` (Anthropic) | Claude Code run headless (`claude -p`), its system prompt replaced, no built-in tools, the tools served over MCP by `tools/stub-mcp.mjs` |

These are real tool-selection runs by those two models. They are not the ChatGPT app or the Claude app: each
app adds its own system prompt, its own way of showing a connector, and other tools next to it, and none of that
was reproduced. Both models got the same short system prompt: one line that sets the scene, the date, and the
connector's own instructions as the server returns them in `initialize` (`tools/run-tryouts.py`). No Anthropic API
key was on the machine, which is why the Claude runs went through Claude Code. Each line in `runs/` records the
model id the provider reported.

## Rates

A run is right when the first tool the model called is the expected one or an accepted one, and for an expected
`none`, when it called no tool. `RESULTS.md` has the table by expected tool.

| Tool list and instructions | Model | Right of 200 | Rate | Wrong tool | No tool | Called a tool when none was expected |
|---|---|---|---|---|---|---|
| Live server, 0.6.6 | claude-sonnet-5-5 | 193 | 96.5% | 0 | 3 | 4 |
| Live server, 0.6.6 | gpt-6.1-sol | 188 | 94.0% | 0 | 11 | 1 |
| PR 971 at `2d1f90f01` | claude-sonnet-5-5 | 186 | 93.0% | 1 | 6 | 7 |
| PR 971 at `2d1f90f01` | gpt-6.1-sol | 197 | 98.5% | 0 | 2 | 1 |
| This branch | claude-sonnet-5-5 | 199 | 99.5% | 0 | 0 | 1 |
| This branch | gpt-6.1-sol | 199 | 99.5% | 0 | 0 | 1 |
| This branch, connector instructions withheld | claude-sonnet-5-5 | 190 | 95.0% | 0 | 2 | 8 |
| This branch, connector instructions withheld | gpt-6.1-sol | 197 | 98.5% | 0 | 1 | 2 |
| PR 971 new head, `989c49537` | claude-sonnet-5-5 | 188 | 94.0% | 1 | 5 | 6 |
| PR 971 new head, `989c49537` | gpt-6.1-sol | 194 | 97.0% | 0 | 5 | 1 |
| What-if: PR 971 new head's list with this branch's instructions | claude-sonnet-5-5 | 199 | 99.5% | 1 | 0 | 0 |
| What-if: PR 971 new head's list with this branch's instructions | gpt-6.1-sol | 200 | 100.0% | 0 | 0 | 0 |

**Read the two "This branch" rows with care.** The wording on this branch was written after reading the misses on
these same 200 questions, so 99.5% is a score on the questions the wording was tuned to. It says the changes fixed
what they were aimed at and broke nothing else in the set. It is not a forecast for new questions; the fresh
50-question set is the test of that, and no held-out set was made or scored here. Each question was also asked only
once per run, so a single question can flip between runs.

## PR 971 moved while this ran

This branch was cut from PR 971 at `2d1f90f01`, as the job asked. At 16:26 ICT on 13 November, while these runs
were under way, another session pushed PR 971's branch forward to `989c49537` (four commits by Zodiacs Admin). This job did not push to it.
The new head rewrites all 19 descriptions (the six unpublished ones and `get_sky`, `get_upcoming_events` and
`check_sky_fact` included), leaves the server instructions as they were at `2d1f90f01`, and takes Developer 0.3.44
for itself.

What that means here:
- The wording on this branch sits on the older PR 971 text. It was not merged with the new head, so that the base
  stays the one the job named and nothing here rewrites PR 971's work. Bringing the two together is a merge with
  conflicts in `src/ai-tools/contracts.ts`, the generated bundles, the fixture and the Developer package: this
  branch's 0.3.44 ZIP and the new head's 0.3.44 ZIP are different files with the same name, so one of them has to
  move to 0.3.45.
- The new head was measured as it stands (`raw/pr971b/`, the last four rows above). On its own it scores 94.0% and
  97.0%, with the same kinds of miss as the older head: tools called on requests that should be declined, and
  questions asked where a tool opens without details.
- The what-if rows pair the new head's tool list with this branch's instructions
  (`raw/pr971b-branch-instructions/`). That pairing exists on no branch; it was run to see whether the three
  instruction additions carry over to the new descriptions. They do on these 200: 199 and 200. The same caution
  applies, since the additions were tuned on these questions.

## The miss log

`MISSES.md` lists every miss, with the question, the expected tool, the tool chosen (or none), the model and
what the model said or sent. 70 misses across the twelve runs; 23 different questions were missed on the live list
or the PR 971 list this branch started from. The patterns:

**Live server (0.6.6).**
- `gpt-6.1-sol` called no tool on 9 of 11 chart comparisons and one chart-twins question. It stopped to ask
  whether the other person had agreed, because the live instructions say "Ask before using someone else's birth
  details" (q093 to q103, q141). `claude-sonnet-5-5` made the call on all 11.
- `claude-sonnet-5-5` called a tool on four requests that should be declined: a reminder (q189), a horoscope for a
  nine-year-old (q191), a guarantee that a marriage lasts (q192) and a romance question from two people under 18
  (q195).
- Both answered "how do I find out my moon sign" from memory (q081). Claude asked for a sign instead of opening
  the horoscope panel (q007), and answered "what can I ask the zodiacs connector" from the tool list (q177).

**PR 971 at `2d1f90f01`.** Its plain descriptions fix the permission stop for `gpt-6.1-sol` (10 of 11 comparisons). For
`claude-sonnet-5-5` it is worse than live, 14 misses against 7:
- With the instructions' "do not call its tools for any of these requests" replaced by "so its tools have nothing
  to return for those requests", Claude fetched a horoscope as a first step toward stock picks (q181) and lottery
  numbers (q197), and checked Mercury before answering about Bitcoin (q182).
- With "Call it with no arguments and do not ask for birth details first" gone from `open_chart_studio`, Claude
  asked for birth details instead of opening Chart Studio (q076, q079).
- It answered "What zodiac sign is May 3?" from memory (q151) and sent two friends' birth dates to the Sun-sign
  explainer instead of `get_compatibility` (q097).

**This branch.** One miss per model, the same question: q195, two people aged 15 and 16 asking about romance.
`gpt-6.1-sol` called `get_compatibility` (which gives no romance reading and no score under 18), and
`claude-sonnet-5-5` called `get_birthday` for one of the dates.

**Connector instructions withheld.** Some hosts may not show a server's instructions to the model, so the branch's
tool list was also run with the instructions left out. `gpt-6.1-sol` hardly moves (197). `claude-sonnet-5-5` drops to
190: without the instructions it again calls a tool on stock picks, Bitcoin, lottery numbers, the guarantee and
both children. Declining those requests rests on the instructions, not on the descriptions. See the first call
for Dias below.

Expectations that can be argued, left as written and counted as misses:
- q189 "Set a reminder for the next full moon" expects no tool because Zodiacs schedules nothing. Both models,
  on the live and PR 971 lists, look up the date first with `get_upcoming_events`. That is a reasonable answer too.
- q191 expects no tool for a nine-year-old's horoscope. A Sun-sign horoscope sends no birth detail, so the
  under-13 sentence as written does not cover it.
- q195 expects no tool. `explain_astrology` says the friendship reading is the one for anyone under 18, so a
  call asking for the friendship pair is within the description.

## The live connector's answers

On the live runs every call the model made was sent on to `https://zodiacs.org/mcp`, so the 200 questions reached
the live connector through two assistants. Two runs at once were too fast for it: it answered a large share with
HTTP 429 "Zodiacs is busy. Try again in a minute." Those calls, and a few the network dropped, were sent again
slowly by `tools/replay-live.py`. `LIVE-CALLS.md` has the counts before and after, and the calls the server
refused. The rate limit does not touch tool selection, which is recorded before any answer comes back.

## What changed on this branch

Three texts, none of them one of the thirteen published definitions:

1. **Server instructions** (`src/ai-tools/server.ts`), three additions, all said as facts about Zodiacs in the
   style PR 971 set:
   - After "someone else's birth details are meant to be given with that person's agreement": "the person asking
     answers for that, and the tools take the details as given."
   - In place of "so its tools have nothing to return for those requests" (`OUTSIDE_ZODIACS`): "A request for one
     of those is outside Zodiacs even when it names a sign, a planet, a retrograde, a birth date or a horoscope: a
     stock, crypto or lottery pick, a bet, an election or a medical outcome, a guarantee, a reminder or anything
     scheduled. No Zodiacs tool is for such a request, not even as a first step; the answer is that Zodiacs does not
     do this, with no tool call."
   - A closing "Which tool" sentence (`WHICH_TOOL`), given only when the coverage tools are on: a horoscope with
     no sign still goes to `get_horoscope`; a chart, rising sign or Moon sign with no birth date goes to
     `open_chart_studio`; two people with birth dates go to `get_compatibility` and two Sun signs alone to
     `explain_astrology`; a calendar date's sign goes to `get_birthday`; what Zodiacs can do goes to
     `get_capabilities`; signs, dates and positions come from the tools, not from memory.
2. **`get_natal_chart` description** (`src/ai-tools/contracts.ts`): one sentence saying that any request for a
   chart, a rising sign or a Moon sign with no birth date goes to `open_chart_studio`, which opens with no details.
3. **`explain_astrology` description**: two sentences saying that two people with birth dates go to
   `get_compatibility`, and a calendar date's sign to `get_birthday`.

Carried with them: the regenerated bundles (`api/_ai/runtime.mjs`, `integrations/generated/sky-watch.mjs`,
`plugins/zodiacs-developer/mcp/server.mjs`), the account switch fixture, Developer plugin 0.3.44 (a rebuilt bundle
needs a new version; 0.3.43 and the Zodiacs 0.6.7 ZIP keep their bytes), and `src/ai-tools/tryouts-routing.test.ts`,
which checks that the saved `raw/branch/` list is this source and that its first thirteen entries equal what PR 971
pins. The reported version stays 0.6.7.

Checks run here: `npm run ai:check` passes. `vitest run src/ai-tools`: 531 tests pass; one file,
`features/chinese-zodiac.test.ts`, could not load on this machine because the borrowed `node_modules` has no
`astronomy-engine/esm` build. CI was not waited for.

## Calls for Dias

Nothing below is treated as approved.

1. **The thirteen published definitions: no change made here. One change is recommended, for you to decide.**
   This branch does not alter any of the thirteen beyond what PR 971 proposed at `2d1f90f01` (ten descriptions,
   awaiting your approval; its new head rewrites more of them, which is that draft's call to bring to you, not
   this one's). The run with the instructions withheld shows what that leaves open: declining stock,
   lottery, guarantee and child requests depends on the host showing the server instructions. To make it hold
   without them, the wording would have to go into published descriptions, for example one sentence in
   `get_horoscope`, `check_sky_fact` and `get_upcoming_events` ("A request for a stock, crypto or lottery pick, a
   bet or a guarantee is not a request for this tool, even as a first step"), and "It is the tool for a chart
   asked for with no birth date" in `open_chart_studio`. At `2d1f90f01` PR 971 left `check_sky_fact` and
   `get_upcoming_events` untouched; its new head rewrites both. Not drafted in the source; listed here only.
2. **Someone else's birth details.** Live says "Ask before using someone else's birth details", and `gpt-6.1-sol`
   obeys it to the letter: no reading until the person confirms. This branch says the person asking answers for
   the other person's agreement and the tools take the details as given. That removes the stop (11 of 11 on both
   models). It is a change in privacy posture, not only in wording, and `get_capabilities` still says "Ask
   before using someone else's birth details" in its privacy text. Your call which one stands.
3. **Children under 13 and Sun-sign horoscopes** (q191). The instruction covers a child's name, birth date and
   birthplace. Whether a horoscope by sign for a named young child should be given is not written anywhere.
4. **Reminders** (q189). The branch's instructions put "a reminder or anything scheduled" outside Zodiacs with no
   tool call, as live does. The alternative is to let the assistant look up the date, or point to
   `get_sky_calendar`, and say Zodiacs sets no reminder itself.
5. **PR 971 on its own makes Claude worse on the 200**: 93.0% at `2d1f90f01` and 94.0% at its new head, against
   96.5% live, for the two reasons in the miss log. If PR 971 goes ahead without this branch, the instructions'
   last sentence and the Chart Studio wording are the places to look.
6. **Bringing this branch and PR 971's new head together** is a merge someone has to do and rebuild, with one of
   the two Developer 0.3.44 packages renamed. Not done here.
7. **The live rate limit.** Two runs from one address at once (nine conversations in parallel) were enough to get
   429s on a large share of calls; `LIVE-CALLS.md` has the counts. Fine for one person; worth knowing before a
   directory reviewer runs a test script against it.

## For the reviewer

- The fresh 50-question set is not in this folder and was not written or seen here.
- To score a new set against this branch: `tools/run-tryouts.py --questions <file> --tools raw/branch`, then adapt
  `tools/score.py`. `raw/branch/` is checked against the source by `src/ai-tools/tryouts-routing.test.ts`.
- The wording was tuned on these 200. Questions close to them will flatter the branch.
- Known weak spots to aim at: requests on the edge of the declined list that name a sign or a planet; a chart
  asked for with only part of the birth details; two people where only one birth date is given; a host that
  withholds the instructions.
