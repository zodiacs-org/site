# Life Chapters meanings and the Ask the Sky question filter: drafts (ZOD-151)

Drafts for two held ideas, ZOD-60 (Life Chapters) and ZOD-61 (Ask the Sky).
Nothing here is shipped. This folder is the only thing the branch changes:
no page, no template, no filter code, no engine change, no fix for ZOD-62.

Written 12 to 13 November 2026 by the builder session for ZOD-151. A second
session is meant to attack the filter and check the citations.

## Files

| File | What it is |
|---|---|
| `01-life-chapters-meanings.md` | The method claim by claim with citations, a plain-words meaning for each of the twelve signs as a chapter, wording for a peak stretch, for the loosing of the bond and for the birth-time warnings, and a list of what the source does not support. |
| `02-ask-the-sky-filter.md` | The written filter: what is allowed, what is refused and why, with examples, the one-question limit, draft refusal wording, and the open decisions. |
| `03-filter-test-set.md` | 72 test questions, each with the expected result and a reason. |
| `SOURCES.md` | What was opened and what could not be, with addresses, hashes and the quoted passages (V1 to V24, L1, L2). |

## Results against the issue's tests

These are the builder's own readings. The second session and the coordinator
decide whether they hold.

| Test | Builder's result | Where |
|---|---|---|
| C1. Twelve chapter meanings, peak, loosing of the bond, birth-time warning; Spirit only | Met. All twelve signs, each with a chapter meaning, a stretch line and a hard-patch line. Chapters are released from the Lot of Spirit only. The Lot of Fortune is used only to find which sign is a peak, which is what Valens does. | `01`, Parts 2 to 5 |
| C2. Every technique claim cited to a raw source opened here | Met for the claims made, with two gaps stated openly. Nineteen claims (T1 to T19) each cite a quoted passage. Gap 1: the phrase "loosing of the bond" is not in the Riley text; the turning point itself is cited. Gap 2: the name "Lot of Spirit" is not in the Riley text; he calls it Daimon. The twelve meanings are our wording built on cited passages, and are labelled so. Nothing cites the ZOD-60 sample or the ticket. | `01`, Part 1 and Part 7; `SOURCES.md` |
| F1. Filter written, all eight named categories, with examples | Met. Health, money, betting, legal, other people, minors, prediction and guarantee claims, and the one-question limit each have a scope, a reason, blunt examples and softened ones. | `02`, sections 2 to 5 |
| F2. Test set of at least twenty, with allowed cases and at least two per refused category, including softened wording | Met. 72 cases: 18 allowed (8 of them keyword traps) and 54 refused. Each of the eight categories has 5 to 7 cases, at least 3 of them softened. | `03` |
| F3. Nothing shipped | Met. One new folder under `docs/platform/evidence/`. No code, no page, no merge. No engine branch touched. | this branch's diff |

## The source problem, in short

The Valens page linked on ZOD-60 could not be read: it returns a bot check
and no book text. The check was not worked around. The same translation was
read from the translator's own PDF, in the Wayback Machine's copy of
11 December 2025, and Dias approved that on 12 November 2026. Details and
hashes are in `SOURCES.md`.

Every quotation in `SOURCES.md` and in `01` was compared by script with the
text taken from that PDF and from the two Lilly pages. One Lilly quotation
leaves out a footnote number that the page prints in the middle of the
sentence ("radical 1 and capable"). There are no other differences.

## For Dias

The full lists are in `01`, Part 7 (thirteen items) and `02`, section 8
(eight items). The ones that change what could be built or said:

1. **"Loosing of the bond" is not in the source that was opened.** Riley says "making the connection". The ZOD-60 sample's "which the old astrologers called the loosing of the bond" has no citation yet. The drafts use the phrase as the product's own name and attribute it to nobody.
2. **"Lot of Spirit" is not Riley's name.** He says Daimon.
3. **Valens gives no list of twelve chapter meanings.** The twelve here are ours, built on his words about each sign and its ruling planet. Four signs (Scorpio, Capricorn, Aquarius, Pisces) were softened because his words for people born under them are harsh.
4. **"Spirit only" needs one engine rule Valens insists on.** When both Lots fall in the same sign, which happens for every birth at a new or full Moon, he counts work from the next sign.
5. **A peak needs the Lot of Fortune's position.** No chapter is counted from Fortune, but Valens finds the strongest places by counting from it.
6. **Valens has no "weeks".** His levels are years, months, days and hours. ZOD-60 asks for a table "down to weeks".
7. **The filter refuses most love questions.** They are questions about another person. Dias decides whether that is acceptable.
8. **Three contestable filter calls:** a raise (refused as money), a scholarship (allowed as an application), and how often a person may ask (one judged question a day is a proposal).
9. **The Valens web page itself is still unread.** If it matters that the page ZOD-60 links says the same as the PDF, someone has to open it in a browser.
