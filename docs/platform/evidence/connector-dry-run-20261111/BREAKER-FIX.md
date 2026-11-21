# Review of the fix round (ZOD-99)

A new, separate session checked the fix round (commit `e7f224132`) against the calls
Dias approved: B1 and S1 to S7 from `BREAKER.md`. Run on 13 November 2026, about
04:10 to 04:25 UTC (11:10 to 11:25 Asia/Bangkok). `BREAKER.md` is the earlier review
and is unchanged. Nothing was submitted, saved in a portal, emailed, merged or marked
ready. No product code and no other file in this folder was changed.

## Verdict

**The approved fixes hold in `REPORT.md`. No blocker.** B1 and S1 to S7 are all
applied, the figures behind them reproduce from the recorded calls, and the two
unanswered product calls are left open, not decided.

**Two should-fix items remain, both small and both wording:** the pull request
description still carries three lines the report corrected (F1), and R1's proposed
fix understates how much of it changes the published definitions (F2). Seven notes.

No D result changes. The dry run still fails (D1, D2, D4, D5, D6, R1), D3 passes,
D8 holds.

| Approved call | In the report | Holds |
|---|---|---|
| B1 Oversized and diagnostic results in the fail list, with a proposed fix, not a product change | R1 has its own row in the result table and its own section, with four rules, the live behaviour, and a fix marked "not made here; a product change for Dias to approve" | Yes, with F2 |
| S1 Under-13 wording | D4 now says the refusal holds "for every full birth date and every birthday card", names the bare birth year (call 61) and the label on the date (calls 62, 67) | Yes in the report. Not in the pull request description (F1) |
| S2 Love readings in `_meta` | D2 has the panel data paragraph (call 42) and says the scan leaves out `_meta` | Yes |
| S3 Counts | `get_chinese_zodiac` is a flag; the table counts 1 fail, 14 flags, 4 passes | Yes |
| S4 Draft 971 credit | 15 descriptions and the server instructions, seven of the eight birth-date tools, what it leaves, longer descriptions, the negative test cases | Yes |
| S5 D5 missed statements | Five rows added; nine stale or contradicted statements in all | Yes in the report. The pull request description still says four (F1) |
| S6 OpenAI review requirements page | Fetched 13 November, in `rules/SOURCES.md` as OR-scan, OR-extraneous and OR-audit; the server instructions now count inside the D1 fail for OpenAI | Yes |
| S7 Short Linear links in the pull request | Both links are `https://linear.app/zodiacs-org/issue/ZOD-99` and `.../ZOD-58` | Yes |

## What was checked

- **The commit.** `e7f224132` changes four files, all in this folder (`REPORT.md`,
  `DRAFT-PRS.md`, `README.md`, `rules/SOURCES.md`). Author and committer of all three
  commits on the branch are Zodiacs Admin `<admin@zodiacs.org>`. No model name in the
  commit messages, the four files or the pull request description. No em dash or en
  dash in the three report files.
- **The pull request.** 979 is open, a draft, head `e7f224132`.
- **R1's figures, recomputed from `raw/mcp/calls/`.**
  - 71 tool calls on record: 44 answered, 26 refused or errored, one protocol error.
    In all 44, the text part parses to exactly the structured part. The report's 44
    is right (`BREAKER.md` said 43).
  - `get_sky` (call 11): receipt, backend and cite are 3,195 of 6,558 characters.
    `check_sky_fact` (call 13): 3,916 of 5,371. Both exact, with default JSON spacing.
  - The engine named is `@zodiacs/engine` `1.1.0-rc.2`; the cite block holds a
    `sha256:` receipt digest; the receipt holds a `tableDigest`.
  - `get_life_milestones` (call 21): `asOf` to the millisecond.
  - Call 33: 14,627 characters each way.
  - `tools/list`: 150,468 bytes; descriptions 14,293 characters, output schemas
    114,798 by my count (the report says about 115,000).
  - No tool has an input named for detail, length or format.
- **S1.** Call 61 (`year: 2020`) returns a full reading; call 56 (a full date under
  13) is refused; calls 62 and 67 answer.
- **S2.** Call 42's request has no `focus`; its `_meta["zodiacs/horoscope"]` holds
  three days with love readings and three links ending `f=love`.
- **S3.** The D1 table: one Fail, fourteen Flag, four Pass.
- **S4.** Read against draft 971's own description today: 15 of 19 descriptions
  change, four are left (`get_chinese_zodiac` among them), ten of the thirteen
  published definitions change, input field descriptions and the under-13 sentence
  of the server instructions are left on purpose, and the branch reports 0.6.7.
- **S5.** The D5 table has eleven rows: two current, nine stale, contradicted or
  incomplete. Four from the first report plus five added.
- **S6.** The page was fetched again at 04:14 UTC (HTTP 200). All three OR
  quotations are on it word for word, and OR-extraneous and OR-audit both sit under
  "What are common rejection reasons and how can I resolve them?". The "other
  model-readable fields, at either the tool or plugin level" line is on the live
  guidelines page.
