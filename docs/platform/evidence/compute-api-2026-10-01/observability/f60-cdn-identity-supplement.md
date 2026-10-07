# F60 supplement: one observed CDN source, cause still unresolved

The saved CDN query for 2026-10-01 06:24–06:25 UTC shows one anonymized IP, `/api/v1/time`, the measured production deployment, HTTP 200, and Count Sum 41. Its simpler IP/path query agrees. The private export contains exactly the same 41 probe request IDs in that window. The CDN table reconciles by window, path, deployment, status and count; it has no per-request ID/IP mapping.

This materially weakens rotating client egress as an explanation. Vercel's [request-header documentation](https://vercel.com/docs/headers/request-headers#x-real-ip) says `x-real-ip` is identical to `x-forwarded-for`, which represents the client public IP. The SDK's actual incoming headers and derived counting keys were not captured, so their distinct counts remain unknown. The earlier export-only diagnosis is preserved as historical evidence; this supplement supersedes its broader suggestion that client rotation was equally plausible.

The corresponding SDK-path CDN query also shows exactly 41 requests in that window and deployment, all HTTP 204, CDN region `iad1`, action `allow`, with WAF Rule ID displayed as `not set`. This directly corroborates the SDK allow response path and weakens cross-CDN-region splitting. The table is aggregate evidence, with no one-to-one parent/subrequest trace join and no internal counter routing/key/window values.

## What the production source establishes

At production source `9cfafa3e742de943062c9174338472781724a4b5`:

- `api/compatibility.ts:50–53` hands the compute route to its own handler first
- `api/_compute/handler.ts:16` supplies only `localTime`, with no limiter override
- Generated `api/_compute/compute.mjs:6151–6168,6318–6338` awaits the general limiter before reading or computing the body; `time` uses `zodiacs-compute-api`
- Non-production mode, missing key/rule, unexpected responses and exceptions fail closed
- Installed `@vercel/firewall` 1.2.1 uses the incoming `x-real-ip` when no custom key is passed, and awaits its same-host rate-limit API response; 204 allows, 429/403 limits, 404 is missing-rule, other statuses throw
- No timestamp, random value or instance ID enters the derived key. The fixed secret inputs were not read. The deployed SDK bytes were not independently fetched
- The production `vercel.json` has no rewrite for the default SDK `.well-known` path; its trailing-slash redirect explicitly excludes `.well-known`

The saved rule-detail snapshot has the correct `@vercel/firewall` condition and exact `zodiacs-compute-api` ID, Fixed Window 60 seconds, limit 40, IP Address key, and 429 action. No obvious ID/condition/threshold mismatch was found. This does not expose the effective runtime key or historical counter/window state.

An isolated local replay of the exact generated guard and installed SDK made 41 intercepted calls for 41 identical synthetic inputs, with one derived key. It verified awaiting and fail-closed results. All fetches were stubbed, and the sandbox's environment was synthetic. This demonstrates the source contract; it does not reproduce the live cause. See `f60-sdk-local-replay.json` and its `.mjs` companion.

## How to interpret “No Data”

The rule-filtered Traffic view for the same window shows “No Data” and dashes for action counts. Those are not numeric zeroes. The independent SDK-path table proves that this empty filtered view cannot be interpreted as no SDK calls. Its `not set` WAF Rule ID also does not independently prove that no counter matched or incremented. The inspected [SDK documentation](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk) and [Traffic UI changelog](https://vercel.com/changelog/improved-analytics-experience-now-available-on-the-vercel-firewall) do not establish complete allowed-SDK attribution to the configured rule ID. The dedicated Firewall Observability page could not be retrieved.

The current evidence still does not demonstrate the configured 40/60 rule blocking this population. It also does not identify a specific SDK key, decision region, bucket boundary or platform-counter defect. The two function instances do not by themselves explain separate counting keys. No documented one-request tolerance is assumed.

## Smallest remaining read-only check

The smallest CDN discriminator has now been obtained: existing records for `/.well-known/vercel/rate-limit-api/zodiacs-compute-api`, grouped by status, rule attribution and CDN region. The unrelated overview total is excluded. No additional UI query or production probe is proposed by this bounded analysis.

The remaining evidence would be privacy-preserving effective-key distinct counts and counter/rule/window association for those existing requests, plus the rule revision active during the probe if needed. The supplied exports and aggregates do not expose those fields. Provider-side existing-request trace correlation may be needed; a specific counter defect or fix is not established. This supplement authorizes no additional production requests, logging changes, security changes or secret reads.

Reproduce the reconciliation with `analyze-f60-cdn-supplement.py`. Its JSON companion contains safe source hashes and query URLs. Earlier baseline and F60 artifacts are unchanged. No raw IPs or unrelated export rows are included.
