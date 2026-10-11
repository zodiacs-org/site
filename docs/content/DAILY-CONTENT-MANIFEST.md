# Daily content manifest

Fetch `https://zodiacs.org/content/today.json` for the site's current English
daily edition. The same build emits an identical copy at
`https://zodiacs.org/content/YYYY-MM-DD.json`, using the payload's `date`.
These are static JSON endpoints for consumers such as Hermes, which can render
their own images and videos. They do not render media or post anywhere.

## Schema: `zodiacs.daily-content.v1`

| Field | Meaning |
| --- | --- |
| `schema` | Versioned contract identifier, `zodiacs.daily-content.v1`. |
| `date` | The verified site's UTC edition date, `YYYY-MM-DD`, not the build day. |
| `generatedAt` | ISO 8601 UTC timestamp when the build creates the manifest. Both endpoints share it. |
| `source.publicationCanonicalSha256` | The canonical publication digest from `src/data/daily-publication-manifest.json`. |
| `source.url` | `https://zodiacs.org/horoscopes/`. |
| `signs` | Exactly twelve entries, in zodiac order from Aries through Pisces. |
| `signs[].sign`, `name`, `symbol` | Lowercase slug, English sign name, and zodiac glyph from the site's sign table. |
| `signs[].dailyLine` | The full first passage of the published daily sign reading, verbatim. |
| `signs[].captions.instagram` | Sign name, the full daily line, and sign page URL. |
| `signs[].captions.x` | Sign name, daily line, and sign page URL; at most 280 weighted characters with the URL counted as 23. |
| `signs[].signPageUrl` | Absolute daily horoscope URL, `https://zodiacs.org/horoscopes/{sign}/`. |
| `signs[].iconUrl` | Official pastel circle icon, `https://zodiacs.org/assets/zodiac-icons/400/{sign}.webp`. |

The canonical copy is `src/data/horoscope-program.json`, reached through the
same `pageReadingFromProgram(..., 'today')` helper as the sign pages. The first
section is also the source of the horoscope hub's shortened teaser. This
manifest preserves that section in full. It does not use the separate
`daily-publication.json` headline, rewrite the reading, or generate new copy.
The publication hash identifies the companion verified publication package;
it is not a hash of this manifest or of the horoscope program. The full package
and program can be inspected at `/data/daily-publication.json`.

Captions contain only the sign name, its published text, and the sign page URL.
If X needs shorter text, the excerpt ends at a sentence boundary, or a word
boundary when no complete sentence fits, followed by `…`. Names retain normal
capitalization. Em-dashes cause generation to fail rather than altering the
verbatim daily line. No slogans, hashtags, acquisition copy, or extra calls to
action are added.

## Updates and polling

The existing Daily Sky workflow (`.github/workflows/daily-horoscopes.yml`)
targets 00:00 UTC, with a 04:23 UTC backstop. It verifies the publication and
horoscope program, publishes them to the default branch (normally through a
merged publication PR), and Vercel redeploys the site. The manifest changes
when that deployment completes, not automatically at midnight. A rebuild of
the same edition may change `generatedAt` without changing `date` or content.

A consumer should fetch `today.json` after 07:30 UTC and check both `schema`
and `date` against the desired UTC edition. Deduplicate work by edition date
and sign. If fetching the stable URL fails or its edition is unexpected, try
`/content/{desired-date}.json`; accept it only if its `date` matches. On a
missing dated file or delayed edition, retry after at least five minutes and
keep any older content labeled with its actual date. Never relabel yesterday's
reading as today's.

Both JSON URLs allow cross-origin reads (`Access-Control-Allow-Origin: *`)
and cache for five minutes (`max-age=300, s-maxage=300`). Only the edition in
the current deployment has a dated file. Earlier dated files are not retained
as an archive across deployments; consumers needing history should store
accepted payloads themselves. Polling after 07:30 UTC is a practical default,
not a guarantee that GitHub scheduling or a deploy has finished.

Generation lives in `src/lib/daily-content-manifest.ts` and the prerendered
Astro endpoints under `src/pages/content/`. Do not edit generated `dist/content/`
files. The endpoints use the normal static build and existing feature flags;
no workflow or publishing integration is added.
