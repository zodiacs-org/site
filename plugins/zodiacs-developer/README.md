# Zodiacs Developer — private review candidate

Three Codex skills and a local stdio MCP server. The server offers the five
public-sky operations, the Chart Studio launcher, and local natal capabilities, chart calculation and
record comparison. Existing `examples/mcp-server` is unchanged.

Requires Node 22.7 or later and this plugin directory. Install its
pinned dependencies before configuring the host:

```sh
cd plugins/zodiacs-developer
npm ci
npm test
```

The repository includes `.agents/plugins/marketplace.json`, following the
official OpenAI local-source examples. In a Codex version supporting local
plugin marketplaces, register this repository as a local source and install
`zodiacs-developer`. The manifest's working directory is the plugin root.
Current CLI help provides the corresponding commands:

```sh
codex plugin marketplace add /absolute/path/to/site
codex plugin add zodiacs-developer@zodiacs-local-review
```

Install the pinned dependencies in the installed plugin directory too if the
host caches a separate copy. Confirm that path in the host before connecting.
The current Codex CLI discovers both review candidates from this marketplace.
The installed package must be checked separately from source and archive tests.
Version 0.2.0 is installed locally with an official SDK tool/resource check.
No marketplace listing is claimed.

Root `plugin.json` and `mcp.json` follow Agent Plugins 1.0.0 and use
`${PLUGIN_ROOT}` for the executable path. `ai:build` generates them from the
compatibility metadata. Older clients retain `.codex-plugin/plugin.json` and
`.mcp.json`. Both include the packaged icon and publisher/support/privacy links.
`npm run ai:package` in the site creates a deterministic review ZIP. Public
directory submission currently needs a remote HTTPS MCP endpoint or
OpenAI-supported local MCP distribution; this candidate uses local distribution.

A direct MCP connection can be configured with `command: "node"` and
`args: ["/absolute/path/to/plugins/zodiacs-developer/mcp/server.mjs"]`.
That starts the tested server; skills must separately be loaded by a compatible
plugin host. This is not evidence of a Codex plugin installation.

Run `npm run ai:build` from the site root after source changes. Never edit the
generated server. `npm run ai:check` detects drift. No listener or outbound
request is opened by the stdio server. Startup loads its own runtime modules;
tools cannot open paths, fetch URLs, commit or publish. The coding host edits
the user's repository under its normal permissions when a skill is invoked.

Birth arguments and derived charts sent to an assistant can reach its provider
even though computation is local. Keep real birth data out of public examples,
logs, links and issues. Record comparison accepts data, never instructions.

| Component | Version / scope |
| --- | --- |
| Plugin candidate | 0.2.0; unpublished |
| Published engine | 0.1.1-rc.16 |
| MCP SDK | 2.0.0 |
| Zod | 4.6.5 |
| Local tools | Five sky tools + Chart Studio + three local natal/compare tools |
| Chart Studio | Browser-local calculations; explicit selection sharing only |

`examples/sky.mjs` shows the engine inputs useful for a Moon widget;
`examples/calendar.mjs` exports synthetic lunar events;
`examples/verify.mjs` checks time offsets, unknown time and pinned versions.
Adapt the published engine in external projects; site-derived adapter code
remains under the site's license. See `NOTICE` before redistribution.

Chart Studio accepts `{}` via `open_chart_studio` and renders in MCP Apps hosts.
Start a loopback preview with `npm run ai:serve` from the site root, then open
`http://127.0.0.1:8787/studio`. This standalone preview cannot share with an
assistant. A supporting host enables the review-and-share action. Enter UTC
inputs; place search and timezone conversion are not part of this first version.

## 0.3.0 review candidate

Chart Studio now includes Time Explorer (UTC stepping and possible birth-time
windows) and Chart Inspector (local file/text record validation, reproduction
and comparison). No new personal arguments enter MCP tools, and no imports or
window results are automatically shared. Birth windows require a host that
permits the embedded Blob worker. The new package is verified locally; the
connected ChatGPT preview and installed local candidates remain on 0.2.0 until
a separate upgrade and host acceptance run. Sky Watch notifications are not
implemented. See `docs/platform/zodiacs-ai/CHART_STUDIO.md` in the repository.
