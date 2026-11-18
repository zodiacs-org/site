# Fix round, 13 November 2026 (ZOD-207)

Written 13 November 2026, Asia/Bangkok, after Dias's answers of 17:12 that day to the calls in `REPORT.md`. A draft.
Nothing here is merged, published, submitted or sent. `REPORT.md` is the first round and is left as it was written;
where the two differ, this file is the later one.

## What Dias decided, and what was done

| Call in `REPORT.md` | Answer | Done here |
|---|---|---|
| 6. Join PR 971's new head | Join it | Merged `origin/admin/zod-58-tool-descriptions` at `989c49537`. Developer rebuilt as 0.3.45 |
| 2. Someone else's birth details | Keep "ask first" | The server instructions say "Ask before using someone else's birth details.", the sentence `get_capabilities` uses. "The person asking answers for that" is gone |
| 1. The published definitions | Reword four of them | `get_horoscope`, `check_sky_fact`, `get_upcoming_events` and `open_chart_studio` now say what is not a request for the tool, and where a chart with no birth date goes |
| 3. Children under 13 | No horoscope for a named child under 13. A bare Sun sign still gets its general horoscope | Said in the server instructions and in both horoscope descriptions. The refusal of a birth date less than 13 years ago is unchanged |

The change to the published definitions was approved by Dias on 13 November 2026, 17:12 Asia/Bangkok. It touches
only the `description` field of those four. `ZOD_207_SENTENCES` in `src/ai-tools/published-tools.ts` lists each
sentence against the PR 971 text it replaced, and `src/ai-tools/tryouts-routing.test.ts` checks that taking them
back out gives PR 971's thirteen at `989c49537`, byte for byte.

## The wording

Server instructions (`src/ai-tools/server.ts`):

- `ASK_FIRST`: "Ask before using someone else's birth details."
- `CHILD_HOROSCOPE`: "There is no horoscope for a named child under 13, meaning a particular child the request names
  or points to, such as someone's nine-year-old daughter: not by sign, and not for a day, a week, a month or a year.
  A Sun sign on its own, with no name and no birth date, gets the general horoscope for that sign."
- `OUTSIDE_ZODIACS` no longer uses the word "crypto"; it says "a stock or lottery pick, an investment call, a bet".
  A release test keeps that word out of tool descriptions, and the instructions now match.

The four published descriptions, each sentence added to PR 971's text:

- `open_chart_studio`: "It takes no input, so it opens before any birth detail is given. It fits a request for a
  birth chart, a rising sign or a Moon sign when no birth date is in the conversation, and someone who wants to
  explore their own chart: the person enters the details in the panel, so nothing has to be asked for beforehand."
- `get_horoscope`: a horoscope asked for with no sign named still belongs here; a request for a betting tip, a stock
  pick and the rest of its limits "is not a request for this tool, not even as a first step"; no horoscope for a
  named child under 13 and the general horoscope for a Sun sign on its own; a reminder or a horoscope on a schedule
  is not a request for it either.
- `check_sky_fact`: "Whether a retrograde, a sign or a Moon phase makes a good time to buy, sell, bet or invest is
  not a claim about the sky.", and the same "not a request for this tool" sentence.
- `get_upcoming_events`: "It lists dates and makes no prediction. A request to set a reminder or an alert, or to
  schedule anything, is not a request for this tool, not even to look the date up first: Zodiacs sets no reminders
  and schedules nothing.", and the picks, forecasts and guarantees after it.

Three descriptions that are not among the thirteen also changed. `get_natal_chart` and `explain_astrology` carry
this branch's earlier routing sentences again, rewritten in the style of PR 971's new text. `explain_astrology` also
says that a guarantee, a reading for a named child under 13, and a pick or forecast are not requests for it.
`get_horoscope_period` says the same about a named child under 13 and a Sun sign on its own.

## What "a named child" means here, and what the tools can and cannot do

The horoscope tools take a sign and, for `get_horoscope`, an optional birth date. They take no name and no age, and
the published schemas are not changed. So:

- A call with a birth date less than 13 years ago is refused by the tool, as before.
- A call with a sign alone is answered with the general horoscope, as before. The tool cannot tell whose sign it is.
- A named child under 13 with no birth date is declined by the assistant, on the strength of the instructions and
  the descriptions. Nothing in the tool can enforce it, because no name or age reaches the tool.

"Named" is read as a particular child the request names or points to ("my daughter, 9"), not only a child whose
first name is typed. That is the builder's reading of the answer; q191 in the set, which the first report called
"a named child", gives no first name.

## The 200 asked again

