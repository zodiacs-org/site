# Chart Studio 0.2.0 — implementation review

Chart Studio adds an interactive MCP Apps panel to the existing Zodiacs server.
`open_chart_studio` takes exactly `{}` and returns a fixed launcher result. The
panel starts with a labeled synthetic chart. It uses the existing wheel,
selection/emphasis model, engine adapter, and versioned natal-record codec.
The shared website wheel source is unchanged.

## Included

- UTC date/time and optional coordinate inputs; Placidus and whole-sign houses.
- Explicit unknown-time noon reference, with no houses/angles or location use.
- Pointer selection and a native keyboard-accessible element menu for bodies,
  signs, houses, angles and aspects; connected aspects show orb and motion.
- House-system comparison for the same instant/location. Requested and actual
  systems, including polar fallback, remain in each record.
- Receipt inspection and a JSON download control. Exported records contain birth
  inputs and are labeled accordingly.
- A second, explicit review-and-share action. The preview's selected facts are
  sent through `ui/update-model-context`; hosts offering only `ui/message`
  receive an explicit question with those facts. Raw date/time/coordinates and
  the full record are excluded from that projection. Derived positions remain
  personal information. Earlier shared context is not erased on chart reset.
- Embedded engine, fonts and twelve sign images: 397,635 bytes of HTML, with
  third-party notices. No external asset or calculation request is needed.

The panel does not persist charts. It does not add an account, geocoding,
local-time conversion, chart import, reminders, a new interpretation model,
or the later Event Watch/Record Vault/Verification Lab roadmap products.

## Checks

On 2026-10-05, Node 22.23.2:

- Production build: 4,416 pages; postbuild, distribution, schema and bundle
  budgets pass. No website wheel or Phase 1 screenshot baseline changes.
- Full repository suite: 6,762 passed, five skipped, 522 passing test files.
- Typecheck: zero errors and warnings (40 existing informational hints).
- AI tests: 54 tests pass; official HTTP client launches the panel, refuses
  personal arguments and retrieves its resource; official stdio client checks
  all nine tools and the packaged resource. The installed 0.2.0 developer copy
  also passes this driver after dependency installation.
- Existing synthetic adapter evaluations: 40/40 pass.
- Reproducible bundle, manifest and package-member checks pass. Both local
  marketplace candidates are installed/enabled at 0.2.0. Sky now includes
  generated compatibility manifests so the local client retains its version,
  branding, skills and MCP configuration during upgrades.
- In-app browser: 1280px desktop and 360px mobile layout; mobile document width
  345px within a 360px viewport; 12/12 sign images embedded; unknown-time controls
  and house/angle absence; house comparison; pointer Sun selection; keyboard
  Venus selection; receipt view; no observed console errors.
- Sandboxed synthetic MCP host: zero selections received on open/preview,
  one received after explicit sharing; context attachment, message fallback,
  and host refusal surfaced correctly. Unit tests also cover origin/source
  checks, timeout, unsupported capability and disposal.

The download control was exercised, but the in-app browser did not return a
completed-download event. Record serialization and codec replay pass; actual
saved-file download remains a host acceptance check. No download success is
claimed from that browser run.

Captures and the machine-readable receipt are in `evidence/chart-studio/`.

## Try it

From the repository, run `npm run ai:serve` and open
`http://127.0.0.1:8787/studio`. The current review session uses port 8791.
`/studio-test-host` is a loopback-only synthetic host fixture. It never connects
to an assistant. A standalone HTML copy is included in the owner's output kit.
Standalone mode can calculate and inspect records but cannot share context.

In a supporting MCP Apps host, invoke `open_chart_studio` with `{}`. The tool
advertises global/thread entrypoints and prefers fullscreen. Public tools now
number six; the developer server adds three local chart tools for nine total.
Only the fixed Studio resource receives the larger 2.1 MB response budget;
ordinary responses keep the 256 KiB bound and incoming requests keep 16 KiB.
The builder caps JSON-encoded HTML at 2 MB.

## Release state

This is implemented and locally reviewed, not accepted in live ChatGPT yet.
The current protected ChatGPT staging connection still serves the earlier
calendar build. Its dated acceptance does not cover Chart Studio. Refresh the
protected preview and host connection, verify CSP/fonts, both entrypoints,
reviewed sharing, refusal recovery and saved-file downloads, then record fresh
host evidence before release. The production switch remains off. Existing
publisher, consenting-beta and final owner approval gates still apply.
