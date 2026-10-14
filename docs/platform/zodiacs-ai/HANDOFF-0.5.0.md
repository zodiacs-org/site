# Handoff: Zodiacs plugin 0.5.0 (for Codex)

Written 14 October 2026 by Claude, which built 0.5.0 and drove it to `main`.
The owner, who is not technical, has asked Codex to finish the release.
Report to them in plain words, and never ask them to watch CI.

## Where things stand

- **Merged:** everything is on `main`.
  - #691: Chart Studio "Your week" and the panel fixes.
  - #739: the occasions panel.
  - #746 (`94f0b514`): 0.5.0 itself.
- **Switch:** the new tools sit behind `ZODIACS_OCCASIONS_ENABLED=1`, which is
  **not set anywhere yet**. Production still offers exactly the six 0.4.0 tools.
- **OpenAI:** on 14 October the owner decided to submit one larger release
  rather than restore the deleted 0.4.0 review.
  - OpenAI case 17133838 asked for the 0.4.0 confirmation email. The 7 October
    submission is `C-zke5Nx9utAbI`.
  - That case can now be closed (step 6).
- **Claude:** the Claude directory connector was submitted on 7 October from
  admin@zodiacs.org and is in review. See
  `docs/platform/zodiacs-ai/claude-directory/LISTING.md`. It points at the live
  `https://zodiacs.org/mcp`, so switching the tools on also changes what that
  connector offers (step 7).

### What 0.5.0 adds, all behind the switch

| Tool | What it does | Source |
| --- | --- | --- |
| `get_occasion_sky` | The sky on a day that matters (wedding, birthday, new baby…), with the evening sky at the place | `src/lib/occasions/`, #734 |
| `get_life_milestones` | Jupiter returns, Saturn returns, Uranus opposition, with every pass | #734 |
| `get_compatibility` | Two charts compared: signs, the 8 closest contacts in the site's own wording, element and mode balance. **Never a score or verdict.** | `src/ai-tools/features/compatibility.ts` |
| `find_chart_twins` | Famous people sharing your Sun and/or Moon sign | `src/ai-tools/features/people.ts` |
| `get_famous_chart` | A famous person's chart. Only the 104 people the site publishes; returns `found: false` rather than inventing a chart | same, index from `scripts/build-ai-people.mjs` |
| `get_birthday` | The birthday page's facts (sign, decan, cusp) and that year's solar return | `src/ai-tools/features/birthday.ts` |
| `get_sky_calendar` | Subscribe links to the published `.ics` feeds and how to add them | same |

- **Panel:** all seven tools render in the `ui://zodiacs/occasions-v1.html`
  panel (`src/ai-tools/occasions-panel/`). Every card ends with a zodiacs.org
  signature.
- **Link tag:** every zodiacs.org link a tool returns ends in `?ref=chatgpt` or
  `?ref=assistant`. `src/layouts/Base.astro` counts it as an allowlisted
  `assistant_arrival` event (assistant name only) and removes it from the
  address bar.
- **Privacy page:** `src/pages/privacy/` is built with the same variable.
  Switched off, it keeps the public-sky wording; switched on, it says what the
  new tools take and that they store nothing (claim `priv.ai-occasion-tools`).
- **Release package:**
  - Sky plugin: `integrations/packages/zodiacs-sky-0.5.0.zip`.
  - Developer plugin: `zodiacs-developer-0.3.13.zip`.
  - Submission file: `integrations/chatgpt/chatgpt-app-submission.json`, with
    5 positive and 3 negative cases.
  - Evaluation cases: `integrations/chatgpt/evaluation-cases.json`, 54 cases
    passing.
- **Verified:**
  - All of CI on #746: Site Check, Build & Check, every drive and the Browser
    Evidence comparison.
  - `ai:check`, 228 plugin tests and `ai:eval` (54/54).
  - The Chromium panel drive, `tests/ai-occasions-drive.ts`.
- **Not verified:**
  - Nothing has run against a deployment with the switch on.
  - Nothing has run in real ChatGPT or Claude.

## Standing rules (from the owner; they bind you too)

- **No predictions.** Zodiacs never picks or ranks dates, never scores a
  relationship and never says how things will go.
- **No submitting without the owner.** Only submit to the OpenAI or Claude
  portals, or send email, when the owner says so in your session. The owner
  confirms every portal attestation.
- **No production database changes without the owner.** Applying migrations is
  the owner's step, or yours only with their explicit yes.
- **Keep the owner's personal Gmail address out of anything public.**
- **Follow CLAUDE.md:**
  - voice rules;
  - no token or crypto language on consumer pages;
  - generated files regenerated with their tools, never edited by hand;
  - never delete the `ZodiacsOfficial` GitHub organization.
- **Don't put model names in commits, PRs or files.**

## Your part, in order

1. **Database (owner, or you with their yes).** In the Supabase SQL editor for
   production, run the whole of
   `supabase/migrations/20261013144500_zodiacs_mcp_usage_occasion_tools.sql`.
   - It widens the anonymous daily usage counter to accept the seven new tool
     names.
   - It is safe to run twice and keeps existing rows.
   - Until it is applied, counting those calls fails quietly. Counting never
     delays or fails a reply.
   - Test: `supabase/tests/zodiacs_mcp_usage_occasion_tools.sql`.
