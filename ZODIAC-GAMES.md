# Zodiac Games — Full Brief (self-contained handoff for Claude Code)

Drop this file in the repo root as ZODIAC-GAMES.md. It contains everything: the plan, the rules, and all approved copy. Claude Code should read it before every packet. Rules in Part 1 §10 are non-negotiable.

---

# PART 1 — THE PLAN


**Cowork operating document · v2.2 · 2026-08-23 · supersedes v2.1**

**Changelog:** The Race now sits inside a simpler recurring system called **The Zodiac Games**. The Race is the live competition. Every zodiac season ends with a **Season Champion** and a completed trophy. Winners enter the **Trophy Hall**. Results accumulate toward one **Annual Champion**. Astrofolio means the twelve actual Zodiac tokens; the canonical consumer page is `https://zodiacs.org/astrofolio/`, and astrofolio.xyz is its redirect alias rather than a separate surface. Ownership never affects Race scoring.

**2026-08-23 route update:** This domain relationship supersedes v2.1 instructions that called astrofolio.xyz “irrelevant” or required zero references. Product links should use the canonical Zodiacs.org page. The alias may be named when explaining the redirect, but it is not a separate destination.

---

## 1. How to use this doc

You are probably a fresh Cowork session in the **Zodiacs.org** project. Read fully → take the next `pending` packet in §11 whose gate is met → one packet per session → verify your own work → update §11 via `project_write` and report the north-star numbers (§7). The strategy is settled; spend judgment on craft.

## 2. Strategy

One sentence: **The Zodiac Games turn sign pride into a recurring global competition; The Race gives people a reason to return, trophies create history, and Astrofolio gives a curious minority a way to own their sign.**

| Decision | Locked answer |
|----------|---------------|
| Umbrella | **The Zodiac Games** — the ongoing competition between the twelve signs |
| Core mechanic | **The Race** — the live standings and free participation layer |
| Emotional core | Sign pride and rivalry. Everyone was born on a team |
| Weekly loop | Weekly standings, check-ins, rivalry, share cards, recap |
| Seasonal loop | Every zodiac season crowns one **Season Champion** and completes one trophy |
| Annual loop | Seasonal results accumulate toward one **Annual Champion** |
| History | **Trophy Hall** — permanent record of past season and annual winners |
| Scoring | Free participation only. Ownership, price, and wallet size never move a sign up the Race |
| Market data | Observed separately. Never presented as a way to win |
| Astrofolio | The twelve actual Zodiac tokens, one for each sign. It is an optional ownership layer, not the game |
| Cabinet | Neutral collection showcase. It shows which of the Twelve a wallet owns; it is not a Race mechanic |
| Voice | Plain everyday language: short, warm, zero jargon, honest |
| Discussion | Real humans only. No synthetic accounts or manufactured threads |
| Shipping / analytics | GitHub branches/PRs; cookieless Plausible/Umami events |
| Thesis | Depth layer for people who want the full case |
| Venice clock | **Icebox** |

## 3. The product hierarchy

Keep the naming simple:

```text
THE ZODIAC GAMES   the whole competition
      ↓
THE RACE           what is happening now
      ↓
SEASON CHAMPION    who won this zodiac season
      ↓
TROPHY HALL        the permanent history
      ↓
ANNUAL CHAMPION    the best-performing sign across the year
```

Do not invent more branded layers unless the product proves it needs them.

## 4. The funnel

```text
search → sign pages & tools → THE RACE → join your sign (free)
      → weekly standings / rivalry / share card → return
      → season reaches its finish → champion + trophy
      → Trophy Hall builds history and status
      → a curious minority discovers the official token for its sign
      → plain explainer → Astrofolio on zodiacs.org → optional ownership
```

The Race must be worth using even if the visitor never owns a token.

The token bridge should feel like a discovery, not a checkout. **Participation wins trophies. Ownership does not.**

## 5. Ground truth

- Zodiacs.org is an astrology utility/SEO platform: birth charts, compatibility, transits, horoscopes, sign pages, and multiple locales.
- The thesis remains a long-form depth layer, not the primary conversion surface.
- Twelve official Zodiac tokens exist on Solana, roughly 1B supply each, with Base representations via Wormhole. The Registry remains the verification layer.
- The Cabinet is a neutral wallet collection view across the Twelve.
- Social surfaces already exist in the footer: X, Instagram, TikTok, Telegram.
- **Astrofolio in this plan means the twelve actual Zodiac tokens. Route the product funnel to `https://zodiacs.org/astrofolio/`; astrofolio.xyz redirects there.**
- Calendar: Virgo season begins around Aug 23, 2026; Libra season around Sep 23, 2026.

