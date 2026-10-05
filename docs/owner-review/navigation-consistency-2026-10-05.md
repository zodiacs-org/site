# Responsive navigation consistency

The owner requested consistent navigation outside desktop on October 5, 2026: “yes do it. I want consistency. Except desktop - that remains as is”.

Compact layouts use the existing edge-to-edge phone bar through 919px in English and Registry pages, and through 1039px for localized astrology pages. The existing full desktop rows retain their 920px/1040px thresholds and styling. Shared-chart receivers now use that same bar while retaining their always-visible header during automatic chart scrolling. Tool pages continue to omit Astrofolio; no copy, birth calculation or privacy behavior changes.

The Registry application, its generated sign pages, Astrofolio, Terminal, thesis and SDK navigation were updated through their shared source and synchronizer. The exact protected-path allowance records the owner's instruction; it expires with this change and cannot permit additional paths.

Local build and type checks pass (zero errors or warnings, 40 existing hints). The 46 source/generator navigation assertions pass. Real Chromium and WebKit checks cover all six languages, breakpoint edges, controls, menu focus, scroll-away behavior and shared-chart boundaries. Browser checks and final evidence refresh are in progress; no release readiness is claimed until they pass.

Release remains a preview for owner review, under the standing preview-before-live instruction.