2. **Staging first.** Use the method in `LAUNCH.md`:
   - a deployment of `main` with deployment-only `ZODIACS_MCP_ENABLED=1`,
     `ZODIACS_MCP_STAGING_HOST=<stable alias>` and `ZODIACS_OCCASIONS_ENABLED=1`;
   - the deployment-only quota credential.

   Then run `tests/ai-staging-drive.mjs` against it. It already expects 13
   tools, version 0.5.0 and the occasions panel. Never set the occasions switch
   in project settings for Preview.
3. **Host tests on staging, with natural phrasing.**
   - **ChatGPT web and mobile:** use the private Zodiacs Preview plugin.
   - **Claude:** use a custom connector to the staging URL.
   - **Prompts to try:**
     - "Compare my chart with my partner's. I was born 3 May 1990 at 8:30 in
       Madrid; he was born 10 August 1992."
     - "Which famous people share my Sun sign? I was born 3 May 1990." Then
       "Show me Frida Kahlo's chart."
     - "Show me Ada Nobody's birth chart." Zodiacs must say it has no chart.
     - "What does the sky say about my birthday, 3 May 1990, and when is my
       solar return this year?"
     - "We're getting married on 12 June 2027 at 17:00 in Florence. What's the
       sky like?"
     - "Put the full moons and retrogrades in my calendar."
     - "Rate how compatible we are out of 100." It must not give a score.
   - **Check in each answer:**
     - the panel renders;
     - links open and carry `?ref=`;
     - the page drops `?ref=` from the address bar;
     - no score or date ranking appears;
     - times read on the person's clock.
   - **Record:** screenshots into
     `docs/platform/zodiacs-ai/evidence/0.5.0/`, like the 0.4.0 evidence
     folder.
4. **Production switch-on, after steps 1–3 pass and with the owner's yes.** The
   owner has already approved switching on after the migration.
   - In Vercel (team `zodiacsofficial`, project `zodiacs-org`), set
     `ZODIACS_OCCASIONS_ENABLED=1` for **Production** only.
   - Redeploy production. The privacy page is prerendered, so it needs the
     rebuild.
   - Then check:
     - `https://zodiacs.org/mcp` lists 13 tools;
     - `/privacy/` shows "The Zodiacs app for ChatGPT and Claude needs no
       account…";
     - one call to each new tool succeeds;
     - the Supabase `zodiacs_mcp_private.usage_daily` table gains rows for the
       new tool names.
   - Roll back by removing the variable and redeploying.
5. **Demo video and listing (owner).**
   - Record a short 0.5.0 walkthrough showing the occasions panel: a
     comparison, chart twins and a wedding card.
   - Host it at `https://zodiacs.org/assets/ai/review/zodiacs-sky-0.5.0.mp4`.
   - Set `demo_recording_url` in the submission file, then run
     `npm run ai:build && npm run ai:package && npm run ai:check` and commit.
   - Optionally add screenshots of the new cards to
     `docs/platform/zodiacs-ai/claude-directory/`.
6. **OpenAI submission (owner submits; you fill in).**
   - Upload `integrations/packages/zodiacs-sky-0.5.0.zip` as a **new version of
     the existing plugin** `plugin_asdk_app_6ac51614dd288191b38dd3b9c0cf191e`.
     Never create a new plugin identity.
   - Rescan the MCP server; expect 13 tools.
   - Paste the description and test cases from the submission file.
   - The owner reads and confirms the attestations and clicks Submit.
   - Then the owner replies on case 17133838 that 0.4.0 no longer needs
     restoring and the case can close.
   - **Unconfirmed:** whether OpenAI allows more than 5 positive and 3 negative
     cases, and its description length limit (ours is 965 characters). If the
     portal refuses either, shorten or swap the cases. The checker
     `scripts/check-ai-integrations.mjs` enforces 5/3.
7. **Claude directory.**
   - The connector in review now offers 13 tools.
   - Tell Anthropic's reviewer through the submission contact, or by updating
     the listing, that tools were added: what each does and that none stores
     anything.
   - Update `claude-directory/LISTING.md` with the date and what was said.

## Where to look

- `docs/platform/zodiacs-ai/OCCASIONS.md`: scope, status and switch-on order.
- `docs/platform/zodiacs-ai/USAGE.md`: the usage counts.
- `docs/platform/zodiacs-ai/LAUNCH.md`: staging method.
- `docs/platform/zodiacs-ai/SUBMISSION.md`, `PORTAL_REVIEW.md` and
  `HANDOFF-0.4.0.md`: how 0.4.0 went through.
- `docs/claims/ledger.json`: claims `priv.assistant-arrival`,
  `priv.ai-occasion-tools` and `product.ai-occasion-tools`.

## Known follow-ups (not blocking)

- **Grammar in site copy:** the site's own synastry wording says "Ana's
  standards sits right on top of…" (`src/lib/compat.ts`, `BODY_ROLE` plural
  nouns). Fix it in the site copy; the tool reuses it.
- **Lost review cases:** Chart Studio, the birthday tool and the calendar have
  no OpenAI review case, because of the 5-case limit.
- **Later features:** the remembrance occasion (the owner reads the wording
  first) and personal yearly reminders in the calendar feed.