## 6. The Zodiac Games — product spec

### 6.1 The Race

Primary page: `zodiacs.org/race`.

Above the fold:
- current zodiac season
- days remaining
- live standings for all twelve signs
- the visitor's sign when known
- one free action: **Join your sign**

Example:

> **The Zodiac Games**  
> Virgo Season · 7 days left  
> Scorpio leads. Leo is 842 points behind.

The page should be understandable in five seconds on mobile.

### 6.2 Scoring

The Race is powered only by free participation:
- **Join** — one person joining a sign
- **Weekly check-in** — one return per week
- **Share** — measured for distribution; do not allow blind share-button tapping to dominate rank

Exact scoring weights are decided in implementation after anti-abuse testing. They must remain simple enough to explain in one sentence.

No purchase, balance, holder count, market value, or token activity can add Race points.

### 6.3 Weekly rhythm

Every week:
- standings stamp: `Week 35`
- short **State of the Race** recap
- closest rivalry
- biggest mover
- sign-specific share cards
- optional email with the visitor's sign standing

The weekly loop creates habit. It does not crown the final winner.

### 6.4 Zodiac seasons

Each solar sign season is one championship period.

Examples:
- Virgo Season
- Libra Season
- Scorpio Season

All twelve signs compete during every season.

Each season has:
1. opening standings
2. weekly Race updates
3. a visible countdown
4. one final result
5. one **Season Champion**

The host sign does not receive a scoring advantage.

Signs level on points rank in zodiac order, Aries first and Pisces last, so a tie at the top goes to the earlier sign.

### 6.5 The trophy

Each season has one visual trophy.

The trophy begins incomplete and progresses visually as the season moves toward its final day. Keep the mechanic visual, not complicated: the trophy is a countdown and symbol of what is at stake, not another game system.

At season close:

> **SCORPIO**  
> **Virgo Season Champion · 2026**

The trophy is completed, engraved with the winning sign, and moved permanently into the Trophy Hall.

The trophy does not need to be an NFT. Start as a Zodiacs.org achievement and historical object. Portability can be tested later only if users care.

### 6.6 Trophy Hall

Create a permanent historical page: `zodiacs.org/games/history` or the simplest route the existing architecture supports.

It records:
- season
- year
- winning sign
- final standings
- margin of victory

Over time it can surface simple records such as:
- most season wins
- longest winning streak
- biggest comeback
- closest finish

Do not overbuild this for launch. The first requirement is simply an immutable list of winners and results.

### 6.7 Annual Champion

Season results also feed one annual table.

Use a simple, published points system based on finishing position. Do not optimize it for complexity. The exact points table can be chosen during implementation, but it must be fixed before the first counted season begins.

At year end:

> **2026 Zodiac Champion — Sagittarius**

The Annual Champion receives its own entry in the Trophy Hall.

The three time horizons should always be easy to understand:

```text
THIS WEEK       what is happening now
THIS SEASON     who is closest to the trophy
THIS YEAR       who leads the Zodiac Games
```

### 6.8 Market data

Market data remains observational and secondary.

If shown on `/race`, separate it clearly from Race scoring. Prefer a compact module rather than a second competing leaderboard.

Mandatory plain risk line adjacent to market data, verbatim or equivalent:

> *These numbers move every day, in both directions. Nobody knows where they go next — anyone who promises they do is selling you something.*

The existing Terminal and Registry remain the deeper market and verification surfaces.

### 6.9 Astrofolio bridge

**Astrofolio means the twelve actual Zodiac tokens. Its canonical consumer page is `https://zodiacs.org/astrofolio/`; astrofolio.xyz is a redirect alias, not a separate product.**

The cleanest bridge is contextual and sign-specific.

During the Race:

> **Aries is one of the Twelve.**  
> Joining Team Aries is free. Aries also has one official digital token. Owning it is optional and does not affect the Race.  
> **Meet Aries →**

After a season win:

> **Scorpio won Virgo Season.**  
> Scorpio is also one of the twelve official Zodiac tokens that make up Astrofolio.  
> **Meet Scorpio →**

The link stays inside Zodiacs.org and leads to the relevant Astrofolio/token explainer. From there, users can reach the Registry, Terminal, Cabinet, and verified third-party acquisition routes where appropriate.

