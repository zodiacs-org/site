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

`public/assets/ai/showcase/20261109/` is the immutable asset family the page
uses. All four images are captures of their current live-resource HTML,
checked byte for byte against the local generated panels: the labelled example
chart, a synthetic Leo request, and the comparison and wedding examples with
the made-up first names Lucía and Mateo, so the cards show names the way
people ask for them instead of Person A and Person B. The horoscope is a dated
example, not a claim that its pictured reading is always today's. The earlier
`20261028/` family, whose comparison and wedding images came from the reviewed
0.5.1 PNGs, stays published and unchanged.

The page links each image's complete version and supplies real text and
copyable prompts beside the cropped previews. No screenshot is presented as
an interactive control. The existing 41-second 1080 by 1600 movie stays
unchanged and still shows the 0.5.1 cards, with controls, no autoplay, no
initial video download and a written description. The audio track is silent.
The poster is the movie's wedding card at 30 seconds, so the video's cover
does not show the older Person A and Person B labels. All image dimensions
are reserved before loading.

`src/data/apps-showcase-images.json` is produced by the capture utility. To
make a new unpublished family after an intentional panel change, capture into
a new local folder. The utility asks https://zodiacs.org/mcp for the live
panels and the synthetic examples itself, and stops unless each local
generated panel equals its live resource:

```sh
node tests/manual/capture-apps-showcase.mjs --out /tmp/zodiacs-new-showcase
```

It no longer reads the Muse preflight, which still targets the 0.5.1 server.

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

The separate [Muse candidate](muse/README.md) records protocol preflight and
host cases to run once the owner has access. It is not a Muse submission or a
claim that the cards render there.
