# Zodiacs Sky — review candidate

Portable Agent Plugins package with one public-sky skill and a remote MCP
connection. The proposed endpoint is `https://zodiacs.org/mcp`; it remains
disabled until deployment and host acceptance checks pass. This package does
not establish an active ChatGPT connection or a directory listing.

The calendar declares sidebar and conversation-panel entrypoints, accepts `{}`
for a seven-day UTC launch, and supports inline/fullscreen display. Explicit
searches require both bounds. No account or birth data is needed. Provider and
hosting metadata retention still require review.

From the site checkout, `npm run ai:package` creates deterministic review ZIPs.
The ZIP contains root `plugin.json`, `mcp.json`, its skill, icon and notices.
Its five positive and three negative review cases are proposed expectations;
real ChatGPT tool selection, screenshots and the required walkthrough remain
launch gates. Credentials and domain-verification tokens belong outside the ZIP.

Use ChatGPT developer mode and an authorized HTTPS staging endpoint to test the
server first. Refresh metadata after changes. Then install the complete package
from the local marketplace and test the skill and native calendar in a new
conversation. Public upload, domain verification, review and publication require
the verified publisher's account. See `docs/platform/zodiacs-ai/LAUNCH.md`.

Version 0.2.0 also declares a Chart Studio entrypoint (`open_chart_studio`, `{}`).
Its self-contained panel calculates in the browser, supports Placidus/whole-sign
comparison, and exports versioned chart records. Only a reviewed selection is
shared on an explicit user action. The panel starts with synthetic inputs and
requires UTC date/time; unknown time uses a labeled noon reference with no
houses or angles. Personal records are not stored. Prior calendar host acceptance
does not establish Chart Studio acceptance; verify this version in ChatGPT.

## 0.3.0 review candidate

Chart Studio includes local date/time entry, an offline search of 1,000 large
cities and a review of daylight-saving/historical-clock assumptions before
conversion. The downloaded record retains those assumptions. Manual UTC entry
and unknown-time references remain available.

Chart Studio also includes Time Explorer (UTC stepping and possible birth-time
windows) and Chart Inspector (local file/text record validation, reproduction
and comparison). No new personal arguments enter MCP tools, and no imports or
window results are automatically shared. Birth windows require a host that
permits the embedded Blob worker. The runtime is verified locally. Local 0.3.0 packages were installed; the
already-open chat still needs a reload. The originally connected ChatGPT preview
remains frozen on 0.2.0, and native acceptance of the new candidate is pending. Sky Watch is implemented on a
separate authenticated test host; real ChatGPT event arrival and human beta
feedback remain unverified. Notifications are not enabled by this package.
See `docs/platform/zodiacs-ai/CHART_STUDIO.md` and `SKY_WATCH.md` in the repository.

## 0.3.1 submission metadata

This metadata update preserves the 0.3.0 runtime. It adds packaged onboarding
and follows the 2026-10-06 OpenAI submission reference. Public upload is distinct
from local/private installation. See `docs/platform/zodiacs-ai/SUBMISSION.md`
for the public route, current blockers and release safeguards.

The five positive scenarios cover all six tools; three starter prompts fit the
listing limit. The old calendar-only reel is cleared from review metadata so it
cannot stand in for a current walkthrough. The empty recording field is an
intentional submission blocker until the current experience has been recorded.
