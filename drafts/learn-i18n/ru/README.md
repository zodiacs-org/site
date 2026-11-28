# Learn translation drafts: Russian (ru)

These are reviewed Russian translation drafts of the English Learn articles in `src/content/learn`. There are 159 articles here (159 revised in the editorial review; no native speaker has read them yet), plus `REVIEW.csv`, the review record for each article.

Nothing in this folder is used by the site. It is not loaded by Astro, routed, listed in the sitemap or listed in `src/data/learn-translations.json`.

## Publishing a batch later

1. Move the chosen files into `src/content/learn-i18n/ru/`, keeping their paths. Only es, pt, fr and it are in the content schema today, so Russian would first need a schema change and new routes.
2. List them in `src/data/learn-translations.json`.
3. Have a native speaker read them before they go live.

## REVIEW.csv flags

- `placements/mars-in-aries`: links-changed
- `placements/uranus-in-aquarius`: dash

`links-changed` means the reviewer changed a link compared with the first draft (in these rows, to add the locale prefix or to stop translating a path segment). Check those links before publishing.

`dash` means the article had a long dash. The one left in `placements/uranus-in-aquarius.mdx` was replaced before these files were committed: "поколения 1996 [en dash] 2003 годов" now reads "поколения, рождённого с 1996 по 2003 год". In `REVIEW.csv`, the reviewer's quotes of the original drafts showed long dashes; each is written as `[en dash]` or `[em dash]` so the record stays accurate without the character itself.
