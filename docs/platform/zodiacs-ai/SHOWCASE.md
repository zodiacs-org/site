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

The page shows a preview of each card and links its complete version. A
preview is a crop of the same capture: the artwork, sign discs, names and
score (Chart Studio: the whole wheel), padded with the card's own background
to a 4:5 shape (the hero: 1:1) and faded where the card continues. The
picture frames take the preview's shape, so nothing inside a preview is cut
off at any width. Real text and copyable prompts sit beside each preview. No
screenshot is presented as an interactive control. All image dimensions are
reserved before loading.

The tour, `tour.mp4` in the same family, is a 20-second, 1080 by 1350, silent
movie of the same live cards and synthetic examples. Each scene types the
question, brings in the real card, then scrolls, opens details or switches
tabs inside it; the question, a footer that says the cards are real with
example details, and the closing words are drawn over the card's own page. It
does not imitate ChatGPT or Claude. The page plays it with controls, no
autoplay, no initial video download and a written description. Its poster is
the first card fully in. The 41-second 0.5.1 recording stays published at
`/assets/ai/review/zodiacs-sky-0.5.1.mp4` but is no longer on the page.

`src/data/apps-showcase-images.json` is produced by the capture utility and
`src/data/apps-showcase-tour.json` by the tour recorder. To make a new
unpublished family after an intentional panel change, run both into new local
folders. Each asks https://zodiacs.org/mcp for the live panels and the
synthetic examples itself, and stops unless each local generated panel equals
its live resource:

```sh
node tests/manual/capture-apps-showcase.mjs --out /tmp/zodiacs-new-showcase
node tests/manual/record-apps-tour.mjs --out /tmp/zodiacs-new-tour
```

Neither reads the Muse preflight, which still targets the 0.5.1 server.

Both refuse an existing output folder. Copy their new files and manifests
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
