# Review packages

`npm run ai:build && npm run ai:package` regenerates both ZIPs and their SHA-256
manifest. `npm run ai:check` verifies byte-for-byte drift. Archive entries use
fixed dates, paths and permissions. The packager includes only plugin manifests,
skills, icons, notices and the developer's pinned runtime/recipes; no credentials,
node_modules, personal data, cache or hosting configuration is included.

The sky ZIP is the portable remote-MCP candidate for ChatGPT/Codex review. Its
connection still needs authorized HTTPS deployment, domain verification, host
acceptance and the reviewer walkthrough. The developer ZIP runs local stdio MCP;
install pinned dependencies after extracting. Public local-MCP directory support
requires an OpenAI-supported distribution path; the repo marketplace and direct
local MCP connection are the available development paths.

These files are prepared packages, not evidence of upload, acceptance or listing.

Current metadata packages are version **0.1.1**; `manifest.json` identifies their
archive and member hashes. The retained 0.1.0 ZIPs are historical artifacts.
Website, company and support metadata are refreshed; runtime and MCP connection
configuration are unchanged. See [profile metadata](../../docs/platform/zodiacs-ai/PROFILE_METADATA.md).
