# Assistant showcase

The English `/apps/` page is a consumer introduction to the existing hosted
Zodiacs integration. It is linked from `/tools/` and `/developers/ai/` and
included in the sitemap, search discovery and generated Guide page inventory.

The initial copy accurately labels the ChatGPT and Claude directory listings
as in review. It offers no private installation URL, claimed approval or Muse
support. After a directory approval, verify the public listing URL and update
the corresponding status and connection instructions together. The developer
plugin's installation documentation stays at `/developers/ai/`.

## Images and movie

`public/assets/ai/showcase/20261028/` is a new immutable asset family. The
comparison and wedding WebP files are compressed derivatives of the exact
reviewed 0.5.1 PNGs. Chart Studio and horoscope are captures of their current
live-resource HTML, checked byte for byte against the local generated panels,
using the labelled example chart and a synthetic Leo request. The horoscope is
a dated example, not a claim that its pictured reading is always today's.

The opening shows the complete comparison and wedding cards side by side,
with their natural proportions. The example gallery links each complete image
and supplies real text and copyable prompts beside its closer previews.
Keyboard-accessible category links jump to each example, and copying a prompt
provides visible feedback inside a control whose dimensions stay fixed. Link
and button names include their visible text for voice and screen-reader use.
No screenshot is presented as an interactive control. The existing 41-second 1080 by 1600 movie stays
unchanged, with controls, no autoplay, no initial video download and a written
description. The audio track is silent. The poster is a frame from that movie.
All image dimensions are reserved before loading. Astro generates responsive
AVIF display variants from the existing WebP captures during the build. The
original full-size captures and their public links remain unchanged.

`src/data/apps-showcase-images.json` is produced by the capture utility. To
make a new unpublished family after an intentional panel change, first run
the direct MCP preflight, then capture into a new local folder:

```sh
node tests/muse-connector-preflight.mjs --out /tmp/zodiacs-preflight
node tests/manual/capture-apps-showcase.mjs --out /tmp/zodiacs-new-showcase --preflight /tmp/zodiacs-preflight
```

The utility refuses an existing output folder. Copy its new files and manifest
into fresh versioned paths only after reviewing them. Never replace the
published 0.5.0/0.5.1 review assets, video, icons or plugin ZIPs.

## Checks

On Node 22, run the source check, complete build, distribution and bundle
checks, and unit suite as required by `DESIGN.md`. The new page adds exactly
one sitemap entry and one evergreen Guide inventory route, so their explicit
counts move by one. The generated Guide context must be regenerated through
its documented builder. The two public review-status sentences have a
supported, evidence-backed entry in the claims ledger.

With a local development or built static server running:

```sh
BASE_URL=http://127.0.0.1:56640 APPS_QA_OUT=/tmp/zodiacs-apps-qa node tests/apps-showcase-drive.mjs
```

The browser drive checks mobile and desktop widths, zero CLS, image decoding,
no horizontal overflow, all prompt-copy buttons, the endpoint-copy button,
owned links, video dimensions/duration, delayed video loading and no browser
errors. It keeps the zero-CLS assertion unchanged. Fixed heading lines and
reserved CTA geometry prevent font swaps from changing the first screen.
The drive also checks the complete hero image ratios, keyboard category links
and copy-feedback geometry. Screenshots include separate hero, gallery and
demo views. The full-page proof paints the shared footer using a capture-only
content-visibility override, after all layout checks. This replaces its
off-screen placeholder with the real footer; source CSS and measured gates
are unchanged.

The separate [Muse candidate](muse/README.md) records protocol preflight and
host cases to run once the owner has access. It is not a Muse submission or a
claim that the cards render there.
