#!/bin/bash
# Refetch the sources behind the carried rows. One attempt each, one retry on a
# transport error only. Writes <name>.<ext> and appends a line to fetch-log.tsv.
out="$1"
mkdir -p "$out"
cd "$out" || exit 1
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
get() {
  name="$1"; url="$2"
  code=$(curl -sS -L --compressed --max-time 40 -A "$UA" -o "$name" -w '%{http_code}' "$url" 2>/dev/null)
  if [ "$code" = "000" ]; then sleep 3; code=$(curl -sS -L --compressed --max-time 40 -A "$UA" -o "$name" -w '%{http_code}' "$url" 2>/dev/null); fi
  printf '%s\t%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$code" "$(wc -c < "$name" 2>/dev/null)" "$name" "$url" >> fetch-log.tsv
  echo "$code $name"
  if [ "$code" = "429" ]; then echo "HTTP 429 on $name: stopping"; exit 9; fi
  sleep 1
}
get yougov.html 'https://yougov.com/en-us/articles/42292-one-four-americans-say-they-believe-astrology'
get coingecko.html 'https://www.coingecko.com/research/publications/average-lifespan-of-pumpfun-tokens'
get smithsonian.html 'https://www.smithsonianmag.com/history/how-are-horoscopes-still-thing-180957701/'
get disclosure.html 'https://zodiacs.org/disclosure/'
get registry.json 'https://zodiacs.org/registry/zodiacs.registry.json'
get home.html 'https://zodiacs.org/'
get apps.html 'https://zodiacs.org/apps/'
get about.html 'https://zodiacs.org/about/'
get astrofolio.html 'https://zodiacs.org/astrofolio/'
get fomo.html 'https://zodiacs.org/fomo/'
get hor-fr.html 'https://zodiacs.org/fr/horoscopes/'
get hor-it.html 'https://zodiacs.org/it/horoscopes/'
get hor-es.html 'https://zodiacs.org/es/horoscopes/'
get hor-pt.html 'https://zodiacs.org/pt/horoscopes/'
get hor-en.html 'https://zodiacs.org/horoscopes/'
get ru.html 'https://zodiacs.org/ru/'
get hor-ru.html 'https://zodiacs.org/ru/horoscopes/'
get distribution.json 'https://zodiacs.org/assets/distribution.json'
get pulse.json 'https://zodiacs.org/assets/pulse.json'
get og-thesis.png 'https://zodiacs.org/assets/og/v2/thesis.png'
get archive-feed.json 'https://zodiacs.org/archive/feed.json'
get solflare-leo.html 'https://www.solflare.com/prices/leo/8Cd7wXoPb5Yt9cUGtmHNqAEmpMDrhfcVqnGbLC48b8Qm/'
get usno-2026.json 'https://aa.usno.navy.mil/api/seasons?year=2026'
get pew.html 'https://www.pewresearch.org/religion/2025/05/21/3-in-10-americans-consult-astrology-tarot-cards-or-fortune-tellers/'
get unicode-derivedage.txt 'https://www.unicode.org/Public/17.0.0/ucd/DerivedAge.txt'
get unicode-pubdates.html 'https://www.unicode.org/history/publicationdates.html'
get sensortower.html 'https://sensortower.com/blog/astrology-apps-2019-revenue-downloads'
get allied.html 'https://www.alliedmarketresearch.com/press-release/astrology-market.html'
get wikipedia-zodiac.json 'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&titles=Zodiac&format=json&formatversion=2'
get npm-window.json 'https://api.npmjs.org/downloads/point/2026-10-11:2026-11-09/@zodiacs/sdk'
get npm-last-month.json 'https://api.npmjs.org/downloads/point/last-month/@zodiacs/sdk'
get npm-registry.json 'https://registry.npmjs.org/@zodiacs/sdk'
get wayback-cdx.json 'https://web.archive.org/cdx/search/cdx?url=zodiacs.org&from=20240101&output=json&fl=timestamp,statuscode,digest,length&filter=statuscode:200&collapse=timestamp:8'
get wayback-thesis-cdx.json 'https://web.archive.org/cdx/search/cdx?url=zodiacs.org/thesis/&output=json&fl=timestamp,statuscode,digest,length&limit=5'
get tweet-portnoy.json 'https://cdn.syndication.twimg.com/tweet-result?id=1891528769770279114&token=a'
get tweet-portnoy3.json 'https://cdn.syndication.twimg.com/tweet-result?id=1891546878350618936&token=a'
get tweet-wanton.json 'https://cdn.syndication.twimg.com/tweet-result?id=1812520143638962302&token=a'
get tweet-friggin1.json 'https://cdn.syndication.twimg.com/tweet-result?id=1809610788296093843&token=a'
get tweet-friggin2.json 'https://cdn.syndication.twimg.com/tweet-result?id=1810351665045975133&token=a'
get fx-portnoy.json 'https://api.fxtwitter.com/stoolpresidente/status/1891528769770279114'
get wm-20260323-virgo.json 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Virgo_%28astrology%29/daily/2026032000/2026032500'
for h in astrofolio.xyz www.astrofolio.xyz; do
  curl -sS -I --max-time 30 -A "$UA" "https://$h/" > "redirect-$h.txt" 2>&1
  printf '%s\t%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$(head -1 "redirect-$h.txt" | tr -d '\r')" "-" "redirect-$h.txt" "https://$h/" >> fetch-log.tsv
done
echo done
