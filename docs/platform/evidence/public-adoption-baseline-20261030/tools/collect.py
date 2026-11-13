"""Public adoption baseline for P0.7a, 2026-10-30.

Read-only requests to public endpoints. Writes each response's bytes to OUT/raw
and a manifest (url, status, retrievedAt, bytes, sha256). The MCP Registry crawl
keeps its pages outside the repository and records only counts and a digest.
"""
import hashlib, json, os, re, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

OUT = sys.argv[1]
RAW = os.path.join(OUT, "raw")
CRAWL = os.path.join(OUT, "registry-pages")
os.makedirs(RAW, exist_ok=True)
os.makedirs(CRAWL, exist_ok=True)
UA = "ZodiacsPublicBaseline/2026-10-30 (https://zodiacs.org/; admin@zodiacs.org)"
manifest = []


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def fetch(url, name=None, keep=True, accept="application/json"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    at = now()
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            status, body = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    except Exception as e:  # network failure: record it, do not invent a value
        status, body = None, repr(e).encode()
    entry = {"url": url, "status": status, "retrievedAt": at, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest()}
    if keep and name:
        with open(os.path.join(RAW, name), "wb") as f:
            f.write(body)
        entry["file"] = "raw/" + name
    manifest.append(entry)
    return status, body


def j(body):
    try:
        return json.loads(body)
    except Exception:
        return None


summary = {"collectedFrom": now()}

# 1. npm downloads and metadata
npm = {}
for pkg in ["@zodiacs/engine", "@zodiacs/mcp-server", "@zodiacs/cli", "@zodiacs/ai-tools", "@zodiacs/wheel"]:
    slug = pkg.replace("@", "").replace("/", "_")
    s, b = fetch(f"https://api.npmjs.org/downloads/point/last-month/{pkg}", f"npm-last-month-{slug}.json")
    npm[pkg] = {"lastMonthStatus": s, "lastMonth": (j(b) or {}).get("downloads") if s == 200 else None}
s, b = fetch("https://api.npmjs.org/downloads/point/last-week/@zodiacs/engine", "npm-last-week-zodiacs_engine.json")
npm["@zodiacs/engine"]["lastWeek"] = (j(b) or {}).get("downloads") if s == 200 else None
s, b = fetch("https://api.npmjs.org/downloads/range/2026-09-28:2026-10-29/@zodiacs/engine", "npm-range-zodiacs_engine.json")
npm["@zodiacs/engine"]["daily"] = (j(b) or {}).get("downloads") if s == 200 else None
s, b = fetch("https://registry.npmjs.org/@zodiacs%2fengine", "npm-meta-zodiacs_engine.json")
meta = j(b) or {}
npm["@zodiacs/engine"]["distTags"] = meta.get("dist-tags")
npm["@zodiacs/engine"]["versions"] = sorted((meta.get("versions") or {}).keys())
summary["npm"] = npm

# 2. PyPI
pypi = {}
s, b = fetch("https://pypistats.org/api/packages/zodiacs/recent", "pypistats-zodiacs-recent.json")
pypi["recent"] = (j(b) or {}).get("data") if s == 200 else {"status": s}
s, b = fetch("https://pypistats.org/api/packages/zodiacs/overall?mirrors=false", "pypistats-zodiacs-overall-without-mirrors.json")
rows = (j(b) or {}).get("data") or []
pypi["withoutMirrorsTotal"] = sum(r.get("downloads", 0) for r in rows if r.get("category") == "without_mirrors")
pypi["withoutMirrorsDays"] = len([r for r in rows if r.get("category") == "without_mirrors"])
s, b = fetch("https://pypi.org/pypi/zodiacs/json", "pypi-zodiacs.json")
pj = j(b) or {}
pypi["version"] = (pj.get("info") or {}).get("version")
pypi["releases"] = sorted((pj.get("releases") or {}).keys())
summary["pypi"] = pypi

# 3. GitHub repositories and dependents (anonymous public pages and API)
gh = {}
for repo in ["zodiacs-org/engine", "zodiacs-org/site"]:
    slug = repo.split("/")[1]
    s, b = fetch(f"https://api.github.com/repos/{repo}", f"github-{slug}.json", accept="application/vnd.github+json")
    r = j(b) or {}
    gh[repo] = {k: r.get(k) for k in ["stargazers_count", "forks_count", "subscribers_count", "open_issues_count", "pushed_at"]}
deps = {}
for kind in ["REPOSITORY", "PACKAGE"]:
    s, b = fetch(f"https://github.com/zodiacs-org/engine/network/dependents?dependent_type={kind}", f"github-engine-dependents-{kind.lower()}.html", accept="text/html")
    html = b.decode("utf-8", "replace")
    found = {}
    for m in re.finditer(r'dependent_type=(REPOSITORY|PACKAGE)"[^>]*>(.*?)</a>', html, re.S):
        text = re.sub(r"<[^>]+>", " ", m.group(2))
        text = re.sub(r"\s+", " ", text).strip()
        n = re.search(r"([\d,]+)\s+(Repositor|Package)", text)
        if n:
            found[m.group(1)] = {"count": int(n.group(1).replace(",", "")), "text": text}
    deps[kind] = {"status": s, "displayed": found}
gh["engineDependents"] = deps
summary["github"] = gh

# 4. Official MCP Registry: named search, then the whole latest-version list
reg = {}
s, b = fetch("https://registry.modelcontextprotocol.io/v0/servers?search=zodiacs&limit=100&version=latest", "mcp-registry-search-zodiacs.json")
rj = j(b) or {}
reg["namedSearch"] = {"status": s, "returned": len(rj.get("servers") or []), "metadata": rj.get("metadata")}
cursor, pages, total, matches, digest = None, 0, 0, [], hashlib.sha256()
while True:
    q = {"limit": "100", "version": "latest"}
    if cursor:
        q["cursor"] = cursor
    url = "https://registry.modelcontextprotocol.io/v0/servers?" + urllib.parse.urlencode(q)
    s, b = None, b""
    for attempt in range(4):
        s, b = fetch(url, keep=False)
        if s == 200:
            break
        time.sleep(2 * (attempt + 1))
    if s != 200:
        reg["crawlError"] = {"status": s, "page": pages, "cursor": cursor}
        break
    digest.update(b)
    pages += 1
    with open(os.path.join(CRAWL, f"page-{pages:04d}.json"), "wb") as f:
        f.write(b)
    data = j(b) or {}
    servers = data.get("servers") or []
    total += len(servers)
    for item in servers:
        text = json.dumps(item).lower()
        if "zodiacs" in text:
            srv = item.get("server", item)
            matches.append({"name": srv.get("name"), "description": (srv.get("description") or "")[:160]})
    cursor = (data.get("metadata") or {}).get("nextCursor") or (data.get("metadata") or {}).get("next_cursor")
    if not cursor or not servers:
        break
    time.sleep(0.15)
manifest[:] = [m for m in manifest if "registry.modelcontextprotocol.io/v0/servers?limit=" not in m["url"] and "&cursor=" not in m["url"] or m.get("file")]
reg["crawl"] = {"pages": pages, "servers": total, "mentioningZodiacs": matches, "pagesSha256": digest.hexdigest(), "filter": "version=latest, limit=100, following metadata.nextCursor"}
summary["mcpRegistry"] = reg

# 5. Citations: Wikipedia external links, Hacker News, OpenAlex, Reddit
wikis = ["en", "de", "fr", "es", "it", "pt", "ru", "ja", "zh", "nl", "pl", "sv", "uk", "ko", "tr", "hi", "fa", "ar", "id", "vi"]
wiki = {}
for lang in wikis:
    hits = []
    for proto in ["https", "http"]:
        for q in ["zodiacs.org", "*.zodiacs.org"]:
            url = f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "list": "exturlusage", "euquery": q, "euprotocol": proto, "eulimit": "500", "format": "json"})
            s, b = fetch(url, f"wikipedia-{lang}-{proto}-{'sub' if q.startswith('*') else 'root'}.json")
            for h in ((j(b) or {}).get("query") or {}).get("exturlusage") or []:
                hits.append({"title": h.get("title"), "url": h.get("url")})
    wiki[lang] = {"hits": hits}
