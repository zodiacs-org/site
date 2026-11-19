# Compute and connector state

The bundled DE440 reducer caches the most recently decoded coefficient record
for each body. These record indices and coefficients depend on the requested
instant. The reducer and its pack reader also reuse arrays containing
intermediate vectors. The bundle's existing cleanup runs after the handler or
tool finishes. It now resets the record indices and zeros those arrays. An
invocation can resume after asynchronous work, but each calculation in the
reducer runs synchronously.

The verified pack bytes, its digest and its body layout remain loaded.
The nutation coefficient rows are derived from fixed tables. The engine's
source override and fallback tracking restore their previous values in
`finally` blocks. The previous cleanup still clears the frame memo, the
astronomy engine Pluto segments and the lunar evaluation counter.

The package source is pinned in the lockfile and verified by the npm receipt
in this directory. The compute generator checks the complete bundled engine
input digest and checks the reducer declarations before adding the cleanup.