Do not make the trophy depend on a purchase. A later experiment may let verified holders display a champion trophy or badge beside their sign, but ownership must never determine the winner.

## 7. Voice guide

Rules: everyday words; short sentences; second person; define any crypto term immediately; metaphors from teams, races, seasons, trophies, and collecting; jokes allowed; hype never; unknowns stated plainly.

Calibration lines:
- "Every sign has a team. You were born on one."
- "Join your sign. It's free."
- "Scorpio is first. Leo is 842 points behind."
- "Seven days until the trophy is awarded."
- "Scorpio won Virgo Season."
- "The Race is free. Owning a Zodiac is separate."
- "A token is a digital asset you can hold in a wallet."
- "Owning more does not give your sign more points."
- "The Cabinet shows the Zodiacs you collect."
- "Nobody knows where prices go next."

Forbidden: profit promises, urgency, "don't miss out," guaranteed returns, safe investment, risk-free, moon language, get rich, financial advice, casino framing, and any copy implying buying helps a sign win.

## 8. Measurement v2.1

North star: **weekly active Race participants**.

Secondary outcomes:
- join rate
- weekly return rate
- share rate
- recap subscriber growth
- per-sign participation
- season completion / final-day return rate
- Astrofolio curiosity rate from Race and champion surfaces

| Event | Fires when | Props |
|-------|-----------|-------|
| `race_view` | `/race` pageview | `season` |
| `team_join` | visitor joins a sign | `sign`, `season` |
| `weekly_checkin` | weekly return action | `sign`, `season` |
| `share_card` | share action | `sign`, `platform`, `season` |
| `trophy_view` | season trophy viewed | `season`, `days_left` |
| `season_result_view` | final result viewed | `season`, `winner` |
| `trophy_hall_view` | history page viewed | — |
| `race_to_astrofolio` | sign-specific token explainer clicked | `sign`, `source` |
| `ramp_click` | on-ramp to `/race` | `source` |

Privacy: cookieless, counts not identities, opt-in email only, never place wallet addresses or email addresses in analytics.

## 9. Phases & packets

### Phase 0 — Plumbing

**P0.1 · Repo intake & site audit** — map the live site, Race integration points, current Registry/Terminal/Cabinet/Astrofolio surfaces, token data sources, and options for a lightweight participation backend. Output: `claude/zodiacs-site-map.md`.

**P0.2 · Analytics** *(gate: P0.1)* — install Plausible/Umami with §8 events and verify each event.

### Phase R1 — Build the Race

**R1.1 · Voice + product copy** *(gate: none)* — finalize the plain voice guide and draft all launch copy for The Zodiac Games, The Race, season trophy, winner state, Trophy Hall, and Astrofolio bridge.

**R1.2 · Race MVP** *(gate: P0.1, R1.1)* — ship `/race`: Zodiac Games header, current season, live standings, join action, weekly stamp, countdown, simple trophy state, and sign-specific Astrofolio bridge. Add rate limiting and dedupe. Verify end-to-end.

**R1.3 · Share cards** *(gate: R1.2)* — per-sign weekly cards and season-winner cards. Verify all twelve signs and correct season/week data.

### Phase R2 — Add stakes and recurrence

**R2.1 · Repoint the ramps** *(gate: R1.2)* — homepage, sign pages, horoscopes, and relevant tools route naturally to `/race`. Use sign-specific copy where known.

**R2.2 · Weekly recap machine** *(gate: R1.2)* — scheduled task pulls Race data and drafts State of the Race for site/email/X/IG/TikTok/Telegram. Nothing auto-posts.

**R2.3 · Season close + Trophy Hall** *(gate: R1.2)* — lock final season standings, complete the trophy, store the immutable result, publish the Season Champion, and append the Trophy Hall.

**R2.4 · Annual standings** *(gate: R2.3)* — define the simple annual points table before the first counted season closes; publish the annual standings and year-end champion state.

**R2.5 · Astrofolio bridge** *(gate: R1.2)* — ensure every Race/token bridge stays on Zodiacs.org, routes to the correct Zodiac token explainer, clearly states that ownership is optional, and connects onward to Registry/Terminal/Cabinet as appropriate. No Astrofolio.xyz dependency.

### Phase R3 — Review cycle

Weekly: read active participants, join rate, return rate, share rate, season-final return rate, and Race → Astrofolio curiosity. Apply one fix. Structural changes become new packets.

### Icebox

