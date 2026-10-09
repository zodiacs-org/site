# zodiacs.org — Product, UX, SEO & Technical Strategy

**The plan: make zodiacs.org one of the most-visited free astrology destinations by giving people genuinely useful tools, guides, and visual experiences, with saved charts as an optional local-first profile layer, Astrofolio as the consumer collection experience, and the token Registry as one dignified wing of the house rather than the house itself.**

This document is the operating strategy for the Learn / Explore / Collect restructure. The companion implementation record lives in the repo history; the design contract lives in `src/styles/tokens.css` and the component library.

**Owner decision · 2026-08-13:** Astrofolio now names the consumer collection experience at `/astrofolio/`. Saved charts at `/profile/` are called simply “saved charts” or “your profile”; their product behavior does not change. Terminal is reserved for the expert market desk at `/terminal/`; the former `/terminal/pro/` URL redirects there. **Astrofolio is the collection. The Registry is the record. The Terminal is the market desk.**

**Owner decision · 2026-10-08: no predictions.** Zodiacs does not build or publish betting tips, sports picks, market timing or election forecasts, on the site, in the plugins or in any API. Blinded tests of astrology come out at chance, both assistant stores ban the money and advertising mechanics behind those products, and gambling-advertising and financial-promotion law applies. What Zodiacs does instead: calculate the sky, offer astrology as interpretation for reflection, and test sky claims honestly in public (source: the research report "Zodiacs should test sky claims, not sell them", 8 October 2026).

---

## 0. The honest verdict

**What's strong about this play:**

- **Free tools → identity layer is the proven wedge** in this category. The incumbent calculator sites (Astro-Seek, Cafe Astrology, astrology.com) win on depth and lose badly on UX, design, and mobile. A genuinely modern, fast, beautiful calculator experience is a real, exploitable gap — not a hopeful one.
- **`zodiacs.org` is a category-exact domain** with unusual existing craft discipline: anti-hype copy rules, CI content gates, data-generated pages, weekly refresh automation, and AEO plumbing (llms.txt, IndexNow, AI-crawler allowlists) that most competitors don't have.
- **The visual raw material already exists**: the 12 pastel SDK icons and the ambient astronomical-dial films give the site a distinctive identity from day one.
- **Client-side chart calculation makes privacy a feature**: chart calculation stays on the device. Birth details leave only when a visitor explicitly opts into account sync or types them into Guide; attaching a chart to Guide sends previewed derived placements to OpenAI, not the saved name, birth date, time, place, or coordinates. Marginal calculation cost per user is ~zero, and no major competitor leads with this local-first posture.

**What's weak or dangerous — stated plainly:**

1. **The crypto elephant.** The Collect layer is tradeable tokens. The mass astrology audience is the audience most allergic to token-shilling, and search engines treat crypto as YMYL. If token language leaks into Learn/Explore or saved-chart surfaces it poisons both trust and SEO. The fix is hard separation: token language stays inside Astrofolio at `/astrofolio/`, the Terminal market desk at `/terminal/`, the Registry, and their collector/builder pages. Astrofolio stays plain-language and consumer-oriented; the Registry keeps its proof/read-only discipline; the Terminal holds the dense market detail. Astrofolio is a distinct consumer product lane within Zodiacs.org, not a separate site; it is never the name of a Zodiacs account, saved chart, or profile.
2. **The saved-charts promise gap.** "Saved charts" CTAs need somewhere real to land. That's why the MVP ships local-first saved charts on zodiacs.org itself; accounts come only when sync is a real need.
3. **SEO is a 6–18 month compounding game** from near-zero consumer authority. Expect quiet months. The counter is correct cluster architecture from day one plus AEO/AI-answer citation, where this repo already has real infrastructure.
4. **Horoscopes are a treadmill.** Daily × 12 is the classic content mill. Only do it with the transit-grounded pipeline (Phase 2) — real sky dates in, structured editorial out — or not at all.
5. **Ploy.ai is a loaded gun.** Programmatic AI content at scale is exactly what scaled-content-abuse policies target. Use it as a research/draft/monitoring engine gated by human review and an embedded-tool quality bar. Never as an autopublisher.

**Never do:** token CTAs on Learn/Explore or saved-chart surfaces · thin 200-word SEO pages · fake urgency · gating basic results behind signup (the anti-Co-Star move is the differentiator) · mystical clip-art · letting any tool autopublish to the domain.

---

## 1. Site architecture