The same 200 questions, the same two stand-ins (`gpt-6.1-sol` through the OpenAI Responses API,
`claude-sonnet-5-5` through headless Claude Code), each question once per run, against `raw/fix-round/`. No call
was sent on to the live connector.

| Tool list and instructions | claude-sonnet-5-5 | gpt-6.1-sol |
|---|---|---|
| Before the fix round: this branch | 199 of 200 (99.5%) | 199 (99.5%) |
| Before the fix round: this branch, instructions withheld | 190 (95.0%) | 197 (98.5%) |
| Fix round | 200 (100%) | 190 (95.0%) |
| Fix round, instructions withheld | 196 (98.0%) | 200 (100%) |

How to read it:

- **`gpt-6.1-sol` at 190 is "ask first" doing what was decided.** All ten misses are comparisons and one chart-twins
  lookup with another person's birth date (q093 to q095, q097 to q100, q102, q103, q141). The model stops and asks
  whether the other person agreed, and calls no tool in its first turn. The question set still marks those as
  misses because it expects the call at once; it was not changed. With the instructions withheld the model does
  not see the sentence and makes the calls. `claude-sonnet-5-5` reads the same sentence and makes the call at once.
- **Declining with the instructions withheld.** Of the 20 requests where no tool should be called,
  `gpt-6.1-sol` now declines all 20 (18 before) and `claude-sonnet-5-5` 18 (12 before). Claude's two: on "Set a
  reminder for the next full moon" (q189) it says it cannot set reminders and calls `get_sky_calendar` to offer the
  calendar subscription; on the romance question from two people under 18 (q195) it says there is no romance
  reading and calls `explain_astrology` for the friendship one. Stock picks, lottery numbers, Bitcoin, the
  guarantee and both children under 13 are declined with no call.
- **Chart Studio with the instructions withheld.** "Can you make me a natal chart?", "what's my rising sign?" and
  "how do I find out my moon sign" (q076, q079, q081) all open `open_chart_studio` on both models, and "Give me my
  daily horoscope" (q007) goes to `get_horoscope`.
- Claude's other two misses with the instructions withheld: it answered "what can I ask the zodiacs connector" from
  the tool list (q177), and sent two friends' birth dates to `explain_astrology` (q097).

**The same caution as before, and more of it.** This wording was written after reading the misses on these same 200
questions, twice over now. A first wording was run (`raw/fix-round-1/`, the "first wording" rows in `RESULTS.md`:
199 and 190 with the instructions, 195 and 199 without), then two sentences were tightened and "crypto" was taken
out, and the 200 were asked again. These are scores on the questions the wording was tuned to. They are not a
forecast for new questions. No held-out set was written, seen or scored here; that is the next session's job.

## Tests

- `src/ai-tools/tryouts-routing.test.ts`: the saved `raw/fix-round/` list is this source; the thirteen differ from
  PR 971 at `989c49537` only by the listed sentences in the four; "ask first" is in the instructions and in
  `get_capabilities`, and the replaced sentence is nowhere; the declining, Chart Studio and child sentences are
  present; no description names crypto.
- `src/ai-tools/under-13.test.ts`, "horoscopes and children under 13": a bare sign gets its general horoscope for
  a day, a week, a month and a year; no sign at all leaves the choice to the person; a birth date less than 13
  years ago is still refused, the day before the 13th birthday included; neither horoscope tool has a field a
  name or an age could travel in, and both reject one; the instructions and both descriptions say the rule. Every
  date in it is made up.
- `npx vitest run src/ai-tools`: 48 files, 549 tests pass. `npm run ai:check` passes. `astro check`: 0 errors.

## Also fixed: the bundles' paths

The first round built the bundles with `node_modules` as a symlink to another worktree, so `api/_ai/runtime.mjs`,
`integrations/generated/sky-watch.mjs` and `plugins/zodiacs-developer/mcp/server.mjs` were committed with
`../mb-acc/node_modules/` in their path comments. CI's drift check regenerates them and would have failed. They are
rebuilt here from a real `node_modules`, and now differ from PR 971's only in the description and instruction lines.

## Still open for Dias

1. "Ask first" costs `gpt-6.1-sol` a turn on every comparison with someone else's birth date. That is the decision
   as given; it is noted so the number is not a surprise.
2. Whether "named" should also cover a child the request only points to, as read here.
3. Reminders: with the instructions withheld, Claude still offers the calendar subscription through
   `get_sky_calendar` after saying it sets no reminders. `get_sky_calendar` is a published description and was not
   one of the four approved, so it was left alone.
4. PR 971 itself still has "meant to be given with that person's agreement" in its instructions. This branch
   replaces it. If PR 971 lands first on its own, that sentence is the place to look.