Holder trophy/badge experiments · portable trophy/NFT experiments · deep locale replication of the Games · Venice-clock flagship · museum-register copy · thesis-ending rework.

## 10. Rules every packet obeys

- [ ] **The Zodiac Games are won by free participation, never by purchases or wallet size.**
- [ ] The Race is the live mechanic; Season Champions and the Trophy Hall give it consequence and history.
- [ ] Keep the system simple. Do not add new branded layers without a clear product need.
- [ ] The Cabinet remains a neutral collection showcase, not a team or Race surface.
- [ ] Astrofolio means the twelve actual Zodiac tokens. Do not route this funnel to Astrofolio.xyz.
- [ ] Any market data is clearly separate from Race scoring and carries plain risk language.
- [ ] No profit promises, urgency, buy-to-win cues, or implied financial outcomes.
- [ ] Discussion is human. No synthetic accounts, engagement pods, or fabricated threads.
- [ ] Privacy stays cookieless; email is opt-in; wallets are not placed in analytics.
- [ ] Mobile performance is a launch requirement.
- [ ] EN-only work must log a locale follow-up instead of silently cutting locales.

## 11. Status log

| Packet | Status | Date | PR | Notes / metrics |
|--------|--------|------|----|-----------------|
| P0.1 repo intake & audit | **done** | 2026-08-16 | — | delivered as `docs/GAMES-SITE-MAP.md` · Plausible already installed with an event allowlist, so P0.2 shrinks to registering the §8 events · `/race` + `/games` namespaces free · R2.1 and R2.5 will each need a phase1 scope allowance (see audit §7) · EN-only locale follow-up for Race surfaces logged per §10 |
| P0.2 analytics | **mostly done** | 2026-08-17 | — | full §8 event set registered in `src/lib/analytics-config.mjs` (+ closed sign/source values); `race_view`/`team_join`/`weekly_checkin`/`trophy_view`/`race_to_astrofolio` wired in the Race island via `trackAnalytics`. Remaining: Plausible is currently hard-disabled sitewide in `Base.astro` (`guideRuntimeEnabled` privacy hold) — events no-op until that owner decision is revisited; live-event verification then |
| R1.1 voice + product copy | **done** | 2026-08-16 | — | delivered as `claude/zodiacs-games-copy.md` |
| R1.2 Race MVP | **done** | 2026-08-17 | — | `/race/` shipped behind `PUBLIC_ZODIAC_GAMES_ENABLED` (committed off, noindex until R2.1): season header + countdown, live 12-sign standings, join, weekly check-in (Week = ISO week UTC), simple trophy state, sign-specific Astrofolio bridge, FAQ. Backend: `supabase/migrations/20260817080000_zodiac_games.sql` (RLS-on/zero-policy tables, SECURITY DEFINER RPCs, dedupe by PK, per-IP-bucket join rate limit) + Docker PG17 contract/concurrency tests + CI job; `api/games.ts` with signed anonymous session cookie (HMAC hashes only). Scoring v1: join 100 · check-in 25 · shares measured but 0 until R1.3 anti-abuse proves them — the scoring sentence stays true. Verified end-to-end in Chromium (join → check-in → reload → standings). Deviations logged: FAQ data answer amended to disclose the functional session cookie (honesty rule beats verbatim); "This week ▲▼" standings column deferred; email opt-in module deferred to R2.2; market module omitted (optional per §6.8). Launch checklist: apply migration in Supabase SQL Editor · set `PUBLIC_ZODIAC_GAMES_ENABLED=1` + `ZODIAC_GAMES_SESSION_SECRET` (≥32 chars) in Vercel · R2.1 un-noindexes + sitemap + assistant-context unlisting removal. **Locale follow-up (§10): /race/ is EN-only** |
| R1.3 share cards | **done** | 2026-08-17 | — | client-rendered PNG cards in the Cabinet-seal design system (`src/lib/games/share-card.ts`): weekly leader card, rivalry variant (points behind the leader + season countdown), and the champion card renderer (surfaced by R2.3). §G copy verbatim; share sheet with download fallback; `share_card` analytics wired; board refreshes after join/check-in so cards carry live numbers. Verified: model tests across all twelve signs + browser drive producing a real PNG. Share module gated to joined visitors |
| LAUNCH | **live** | 2026-08-18 | — | `/race/` live in production end to end: flag + session secret set in Vercel; migration applied to the Zodiacs.org Supabase project via the Supabase connector (an earlier Codex "Success" report had never landed — the project had no Games tables; verified empty, applied, schema reloaded); `/api/games?action=standings` returns the live 12-sign board (leo-2026). Ops hardening shipped en route: self-diagnosing `missing` shape on the unconfigured 503 (#261) and a sanitized `upstream` echo on the 502 (#263, #264). #261 also repaired four pre-existing main breakages from the overnight redesign (sign-records needle, seven stale wing loader stamps, quiet-Guide drive + visual baselines, Astrofolio FAQ count) |
| R2.1 repoint ramps | **done** | 2026-08-19 | — | flag-gated `RaceRamp` band (renders nothing flag-off, so CI receipts hold): homepage (after The Twelve), all twelve sign guides (below CollectBand; scope allowance `race-ramp-sign-guides-2026-08-19`), horoscopes hub + every sign-horoscope template (sign-specific copy), compatibility. `/race/` un-noindexed + sitemap entry (flag-gated) + removed from assistant `UNLISTED_ROUTE_PREFIXES`. Owner-directed same-PR fixes (Dias 2026-08-19): Race page token-free (bridge copy + FAQ trimmed — the records register lives on the catalogue profile, not the Race); bridge re-pointed to `/registry/{sign}/` (early R2.5 delivery); official SDK circle icons on the board, chips, and share cards (canvas draws them with glyph fallback); trophy module now shows the season sign's gold sculpture (`/assets/sculptures/512/`) |
| R2.2 weekly recap machine | **done** | 2026-08-19 | — | `scripts/build-race-recap.mjs` + `race-recap-lib.mjs` (§H skeleton verbatim, §F sign lines rotated weekly; drafts for site/email/X/IG/TikTok/Telegram; X ≤280 tested; no market words, tested) reads the PUBLIC standings endpoint — no secret. Weekly cron `race-weekly-recap.yml` (Mon 08:11 UTC) commits the draft + snapshot history to `docs/race-recaps/` and opens a review ISSUE — **nothing auto-posts**; movers computed against the prior week's committed snapshot; honest skip when the Games flag is off or the week is already stamped. First live draft committed (`leo-2026-w34.md`). Deferred, logged: actual email SENDING + Race opt-in list (drafts carry a `{{unsubscribe_url}}` placeholder) — needs an owner decision on reusing the daily-list Resend pipeline vs. a separate Race list |
| R2.3 season close + Trophy Hall | **done** | 2026-08-19 | — | Standings API accepts a past `season` id (validated, future ids refused; closed seasons served immutable with day-long edge cache). Daily cron `race-season-close.yml` (00:23 UTC) locks the just-closed season into committed `src/data/games/champions.json` — appended once, never edited, git history as tamper evidence; empty boards are not counted (no zero-point champions). Trophy Hall live at `/games/history/` (§E copy verbatim: entries with champion sculpture, margin, expandable final standings; launch empty state with the live close date). §D champion announcement renders on `/race/` above the board for the month after each close. Sitemap + check-dist + assistant listings flag-gated like `/race/`. First real close: leo-2026 on 2026-08-23, fully automatic. Follow-up logged: champion share-card surfacing on the Hall; §D context lines (Nth title / closest finish) once ≥2 seasons of data exist |
| R2.4 annual standings | pending | — | — | points fixed before first counted close |
| R2.5 Astrofolio bridge | pending | — | — | actual tokens · **Historical decision, Dias 2026-08-16:** astrofolio.xyz coexists but gets zero references — sweep existing footer/thesis links · **Historical decision, Dias 2026-08-17:** the funnel's destination is the per-sign catalogue profile (`/registry/{sign}/`), which Dias is tailoring for the Zodiac Games — re-point the Race's "Meet [Sign]" bridge there (from `/astrofolio/`); keep the record register calm, keep market data boxed with the §6.8 risk line, link live standings to /race rather than baking them into daily-built pages · bridge re-point + Race-page token removal delivered early in R2.1 (2026-08-19). **Superseded route fact, 2026-08-23:** the official consumer experience is `https://zodiacs.org/astrofolio/`; astrofolio.xyz redirects there. Current links should use the canonical Zodiacs.org URL. |
| R3 review cycle | recurring | — | — | begins after P0.2 + R1.2 |
| Icebox | iced | — | — | holder trophies, NFT portability, clock, locales, thesis ending |

## 12. Re-grill triggers

- **Participation flatlines after launch** → re-grill the game mechanic before adding marketing volume.
- **People join once but do not return** → weekly stakes are too weak; improve rivalry, countdown, and season consequence.
- **Season-final return is weak** → the trophy is not creating enough anticipation; simplify or strengthen its presentation.
- **Race → Astrofolio curiosity is near zero while the Race grows** → improve the sign-specific explanation and placement, not the aggressiveness of the sales language.
- **People think buying helps their sign win** → treat as a product failure and remove the confusing cue immediately.
- **The naming system starts expanding** → collapse it back to: Zodiac Games → Race → Season Champion → Trophy Hall → Annual Champion.

*End of plan v2.1. The Zodiac Games are the world. The Race is the game. Every season crowns a champion. The trophies remember.*

---

## Appendix — paste-ready Cowork prompts *(added by Claude 2026-08-16; Dias may edit/remove)*

**P0.1**
```
In my Zodiacs.org project, read claude/zodiacs-master-plan.md, then execute
Packet P0.1. Repo: <PASTE GITHUB URL>. Map the Games integration points,
Registry/Terminal/Cabinet surfaces, token data sources, and participation-
backend options. Write claude/zodiacs-site-map.md; update the status log.
```

**R1.1** *(no repo needed — can run today)*
```
In my Zodiacs.org project, read claude/zodiacs-master-plan.md, then execute
Packet R1.1: finalize the voice guide and draft all launch copy for The
Zodiac Games, The Race, season trophy, winner state, Trophy Hall, and the
Astrofolio bridge. Obey §10. Save as a project doc; update the status log.
```

**Any build packet (R1.2, R1.3, R2.1, R2.3, R2.4, R2.5)**
```
In my Zodiacs.org project, read claude/zodiacs-master-plan.md and
claude/zodiacs-site-map.md, then execute Packet <ID>. Obey §10 word-for-word,
verify per spec, open a PR, update the status log.
```

**R2.2**
```
In my Zodiacs.org project, read claude/zodiacs-master-plan.md, then execute
Packet R2.2: build the weekly recap machine and register the scheduled task
(weekly, Monday morning my time). Drafts come to me for approval — nothing
auto-posts. Update the status log.
```

**R3 (weekly)**
```
In my Zodiacs.org project, read claude/zodiacs-master-plan.md, then run the
R3 review cycle: active participants, join rate, return rate, share rate,
season-final return, Race → Astrofolio curiosity. Apply one fix; log numbers.
```

---

# PART 2 — VOICE & APPROVED COPY


**Packet R1.1 deliverable · v1.0 · 2026-08-16 · obeys Master Plan v2.1 §10**
Copy is EN-only this packet; locale follow-up is logged in the status log per §10. Strings are parameterized with `[Sign]`, `[Season]`, `[N]`, `[Date]` slots so R1.2 can lift them directly.

---

## A. The voice, finalized

Write like you'd text a smart, busy friend. Short sentences. One idea each. Second person.

1. **Sports language for the Games.** Leads, trails, comeback, final day, title, engraved. The Games are a sport; talk like it.
2. **Weather language for markets.** Moves, both directions, nobody knows. Markets are weather; report them, never cheer them.
3. **Define every crypto term the moment it appears, in one line.** "A token is a digital asset you can hold in a wallet." Then move on.
4. **Numbers beat adjectives.** "842 points behind" — never "surging," never "exploding."
5. **Honesty is the charm.** Unknowns stated plainly. It's what makes the rest believable.
6. **Jokes allowed. Hype never.** Exclamation marks almost never.
7. **Countdowns are sports facts, not pressure.** "7 days left in Virgo Season" is a fixture date. Never attach a countdown to anything ownable.

**Banned everywhere** (from §7/§10): profit promises · urgency ("don't miss out," "last chance") · guaranteed/safe/risk-free · moon or get-rich language · financial advice · casino framing · anything implying buying helps a sign win.

**Calibration lines** (the plan's set, kept, plus additions):
- "Every sign has a team. You were born on one."
- "Join your sign. It's free."
- "Scorpio is first. Leo is 842 points behind."
- "Seven days until the trophy is awarded."
- "The Race is free. Owning a Zodiac is separate."
- "Owning more does not give your sign more points."
- "Nobody knows where prices go next."
- "Points come from people. Nothing else counts."
- "The Hall remembers. That's its whole job."
- "New season, clean slate."

---

## B. The Zodiac Games — concept copy

**One-liner (masthead / meta description):**
> Twelve signs. One race. Every season crowns a champion.

**Short explainer (Race page intro, About block):**
> Every sign has a team. You were born on one.
> The Zodiac Games are a running competition between all twelve signs. People join their sign, check in weekly, and push it up the standings. Every zodiac season ends with one champion and one engraved trophy. The Games are free. They always will be.

**How it works (3 steps):**
> 1. **Join your sign.** Ten seconds. Free.
> 2. **Check in weekly.** Every check-in scores.
> 3. **Watch the season.** One champion. One trophy. Then it starts again.

**The scoring sentence (the one-sentence rule from §6.2 — use verbatim wherever scoring is explained):**
> People score the points: joins, weekly check-ins, and shares. Nothing else counts.

**FAQ block:**

> **Is this free?**
> Yes. Completely. That's the point.
>
> **How does my sign score?**
> People score the points: joins, weekly check-ins, and shares. Nothing else counts.
>
> **Can someone buy a win?**
> No. Money can't add points. Not ours, not anyone's. If anything ever makes you think otherwise, tell us — we'll treat it as a bug.
>
> **What does the winner get?**
> The trophy, engraved with the sign's name, permanent in the Trophy Hall. Pride. That's the prize, and it's the good kind.
>
> **What's a Zodiac token, then?**
> Each sign also has one official token — a digital asset you can hold in a wallet. Owning one is optional, separate, and doesn't affect the Games at all.
>
> **Do you sell anything?**
> No. The Games are free and nothing here is a store. Some people choose to own their sign's token; that happens elsewhere, on public exchanges, and it's never required.
>
> **What happens to my data?**
> Almost nothing. No cookies, no tracking identities — we count, we don't watch. Email is optional and only sends standings. Unsubscribe anytime.

---

## C. The Race page (`/race`)

**Header block:**
> **The Zodiac Games**
> [Season] Season · [N] days left
> [Leader] leads. [Second] is [N] points behind.

**Standings labels:** `#` · `Sign` · `Points` · `This week ▲▼`

**Join module (not yet joined):**
> **Pick your team. You already know which one.**
> Button: `Join [Sign]`
> Confirm state: **You're in.** [Sign] just scored. Come back weekly — check-ins count.

**Joined state:**
> Team [Sign] · joined [Month Year]
> Button: `Check in — Week [N]`
> Done state: **Counted.** See you next week.

**Email opt-in:**
> Want the standings in your inbox? One email a week. That's all it ever is.
> Button: `Send me the standings`
> Sub: Unsubscribe anytime. We don't share your address.

**Share module:**
> Post [Sign]'s standing. Rivalries don't run themselves.
> Button: `Share the card`

**Trophy module (in-season):**
> **The [Season] trophy.**
> Completes in [N] days. Engraved with whoever's on top when the season closes.

**Season explainer (footer of /race):**
> **How seasons work.** Each zodiac season is one championship — about a month long, twelve a year. All twelve signs compete in every season. When a season closes, the leader becomes Season Champion, the trophy is engraved, and the next season starts from zero.

**Market module (compact, per §6.8 — market data never renders without the risk line):**
> **Meanwhile, in the market.**
> Each sign also has one official token — a digital asset people can own. This board shows what people have been paying. It is not part of the Race and can't be: money doesn't score points here.
> *These numbers move every day, in both directions. Nobody knows where they go next — anyone who promises they do is selling you something.*
> Link: `See the full numbers →` (Terminal)

---

## D. Trophy & winner states

**Final week:**
> [Season] closes in [N] days. [Leader] holds first. [Second] is [N] points back.

**Season close — champion announcement:**
> **[SIGN]**
> **[Season] Season Champion · [Year]**
> Won by [N] points over [Runner-up]. Engraved. Permanent.
> Link: `See the Trophy Hall →`

**Champion context lines (rotate as fits):**
> - [Sign]'s first title. / [Sign]'s [Nth] title.
> - The closest finish so far: [N] points.
> - Led for [N] of [M] weeks.

**For everyone else:**
> [Your sign] finished [place]. [Next season] starts [Date]. New trophy, clean slate.

## E. Trophy Hall (`/games/history`)

**Intro:**
> **The Trophy Hall.**
> The Games run all year. The Hall remembers all of it — every season, every champion, forever.

**Entry format:** [Season] [Year] · **[Champion]** · won by [N] points · `final standings →`

**Records labels (post-launch, as data accrues):** Most titles · Longest streak · Biggest comeback · Closest finish

**Launch empty state:**
> The first trophy is still being raced for. [Season] Season closes [Date]. Someone's name goes here forever.

---

## F. The Astrofolio bridge (canonical page on Zodiacs.org)

**In-Race module (sign-specific):**
> **[Sign] is one of the Twelve.**
> Joining Team [Sign] is free — that's the whole game. [Sign] also has one official token. A token is a digital asset you can hold in a wallet. Owning it is optional and doesn't affect the Race.
> Link: `Meet [Sign] →`

**Post-championship variant:**
> **[Sign] won [Season] Season.**
> [Sign] is also one of the twelve official Zodiac tokens — together they're called Astrofolio.
> Link: `Meet [Sign] →`

**"Meet [Sign]" token explainer page (the bridge destination — full copy):**
> **[Sign], the token.**
> Each of the twelve signs has one official token. Together they're called Astrofolio. [Sign]'s is this one.
>
> **What it is.** A token is a digital asset you can hold in a wallet — like a domain name, it's a thing you own, not a promise from anyone. There are about a billion units of [Sign]. That number is fixed and can't be changed by anyone, including us.
>
> **How to know it's the real one.** Copies and fakes exist for everything popular. The Registry lists the one verified address for each sign — check it before you trust anything. `Verify in the Registry →`
>
> **The numbers.** What people pay for [Sign] changes constantly. The Terminal shows it plainly. *These numbers move every day, in both directions. Nobody knows where they go next — anyone who promises they do is selling you something.* `Open the Terminal →`
>
> **The collection view.** The Cabinet shows which of the Twelve a wallet holds. It's a shelf, not a scoreboard. `See the Cabinet →`
>
> **Should you own one?** That's not our question to answer, and we won't pretend it is. People own their sign for the same reason people frame a jersey — it means something to them. If you ever consider it: prices move both directions, nothing here is advice, and never spend money you'd miss. People who do decide to own one use public exchanges; the Registry exists so they don't get fooled on the way.
>
> **Either way — the Race stays free, and owning [Sign] never adds a point to it.**

**Twelve sign lines (for bridges, cards, and season copy — plain, warm, astrology-culture humor):**
- **Aries** — First in the zodiac. Hates being second anywhere.
- **Taurus** — Slow to start. Immovable once ahead.
- **Gemini** — One team, despite the twins.
- **Cancer** — Home-team energy, wherever it plays.
- **Leo** — Expects the trophy. Always has.
- **Virgo** — Read the scoring rules. All of them. Twice.
- **Libra** — Wants a fair race. Then wants to win it.
- **Scorpio** — Says nothing. Climbs anyway.
- **Sagittarius** — Aims high. Occasionally at the wrong target.
- **Capricorn** — Checks in, says nothing, goes back to work.
- **Aquarius** — Joins late. Rewrites the strategy.
- **Pisces** — Dreams big. Sometimes remembers to check in.

---

## G. Share card text (feeds R1.3)

**Weekly card:**
> ♏ **SCORPIO** · 1st this week
> Week [N] · The Zodiac Games
> zodiacs.org/race

**Rivalry variant:**
> ♌ **LEO** · 842 points behind Scorpio
> [N] days left in [Season] Season
> zodiacs.org/race

**Champion card:**
> ♏ **SCORPIO**
> [Season] Season Champion · [Year]
> The Zodiac Games · zodiacs.org/race

## H. State of the Race — recap skeleton (feeds R2.2)

> **Subject:** Week [N]: [Leader] holds on / [Mover] makes a move
>
> **Standings.** [Top three with points.]
> **Closest rivalry.** [Pair + gap.]
> **Biggest mover.** [Sign, places climbed.]
> **The trophy.** [N] days until [Season] closes.
> **One more thing.** [One sign line or record note.]
>
> Footer: standings link · share your sign's card · unsubscribe (one tap, no questions)

## I. Notes for R1.2 (build packet)

- Keep every string parameterized; the copy above is the source of truth — don't paraphrase in code.
- The §6.8 risk line ships verbatim wherever market numbers render, including the Meet-[Sign] pages.
- The scoring sentence (§C) appears on /race and in the FAQ, identical both places.
- Use `https://zodiacs.org/astrofolio/` for the official consumer experience. astrofolio.xyz may be mentioned only to explain that it redirects to the canonical page; it is not a separate destination. The earlier zero-reference rule (Dias, 2026-08-16) is superseded by the operator’s 2026-08-23 route update.
- Countdown copy attaches only to seasons and trophies, never to tokens.