```
/                          Homepage
/{sign}/                   12 zodiac sign GUIDES (top-level slugs — the SEO crown jewels)
/learn/                    Learn hub
  /learn/birth-chart/        pillar: how to read a birth chart
  /learn/big-three/          sun–moon–rising explainer
  /learn/planets/{planet}/   Phase 2 (10 pages)
  /learn/houses/{n}/         Phase 2 (12 pages)
  /learn/aspects/{aspect}/   Phase 2 (~7 pages)
  /learn/zodiac-dates/       dates/order/elements lookup page
/tools/                    Explore hub (links all calculators)
/birth-chart/              flagship calculator (flat slugs for money pages)
/moon-sign/                moon sign calculator
/rising-sign/              rising sign calculator
/compatibility/            Phase 2: calculator + hub for pair pages beneath it
/synastry/ /moon-phase/ /saturn-return/ /transits/    Phase 2–3
/horoscopes/{sign}/        Phase 2: weekly + monthly first; daily in Phase 3
/compatibility/{a}-{b}/    Phase 2/3: 78 pair pages, only after the synastry tool exists
/profile/                  Saved charts (local-first profile)
/astrofolio/               Astrofolio (consumer collection experience)
/terminal/                 Terminal (expert market desk)
/registry/                  Collect wing landing (the registry experience, preserved)
  /registry/{sign}/           token catalogue pages (moved from /{sign}/)
/thesis/ /archive/ /sdk/   Unchanged URLs (collector/builder wing)
/registry/zodiacs.registry.json    Unchanged (external consumers)
/methodology/              How charts are computed (E-E-A-T + privacy)
```

**The `/{sign}/` decision:** sign-name URLs carry astrology intent, not token intent — they became the guides. The token catalogue lives at `/registry/{sign}/`, linked prominently from each guide's Collect band so external token listings that still point at `/{sign}/` remain one click from the record while listings are updated.

## 2. Homepage

Conversion arc (layout rhythm inspired by ploy.ai; execution fully zodiac-native): sparse commanding hero → light-density live proof → tool cards → capability demonstration → full catalog → three pillars → persona doors → FAQ → minimal close.

1. **Hero** — H1 **"Explore the stars behind your story."** · sub: "Free birth charts, moon signs, compatibility, and horoscopes — accurate, private, and easy to understand." · CTAs **"Get your free birth chart"** / **"See your forecasts"** · signature asset: the rounded zodiac video surface.
2. **Live sky ticker** — "Right now · Sun 13°41′ Cancer · Moon in Scorpio · Mercury direct · Full moon in 5 days." Real computation as credibility.
3. **Tool cards** — Birth Chart ("what it means") · Moon Sign ("how you feel") · Rising Sign ("how people first meet you") · Compatibility. Only live features get cards.
4. **Demo chart** — a real annotated chart (Frida Kahlo, public birth data), three plain-language callouts, "Yours takes about 20 seconds."
5. **The Twelve** — pastel icon grid → guides (the internal-link hub).
6. **Three pillars** — Learn · Tools · **Saved charts**: "Learn your signs. Save what matters."
7. **Persona doors** — New here? → Big Three · Chart-literate? → full calculator · A collector? → the Registry wing.
8. **FAQ** (free? accurate? what happens to my birth data? what is Astrofolio? what is the registry?) with FAQPage schema.
9. **Close** — "Start with your birth chart."

## 3. Navigation

**Signs · Tools · Learn · Horoscopes (Phase 2) · Saved charts** + profile glyph (fills when something is saved) + **Astrofolio** collection chip. The Signs menu is a 12-icon pastel grid — the icons are the navigation. Sign pages tint the accent with their disc hue. Footer: full tree + methodology + SDK + socials; crypto disclosure lives only in the collector/builder wing.

## 4. Voice & microcopy

Plain language first; jargon translated inline ("Rising sign — how people first meet you"). Confident and warm; never woo-woo, never salesy. Technical facts stay available where they build trust.

Canonical labels: "Get your free birth chart" · "Save this chart" → "Saved · on this device" · "Saved charts" · "Find your moon sign" / "Find your rising sign" · "Read your sign" · nav collection label: "Astrofolio" (the consumer collection at `/astrofolio/`) · "the Twelve" = the twelve signs as canonical records in the Registry · records bridge (sign guides EN+ES + the birth-chart result): "{sign} also exists as one of the Twelve — a canonical record in the Registry" → "View the record →" (records register, never market language) · profile empty state: "Nothing saved yet. Charts you save will live here, on your device first." · Astrofolio one-liner: "Choose your sign and find its official identity through one calm collection view."

## 5. MVP feature set (shipped in this restructure)

