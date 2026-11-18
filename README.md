# zodiacs.org

The source of [zodiacs.org](https://zodiacs.org): a free astrology site with
guides, calculators that compute charts in the visitor's browser, and a
developer section. The site also keeps the Registry (Astrofolio), its record
of the Zodiacs collection, as a separate wing with its own pages.

Production deploys from `main` through Vercel as a static Astro build, with a
few serverless functions under `api/`.

This repository is public so that its work can be read and checked. It is not
open source: all rights are reserved (see [LICENSE](LICENSE)).

## Connect an AI assistant (MCP)

The hosted [Model Context Protocol](https://modelcontextprotocol.io/) server
provides read-only tools for birth charts, chart compatibility, dated Sun-sign
horoscopes and public sky events. It keeps calculated astronomical facts
separate from astrological interpretation; readings are for reflection, not
guarantees.

- **Endpoint:** `https://zodiacs.org/mcp`
- **Transport:** Streamable HTTP.
- **Authentication:** no account, API key or sign-in is required.
- **Installation:** no local runtime is needed for the hosted server. Add the
  endpoint as an HTTP MCP server in an assistant that supports remote MCP.

For Copilot, this portable configuration can go in the workspace's `.mcp.json`
or the user's `~/.copilot/mcp-config.json` (see the
[configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)
for other destinations and remote workspaces). Merge the entry into an existing
configuration rather than replacing other servers:

```json
{
  "mcpServers": {
    "zodiacs": {
      "type": "http",
      "url": "https://zodiacs.org/mcp",
      "tools": ["*"]
    }
  }
}
```

Review the assistant's server-trust prompt, then use `get_capabilities` to
check the connection and available tools. Examples to ask:

- "What changes in the sky this week in Europe/London?"
- "Is Mercury retrograde right now?"
- "Show today's horoscope for Leo."

Public-sky questions need no birth details. Hosted tool arguments and results
pass through the assistant and Zodiacs; this is not the browser-only calculation
described above. Do not send birth details for children under 13. See the
[tool list, examples and limits](https://zodiacs.org/developers/ai/) and
[AI integration privacy policy](https://zodiacs.org/privacy/#ai-integrations)
before connecting personal records. The server gives no financial or medical
advice and schedules nothing.

The repository-linked official MCP Registry listing is
[`org.zodiacs/astrology`](https://registry.modelcontextprotocol.io/v0.1/servers/org.zodiacs%2Fastrology/versions/latest).
The older `io.github.zodiacs-org/zodiacs` listing points to the same endpoint;
the two names are registry records, not separate servers. Registry metadata
versions are separate from the runtime version returned by MCP initialization.

## What is where

- **The astrology site** is everything Astro builds from `src/`: the sign
  guides, the Learn pages, the calculators (`/birth-chart/`, `/moon-sign/`,
  `/rising-sign/` and others), the daily pages and the developer pages under
  `/developers/`. Charts are computed on the visitor's device by
  [`@zodiacs/engine`](https://github.com/zodiacs-org/engine), which the site
  vendors as a digest-pinned archive in `vendor/`.
- **The Registry wing** is the static pages in `public/registry/`,
  `public/thesis/`, `public/archive/` and `public/sdk/`, plus the wing routes
  under `src/pages/registry/`, `src/pages/terminal/` and `src/pages/fomo/`. It
  keeps its own register; `CLAUDE.md` gives the boundary between the two, and
  CI enforces it.
- **Records** of how the site and its engine are checked are in `docs/`:
  `docs/platform/programme/` (the programme's acceptance ledger and status),
  `docs/platform/evidence/` (measurements), and `docs/claims/ledger.json` (the
  evidence behind every accuracy, time and privacy sentence on the site).

## Development

```bash
npm ci
npm run dev        # Astro dev server
npm run build      # static build to dist/ (runs the generators' checks first)
npm run check      # consumer boundary, footer and astro check
npm test           # vitest
node scripts/check-dist.mjs   # link and artifact integrity over dist/
```

Several files are generated; `CLAUDE.md` lists each with its generator. Edit
the source, run the generator, and commit both: CI regenerates them and fails
on any difference.

## Privacy

Birth details entered in the calculators are computed on the visitor's device.
What the site does send, and when, is described on
[the privacy page](https://zodiacs.org/privacy/).

## Licence

All rights reserved; see [LICENSE](LICENSE), which also lists the parts that
come with their own terms: the chart engine (MIT code with CC BY 4.0 ΔT data, and the time and star data its NOTICE lists), the CC BY 4.0 sky
data, the CC BY 4.0 historical time atlas (whose resolver is MIT) and GeoNames
place data, and third-party packages.

[CONTRIBUTING.md](CONTRIBUTING.md) says what kinds of report are welcome,
[SECURITY.md](SECURITY.md) how to report a security problem, and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) the rules for taking part.
