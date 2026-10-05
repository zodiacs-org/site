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
Its six positive and three negative review cases are proposed expectations;
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
