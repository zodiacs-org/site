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
