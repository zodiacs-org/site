# Exact-match domains (evaluation, 2026-11-08)

Rule for this program: at most two domains, each either a 301 redirect to the
one zodiacs.org page that answers the phrase, or not bought. Never a copy of
the site, never its own content (Google treats that as doorway spam).
Nothing is bought without Dias's yes.

## Checked

Availability and price from the Vercel registrar API (read only, team
`zodiacsofficial`, 2026-11-08). History lookups (web.archive.org, RDAP) were
blocked by this session's network policy and are still to do.

| Domain | Available | Price (1 year, renewal) | Would 301 to | Wayback history | Registry record |
| --- | --- | --- | --- | --- | --- |
| birthchartwithhouses.com | yes | $12.03, $12.03 | `/birth-chart/` | not checked | not checked |
| whatismymoonsign.com | yes | $12.03, $12.03 | `/moon-sign/` | not checked | not checked |
| freebirthchartwithhouses.com | yes | $12.03, $12.03 | `/birth-chart/` | not checked | not checked |
| whatismyrisingsign.org | yes | not priced | `/rising-sign/` | not checked | not checked |
| privatebirthchart.com | yes | $12.03, $12.03 | `/birth-chart/` | not checked | not checked |
| birthchartnosignup.com | yes | $12.03, $12.03 | `/birth-chart/` | not checked | not checked |
| privatebirthchartcalculator.com | yes | not priced | `/birth-chart/` | not checked | not checked |
| whatismyrisingsign.com | **no, registered** | aftermarket only, unknown | `/rising-sign/` | not checked | not checked |
| risingsigncalculator.com | **no, registered** | aftermarket only, unknown | `/rising-sign/` | not checked | not checked |

"Available" means not registered today. A dropped domain can still carry a
spam history (casino, pharma, adult, link farm), which follows it. That is why
the history check is required before any purchase.

## The two to consider

After the 2026-11-08 baseline named the privacy and no-signup phrases as the
most winnable, the two worth considering are:

1. **privatebirthchart.com** → redirect to `https://zodiacs.org/birth-chart/`
2. **birthchartwithhouses.com** → redirect to `https://zodiacs.org/birth-chart/`

After the re-centring on high-volume families, exact-match domains matter
even less: nobody types a domain for "leo horoscope today", and the families
are won by pages in each language on zodiacs.org.

## Recommendation: buy neither, for now

- A new domain with no links and no history passes nothing to the page it
  redirects to. Google stopped giving exact-match domains a ranking boost in
  2012, and a fresh domain has no history to pass on. Assistants cite the
  page they land on, which is zodiacs.org either way.
- The phrase work on the zodiacs.org pages does the job without them.
- The only real use is a short address to say aloud or print (podcast, video
  end card, flyer), where `zodiacs.org/moon-sign` already works.

If Dias wants one anyway (about $12 a year each):

1. Check history first: `https://web.archive.org/cdx/search/cdx?url=<domain>&output=json&fl=timestamp,statuscode,original&collapse=timestamp:6`
   and look at a few captures; `https://rdap.org/domain/<domain>` for past
   registration. Reject anything with past spam, adult, gambling, pharma or
   crypto content.
2. Register through Vercel, privacy on, auto-renew on.
3. Add it to the `zodiacs-org` project and add one host-matched rule in
   `vercel.json` (`"has": [{"type": "host", "value": "<domain>"}]`, source
   `/:path*`, permanent) so every path lands on the single target page, not on
   the matching path. Vercel serves permanent redirects as 308, which Google
   treats like a 301. Cover `www.` too.
4. No content, no sitemap, no Search Console property beyond a check that it
   redirects.

## Run the history check once the network allows it

```bash
for d in birthchartwithhouses.com whatismymoonsign.com; do curl -s "https://web.archive.org/cdx/search/cdx?url=$d&output=json&fl=timestamp,statuscode,original&collapse=timestamp:6&limit=50"; echo; curl -s "https://rdap.org/domain/$d" | head -c 800; echo; done
```
