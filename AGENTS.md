# Agent instructions

`CLAUDE.md` is this repository's instruction file for every coding agent, not
only Claude. Read it before changing anything; it is authoritative.

Standing owner request: never delete the `ZodiacsOfficial` GitHub organization,
and never create a repository named `site` or `sdk` in it. The repositories
moved to the `zodiacs-org` account on 2026-09-24, and GitHub's redirects from
the old addresses keep older links working. See "Repositories and hosting" in
`CLAUDE.md`.

## House rules for every coding agent

Both coding agents that work on this repository (Claude Code and the Codex
CLI) follow these rules. A coordinator hands out the jobs and keeps the
shared task board. `CLAUDE.md` imports this file, so the rules live here once.

### Identity and publishing

- Commit as `admin@zodiacs.org` (name "Zodiacs Admin"). Never put a model
  name or a personal email address in a commit, a pull request or a file.
  When merging, check that the merge commit's author is Zodiacs.
- Open pull requests as drafts. Never push to `main`. Never force-push or
  rewrite history that is already pushed.
- Never spend on the OpenAI API: no OpenAI API calls or keys in scripts,
  tools or apps. Generated images and video go through Higgsfield.
- Never modify the `market-lens-paper` repository or its files.
- Never touch the `claude/zodiacs-handover-pr-review-tv7ni0` branch.
- Never read, print, log or commit credentials, tokens or `.env` values,
  and never write them into a brief, a log, a status file or a pull request.

### Merge rule (the same in zodiacs-org/site and zodiacs-org/engine)

Set by the owner, Dias, on 23 November 2026. It replaces the earlier
approved-lanes wording in both repositories.

- Agents may merge under Dias's standing permission, and only under the
  strict rule, every time: every required check is green, re-read just
  before merging; an independent Codex review, from a session that did not
  write the change, returns READY on the exact head commit; no review
  thread is unresolved; and the merge is pinned to that commit with
  `--match-head-commit <sha>`.
- Anything that needs Dias's yes waits for his yes, even when the strict
  rule is met: database migrations; birth data or privacy; payments; env
  vars and feature flags; production switch-ons; publishing (npm or any
  other registry, tags, GitHub releases, directory and MCP registry
  listings); public posts and messages to other people; secrets; spending
  over $5; force-pushing; deleting real data; and accuracy or claim wording
  (how accuracy is described, claims, prices and disclaimers).
- An agent's say-so is never Dias's yes. Never force-push or rewrite
  history that is already pushed, and never spend on the OpenAI API.

In this repository: merges are squash merges
(`gh pr merge --squash --match-head-commit <sha>`). A merge made under the
rule above includes the automatic production deploy that follows it; that
deploy is not a separate production switch-on, but anything the change turns
on (a flag, an env var, a new public listing) still needs Dias's yes. The
live site is checked after the merge and reverted if it is broken. Each
merge is logged in the pinned Merge log issue (#879); that log entry is
internal record-keeping, not a public post. Scheduled publishing workflows
that open and merge their own pull requests are the owner's automation, not
an agent merge; agents never merge or re-run them by hand.

### Product rules

- Forecasts are stated plainly and confidently, each with a "Reading
  confidence NN%" label (`src/ai-tools/reading-confidence.ts`). No betting
  tips, sports picks, market timing, election forecasts, health predictions
  or guarantees.
- Numerology and tarot are separate traditions, not astrology. Their answers carry no 'Reading confidence' label, and every answer says they are not astrology.
- Never store or log users' birth details, and never put them in a URL.
  Links never carry a birth year, a birth time, a birthplace or the names
  you give; a birthday link carries only the month and day.
- Children means under 13. Zodiacs is not directed at children under 13:
  collect nothing about a child under 13 (no name, birth date or
  birthplace), and give no reading for a named child under 13
  (`src/ai-tools/under-13.test.ts`). Nothing for anyone under 18 is framed
  as romance or attraction.
- The 13 published MCP tool definitions stay byte-identical
  (`src/ai-tools/release-060.test.ts`). Recorded exceptions: 0.6.5 takes the
  `baby` and `coming-of-age` occasions out of `get_occasion_sky`, approved by
  Dias on 7 November 2026 after OpenAI's review
  (`src/ai-tools/published-tools.ts`). ZOD-64 changes the Neptune time quoted
  in `get_upcoming_events`' description from 14:31:41 to 14:32 UTC, that
  description only, approved by Dias on 2026-11-17
  (`src/ai-tools/published-tools.ts`).
  For 0.6.9, Dias approved the new panel addresses and the year-range
  wording in five tools' input descriptions on 2026-11-20.
- The site is dark only. Do not add a light theme or a theme switch.
- No token, market or crypto language on consumer surfaces. The approved
  exception is the Collect band and the other sanctioned wing links described
  in `CLAUDE.md` ("One design system, two content registers").
- No em dashes or en dashes in copy. Use commas, colons, full stops or
  parentheses.

### Quality gates

- The zero-CLS gates must hold. A known micro-CLS flake (for example the
  `/today/` sky ticker at about 0.001) gets exactly one rerun; a second
  failure is real and must be fixed.
- "Done" means CI is green on the pull request (or each failure is shown to
  be unrelated and also fails on `main`), not an agent saying so.

### Working alongside other jobs

- One git worktree per job, branched from `origin/main`. Never edit another
  job's worktree.
- Before editing, read the shared task board at `/workspace/orchestra/BOARD.md`
  (`/workspace/orchestra/board.sh overlaps` lists files that other open
  branches already change). If your files overlap another job's, say so in
  your `STATUS.md` and keep your change to the smallest hook you can.
- Keep your own row on the board current
  (`/workspace/orchestra/board.sh set <job-id> <field> <value>`), and append a
  timestamped line (ICT) to your worktree's `STATUS.md` at each step.