- **Open calls.** The report's D4 says of the birth year "an open call for Dias;
  this report does not decide it", and R1 ends "Whether to trim what results carry is
  an open call for Dias; this report does not decide it". Both are in the list of
  seven open calls. No draft, branch or product file acts on either.

Not checked: the portals and the mailbox (not opened). No call was made to the live
server in this review; the only outside requests were two public rules pages.

---

## Should fix

### F1. The pull request description still carries three lines the report corrected

The description of 979 was edited for S7 and gained an R1 row, but three rows of its
table are the first version's:

- **D4** says "The under-13 refusal holds on all eight tools that take a birth
  date." That is the sentence S1 took out of the report. The report's line is: "The
  under-13 refusal holds for every full birth date and every birthday card; a bare
  birth year is answered."
- **D5** says "four statements reviewers hold are contradicted and not withdrawn".
  The report says nine.
- **D2** does not say that the panel data carries love readings on a general request.

The description is what a reader meets first, so it should say what the report
says. The fix is a copy of the report's three table lines into the description. No
file changes.

### F2. R1's proposed fix understates what it changes in the published definitions

The report says the fix "changes what the 13 published tools return, though not their
names or descriptions, and a `detail` input would change input schemas". It leaves
out the output schemas, and they matter here:

- In the live `tools/list`, the output schemas of `get_sky`, `get_upcoming_events`
  and `check_sky_fact` list `receipt`, `backend` and `cite` as **required**, and
  `get_life_milestones` lists `asOf` as required.
- All four are among the thirteen published definitions, and
  `src/ai-tools/release-060.test.ts` holds each one's `outputSchema` byte for byte.

So two of the fix's three parts change published definitions whatever is decided
about a `detail` input: leaving those fields out by default, and trimming the output
schemas. Only "send each result once" leaves the thirteen as published. Open call 2
should say this, because it is the cost Dias is being asked to weigh, and it means
both directories would rescan those tools.

A smaller point in the same section: R1 names `get_sky` and `check_sky_fact`;
`get_upcoming_events` carries the same three blocks.

This does not decide the call. It is still open.

---

## Notes

- **N1. `DRAFT-PRS.md` records the heads of 11 November.** Drafts 970, 971 and 972
  have moved since: `cb0e7df3`, `4867df78` and `cb8f9ff5`, each a merge of `main`
  committed at about 01:40 UTC on 13 November, some two and a half hours before the
  fix commit. The file is dated, so it is not wrong, but the fix round rewrote its
  text without reading the heads again, and "green checks" in D7 is the 11 November
  state. All four are still open drafts; 968 is at the recorded `ff45eba8`.
- **N2. A second set of descriptions exists.** Draft 971's description now says that
  the ZOD-108 evidence pull request (982, an open draft) "drafts a second set of
  plain-words descriptions for all 19 tools". The report does not mention it. It
  bears on open call 3 (it would cover `get_chinese_zodiac`), so Dias should see the
  two side by side.
- **N3. Draft 971 and the approval.** The report says the approval of the change to
  the published definitions could not be confirmed outside the pull request. That is
  still so. It stays with Dias.
- **N4. The OpenAI review page's digest.** My fetch has SHA-256 `3159fd1b…331532f0a`,
  not the `c76f0130…f7010dd8` in `rules/SOURCES.md`. The page is HTML with a build
  stamp and the quoted lines are identical, as `SOURCES.md` already warns.
- **N5. `README.md` does not list this file.** I was allowed to commit this file
  only. One line there would do.
- **N6. Engine pull request 91** shows an update time of 03:49 UTC on 13 November.
  Its head is still `ce4ba826`, its last commit is from 11 November and it has no
  comments, so no commit or comment was added. Pull request 92 is at `255b615b`,
  untouched since 11 November. Both are open drafts.
- **N7. Linear.** ZOD-99 has no comments. Nothing there was edited by the fix round.

---

## D8 for the fix round

Holds, as far as it can be seen from outside.

- The fix commit touches only this folder. No product code, tool description or
  generated file changed.
- 979 is an open draft. 968, 970, 971, 972, 975, 943 and 982 are open drafts. None is
  merged or marked ready.
- Engine pull requests 91 and 92 are at the heads named in the job's rules.
- The fix round's handoff says it made no call to the live server and opened no
  portal or mailbox. Nothing in the records contradicts that; the portals and the
  mailbox cannot be seen from here.
- No second fix pass was started, by the builder or by this review.

This review committed this one file and nothing else.

## What stays with Dias

The report's seven open calls, unchanged. The two that the fix round was told to
leave open are open: whether a bare birth year under 13 should be refused, and
whether to trim what results carry (R1). For the second, read F2 first: the trim
changes the published output schemas of four of the thirteen tools.

F1 and F2 are wording. Neither needs another pass at the product, and neither
changes a result.
