# Bounded independent rc16 decision review — 2026-10-01

Reviewed actual source and recorded decisions at local site-rc16 head18fdf260, before subsequent owner-main integration. This is not whole-PR approval or release/accuracy acceptance.

- Station alignment: build-sky longitude primitive alone changes from the older direct astronomy frame/model clock to @zodiacs/engine/internal bodyLongitude. The ±0.25-day derivative, scans/refinement and <2second internal consistency gate are preserved. Existing shared lunation helper was already package-native. Product catalogue is not an independent arbiter; minutes-scale Swiss residual failures remain failures.
- Composite: git diff against owner mained55 confirms src/lib/composite.ts restored exactly. Deferral preserves existing ephemeris-free view and fixed denominator. Future pure entry is a real packaging dependency, not an accepted technique.
- Bundle: final actual closure33,130 versus32,108B is +1,022B. New allowance33,380.4B retains prior250.4B headroom under incorporated step10; route budgets unchanged. Earlier1,046B evidence remains labeled pre-deferral.
- Protected numerical golden: sole scripts/registry-outlook.test.mjs expectation shifts Mercury Leo ingress .308→.438 by130ms. Exact-archive witness uses unchanged generator and attributes the shift to new nutation to8.01e-14degrees. It is millisecond-rounded generator output, not an exact root/error-tolerance claim.

No blocker found within this bounded decision/source review. Final integrated source, both flag builds, full suite, independent private-state tests, all evidence bindings, protected scope guard and release gates still required.
