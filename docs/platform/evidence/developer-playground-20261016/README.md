# The compute API playground (P3.8), 2026-10-16

P3.8 asks for a playground at `/developers/playground/` with "live requests
against the hosted API beside the in-browser engine, a receipt viewer, code
in five languages, and shareable links that carry birth data only if the user
chooses". Its gate: "agents and people can reproduce any documented example
from it".

## What it does

- **The requests.** It offers the compute API's 14 documented requests, the
  request examples of the OpenAPI document, and the three documented refusals
  that a JSON body alone provokes (`invalid-request`, `invalid-json`,
  `budget-exhausted`). Each comes with the answer the API's handler gives
  (`src/lib/compute-api/examples.json`), served with it at
  `/developers/playground/examples.json`. A person can also write their own.
- **Live requests.** Send posts the body to `/api/v1/<endpoint>` on
  zodiacs.org, and only Send does.
- **The browser run.** Run in this browser loads
  `/developers/playground/engine.mjs`, built by
  `scripts/build-playground-engine.mjs` from
  `src/lib/compute-api/playground.ts`: the API's own parsers and calculations,
  with `@zodiacs/engine` 1.0.0, astronomy-engine 2.1.19 and the engine's 16
  zone histories, 154,566 bytes with gzip -9. It makes no network request and
  uses no storage. It answers as the handler does once a request has arrived.
- **The comparison.** Two answers are compared as JSON, path by path. Each
  difference is named:
  - runtime: a receipt names the runtime that computed it, Node with its
    tzdb or the browser, which reports none;
  - citation: the digest of a receipt that differs;
  - rounding: numbers within 1e-8;
  - value: anything else.
  The API's answer is compared with the browser's, and each with the
  documented one while the request is still a documented one.
- **The receipt viewer.** Each answer is shown whole, and its citation is
  checked: the page computes `sha256:` and the SHA-256 of the receipt's RFC
  8785 canonical JSON with the browser's own `crypto.subtle`, and says whether
  it is `cite.receipt`.
- **Code in five languages.** cURL, JavaScript, Python, Swift and Ruby, each
  with its standard library, for the request as it stands. Each sends exactly
  the text the page shows, its layout with it, since the API measures a body
  before it reads one: cURL with `--data-raw`, since `--data` would upload
  the file a text starting with `@` names; Swift's raw string with more hashes
  than any run of them after a quote or a backslash, so `\#(` is never an
  interpolation, and its control characters escaped; Ruby's carriage returns
  as `"\r"` beside the single-quoted text, since Ruby reads one before a line
  feed as the line break alone.
- **Links.** A link names the endpoint, and the documented example while the
  request is still that example. It carries the request only when the box is
  ticked, base64url after `#request=`, which a browser never sends to a
  server.
- **For agents.** `/developers/playground.md` lists every request with a cURL
  command and its documented citation digest; `examples.json` holds each
  request with its documented answer. Both are listed in `llms.txt` and
  `llms-full.txt`.

## Evidence

### Tests

- **The browser run** (`tests/api/compute-api-playground.test.ts`). The
  browser entry and the built bundle answer every documented request and four
  refusals a body provokes exactly as the handler does, status and body:
  `invalid-request`, `invalid-json`, `budget-exhausted` and a counted
  `payload-too-large`. The bundle must be what its sources build and between
  145 and 165 KB with gzip -9. Its SHA-256 must equal node:crypto's on 16
  lengths up to 64 KB and on multi-byte text.