s, b = fetch("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({"action": "query", "list": "exturlusage", "euquery": "zodiacs.org", "euprotocol": "https", "eulimit": "500", "format": "json"}), "wikidata-https-root.json")
wiki["wikidata"] = {"hits": [{"title": h.get("title"), "url": h.get("url")} for h in ((j(b) or {}).get("query") or {}).get("exturlusage") or []]}
summary["wikipedia"] = wiki

hn = {}
for label, params in {"urlField": {"query": "zodiacs.org", "restrictSearchableAttributes": "url", "hitsPerPage": "100"}, "fullText": {"query": "\"zodiacs.org\"", "hitsPerPage": "100"}}.items():
    s, b = fetch("https://hn.algolia.com/api/v1/search?" + urllib.parse.urlencode(params), f"hn-{label}.json")
    hj = j(b) or {}
    hn[label] = {"status": s, "nbHits": hj.get("nbHits"), "hits": [{"objectID": h.get("objectID"), "url": h.get("url"), "title": h.get("title"), "type": (h.get("_tags") or [None])[0]} for h in hj.get("hits") or []]}
summary["hackerNews"] = hn

oa = {}
for label, params in {"fulltext": {"filter": "fulltext.search:zodiacs.org", "per-page": "50"}, "search": {"search": "\"zodiacs.org\"", "per-page": "50"}}.items():
    s, b = fetch("https://api.openalex.org/works?" + urllib.parse.urlencode(params), f"openalex-{label}.json")
    oj = j(b) or {}
    oa[label] = {"status": s, "count": (oj.get("meta") or {}).get("count"), "results": [{"id": r.get("id"), "title": r.get("title"), "year": r.get("publication_year")} for r in oj.get("results") or []]}
summary["openAlex"] = oa

s, b = fetch("https://www.reddit.com/search.json?" + urllib.parse.urlencode({"q": "url:zodiacs.org", "limit": "100"}), "reddit-url-search.json")
rd = j(b) or {}
summary["reddit"] = {"status": s, "children": len(((rd.get("data") or {}).get("children")) or []), "urls": [((c.get("data") or {}).get("url")) for c in ((rd.get("data") or {}).get("children") or [])]}

summary["collectedTo"] = now()
with open(os.path.join(OUT, "summary.json"), "w") as f:
    json.dump(summary, f, indent=2, ensure_ascii=False)
with open(os.path.join(OUT, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2)
print(json.dumps({"npm": {k: v.get("lastMonth") for k, v in npm.items()}, "engineLastWeek": npm["@zodiacs/engine"].get("lastWeek"),
                  "pypi": {"recent": pypi.get("recent"), "withoutMirrorsTotal": pypi.get("withoutMirrorsTotal")},
                  "github": {k: v for k, v in gh.items() if k != "engineDependents"}, "dependents": {k: v["displayed"] for k, v in deps.items()},
                  "registry": {"namedSearch": reg["namedSearch"]["returned"], "crawl": {k: reg["crawl"][k] for k in ["pages", "servers"]}, "mentions": len(reg["crawl"]["mentioningZodiacs"]), "error": reg.get("crawlError")},
                  "wikipediaHits": {k: len(v["hits"]) for k, v in wiki.items()}, "hn": {k: v["nbHits"] for k, v in hn.items()},
                  "openAlex": {k: v["count"] for k, v in oa.items()}, "reddit": summary["reddit"]["status"]}, indent=1))
