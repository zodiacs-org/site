# Compute and connector state

This review covers the engine inputs the compute handler and the hosted AI
runtime bundle from `@zodiacs/engine` 3.0.0 and `astronomy-engine`. It compares
them with the 2.1.0 review in
`docs/platform/evidence/site-engine-2-1-0/PRIVATE-STATE.md`.

Every module-level `var`, `let` and `const` in the generated bundles was listed
for 2.1.0 (`api/_compute/compute.mjs` and `api/_ai/runtime.mjs` at main
`dea525715`) and for 3.0.0 (the same files on this branch), with the TypeScript
parser. Both bundles add the same three names and drop the same three:

- `registeredDe440Loader` holds the function that opens the shipped pack. Each
  bundle's first module, `src/lib/engine/server-de440.mjs`, registers it once
  with `useDe440()` when the bundle loads, and nothing replaces it after that.
  It holds no value from a request.
- `installed` is the position source `withEphemeris` puts in place for one
  synchronous call and restores in `finally`, as 2.1.0's `source` was. No site
  code calls `withEphemeris`.
- `NOT_LOADED` is a fixed message.
- `INITIAL_DEFAULT_EPHEMERIS` is gone: `defaultName` starts as
  `astronomy-engine` and `useDe440()` sets it to `de440` when the bundle loads.
  The hosted runtime changes it only around one synchronous page calculation,
  in `src/ai-tools/personal/page-ephemeris.ts`, and restores it in `finally`,
  as with 2.1.0.
- `shippedError` is now a function, and `source` is now `installed`.

The AI runtime also renames one pure function, `signOf3` to `signOf2`. Two
names keep their meaning with a new shape: `shipped` holds the opened pack
with the loader that opened it, and `opened` and `refused` in the pack module
hold the opened pack or the error from opening it. Each is the shipped pack
or an error about it, never a request's value.

The pack's reader adds two methods, `moonState` and `earthAndSunState`, for
True Black Moon Lilith and the minor bodies. They write only the reducer's
existing working vectors (`emb`, `moon`, `earth` and `a`), which the cleanup
already empties; no site code calls them. The cleanup markers checked by
`scripts/build-compute-handler.mjs` and `scripts/ai-runtime-lifetime.mjs`
each still occur once: the frame memo (`var last;`), the astronomy engine
Pluto segments and the lunar evaluation counter. The DE440 reducer
declarations still pass `scripts/lib/de440-lifetime.mjs`, which adds the reset
of the record indices and the intermediate arrays. No marker or cleanup step
changes.

The local-time bundle (`api/_compute/local-time.mjs`) carries the `geo` entry,
whose code is 2.1.0's byte for byte under a new chunk name. Its per-request
module and `dispose()` are unchanged.

The package source is pinned in the lockfile and by
`vendor/zodiacs-engine-3.0.0.sha256`. The compute generator checks the complete
bundled engine input digest against `PRIVACY_REVIEWED_ENGINE_INPUTS_SHA256`,
which names this review, and checks the reducer declarations before adding the
cleanup.
