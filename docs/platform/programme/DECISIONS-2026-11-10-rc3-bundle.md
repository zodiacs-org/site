# Technical decision: measured 1.1.0-rc.3 engine allowance, 10 November 2026

[DECISIONS-2026-10-01-rc16-bundle.md](DECISIONS-2026-10-01-rc16-bundle.md)
applies the standing rule for the engine chunk's budget: it allows only the
measured engine growth, with its reason recorded, keeps the prior headroom
and allows no route-budget increase. This applies the same rule to engine
1.1.0-rc.3 (P4.1); it is not a new owner approval or a gate waiver.

With production's flags (the stand-ins of `.github/workflows/sitemap-dates.yml`)
under one pinned clock, the engine chunk's eight-chunk static closure is
33,361 gzip bytes on main at `633f01e5` (1.1.0-rc.2) and 33,397 on this
branch at `a7df1015` (1.1.0-rc.3): **36 bytes** more, against an allowance of
33,380.4 bytes. Every chunk but one has the same gzip size on both; the root's
ephemeris chunk grows from 22,989 to 23,025 bytes. That chunk carries
`withEphemeris` and the source's path in the position functions, which
1.1.0-rc.3 adds to the root (its CHANGELOG: 2,206 bytes of the root's
JavaScript, which every entry that loads the ephemeris chunk carries). The
site's own chunks (`full.*.js`, `chart-adapter.*.js`) are byte-identical in
size, and nothing the site controls can leave the hook out: it is in the
functions the chart calls. The measurements are in
[../evidence/site-engine-1-1-0-rc3/bundle-audit/engine-closure.json](../evidence/site-engine-1-1-0-rc3/bundle-audit/engine-closure.json).

Only `budgets.json`'s engine-chunk value changes: 32.598046875 to
32.633203125 KiB, exactly **+36 bytes**, from 33,380.4 to 33,416.4 bytes,
which keeps the 19.4 bytes of headroom 1.1.0-rc.2 left. Every route and
chunk-max allowance stays unchanged, and the build's other gates passed
before the change (`/birth-chart/` 69.2 of 71 KB; engine isolation and the
homepage markers clear). No page loads the engine chunk before a chart is
asked for.

No immutable archive, production flag, numerical gate or programme
denominator changes with this decision.
