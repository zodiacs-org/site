# Merge train for the November 2026 tools

How to bring each open November tool PR up to date with `main` after another
one merges, so that no generated bundle is merged by hand, no two branches
ship the same Developer plugin version, and no model name reaches `main` in a
commit message. Linear ZOD-9.

The owner decides the order and approves every merge. AGENTS.md still
applies: draft PRs, commits as Zodiacs Admin, a merge only when CI is green and
an independent review finds no blockers, a live check after the merge, and a
line in the Merge log issue (#879).

## Already done before the train

- One shared usage counter migration on every branch that adds a counted tool
  (ZOD-5): `supabase/migrations/20261110090000_zodiacs_mcp_usage_november_tools.sql`,
  byte-identical everywhere, so those branches merge in any order.
- Default-off flags for every new page, share route, menu entry, sitemap row and
  Guide line (ZOD-6, ZOD-7, ZOD-8), all read through `src/lib/launch-flags.ts`,
  which is the same file on every branch. Counts in tests and `check-dist`
  follow the flags, so a second merge does not collide on a literal.
- The Year Ahead stack (#933, #945, #951, #952, #954, #955) and numerology
  (#932) are on `main`.

## Order

The owner may change it; the procedure below does not depend on it. A PR goes
only once its own blocker tickets in Linear are done. The order only says which
goes first when two are ready.

1. #944, the personal tools plumbing. Nothing a visitor sees.
2. #950, claims tested. Already behind its flag, no generated bundles.
3. #946, compatibility invites. Behind flags, no Developer version change.
4. #956, tarot.
5. #930, the good day finder.
6. #953, then #947, each after merging the new `main` in.
7. The personal pages in registry order: #937 (astrocartography), #934 (Vedic
   signs), #935 (your day), #936 (retrogrades for you). This is the order
   `docs/platform/zodiacs-ai/PERSONAL_TOOLS.md` lists.
8. #926, the locale expansion, last, as it touches the most shared files.

## Catching a branch up

Run this on one branch at a time, in merge order, after `main` moved.

1. `git fetch origin && git merge origin/main` on the PR branch. Never rebase a
   branch another PR is stacked on.
2. Resolve source conflicts by hand with these fixed rules.
   - `src/ai-tools/usage.ts`, `COUNTED_TOOL_NAMES`: `EVERY_AI_TOOL_NAME`, sky
     events, numerology, tarot, good days, year score, solar return, then
     `SAVE_TOOL_NAME`, keeping only the groups the tree has.
   - `src/ai-tools/contracts.ts`: keep every branch's `*_TOOL_NAMES` and
     `*_SWITCH_ENV`. Where both sides define `EVERY_SWITCHED_TOOL`, its value is
     the released tools, then numerology, tarot, good days, year score and solar
     return, keeping only the groups present.
   - A test that says "my tool is listed last" becomes "comes after every
     released tool, in the order above".
   - `src/ai-tools/personal/registry.ts`: `PERSONAL_TOOLS` is astrocartography,
     Vedic signs, personal day, retrograde, keeping only the tools the tree has.
   - `tools.ts`, `http.ts`, `explain.ts`, `scripts/serve-hosted-mcp.mjs`: keep
     both sides' additions. Where one expression picks a message, keep both
     pointers reachable.
   - `RESULT_SHARE_ROUTES` and `ROUTES` in `src/server/result-preview.ts`, the
     `vercel.json` rewrites, `nav-tools.ts`, `tool-icons.ts`, `seo.en.mjs`,
     `docs/claims/ledger.json`: the union, each side's entries kept whole.
   - `src/pages/sitemap.xml.ts`: where two PRs bump the same page's date, keep
     one row with the later date.
3. Generated files are never merged or edited by hand, even when git reports no
   conflict. Take main's copy (`git checkout origin/main -- <file>`) and
   regenerate in step 5. They are `api/_ai/runtime.mjs`,
   `integrations/generated/sky-watch.mjs`, `plugins/zodiacs-developer/mcp/server.mjs`,
   `plugins/zodiacs-developer/plugin.json`, `integrations/packages/manifest.json`
   and `api/_assistant/context.ts`.
4. Developer plugin version. `git rm` every
   `integrations/packages/zodiacs-developer-*.zip` the branch added that `main`
   does not have. Set the version to main's plus one patch step in
   `plugins/zodiacs-developer/.codex-plugin/plugin.json` (the build copies it
   into `plugin.json`), `package.json`, `package-lock.json` (both version lines)
   and the two version lines in `plugins/zodiacs-developer/README.md`. Rewrite
   the branch's own `release_notes` sentence under the new number, and add one
   sentence for it to `integrations/packages/README.md`, updating the "Current
   candidates" line there. A stack keeps its internal sequence: after the
   bottom PR catches up, each PR above takes the next number.
5. Regenerate and verify, in this order, with every launch flag unset:

   ```bash
   npm ci
   npm run ai:build
   npx vite-node --script scripts/build-assistant-context.mjs
   npm run ai:package
   npm run ai:check
   npm run build && npm run check && npm test
   node scripts/check-dist.mjs
   ```

6. `git status` shows exactly one new `zodiacs-developer-<version>.zip` and no
   changed older ZIP. An archive already on `main` keeps its bytes.
7. Commit as Zodiacs Admin with a plain subject, such as "Merge main,
   repackage Developer 0.3.50". No trailers.

## Commit messages

Every PR is squash-merged with a written message. Before merging, run on the
branch:

```bash
git log origin/main..HEAD --format='%h %s%n%b' | grep -inE 'claude|anthropic|opus|sonnet|fable|co-authored-by|session_' || echo clean
```

The squash message must also print `clean` under the same search. After the
merge, `git log -1 --format='%an <%ae>%n%B' origin/main` shows Zodiacs Admin
and no match. Branch names such as `claude/...` appear only in the PR, never
in the squash message.

## After each merge

Check the live site, revert if it is broken, and add a line to the Merge log
issue (#879), as AGENTS.md says.

## When something fails

- `ai:build` fails on the Chart Studio pin: a shared module the panel imports
  changed in the merge. Read the failure. If the studio's own sources did not
  change, record the new build in `SOURCE_SHA256` as CLAUDE.md allows and say
  so in the commit body.
- `release-060.test.ts` fails: a published tool definition moved. Stop. Do not
  update the fixture. Find what in the merge touched
  `src/ai-tools/published-tools.ts` or a shared description.
- Two branches caught up in parallel pick the same version. Catch up one
  branch at a time, in merge order.

## What this procedure never does

- Merge, push to `main` or switch a flag.
- Rewrite history on a shared branch without the owner's yes.
- Delete a ZIP that is on `main`.
- Run a generator with a launch flag set. Committed output is flag-off.