1. Astro scaffold, design tokens, global shell.
2. Homepage with the three signature islands (Zodiac Wheel, sky ticker, demo chart).
3. Birth chart calculator — fully client-side: offline city index → historical timezone → Sun–Pluto + True Node + ASC/MC + Whole Sign/Placidus houses + aspects → interactive SVG wheel + placements + big-three readings + Save.
4. Moon sign + rising sign calculators (same engine, dedicated SEO landers).
5. 12 sign guides (personality, love, strengths, myth/heritage, big-three variants, FAQ).
6. `/profile/` local saved charts.
7. `/registry/` wing: the prior registry homepage preserved intact; catalogue at `/registry/{sign}/`.
8. SEO base: per-page meta/OG, JSON-LD, composed sitemap, rewritten llms.txt, methodology page.

## 6. Roadmap

**Phase 2 (weeks ~2–8): capture demand**
- Compatibility calculator (instant sun-sign + full synastry) → then 78 pair pages with the tool embedded.
- Weekly + monthly horoscopes, transit-grounded: a cron computes real transits (same engine in Node), drafts against a strict editorial template with transit data cited inline, human review, commit → rebuild.
- Moon phase tool · Saturn-return calculator · planets/houses/aspects clusters (~30 pages).
- **Saved-chart accounts** (Supabase): sync the local profile losslessly; relationship tracking.
- Collect wing retheme onto shared tokens (museum character kept); shareable chart OG cards.

**Phase 3 (months ~3–6+): compound**
- Daily horoscopes (only if Phase 2 proved quality), 120 placement pages, transit tracker, retrograde/eclipse calendar pages, AI astrologer grounded in the saved chart (costed first), email digests, then apps/localization.

## 7. Free tools priority

1. Birth chart calculator (flagship; feeds everything)
2. Rising sign calculator (high volume, high confusion, weak competition)
3. Moon sign calculator (emotional hook, shareable)
4. *(P2)* Compatibility → synastry (viral loop; bridge to "track this relationship")
5. *(P2)* Moon phase today / birthday moon (habit former)
6. *(P2)* Saturn return calculator (underserved, high intent, perfect save-hook)

## 8. SEO content clusters (build order)

1. **Zodiac signs** — 12 guides + zodiac-dates page (authority base)
2. **Birth chart** — calculator + how-to-read pillar + big-three (the money cluster)
3. **Rising/Moon** — calculators + explainers + 12 rising profiles (P2)
4. **Compatibility** — hub + 78 pairs, tool-embedded, element/modality logic per pair (P2)
5. **Houses/Planets/Aspects** — ~30 pages completing birth-chart topical authority (P2)
6. **Moon** — phases, full-moon calendars/names by year (seasonal spikes)
7. **Transits/retrogrades** — year date-pages, Saturn return, eclipses (P3)
8. **Horoscopes** — weekly/monthly (P2), daily (P3); a retention cluster, not a rankings play at first

**AEO throughout:** every tool page carries a quotable computed fact box (structured, dated sky data); FAQPage/HowTo schema wherever honest; llms.txt covers the consumer surface; the existing AI-crawler posture extends to all new content.

## 9. How saved charts are introduced

**Principle: saved charts only offer to keep something the user just created. They never sell.**

- Calculator result → **"Save this chart"** (one tap, local, no signup) → profile glyph fills.
- Second saved chart → "Compare these two →" (P2 synastry) → **"Track this relationship."**
- Guide footer → "Is {Sign} your sun sign? Add it to your profile."
- Horoscopes (P2) → "Get this for *your* placements."
- `/profile/` is the only surface that upsells accounts (P2): "Keep this on every device."
- **Token collecting is a separate path, never a save-flow upsell:** Astrofolio, the Registry, and the Terminal stay outside the saved-charts funnel.

Funnel: anonymous tool use → local save (zero friction) → accumulation → account at a real sync-need moment. Astrofolio is an independently entered consumer collection experience, not the final rung of this funnel.

## 10. The registry's place

The Registry is **the record**: its verification experience lives at `/registry/`; catalogue pages live at `/registry/{sign}/`; thesis/archive/sdk URLs stay unchanged. Astrofolio at `/astrofolio/` is the consumer collection, while the Terminal at `/terminal/` is the expert market desk. The Registry keeps its anti-hype/read-only discipline and remains the canonical source of identity, addresses, datasets, and methodology.

## 11. Calculations & APIs (own the math, client-side)

