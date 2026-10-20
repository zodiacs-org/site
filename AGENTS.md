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
  name or a personal email address in a commit, a pull request, or a file.
- Open draft pull requests only. Never merge, never mark a pull request ready
  for review, and never push to `main`. The owner decides every merge.
- Post nothing publicly: no social posts, no release notes, no comments on
  other projects, no messages to people.
- Never touch the `claude/zodiacs-handover-pr-review-tv7ni0` branch.
- Never read, print or commit credentials, tokens or `.env` values.

### Product rules

- The site is dark only. Do not add a light theme or a theme switch.
- No predictions on the site. Horoscopes stay reflective: they describe the
  sky and invite reflection, they never forecast outcomes.
- No token, market or crypto language on consumer surfaces. The approved
  exception is the Collect band and the other sanctioned wing links described
  in `CLAUDE.md` ("One design system, two content registers").
- No em dashes or en dashes in copy. Use commas, colons, full stops or
  parentheses.

### Quality gates

- The zero-CLS gates must hold. A known micro-CLS flake (for example the
  `/today/` sky ticker at about 0.001) gets exactly one rerun; a second
  failure is real and must be fixed.
- "Done" means CI is green on the pull request, not an agent saying so.

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
