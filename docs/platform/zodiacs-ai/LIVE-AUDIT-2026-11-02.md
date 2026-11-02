# Live audit of https://zodiacs.org/mcp (2026-11-02, v0.5.1)

Accuracy: get_sky matched JPL DE421 within 17 arcsec for every body at four instants (1990, 2000, 2026); Moon phase angle and illumination matched to 0.01 degrees. Einstein's famous chart and Cancer rising matched; Mercury station direct 2026-11-13/14 matched check_sky_fact.

Fixed on branch fix/mcp-audit-errors:
- Schema mismatches now return a structured result (`error.code: invalid-arguments`) naming the field, built only from schema words (field names, enum options, descriptions); unknown property names and values are never echoed.
- get_upcoming_events accepts plain YYYY-MM-DD for from/to (from = 00:00:00Z, to = 23:59:59Z), rewritten before the unchanged input schema; any other form gets the ISO 8601 hint.
- Unparseable JSON returns a JSON-RPC parse error (-32700, data.code invalid-json) with HTTP 400.

Not changed:
- Unknown tool keeps -32602 with the generic sentence: the accounts flag-off fixture requires the unknown save tool to be byte-identical to any unknown tool, so changing the text needs a fixture refresh decision.
- Frida Kahlo Moon: top-level moon is null while placements list Moon 1.5 Gemini with settled:false. This is by design (no birth time; the Moon is near a sign boundary, so its sign is unsettled). Suggest the description say so explicitly.

SSL UNEXPECTED_EOF: 2 of about 30 sequential calls from one client (Python urllib, new TLS connection per call) failed mid-handshake/read and succeeded on retry. Application code never sees these, so it is at the Vercel edge or Firewall layer. Next steps: check Vercel Firewall/attack-challenge logs for the audit window (2026-11-01 17:55 to 18:05 UTC), and re-run with keep-alive (one connection) to see whether only fresh handshakes drop.
