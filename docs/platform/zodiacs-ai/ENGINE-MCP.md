# /mcp/engine: the Astrologer bot's engine tools

`https://zodiacs.org/mcp/engine` is a second hosted MCP server, separate from
the consumer server at `/mcp`. It serves exactly the seven tools that the
Astrologer bot (zodiacs-org/engine, `bots/astrologer/template/INSTRUCTIONS.md`)
calls, and nothing else. The consumer server keeps its own tools; the two
share no tool, no handler and no quota.

## Tools

| Tool | What it does | Source |
| --- | --- | --- |
| `search_places` | Place name to coordinates and IANA zone, from GeoNames cities15000 (33,934 places of 15,000 people or more) | `src/engine-mcp/places.ts`, the index of the site's birthplace search |
| `resolve_civil_time` | Local date and wall time in a zone to a UTC instant, with `gap`, `fold`, `lmt` and calendar flags | port of engine PR #74 |
| `reading_facts` | The bot's facts sheet: placements, sect, dignities, aspects, chart ruler, dispositors, angles, sign edges, birthday, transits and stations, each line with an ID | `src/engine-mcp/reading-facts.ts`, copied from the engine repository by `scripts/sync-reading-facts.mjs` |
| `natal_chart` | Natal chart from a UTC instant, with an engine receipt | port of engine PR #49 |
| `transits_at` | Moving-to-natal aspects at an instant | port of engine PR #49 |
| `event_search` | Instants a body crosses a longitude, at most 366 days | port of engine PR #49 |
| `get_capabilities` | Tools, settings, versions (engine, ephemeris, shipped and host tzdb, Node) and limits | `src/engine-mcp/tools.ts` |

The four ported tools keep the inputs and the `zodiacs-astro/1` data of the
engine's zodiacs-astro server; each reply adds `links` (the zodiacs.org page
for that kind of fact and the methodology page). No link carries birth data.

## Switch, limits and privacy

- Off unless `ZODIACS_ENGINE_MCP_ENABLED=1`; until then every request gets 503.
- Hosts `zodiacs.org` and `www.zodiacs.org`; browser origins grok.com,
  chatgpt.com, chat.openai.com, claude.ai, claude.com and zodiacs.org; a
  request without an Origin header (a server-side client) is accepted.
- Per-address limits from the compute API's Firewall rules:
  `zodiacs-compute-api` for every request and `zodiacs-compute-events` also
  for `reading_facts` and `event_search`. A limiter that cannot answer fails
  closed (503). There is no service-wide daily quota yet.
- Request body at most 65,536 bytes; reply at most 1,048,576 bytes.
- Stateless; nothing is stored or logged. A refusal names fields, never values.

## Local run

```sh
npx vite-node --script scripts/serve-engine-mcp.ts -- --port 8787
# http://127.0.0.1:8787/mcp/engine, switch on, no rate limit
```

Tests: `npx vitest run src/engine-mcp`.

## Keeping reading_facts in step with the engine

`src/engine-mcp/reading-facts.ts` is generated. After a change to
`bots/astrologer/facts/reading-facts.ts` in the engine repository, rerun
`node scripts/sync-reading-facts.mjs <engine checkout> <ref>`. Its header
records the engine commit and the SHA-256 of the source file. The copy runs on
the vendored package; when the engine's code under `src/` changes, the vendored
archive must be the same engine for the sheets to match.