- **Ephemeris:** `astronomy-engine` (MIT, ~45KB gz, arc-minute accuracy, runs in browser and Node). Sun–Pluto + True Node. Chiron is not computable in astronomy-engine — Phase 2 adds it via a precomputed JPL Horizons daily-longitude table (public domain; no Swiss Ephemeris AGPL entanglement).
- **Houses/angles:** in-house (Whole Sign default + Placidus; hard fallback to Whole Sign above 66° latitude). **Aspects:** in-house (5 majors, documented orbs, applying/separating).
- **Accuracy gate:** CI test vectors — JPL Horizons cross-check, astro.com modern chart (±0.1° bodies / ±0.2° cusps), a 1907 pre-standard-time LMT case, DST gap + fold, southern hemisphere, high-latitude fallback, True Node.
- **Geocoding:** no API — GeoNames cities index shipped as sharded static JSON with client-side typeahead (CC-BY attribution in the calculator footnote and colophon).
- **Timezones:** GeoNames rows carry the IANA zone; historical offsets from 1970 on come from the browser's own tzdb via `Intl`, and before 1970 from a pinned tzdb release with backzone (`src/data/tz-history/`), with the birthplace's own local mean time before its zone's era ended; explicit DST-gap/fold policy and flags saved on the chart. Documented on `/methodology/`.
- **Paid astrology APIs** (astrology-api.io, AstrologyAPI.com, Prokerala): not on the core path — per-call pricing taxes exactly the growth we want. Useful as validation datasets and a Phase-3 option for exotic calculations.
- **Privacy dividend:** chart calculation stays on the device. Birth details leave only through explicit account sync or when the visitor types them into Guide; the optional Guide chart attachment sends previewed derived placements to OpenAI, not saved identity or birth-input fields. Lead with the precise local-first claim, not an absolute no-transmission promise.

## 12. Technical stack

Astro 5 static + Preact islands · TypeScript engine lib shared browser/Node · MDX content collections (zod-validated) · hand-rolled CSS tokens (no Tailwind) · self-hosted variable fonts (Instrument Sans + JetBrains Mono, OFL) · Vercel static (functions only when accounts arrive) · Supabase in Phase 2 · GitHub Actions: weekly data crons kept, CI = astro build + check + dist link-check + content gates + a scoped drift gate for the legacy wing generators.

## 13. Design system — "Cosmic Void"

- **Base:** cool void near-blacks (`#060709 → #1C2130`), cool off-white ink, hairline borders. Premium restraint; zero mystical clip-art.
- **The pastel icons are the design language, not decoration**: hero wheel, Signs nav grid, calculator sign chips, placement tables, guide heroes, pair lockups, profile big-three, wing rows, share cards, 404. Served as resized AVIF/WebP tiers (24/64/200px) — never the raw 1024px PNGs.
- **Per-sign accent tokens from the disc hues** (`--sign-aries: #DE8E79` … `--sign-pisces: #A9D4C4`), element groupings, `color-mix` tinting — no 12× component variants.
- **Type:** Instrument Sans variable (display to text; hero up to ~4.5rem clamp) + JetBrains Mono for computed data. Cinzel/Cormorant survive only inside the legacy wing until its retheme.
- **Motion:** the house easing (`cubic-bezier(0.32,0.72,0,1)`), scroll-reveal discipline, hero-wheel slow orbit, chart stroke-draw-in — all behind `prefers-reduced-motion`.
- **Kept from the old handoff because it's right:** sharp restrained cards, quiet data styling, no gradient-blob kitsch, mobile-first single-DOM responsive.

## 14. Conversion flows

1. **Chart → Save:** result → "Save this chart" → local → glyph fills → return visit greets "Sun {sign} ☉".
2. **Two charts → Relationship:** ≥2 charts → "Compare these two →" → synastry (P2) → "Track this relationship."
3. **Guide → Identity:** "your sign?" → add to profile → profile suggests the full chart ("know your moon too?").
4. **Profile → Account (P2):** ≥2 saves or second device → "Keep this on every device" → saved-chart account → sync.

## 15. Ploy.ai — the traffic engine, with a muzzle

**Use for:** keyword/entity gap research vs Astro-Seek/Cafe Astrology/astrology.com · cluster planning · MDX first-drafts delivered as GitHub PRs (the repo stays the single source of truth; Ploy never publishes to the domain) · decay/cannibalization monitoring · AEO citation tracking · internal-link and meta suggestions.

**Hard guardrails:** human review on every page before merge · every programmatic page must embed a working tool, computed data, or a unique visual ("earn the index") · velocity cap ≤10 new pages/week in Phase 2 · quarterly prune/consolidate on engagement data · no doorway patterns · no pair pages before the synastry tool exists.

**Sequencing:** Phase 1 research + briefs only → Phase 2 drafted clusters through PR review → Phase 3 scaled placements/date pages once the quality pattern is proven.

## 16. Measurement

Search Console + privacy-light analytics; events on the four conversion flows (save, second-chart, profile-visit, wing-entry); weekly cluster rank/citation review once Phase 2 content ships; quarterly content prune. The number that matters in months 1–3 is *tool completion rate and saves*, not rankings.
