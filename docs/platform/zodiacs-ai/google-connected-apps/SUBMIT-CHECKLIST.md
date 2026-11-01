# Google Connected Apps: the owner's steps

Prepared 1 November 2026. Every step here is the owner's: applying,
accepting terms, typing into the console, adding testers, sending for review
and publishing. An engineer helps only with step 5 (the verification token)
and with fixes. Nothing has been submitted.

Before starting, read the three blockers in [GAP.md](GAP.md): the category
(step 3 is permanent), the panels in Gemini (step 0), and the token (step 5).
The words to type are in [LISTING.md](LISTING.md).

Docs: [prerequisites](https://developers.google.com/connected-apps/gpc/prerequisites),
[register, test and publish](https://developers.google.com/connected-apps/gpc/perform-the-steps),
[Developer Mode](https://developers.google.com/connected-apps/mcp/dev-mode/usage).

## 0. Try Zodiacs in Gemini Developer Mode (no registration needed)

- **Do:** sign in to Gemini on the web, open `https://gemini.google.com/devmode`
  (or **Settings > Gemini Apps Developer Mode**). In **Choose an app**, select
  **+ Create new**, enter `https://zodiacs.org/mcp`, accept, name it Zodiacs and
  check that 13 tools appear under **Available actions**. Select **Connect**.
- **Try:** the six example prompts in LISTING.md.
- **Look for:**
  - in the **Event Log**, every call answers 200 (a 403 means gap 6 in GAP.md);
  - the horoscope, sky calendar and occasion cards show their content, not an
    empty frame (gap 5); Chart Studio opens;
  - no score is promised as a guarantee and no investment advice is given.
- **Prepared:** the live server; nothing to change for this step.
- **If cards are empty:** stop here and ask an engineer for the panel fix
  described in gap 5 before step 7. It is a release that also reaches ChatGPT
  and Claude, so it needs the owner's separate yes.

## 1. Apply for the preview

- **Do:** fill in Google's interest form at
  `https://connected.google.com/console/help/?apply`. Use the business Google
  account that will own the app (admin@zodiacs.org if it is a Google account),
  not a personal one.
- **Ask Google's contact,** when they reply, which category they expect for an
  astrology and sky app (GAP.md, gap 1).
- **Prepared:** company Zodiacs LLC, website `https://zodiacs.org/`, contact
  `admin@zodiacs.org`, endpoint `https://zodiacs.org/mcp`.

## 2. Open Connected Console and accept the terms

- **Do:** sign in at `https://connected.google.com/console`. The account owner
  or an administrator reads and accepts the Connected Apps Terms of Service.
  Other team members can only continue after that.
- **Prepared:** nothing; this is the owner's agreement.

## 3. Create the app

- **Do:** **Create app**, then:
  - **Give your connected app a name:** `Zodiacs`
  - **Select a connected app category:** permanent. Only continue once a
    category fits (gap 1).
  - **Choose connection type:** **MCP server** (permanent).
  - **Create Connected app**.

## 4. App details

- **Do:** **App details > Get started**, copy each field from LISTING.md:
  name, icon (upload `public/assets/ai/brand/zodiacs-avatar-v2.png`, 512 × 512
  PNG), description (one sentence, 24 words), the eight capabilities, the six
  example prompts, Terms of Service URL `https://zodiacs.org/terms/`, Policy URL
  `https://zodiacs.org/privacy/`, website `https://zodiacs.org/`. **Save.**
- **Before review:** the privacy page should name Gemini (gap 8); that is a
  site change for an engineer, with the owner's yes.

## 5. Endpoint and domain verification

- **Do:** **MCP and tools setup > Get started**.
  1. Under **Connect your MCP server endpoint**, enter `https://zodiacs.org/mcp`.
  2. Under **Verify your domain**, select **Download token**. This saves
     `google-connected-apps.json`.
  3. Send that file to the engineer (it is not a password: Google reads it
     publicly from the site, but keep it out of chat logs anyway).
  4. Wait for the engineer's "it's live", then select **Verify domain** and
     look for the green check.
- **Engineer, with the owner's yes:**
  - Put the token into `public/.well-known/google-connected-apps` (or replace
    the file with the downloaded one). The file today is
    `{"verification_tokens": []}`; keep the `verification_tokens` key.
  - `npx vitest run tests/api/google-connected-apps.test.ts` checks the shape,
    the headers and that nothing redirects it.
  - Open a draft PR; the owner merges; Vercel deploys `main`.
  - Check production: `curl -sS -D - https://zodiacs.org/.well-known/google-connected-apps`
    must show `HTTP/2 200`, `content-type: application/json; charset=utf-8`, no
    `location` header, and the token in the body.
- **Prepared:** the file, its exact-path JSON header rule in `vercel.json`, the
  test, and the routing receipt entry. See GAP.md, gap 2.

## 6. Access credentials

- **Do:** **Provide access credentials > Get started**. For **Does your server
  require authorization?** choose **No**, then **Confirm**.
- **Skip** the **Test account details** step: it only applies to user sign-in.
- **Prepared:** all 13 tools work without sign-in. Saved-chart sign-in is off
  and not ready for Google (gap 4).

## 7. Sync tools

- **Do:** **Sync tools**. Expect exactly 13 tools, named as in LISTING.md, and
  no **Must fix** errors. Then **Next**.
- **Note:** Google keeps this snapshot. After publishing, any change to the
  tools at `/mcp` needs a new console version (gap 10). Do this step only after
  step 0 passed, so the panels Google keeps are the right ones.
- **Prepared:** the live `tools/list` saved as
  `tools-list.live-2026-11-01.json`, for comparing.

## 8. Availability and tools

- **Do:**
  - **Countries / regions:** owner's choice.
  - **Languages:** English.
  - **Products:** Gemini app and Search, if both are offered.
  - **Manage tool panel:** every tool enabled; **Additional context:** none;
    **User confirmation required:** off (none is destructive).
  - **UI resources** tab: four panels; `resourceDomains` shows
    `https://zodiacs.org`.
  - **Save.** The version becomes **Available to testers**.
- **Prepared:** the settings table in LISTING.md.

## 9. Testers and testing in Gemini

- **Do:** in **Test your app**, **Add testers**: `@gmail.com` accounts only
  (the owner's own and one more). **Save** and wait up to 10 minutes.
- **Test** in the Gemini app as a tester: type `@Zodiacs` and each example
  prompt, then the same requests by name mid-sentence and without the name.
  Check answers, cards, links to zodiacs.org, and the boundary prompts in
  LISTING.md. Developer Mode now also lists the registered app.
- **Record:** screenshots into `docs/platform/zodiacs-ai/evidence/google/`
  (host chrome is fine there; they are evidence, not listing images).

## 10. Send for review

- **Do:** **Releases > Send for review**, once the console shows no blocking
  issues. Paste the reviewer notes from LISTING.md if a notes field or the
  Google contact asks.
- **If issues come back:** **View issues**, fix the draft (an engineer for
  code issues, each with the owner's yes), retest with testers, send again.

## 11. Publish

- **Do:** when the card says **Ready to publish**, the owner decides and
  selects **Publish**.
- **After:** the **Published** card shows the live version. Record the date and
  version in this folder, as the Claude and OpenAI records do. For later tool
  changes, use **Create new version**.
