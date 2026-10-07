# Handoff: Zodiacs plugin 0.4.0 (for Codex)

Written 2026-10-07 by Claude (Opus 5.5), who drives this work and will review
your amendments. It follows the owner's 7 October second opinion. The owner is a
non-technical founder: report to them in plain words and never ask them to
watch CI.

## What is done (pull request #681, draft, not merged)

- **Horoscopes in the plugin.** `get_horoscope` and its panel. Every reader
  gets the edition for their own date: `src/data/horoscope-window.json` holds
  the editions for the day before, the day of and the day after the committed
  daily date. Code is in `src/ai-tools/horoscope/`, the window builder in
  `scripts/horoscope-window-files.ts`, and the nightly step in
  `.github/workflows/daily-horoscopes.yml`.
- **One hosted server.** `/api/v1/mcp` (#677) is reverted. `/mcp` accepts
  claude.ai and claude.com origins, allows 92-day event windows and gives plain
  refusals. `search_zodiacs` is retired.
- **Plain language.** Tool titles and descriptions, server instructions, the
  onboarding skill, the listing, the sky calendar widget and Chart Studio's
  first screen ("When and where were you born?").
- **Packages.**
  - `integrations/packages/zodiacs-sky-0.4.0.zip`, with `demo_recording_url`
    deliberately empty.
  - `zodiacs-developer-0.3.3.zip`; 0.3.2 is left unchanged.
- **Verified locally.** These all pass:
  - `ai:check` and 139 plugin tests, including the Bangkok, New York and
    Los Angeles midnight cases;
  - the claims ledger, the consumer boundary and `astro check`;
  - `tests/ai-widget-drive.ts` and the new `tests/ai-horoscope-drive.ts` in
    Chromium;
  - a smoke test of the built `api/_ai/runtime.mjs` with the official MCP
    client.
- **Not verified.** Nothing has been run on Vercel infrastructure, in ChatGPT
  or in Claude. That is your part.

## Your part, in order

1. **CI on #681.** Read the checks once and fix what fails. Amend on the same
   branch and keep commits small. Commit as Codex with your usual attribution.
2. **Staging.** Use the 5 October method in `LAUNCH.md`:
   - a deployment of #681 with deployment-only `ZODIACS_MCP_ENABLED=1` and
     `ZODIACS_MCP_STAGING_HOST=<the stable alias>`;
   - the deployment-only quota credential. General Preview has no
     `SUPABASE_SERVICE_ROLE_KEY`, so without it every call answers 503;
   - then run `tests/ai-staging-drive.mjs` against it. It still expects the
     0.3 tool list, so update it first.

   Never point production at it, and never set the switch in project settings.
3. **Host tests**, with natural phrasing and not scripted engineering prompts.
   - **ChatGPT web and the ChatGPT mobile app**, using the private Zodiacs
     Preview identity. Set its three starters to:
     - "Show my horoscope for today"
     - "Is Mercury retrograde right now?"
     - "Help me read my birth chart"

     Check that the horoscope panel shows the reader's own date, that
     switching sign inside the panel works (`openai/widgetAccessible`), and
     that Chart Studio opens on birth details.
   - **Claude** (custom connector to the staging URL). Record whether Claude
     sends an Origin header, and whether its panels render.
4. **The walkthrough.**
   - Record the 0.4.0 walkthrough and upload it to
     `/assets/ai/review/zodiacs-sky-0.4.0.mp4`.
   - Set `demo_recording_url`, then run `npm run ai:package` and
     `npm run ai:check`.
5. **The submission.** Ask the owner before changing what is under review.
   - If the 0.3.x review is still open, the owner decides whether to replace
     it with 0.4.0.
   - Merging #681 changes the live `/mcp` tools, so it must not land while
     reviewers test 0.3.x.
6. **Claude listing prep.** This is not in #681. Add a `.claude-plugin/`
   manifest and the `type` field in the plugin's `.mcp.json`, as Claude's
   directory requires.
7. **Stale docs.** None of these is user-facing on the site:
   - `integrations/chatgpt/README.md` (says "not deployed", "five tools",
     "Lifestyle");
   - `integrations/packages/README.md` (0.1.1);
   - `plugins/zodiacs-developer/README.md` (0.3.1);
   - `CHECKPOINTS.md` and `COST.md` (say `/mcp` is 404);
   - the `app_info.category` "LIFESTYLE" in `chatgpt-app-submission.json`;
   - the model-routing lines ("Use GPT-6.1 Sol High…") in the developer skills.
8. **Rate limits (separate PR, F-78).** The live Firewall is 30 a minute and
   6 for events (version 8), but `RATE_LIMIT_RULES` and the docs say 40 and 10.
   - Rebuilding means the compute bundle, the runtime, the MCP archive and the
     Phase 1 receipt.
   - Then update the claims statement `product.compute-budgets`.

## Owner rules that apply here

- Ship to a preview, not the live site. Stop and show the owner before
  anything goes live.
- Merging needs the owner's explicit yes each time. No auto-merge.
- Ask the owner before any legal, disclosure or privacy wording, including
  what to do with the email sign-ups collected while the daily email sent
  nothing.
- Never invent a birth time or a sign. Keep calculation and interpretation
  separate.
- Sentence case for display text. Every new site string goes in all six
  languages. The plugin copy is English-only, as before.
- No token, market or crypto language outside the wing. Don't touch wing or
  SDK text, `disclosure.*` keys, the hash-locked trust sentences or the
  "Registry" footer heading.
- Never permanently delete anything. Don't open Astro-Databank pages. Don't
  email anyone.

## Related

- The horoscope preview as first built is saved unchanged on branch
  `opus/horoscope-preview-rescue`.
- The daily horoscope job would fail on 8 and 10 October: the Gemini and
  Virgo "tomorrow" readings are too similar (0.402 against a 0.4 limit). A
  separate draft PR fixes it and needs the owner's yes before 00:00 UTC.
