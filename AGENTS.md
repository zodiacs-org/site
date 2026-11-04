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
- Open pull requests as drafts. The owner pre-approves a merge when CI is
  green (or each failure is shown to be unrelated and also fails on `main`),
  an independent review finds no blockers, the live site is checked after the
  merge (revert if it is broken), and the merge is logged in the pinned Merge
  log issue (#879). Never push to `main`.
- Additive database migrations (nothing deleted, no personal data touched)
  may be applied after review and logged in #879; anything that deletes data
  needs the owner's yes. A feature flag may be switched to fix a live problem,
  logged in #879; secret values stay with the owner.
- Ask the owner before spending money, submitting to a directory, deleting
  data, posting publicly outside this repository, or messaging people.
- Never touch the `claude/zodiacs-handover-pr-review-tv7ni0` branch.
- Never read, print or commit credentials, tokens or `.env` values.

### Product rules

- Forecasts are stated plainly and confidently, each with a "Reading
  confidence NN%" label (`src/ai-tools/reading-confidence.ts`). No betting
  tips, sports picks, market timing, election forecasts, health predictions
  or guarantees.
- Never store or log users' birth details. Links never carry a birth year,
  time, place or names; a birthday link carries only the month and day.
- The 13 published MCP tool definitions stay byte-identical
  (`src/ai-tools/release-060.test.ts`).
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
