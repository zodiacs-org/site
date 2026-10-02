# F60: bounded counting-identity diagnosis

All 41 aligned time-endpoint probes exact-match the private Vercel export by request-ID suffix. All returned 200. Platform timestamps span 06:24:33.688–06:24:39.626 UTC (5.938 seconds). They ran on two function instances in iad1, each reporting Peak Concurrency 1.

The supplied export has no client-IP, original-request-header, rate-limit-key, remaining-counter or bucket-reset field. Captured response headers also lack the incoming `x-real-ip`. Therefore distinct client IPs, effective counting keys and rate-limit decision regions are unknown. This is not evidence that those values were identical or absent at runtime.

## Verified source semantics

The production SHA's lockfile resolves official `@vercel/firewall` 1.2.1 from npm. The installed package declares `github.com/vercel/vercel`, package directory `packages/firewall`. The production handler calls `checkRateLimit(id, {headers: req.headers})`, without a custom key. Its production source and the installed SDK were inspected locally; deployed package bytes and secret values were not fetched.

At `node_modules/@vercel/firewall/dist/rate-limit.js:51–67`, the SDK chooses `x-real-ip` when no key override is supplied. It appends a deterministic SHA-256 suffix involving the key, rule ID and configured secret inputs. Neither function instance ID nor a timestamp/random value appears in this expression. The SDK forwards the key and ID to the same host's rate-limit API, waits for its response, and reports an allow for 204 or a limit for 429. The handler refuses missing rules and errors.

Different trusted incoming IPs would consequently yield different default keys. Two observed function instances are not two proven counting identities.

## Official semantics and limits

Vercel's current [SDK documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk), updated July 23, 2026, states that unique keys have separate buckets, the default is client IP, and counters operate per region. A key spanning regions can exceed one region's threshold in aggregate. This is a documented limitation on a global-cap claim; it does not establish that this probe crossed counting regions.

The inspected [WAF documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) describes Pro fixed-window limits for a common source. Its indexed text does not establish an allowed one-request overshoot, asynchronous SDK counting, exact global linearizability, or the reset boundary for this probe. Direct retrieval of that page failed; its indexed text is older than the SDK page. No presumed off-by-one allowance is used to explain the result.

## Conclusion

The active 40-request rule did not produce a 429 in this 41-call probe. That leaves enforcement unproved. It does not, by itself, prove a failed counter: same-client execution does not establish one egress IP/default key. Proxy-IP rotation is a plausible distinction, not an observed cause. Distributed counting and fixed-window boundaries are additional semantics to identify, not explanations established by the two application-instance IDs.

The smallest useful remaining evidence is a privacy-preserving distinct count of incoming client IP/default key and rate-limit decision region for these existing requests, ideally with per-key/window counts. No raw IP, arbitrary request header, secret, additional production request or rule change was made or included in this diagnostic.

See `f60-counting-identity-diagnosis.json` for the 41 synthetic-only matches, source checksums and exact limits; `analyze-f60-identity.py` reproduces the local analysis. Earlier baseline artifacts are unchanged.
