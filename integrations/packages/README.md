# Review packages

`npm run ai:build && npm run ai:package` regenerates both ZIPs and their SHA-256
manifest. `npm run ai:check` verifies byte-for-byte drift. Archive entries use
fixed dates, paths and permissions. The packager includes only plugin manifests,
skills, icons, notices and the developer's pinned runtime/recipes; no credentials,
node_modules, personal data, cache or hosting configuration is included.

The sky ZIP is the portable remote-MCP candidate for ChatGPT/Codex review. Its
production connection is already deployed and domain-verified. The 0.5.0
candidate still needs the occasion tools switched on (`ZODIACS_OCCASIONS_ENABLED=1`),
its own preview acceptance, real-host checks and a reviewer walkthrough that
shows the occasions panel. The developer ZIP runs local stdio MCP;
install pinned dependencies after extracting. Public local-MCP directory support
requires an OpenAI-supported distribution path; the repo marketplace and direct
local MCP connection are the available development paths.

These files are prepared packages, not evidence of upload, acceptance or listing.
`ai:package` never rewrites an archive that already exists: a change needs a
new version, so every earlier ZIP keeps its bytes.

Zodiacs 0.6.0 adds five read-only tools offered where `ZODIACS_COVERAGE_ENABLED=1`
joins the occasions switch, and an About that names the score and rating out of
100 and the new features. 0.5.1 was in OpenAI review on 28 October; see
[RESUBMISSION-0.6.0](../../docs/platform/zodiacs-ai/RESUBMISSION-0.6.0.md).
Developer 0.3.16 is rebuilt from the corrected 0.6.0 source with unchanged local
tools; 0.3.15 keeps its bytes. Zodiacs 0.6.1 gives the five 0.6.0 tools the
inline readings panel, offers `find_birthplace` with them, and carries the
4 November forecast rule, the under-18 rule and the link privacy wording;
Developer 0.3.21 is rebuilt from that source with unchanged local tools. 0.6.0
and 0.3.20 keep their bytes. Zodiacs 0.6.2 packages the listing text chosen on
4 November: an About, subtitle, starter prompts, capabilities and review cases
that lead with the tools needing no personal details. The server reports 0.6.2
and its tools are unchanged; Developer 0.3.22 is rebuilt from that source with
unchanged local tools. 0.6.1 and 0.3.21 keep their bytes. Developer 0.3.23 is
rebuilt from the 0.6.2 source that adds `search_sky_events`, the natal chart's
lunar nodes and Placidus houses behind `ZODIACS_SKY_EVENTS_ENABLED`, which its
local server does not set; its local tools are unchanged, Zodiacs stays 0.6.2,
and 0.3.22 keeps its bytes. Developer 0.3.24 is rebuilt from the 0.6.2 source
that adds Chiron, from NASA JPL Horizons positions for 1800 to 2199, to the
natal chart, `search_sky_events` and `explain_astrology` behind the same switch;
its local tools are unchanged, Zodiacs stays 0.6.2, and 0.3.23 keeps its bytes.
Developer 0.3.25 is rebuilt from the 0.6.2 source whose answers link back to
zodiacs.org (the sky calendar, the daily horoscope email and an invitation to
compare charts) and whose compatibility and date share links carry the reading
confidence; the share links for the big three, the Chinese zodiac's animal and a
month's or year's horoscope, and the readings panel with the lunar nodes and
Chiron, sit behind the same switch. Its local tools are unchanged, Zodiacs stays
0.6.2, and 0.3.24 keeps its bytes. Zodiacs 0.6.3 changes only the listing's
category, from Education & Research to Entertainment, which the owner chose
after OpenAI's portal could not confirm the earlier one. The server reports
0.6.3 and its tools are unchanged; Developer 0.3.26 is rebuilt from that source
with unchanged local tools. 0.6.2 and 0.3.25 keep their bytes. Developer 0.3.27 is rebuilt after the server stopped listing
its pointer to get_sky among a date's reasons; 0.6.3 and 0.3.26 keep their bytes.
Zodiacs 0.6.4 makes one privacy sentence exact: links never carry a birth year,
a birth time, a birthplace or the names you give, and a birthday link carries
only the month and day. The earlier wording read as if no link carried any time
or place, but a card link for a wedding or another day carries that day's time,
time zone and coordinates rounded to two decimals, as the privacy page already
says. The About, the earlier release notes, the README, the skill, the server
instructions and get_capabilities carry the new sentence; the server reports
0.6.4 and its 19 tool definitions are unchanged. Developer 0.3.27, not yet
released, is rebuilt from that source with unchanged local tools. 0.6.3 and
0.3.26 keep their bytes. Developer 0.3.28 is 0.3.27's source with its local
chart tools on MCP adapter 0.1.0-rc.26 and engine 1.1.0-rc.2; 0.3.27 keeps its
bytes.

Current candidates are **Zodiacs 0.6.4** and **Zodiacs Developer 0.3.28**;
`manifest.json` identifies their archive and member hashes. Earlier ZIPs are
historical artifacts. The consumer ZIP includes portable, Codex and Claude
manifest files; its shared `.mcp.json` declares HTTP transport. The production
MCP URL remains unchanged. Zodiacs 0.5.0 adds seven tools that share the
occasions panel; the developer ZIP's local server keeps its eight tools and
reports the 0.5.0 source. See [the 0.4.0 audit](../../docs/platform/zodiacs-ai/AUDIT-0.4.0.md)
for the last audited acceptance evidence and outstanding release gates.

The October 8 integration retains main's developer 0.3.3 ZIP at its existing path. The earlier PR-carried 0.3.3 bytes are also retained at `history/zodiacs-developer-0.3.3-before-20261008-main.zip`; those two inherited variants have different digests. New combined developer sources used 0.3.6, preserving both inherited byte sequences. Developer 0.3.7 bundles engine 1.0.0, published on npm, and its recipes install 1.0.0 from npm; 0.3.6 and earlier ZIPs keep their bytes. Developer 0.3.14 bundles engine 1.1.0-rc.1, a vendored candidate not on npm, and its recipes still install 1.0.0 from npm; 0.3.13 and earlier ZIPs keep their bytes.
