# Astrofolio navigation placement

Owner direction: “Astrofolio should be on its own on the right,” with profile and search to the left of the separating line.

The order is now **profile · search | Astrofolio**. Mobile separates the Zodiacs mark beside the menu from Astrofolio at the far right. Desktop retains its existing pill dimensions and links. The keyboard sequence follows the new order, and the existing photo/initial/person profile control is unchanged. Shared-chart and other tool pages still omit Astrofolio and no longer reserve an empty trailing track.

The same mobile placement is generated for the Registry, Astrofolio, SDK and other static wing pages. No display strings, consent/disclosure text, account behavior or chart calculations changed.

![Mobile navigation](navigation-mobile.png)
![Desktop navigation](navigation-desktop.png)

## Validation

- Build: passed, including link integrity and bundle budgets.
- Astro/type, footer and consumer-boundary checks: 0 errors, 0 warnings, 39 existing hints.
- Full unit suite: 521 files passed, one skipped; 6,766 tests passed, six skipped.
- Phase 1 visual acceptance: 18/18 exact-width captures refreshed.
- Profile navigation: 12 cases passed (six languages, phone/desktop), including photo display, keyboard order, rejected photo inputs and profile access boundaries.
- Responsive navigation: all 124 cases passed in Chromium and WebKit, covering six languages, phone/tablet/desktop breakpoints, collection and tool pages, shared-chart receivers, menu behavior, keyboard order, hit targets and overflow. Every shown control stays left of Astrofolio’s divider.
