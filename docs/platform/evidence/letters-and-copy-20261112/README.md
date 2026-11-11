# Letters, lawyer brief, tool descriptions and a page draft (ZOD-108)

Written on 12 November 2026 (Asia/Bangkok; 11 November, 18:16 to about
19:30 UTC) on this job's own branch, from `origin/main` at `7c7b2d16`.
Linear: https://linear.app/zodiacs-org/issue/ZOD-108

**Everything here is a draft. Nothing was sent, published or submitted.** No
email, no portal, no live page, no merge, no change to a published tool
definition. The only files this branch adds are in this folder.

## Files

| File | What it is |
| --- | --- |
| [01-letter-naif.md](01-letter-naif.md) | Draft follow-up to NAIF: may a refit of `de440.bsp` be redistributed. |
| [02-letter-iers.md](02-letter-iers.md) | Draft to the IERS Earth Orientation Centre: terms and citation for EOP 20 C04. |
| [03-letter-cds.md](03-letter-cds.md) | Draft to the CDS: 20 single values obtained through VizieR and SIMBAD. |
| [04-lawyer-brief.md](04-lawyer-brief.md) | Draft brief for counsel: eleven open questions, facts and quotations, no conclusion. |
| [05-tool-descriptions.md](05-tool-descriptions.md) | Plain-words descriptions of the 19 live connector tools: what each does, when it fits, its limits. |
| [06-how-we-calculate.md](06-how-we-calculate.md) | Draft "How we calculate" page, the accuracy sentences held for the owner, and flags on the live methodology page. |
| [SOURCES.md](SOURCES.md) | Every source behind a bracketed key: address or file and line, when read, digest, the words relied on. |
| `raw/mcp/` | The live connector's `initialize`, `tools/list` and `get_capabilities` answers as fetched in this job, with requests, headers and times. |
| `raw/pages/` | Text copies of the live `/methodology/`, `/privacy/`, `/terms/`, `/developers/ai/`, `/developers/mcp/` pages and of the 404 at `/how-we-calculate/`, with a fetch log. |
| `tools/check-drafts.py` | The check below. |

Third parties' pages (NAIF, JPL, IERS, Paris Observatory, the US Naval
Observatory, the CDS's archive copies, ESA, a journal page) were fetched and
read but are **not committed**; `SOURCES.md` gives each address, time and
digest and quotes the words used. The copies are in the coordinator's job
folder for this issue.

## How to read the citations

Each factual sentence in the drafts ends with one or more keys such as
`[T-NAIF-RULES]`. `T` is a provider's page fetched in this job, `E` the
engine repository at `bc0b5a7`, `S` the site repository at `7c7b2d16`, `L`
the live service or a live page fetched in this job, and `J` a file from
jobs 1 to 4 together with the source that file rests on. Requests, questions
and statements of what a draft does not say carry no key.

## Results against the issue's tests

| Test | Result | Notes |
| --- | --- | --- |
| L1 Letters | Met, as drafts | Three separate letters, each with an addressee, a purpose, the facts and a citation on each factual sentence, each headed as a draft that is not to be sent. |
| L2 Lawyer brief | Met, as a draft | Eleven questions. The CDS A&A sentence and the Hipparcos and ESA matter are both stated as open questions. No legal outcome is asserted. |
| L3 Tool descriptions | Met, as drafts | 19 of 19 live tools, in `tools/list` order. No published definition changed. The check script finds no directive wording in the description parts. |
| L4 How we calculate | Met, as a draft | The draft does not say the service uses DE440, does not say the engine passes 240 vectors, gives no future-UT comparison with Horizons without the ΔT caveat, keeps the true node out of any 30″ statement, and flags the Swiss and Moon/ΔT sentences on the live page. Every accuracy figure is held for the owner. |
| L5 Citations | Met to the extent a builder can say so | Every key used is defined in `SOURCES.md` (script). Sentence-by-sentence checking is the reviewing session's job. |
| L6 Nothing sent or published | Holds | See "What this job did and did not do". |

"Met" is this session's own reading. The issue gives the verdict to a
second session.

## What this job found that the earlier jobs did not

