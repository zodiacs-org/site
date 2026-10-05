# Responsive navigation consistency

The owner requested consistent navigation outside desktop on October 5, 2026: “yes do it. I want consistency. Except desktop - that remains as is”.

Compact layouts use the existing edge-to-edge phone bar through 919px in English and Registry pages, and through 1039px for localized astrology pages. The existing full desktop rows retain their 920px/1040px thresholds and styling. Shared-chart receivers now use that same bar while retaining their always-visible header during automatic chart scrolling. Tool pages continue to omit Astrofolio; no copy, birth calculation or privacy behavior changes.

The Registry application, its generated sign pages, Astrofolio, Terminal, thesis and SDK navigation were updated through their shared source and synchronizer. The exact protected-path allowance records the owner's instruction; it expires with this change and cannot permit additional paths. Real WebKit testing also exposed a menu keyboard-focus defect in the Registry application: opening now focuses the first menu item, Tab stays inside, and Escape returns focus to the menu button.

Validation completed:

- Node 22 production build and type checks passed: zero errors or warnings, 40 existing hints.
- All 120 real Chromium and WebKit responsive cases passed, covering six languages, breakpoint edges, touch targets, no horizontal overflow, menu focus, scroll-away behavior and shared-chart boundaries.
- Full unit suite passed: 6,707 tests passed, five intentional skips; 516 test files passed and one skipped. The 46 focused navigation source/generator assertions also passed.
- Desktop navigation screenshot comparisons against production had zero changed pixels for English Learn (920/1440), Spanish Learn (1040/1440), Astrofolio (920/1440), SDK (920/1440) and Virgo Registry (1440). The SDK 920 capture initially differed while a font weight was still loading; waiting for the actual computed navigation fonts eliminated all differences. Russian desktop layout is covered by the responsive suite, not this pixel comparison.
- Phase 1 scope guard passed with exactly 19 protected paths in its one-time allowance. Generated drift and consumer boundary checks passed in the prebuilt preview build.
- The Phase 1 screenshot receipt was downloaded from successful CI run [37298370026](https://github.com/zodiacs-org/site/actions/runs/37298370026), captured at navigation CSS commit `5b5f68579534bd14e360ef54dfb078126b74e73f`. Artifact lengths and SHA-256 checksums were verified. Its represented template hash is `a6c30a02e981c850b5b285381136ea2d0d6fe2f3ced23848ab873cb613db8701`, which still matches current sources. The subsequent Registry application focus fix is outside that template boundary and is verified by the responsive driver. Visual baselines were retained.

[Hosted preview](https://zodiacs-sv7w35di2-zodiacsofficial.vercel.app/) is READY, deployment `dpl_4Lxkb71cJZRAGTrHJVPJih6M4rjG`, target preview. It includes the navigation and Safari menu-focus changes through commit `8684b2e5f7eda19cc7b930c438fc337281409bb0`. The follow-up screenshot receipt and this report do not change the deployed site. The 612px hosted homepage was inspected and captured in the Codex browser; the temporary viewport override was then reset.

Remote checks on the final pull request head must finish before release readiness can be claimed. Release remains a preview for owner review, under the standing preview-before-live instruction. Nothing was merged or deployed to production.
