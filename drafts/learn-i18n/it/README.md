# Learn translation drafts: Italian (it)

These are reviewed Italian translation drafts of the English Learn articles in `src/content/learn`. There are 147 articles here (147 revised in the editorial review; no native speaker has read them yet), plus `REVIEW.csv`, the review record for each article.

Nothing in this folder is used by the site. It is not loaded by Astro, routed, listed in the sitemap or listed in `src/data/learn-translations.json`.

## Publishing a batch later

1. Move the chosen files into `src/content/learn-i18n/it/`, keeping their paths. es, pt, fr and it are the locales in the content schema today.
2. List them in `src/data/learn-translations.json`.
3. Have a native speaker read them before they go live.

## REVIEW.csv flags

- `placements/pluto-in-aries`: links-changed

`links-changed` means the reviewer changed a link compared with the first draft (in these rows, to add the locale prefix or to stop translating a path segment). Check those links before publishing.
