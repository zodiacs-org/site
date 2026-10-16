# The compute API playground (P3.8), 2026-10-15

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
  - runtime: a receipt names the runtime's tzdb, which a browser does not
    report;
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
  with its standard library, for the request as it stands.
- **Links.** A link names the endpoint, and the documented example while the
  request is still that example. It carries the request only when the box is
  ticked, base64url after `#request=`, which a browser never sends to a
  server.
- **For agents.** `/developers/playground.md` lists every request with a cURL
  command and its documented citation digest; `examples.json` holds each
  request with its documented answer. Both are listed in `llms.txt` and
  `llms-full.txt`.

## Evidence

TESTS

DRIVE

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
  computed there records `null` where the server's records Node's, and its
  citation differs with it.
