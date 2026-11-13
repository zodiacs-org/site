# Review of the fix round (ZOD-152, site)

13 November 2026, 11:15 ICT. A new session, model id claude-fable-5-2, not
the builder's. It checks the one fix round the owner approved at 10:48 ICT
(commit `ce72a22f6`, draft pull request 1014) against the approved calls.
Read commands only; nothing was changed but this file.

## Verdict

**No blocker. The approved fixes hold on the site**, with one should-fix: the
new correction note understates what happened after the rule.

| Approved call | Result | How it was checked |
| --- | --- | --- |
| Correction note on the audit branch; no published file edited | holds | `git diff origin/main...HEAD` touches the audit folder and `integrations/packages/README.md` only. No ZIP, no `manifest.json`, no adoption record, nothing under `public/`. No script, test or workflow reads `integrations/packages/README.md`. |
| Nothing tagged or released | holds | The site has no tag and no release. |
| `/corrections/` folded in | holds | Inventory row 7 and `FIX-ROUND.md` row F-corr-01; `src/data/corrections.json` has the one entry. |
| S-adopt-06 settled | holds | Looked up again today: the four ids are commits in `zodiacs-org/sdk`; `03142a4d9a78733876137f611586d7482793bee6` gives "No commit found" there and is not an object in the site or engine repositories. `site-engine-rc16/README.md` line 55 cites it. Row 2 of `UNSUPPORTED.md`. |

Pull request 1014 is an open draft at `ce72a22f6`, authored and committed as
Zodiacs Admin, with no model name in the commit. The engine half is reviewed
in the engine repository's copy of this file.

## Findings

### Blocker

None.

### Should fix

1. **"Before the rule, and once after it" is too few.** The note added to
   `integrations/packages/README.md` says ZIPs were rewritten "before the
   rule, and once after it", and `FIX-ROUND.md` says "one of them once after
   it". The script's refusal dates from `5ff8cea53` (2026-11-02 01:33 ICT)
   and the sentence from `de7372e6c` (01:55). After both:
   `zodiacs-developer-0.3.14.zip` was rewritten twice on 2026-11-02
   (`2c3760139` at 18:57 and `08edafff4` at 19:12, each a new blob), and
   `zodiacs-developer-0.3.19.zip` was committed five times on 2026-11-03
   (13:42 to 18:58), four of them rewrites. That is two ZIPs and six
   rewrites, not one. The rest of the note holds: Developer 0.3.20, 0.3.21
   and 0.3.22 each have a single commit, and the first pass's row S-pkg-04
   covers the later ones. Suggested words: "Before the rule, and for
   Developer 0.3.14 and 0.3.19 after it".

### Notes

1. I did not count the 13 rewritten ZIPs again to the unit. The first review
   confirmed the figure; a quick count of mine over all history gave a
   number within one or two of it and was not reconciled.
2. `npm run ai:check` was not run here either (no dependencies in the
   worktree). The README is not an input of it; CI is the check.

## Limits

No test suite and no CI result was read. The 11 unchecked rows are still
unchecked. What the four sdk commits hold was not read.
