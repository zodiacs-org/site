# Compute and connector state

This review covers the engine inputs the compute handler bundles from
`@zodiacs/engine` 2.1.0 and `astronomy-engine`. It compares them with the
1.1.0 review in `docs/platform/evidence/site-engine-1-1-0/PRIVATE-STATE.md`.

The compute bundle keeps the same mutable module state as with 1.1.0. Every
module-level `var` and `let` in the generated bundle was listed for 1.1.0 and
for 2.1.0. The 2.1.0 bundle adds these names, and each is a constant or a
pure function:

- `CALENDAR_UNKNOWN_DATES`, `CALENDAR_UNKNOWN_INSTANTS`, `HOST_ANSWERS_FROM`,
  `TIME_FLAGS_TIME_BASIS` and `NEAR_MISS_KEYS` are fixed tables.
- `CONTINUOUS_UTC_FEATURE`, `CONTINUOUS_UTC_RELEASE`,
  `CONTINUOUS_UTC_TIME_SCALE`, `CONVENTIONS_CONTINUOUS_UTC`,
  `CONVENTIONS_DE440_CONTINUOUS_UTC` and `TT_MINUS_TAI_MS` are fixed values.
- `INITIAL_DEFAULT_EPHEMERIS` is the fixed string `de440`.
- `insidePolarCircle` and `meanObliquity2` are pure functions.

`SampleBudgetReached` is no longer bundled. The cleanup markers checked by
`scripts/build-compute-handler.mjs` each still occur once: the frame memo
(`var last;`), the astronomy engine Pluto segments and the lunar evaluation
counter. The DE440 reducer declarations still pass `scripts/lib/de440-lifetime.mjs`,
which adds the reset of the record indices and the intermediate arrays.

Engine 2.x adds three pieces of module state in its `geo` entry: a per-host
map of the host's answers at fixed probe instants, the probe table decoded
once from a fixed string, and a host that only tests replace. The compute
bundle does not include that entry, so none of these is in it.

The local-time bundle (`api/_compute/local-time.mjs`) does include the `geo`
entry. `scripts/build-compute-local-time.mjs` wraps it so that each hosted
request creates its own module, and the per-host map of probe answers is
created inside that module. It holds zone names and the offsets at fixed probe
instants, never a requested instant, and it is dropped with the request's
module. A `WeakMap` has no `clear()`, so the wrapper's `dispose()` still
empties only the histories, the pending loads and the offset formatters, as
before.

The package source is pinned in the lockfile and verified by the npm receipt
in this directory. The compute generator checks the complete bundled engine
input digest and checks the reducer declarations before adding the cleanup.
