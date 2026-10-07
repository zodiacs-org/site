# Zodiacs horoscope feature preview

A local-only candidate for the main Zodiacs consumer plugin. This does not create another cloud plugin, change the six production MCP tools, modify the 0.3.4 review package, or deploy to production.

## Run

Use the repository Node 22 runtime.

```sh
npm run ai:horoscopes:build
npm run ai:horoscopes:serve
```

Open http://127.0.0.1:8796/horoscopes. An MCP client on the same computer can connect to http://127.0.0.1:8796/mcp. The default port can be changed with ZODIACS_HOROSCOPE_PREVIEW_PORT. The server refuses Vercel deployment environments, binds only loopback, checks Host/Origin, limits body size and accepts only the required protocol operations.

## Scope and dates

`get_horoscope` accepts an optional Sun sign, daily/weekly period, ISO calendar date, IANA timezone and general/love/career focus. Empty input opens the sign picker. New York is the explicit default. No user sign is inferred by the tool; the standalone panel starts with an Aries example.

Data is the repository's existing horoscope-program.json, bundled as an edition snapshot. Calendar-day selection uses the requested timezone, including daylight-saving rules. Reading periods remain UTC-based. Uncovered dates and unsupported weekly focuses return an unavailable result; the UI offers covered dates. When original copy says today or tomorrow, those words refer to its source edition; the tool preserves that provenance and the panel discloses it when relevant.

The panel offers all 12 signs, date/period/focus selection, a facts-versus-interpretation explanation, source links and copy with provenance. All interaction is local to the panel; a connected MCP host receives the requested sign and returned reading. No account, birth details, persistence, analytics, external assets or generative-model call is added.

## Verify

```sh
npm run ai:horoscopes:test
npx vitest run src/ai-tools/tools.test.ts
```

The standalone server was also exercised with the official MCP client (initialize/list/call/resource/close). Browser checks cover sign switching, weekly content, source disclosure, New York display, unsupported-date recovery and copying.

## Before a hosted release

- Integrate this feature into the existing consumer MCP identity after the current review decision; do not create a separate horoscope listing.
- Connect generated edition refreshes to the deployment pipeline and enforce date coverage. This local preview does not auto-refresh its bundled edition.
- Validate the embedded panel in actual ChatGPT and Codex hosts, including host-supplied tool results and size changes.
- Add review cases and a real walkthrough for the revised tool set. Keep the current 0.3.4 submission evidence immutable.
- Do not market sign readings as personalized natal forecasts. Personal transits and stored charts are later capabilities.