- **The code** (`tests/api/compute-api-playground-code.test.ts`). The code the
  page shows runs in every language the machine has, against the handler
  served locally at `/api/v1/<endpoint>`, for every offered request (Swift
  once per endpoint, as it compiles each file), and prints the handler's
  answer. On this Mac all five ran: cURL, JavaScript (Node 22), Python 3.9,
  Swift 6.2 and Ruby 2.6. Each also sends two texts that are not JSON to a
  server that keeps what it receives, and it receives exactly that text: one
  starts with `@` and holds each language's quotes, escapes and
  interpolations, Swift's delimiters, line breaks, a tab, U+0001, DEL and text
  beyond ASCII; the other holds `\#(` with no quote before it. A JSON text
  arrives with its layout, and a documented request padded past the 16,384
  bytes the API measures is refused with 413 in every language, as the
  page's own request is. With the code as it was before Codex's third
  review, cURL fails first; before its fourth, the padded request is
  answered 200, and the JSON arrives compacted. (No shell command
  line can carry a NUL, so that one character is not offered.)
- **The helpers** (`src/lib/developer-playground.test.ts`):
  - `examples.json` offers every documented request with its documented
    answer;
  - the code quotes a body that holds each language's quoting characters;
  - links carry a request only when asked, after the `#`;
  - the citation digest the page computes equals the API's for every
    documented answer, and a tampered receipt does not match;
  - the comparison names each kind of difference and gives one verdict.
- **Privacy** (`tests/api/compute-api-privacy.test.ts`):
  - the playground is the API's one caller, by the Send button alone;
  - the bundle and the helpers make no request and use no storage;
  - the page loads no analytics.

The scripts' tests and the claims ledger
(`product.compute-playground`, `priv.compute-api`) hold these statements to
their evidence.

### The drive

`node tests/developer-playground-drive.mjs` drove a build of this branch in
Chromium on 2026-10-16
([drive-local.json](drive-local.json)). The API was answered by the function's
own bundle, `api/_compute/compute.mjs`. 53 of 53 checks passed:

- **An agent's path.** For each of the 17 requests, the Markdown twin lists it
  with its cURL request (`--data-raw`), and the API's answer to that body
  reproduces the documented one.
- **A person's path.** Each request opens by its link. Send and Run in this
  browser both answer with the documented status, and both citations match
  their receipts. The API, the browser and the documentation agree: the same
  answer, or one whose receipts differ only where each names its runtime.
- **Controls.** The page calls the answers different when the API's answer
  has the Sun moved by 0.001°. It calls out a citation that is not its
  receipt's digest.
- **Behaviour.**
  - An edited request runs in the browser without a request to the API, and
    no documented answer is applied to it.
  - The link carries the request only once the box is ticked, after the `#`,
    and such a link reopens the request.
  - The code shows the request in all five languages.
  - A copy button says the code or the link was copied only while the page
    still shows what it copied. Changing the request takes "Copied" away, and
    a copy that finishes after the request, the language or the box changed is
    not shown as done. The drive gives the page a clipboard whose writes finish
    when it says. With the island as it was before Codex's second review, these
    five checks fail (44 of 49).
  - An answer is shown only beside the request that produced it. An API
    answer that arrives after its request was edited is not shown, and
    changing the request takes both answers and their comparison away. With
    the island as it was before Codex's first review asked for this, these two
    checks fail (42 of the 44 checks the drive had then).
  - A receipt computed in the browser names the browser as its runtime, with
    no tzdb release.
  - Until the examples load, the request can be neither edited nor sent, so
    the request the page opens with never replaces one someone has started;
    then it is the example the link names. If the examples do not load, a
    link that carries its request still opens it, ready to send.
  - With the build as it was before Codex's third review, 32 of the 52 checks
    the drive had then pass: those three fail, and so do the 17 agent checks,
    whose twin still wrote `--data`.
  - An example padded past the size limit is refused as sent, its code sends
    the padding too, and no documented answer applies to it. With the build
    as it was before Codex's fourth review, that check fails (52 of 53).
  - At 375 px, with both answers and their comparison on the page, nothing
    scrolls sideways. The first run caught a 639 px overflow from the example
    list, which this page's own field styles fixed.

The same drive runs against production once the page is live:
`node tests/developer-playground-drive.mjs --base-url https://zodiacs.org`.

### Phase 1 captures

The playground's island and helpers are in `src/islands` and `src/lib`, which
the Phase 1 capture digest covers, as are the files #766 changed, so CI took
the 18 captures again.

