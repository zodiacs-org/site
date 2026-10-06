# Desktop profile photo consistency — October 6, 2026

The desktop profile link now uses the same person icon as the compact bar. A saved local photo replaces it in both bars and the menu; a named profile without a photo uses its initial. The 44px click target stays fixed.

The English profile photo editor is available without marking a birth chart as yours. Personal placements and readings still require an explicit self chart; editing identity never chooses one. Photo processing, browser-local storage, manual backup and optional chart-sync boundaries are unchanged. Photos do not automatically transfer between devices. Existing translated navigation labels are reused in all six languages; no new display or legal copy.

## Evidence

Screenshots use synthetic data and a solid green test image, not a real visitor's photo.

- [Desktop photo before selecting a personal chart](desktop-profile-2026-10-06/desktop-photo-without-self-chart.png)
- [Desktop with a named personal chart](desktop-profile-2026-10-06/profile-desktop.png)
- [Photo editor on mobile](desktop-profile-2026-10-06/photo-editor-mobile.png)

Browser verification: 16 Chromium/WebKit photo flows across 320, 390, 768 and 1440px, including no-name/unassigned and empty profiles; chooser, preview, save/reload, cancel, invalid input, removal, focus restoration and matching navigation image. Twelve additional navigation cases cover all six languages on desktop/mobile, rejected remote/SVG/oversized images, account access revocation, other-tab removal and overflow. These checks now run in CI.

Production build, dist integrity, bundle limits and Astro check passed. Phase 1 captures were refreshed: 18/18. Full unit-suite results are recorded in the pull request.

During verification, the existing compute-example test exposed a contradictory exact-byte assertion after its allowed 1e-8 nodal-speed rounding tolerance. Both comparisons now apply that same bounded normalization. Calculation code, published examples, tolerance and every other response field are unchanged.
