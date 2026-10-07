# Review packages

`npm run ai:build && npm run ai:package` regenerates both ZIPs and their SHA-256
manifest. `npm run ai:check` verifies byte-for-byte drift. Archive entries use
fixed dates, paths and permissions. The packager includes only plugin manifests,
skills, icons, notices and the developer's pinned runtime/recipes; no credentials,
node_modules, personal data, cache or hosting configuration is included.

The sky ZIP is the portable remote-MCP candidate for ChatGPT/Codex review. Its
production connection is already deployed and domain-verified for the 0.3.4
package under review. The 0.4.0 candidate still needs its own preview acceptance,
real-host checks and reviewer walkthrough. The developer ZIP runs local stdio MCP;
install pinned dependencies after extracting. Public local-MCP directory support
requires an OpenAI-supported distribution path; the repo marketplace and direct
local MCP connection are the available development paths.

These files are prepared packages, not evidence of upload, acceptance or listing.

Current candidates are **Zodiacs 0.4.0** and **Zodiacs Developer 0.3.3**;
`manifest.json` identifies their archive and member hashes. Earlier ZIPs are
historical artifacts. The consumer ZIP includes portable, Codex and Claude
manifest files; its shared `.mcp.json` declares HTTP transport. The production
MCP URL remains unchanged. See [the 0.4.0 audit](../../docs/platform/zodiacs-ai/AUDIT-0.4.0.md)
for acceptance evidence and outstanding release gates.