1. **The A&A "scientific usage" sentence is commented out.** In the archive
   copy of the CDS's VizieR rules (2026-10-25), "Tabular data, spectra or
   images coming from A&A (J/A+A) are free for a scientific usage" sits
   inside an HTML comment, so the page does not show it; the 2021 copy has
   it commented out as well. What the page shows for A&A is two links to
   A&A's own policy pages, which refused automated reading. The issue, and
   job 2's second session, treat the sentence as a displayed rule. The CDS
   letter and the brief state it as it is. `[T-WB-VIZIER]`
   `[T-WB-VIZIER-2021]` `[T-AANDA]`
2. **ESA's archive terms do name the licence.** "Data hosted in the ESA
   Space Science Archives are distributed under the CC BY-NC 3.0 IGO
   licence." Whether those terms reach values of the 2007 reduction taken
   from VizieR is still open, and the brief leaves it open. `[T-ESA-TERMS]`
3. **Why Horizons is not a future-UT reference, from JPL's own manual:**
   "Beyond that prediction interval, the last prediction is taken as a
   constant for all future dates." Job 1's second session observed the
   constant; this is the sentence that explains it. `[T-HZ-MANUAL]`
4. **NAIF's contact page invites a second message** when a first has had no
   answer, while the site's record says of the first "Do not resend it".
   `[T-NAIF-CONTACT]` `[S-NAIF-SENT]`
5. **The Centre's page for C04 no longer names the paper our notice cites.**
   Its "Technical note" link goes to the readme. `[T-C04-PAGE]`

## For the owner (Dias)

Decisions this job did not take:

1. Whether any letter is sent, to whom, and when. NAIF: the record says do
   not resend. CDS: its site is degraded after a security incident.
2. Whether the brief goes to a lawyer, and which lawyer.
3. Whether a letter to ESA is wanted. None was drafted.
4. Whether the tool descriptions here, or site draft pull request 971's, or
   neither, become the published definitions. Any change alters published
   definitions.
5. Which accuracy sentence, if any, goes on a "How we calculate" page
   (`06-how-we-calculate.md`, Part 2), and whether the flagged lines of the
   live methodology page are corrected (Part 3).

Owner calls from jobs 1 to 4 that this job reflected and did **not** act
on: no Horizons rerun was sent (this job sent no request to Horizons at
all); no draft pull request was merged or marked ready; no public accuracy
sentence was approved; engine pull requests 91 and 92 and their branches
were read only (92 with `git show`), and the ZOD-58 draft branches (site
pull requests 968, 970, 971, 972) were not touched.

## What this job did and did not do

Did:

- Read the jobs 1 to 4 evidence and re-opened the sources the drafts rely
  on.
- Fetched 30 third-party addresses, one request at a time, with a generic
  `User-Agent` and nothing identifying the project in the request. Six were
  asked a second time after a timeout.
- Sent three requests to the live connector: `initialize`, `tools/list` and
  one call to `get_capabilities` with no arguments. No personal or synthetic
  birth data was sent.
- Fetched six pages of the live site.
- Read site pull request 943 and engine pull request 80 with `gh pr view`.

Did not:

- Send any email or message, open any portal, or post on Linear, GitHub
  issues or anywhere else.
- Change any file outside this folder.
- Query JPL Horizons, run the engine, or run any test suite.
- Open the mailbox to find the September message to NAIF.
- Read A&A's policy pages, the three catalogues' ReadMe files, Swiss
  Ephemeris's licence, the Royal Society's pages, the directories' rules
  pages or the engine master plan. Where a draft relies on one of these it
  says so and cites the job that read it.

## The check

```
$ python3 tools/check-drafts.py
01-letter-naif.md: 21 distinct keys, undefined: none
02-letter-iers.md: 20 distinct keys, undefined: none
03-letter-cds.md: 17 distinct keys, undefined: none
04-lawyer-brief.md: 52 distinct keys, undefined: none
05-tool-descriptions.md: 11 distinct keys, undefined: none
06-how-we-calculate.md: 32 distinct keys, undefined: none
README.md: 9 distinct keys, undefined: none
SOURCES.md: 1 distinct keys, undefined: none
live tools: 19; drafted: 19; same order: True
directive wording in description parts: 0
OK
```

The script checks that keys exist, that all 19 tools are described, that
the description parts hold none of the directive forms the ZOD-99 dry run
flagged, and that the drafts' own prose has no en dash or em dash. It does
not check that a cited source says what a sentence claims. That is the
reviewing session's work.
