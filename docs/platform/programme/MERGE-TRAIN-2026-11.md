# Merge train for the November 2026 tools

How to bring each open November tool PR up to date with `main` after another
one merges, so that no generated bundle is merged by hand, no two branches
ship the same Developer plugin version, and no model name reaches `main` in a
commit message. Linear ZOD-9.

The owner decides the order. Merges follow AGENTS.md and the owner's standing
approval there. AGENTS.md still
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
   The locale PRs #939 to #942 follow it, each after merging the new `main` in.

## Catching a branch up

Run this on one branch at a time, in merge order, after `main` moved.

1. `git fetch origin && git merge --no-commit origin/main` on the PR branch, so
   the merge commit gets a written message in step 7. Never rebase a branch
   another PR is stacked on.
2. Resolve source conflicts by hand with these fixed rules.
   - `src/ai-tools/contracts.ts`, `EVERY_TOOL_NAME`: keep main's order as it
     stands (on 16 November: the released tools with sky events, year score,
     solar return, numerology) and append each new group after it in merge
     order. `EVERY_SWITCHED_TOOL` stays an alias of `EVERY_TOOL_NAME`. Keep
     every branch's `*_TOOL_NAMES` and `*_SWITCH_ENV`.
   - `src/ai-tools/usage.ts`, `COUNTED_TOOL_NAMES`: the same order as
     `EVERY_TOOL_NAME`, then `SAVE_TOOL_NAME` last, so the two lists stay in
     step. Never move a group `main` already has, as that reorders
     `tools/list`.
   - A test that says "my tool is listed last" becomes "comes after every
     tool already on main, in merge order".
   - `src/ai-tools/personal/registry.ts`: `PERSONAL_TOOLS` is astrocartography,
     Vedic signs, personal day, retrograde, keeping only the tools the tree has.
   - `src/ai-tools/tools.ts`, `src/ai-tools/http.ts`,
     `src/ai-tools/features/explain.ts`, `scripts/serve-hosted-mcp.mjs`: keep
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
4. Developer plugin version. For every
   `integrations/packages/zodiacs-developer-*.zip` the branch added: if `main`
   has a file of that name, take main's bytes with
   `git checkout origin/main -- <zip>`; otherwise `git rm` it. Most branch
   ZIP names (0.3.39 to 0.3.47) are already on `main` with other bytes, so this
   is the usual case. Then set the version to main's plus one patch step in
   `plugins/zodiacs-developer/.codex-plugin/plugin.json` (the build copies it
   into `plugins/zodiacs-developer/plugin.json`),
   `plugins/zodiacs-developer/package.json`,
   `plugins/zodiacs-developer/package-lock.json` (both version lines) and the
   two version lines in `plugins/zodiacs-developer/README.md`. The root
   `package.json` is not the plugin's version. Rewrite
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
   ```

6. `git status` shows exactly one new `zodiacs-developer-<version>.zip` and no
   changed older ZIP. An archive already on `main` keeps its bytes.
7. Commit as Zodiacs Admin with a plain subject, such as "Merge main,
   repackage Developer 0.3.49". No trailers. The number is set at catch-up
   time from `main`; a number an open PR already carries (on 16 November #1068
   has 0.3.49) reserves nothing. A branch that loses the race catches up
   again.

## Commit messages

Every PR is squash-merged with a written message, so only that message
reaches `main`. Older commits on a branch may carry session trailers or a
default merge subject; that is expected and is never fixed by rewriting the
branch. The letters in brackets below keep this file itself free of the names
it searches for. Check the squash message before merging:

```bash
PATTERN='cl[a]ude|anthr[o]pic|op[u]s|s[o]nnet|f[a]ble|ha[i]ku|co[d]ex|gp[t]|gr[o]k|co-authored-by|session_'
# squash-msg.txt holds the exact squash title and body you will merge with.
test -s squash-msg.txt || { echo 'squash-msg.txt is empty'; false; }
grep -inE "$PATTERN" squash-msg.txt || echo clean
```

It must print `clean`. After the merge, in the same shell:

```bash
git fetch origin
git log -1 --format='%an <%ae>%n%B' origin/main | grep -inE "$PATTERN" || echo clean
```

It must print `clean`, and
the author is Zodiacs Admin. Agent branch names appear only in
the PR, never in the squash message.

## After each merge

Check the live site, revert if it is broken, and add a line to the Merge log
issue (#879), as AGENTS.md says.

## When something fails

- `ai:build` fails on the Chart Studio pin: a shared module the panel imports
  changed in the merge. Read the failure. If the studio's own sources did not
  change, record the new build in `SOURCE_SHA256` as the "Generated vs source" section of the repository agent notes allows and say
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