- **Committed captures.** Browser Evidence run 38966349900 took them on
  `3833312a`, this branch's last code head, with main `cb1e411f` merged in,
  with Chromium 149.0.7827.55 at 2026-10-16T21:05:05Z, for the 2026-10-16
  edition, bound to template source digest `6338aed1…`. Its build, acceptance
  captures, receipt, visual comparison, Lighthouse and explorer drive passed
  ([browser-evidence-provenance.json](browser-evidence-provenance.json) is the
  run's own record).
- **Against the same browser before.** Run 38952005658 took the captures on
  `4e4e026c`, and they were identical, pixel for pixel, to those run 38935927506
  took on `38596f49`, before #766 and the last two rounds of review. Against
  `4e4e026c`'s, 17 of these are identical. `love-360.png` differs in 24 pixels
  at the lower edge of the period tabs' labels (Daily to Monthly), a glyph
  edge two runs of the same browser drew differently; it records the same
  size and layout.
- **Against main's captures.** #766 committed captures taken with Chromium
  155.0.8059.80, where CI pins 149.0.7827.55. Against them each capture
  differs in 7.38% to 54.60% of its pixels, as the two browser versions draw
  text and images. Every capture records the same size, layout and content
  length as main's; only the drawn pixels differ.

## Production, 2026-10-17

#767 merged as `6bbda021` on 2026-10-16 at 22:36 UTC (05:36 on 2026-10-17
in Bangkok). Its tree is the tree of `520a058c`, the head every check above
ran on.

- **Deployment.** The zodiacs.org alias names
  `dpl_Bs8UKEC7igJeo1qBg2cUYVhrBUY7`: readyState READY, target production,
  githubCommitSha `6bbda021eb0886bb18bac953c883be4170dc4f10`, ready and
  aliased at 2026-10-16T22:40:06Z.
- **What production serves.**
  [tools/production-check.mjs](tools/production-check.mjs) passed 8 of 8 at
  2026-10-16T22:42:40Z ([production.json](production/production.json)): the
  page with the playground on it; `examples.json` as the merge builds it,
  every documented request with its documented answer; the Markdown twin,
  with a `--data-raw` cURL command for each request; the browser bundle, byte
  for byte the one its sources build; `llms.txt`; the sitemap; and
  `/developers/` and `/developers/compute/`, which link to the page. The same
  check before the merge, at 2026-10-16T19:51:15Z, passed 0 of 8
  ([control-before.json](production/control-before.json)): the page and its
  files answered 404, and nothing listed or linked to them.
- **The drive against production.**
  `node tests/developer-playground-drive.mjs --base-url https://zodiacs.org`
  passed 53 of 53 at 2026-10-16T22:44:28Z
  ([drive-production.json](production/drive-production.json)). Each of the
  17 requests reproduces by an agent's path, the twin and the hosted API, and
  by a person's path, the link, Send, Run in this browser and both
  citations; the API, the browser and the documentation agree. Its controls
  hold in production: an API answer with the Sun moved 0.001° is called
  different, and a citation that is not its receipt's digest is called out.
- **Main's Site Check** passed on the merge (run 38976740729).

## Privacy

The compute API's privacy claim said no page, island or script of the site
calls it. The playground does, by design, so the claim and its test name it as
the one exception: `tests/api/compute-api-privacy.test.ts` holds that the
island makes one request to the API, in the function only the Send button
calls, and that the browser bundle and the playground's helpers make no
network request and use no storage. The page loads no analytics script
(`privateSurface`), as `/developers/compare/` does.

## What it does not do

- The refusals that come from how a request is framed (its method, media type
  or declared length), from the server's state (its rate limit, its switch, an
  engine failure) or from an address that names no endpoint are documented at
  `/developers/compute/#errors` with the handler's own answers. They are not a
  body the playground sends.
- A browser does not report the tzdb release its `Intl` reads, so a receipt
  computed there names the browser as its runtime and records `null` where the
  server's name Node and its tzdb, and its citation differs with it.
