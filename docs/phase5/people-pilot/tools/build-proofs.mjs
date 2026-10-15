/**
 * Phase 5A proof-board generator.
 *
 * Writes the static boards under docs/acceptance/phase5-people/ from the
 * real pilot data, so every board shows copy and figures that came out
 * of the manifest rather than mock text. Boards are self-contained: the
 * only external references are the repository's own fonts, the site's
 * pastel sign discs, and two licensed Commons portraits committed
 * alongside them.
 *
 *   node docs/phase5/people-pilot/tools/build-proofs.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PILOT = join(HERE, '..');
const OUT = join(PILOT, '..', '..', 'acceptance', 'phase5-people');

const manifest = JSON.parse(await readFile(join(PILOT, 'manifest.json'), 'utf8'));
const people = Object.fromEntries(manifest.people.map((person) => [person.slug, person]));
const copy = {};
for (const person of manifest.people) {
  copy[person.slug] = JSON.parse(await readFile(join(PILOT, 'copy', `${person.slug}.json`), 'utf8'));
}
const screening = JSON.parse(await readFile(join(PILOT, 'screening.json'), 'utf8'));
const byScreen = Object.fromEntries(screening.candidates.map((row) => [row.slug, row]));

const SIGN_NAMES = {
  aries: 'Aries', taurus: 'Taurus', gemini: 'Gemini', cancer: 'Cancer',
  leo: 'Leo', virgo: 'Virgo', libra: 'Libra', scorpio: 'Scorpio',
  sagittarius: 'Sagittarius', capricorn: 'Capricorn', aquarius: 'Aquarius', pisces: 'Pisces',
};
const SIGNS = Object.keys(SIGN_NAMES);
const GLYPH = {
  Sun: '☉', Moon: '☾', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
};
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** Reader-facing ingress instants: to the minute. Milliseconds are
    spurious precision for an ephemeris boundary, and they read as
    machine spill in a sentence. The full value stays in the record. */
const toMinuteUtc = (iso) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;
const escape = (text) => String(text)
  .replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const longDate = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
};
const birthdayLabel = (iso) => {
  const [, month, day] = iso.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}`;
};

/* ── Shared partials ────────────────────────────────────────────────── */

function page({ title, kicker, heading, intro, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<link rel="stylesheet" href="proof.css">
</head>
<body>
<header class="proof-head">
  <span class="kicker">${escape(kicker)}</span>
  <h1>${escape(heading)}</h1>
  <p>${intro}</p>
</header>
${body}
</body>
</html>
`;
}

const board = (note, stage, extraClass = '') =>
  `<section class="board${extraClass ? ` ${extraClass}` : ''}">
  <div class="board__note">${note}</div>
  <div class="board__stage">
${stage}
  </div>
</section>
`;

const disc = (sign, size = 62, cls = '') =>
  `<img class="${cls}" src="assets/signs/${sign}.webp" width="${size}" height="${size}" alt="" style="width:${size}px;height:${size}px;border-radius:50%">`;

/** A real chart wheel from real longitudes. No house ring: there is none. */
function wheel(person) {
  const computed = JSON.parse(person.__computedRaw);
  const R = 148;
  const cx = 160;
  const cy = 160;
  const sectors = SIGNS.map((sign, index) => {
    const start = (index * 30 - 90) * (Math.PI / 180);
    const end = ((index + 1) * 30 - 90) * (Math.PI / 180);
    const x1 = cx + R * Math.cos(start);
    const y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end);
    const y2 = cy + R * Math.sin(end);
    return `<path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="var(--${sign})" fill-opacity="0.10" stroke="rgba(198,204,218,0.14)" stroke-width="0.75"/>`;
  }).join('\n      ');
  const bodies = computed.placements.map((placement) => {
    const lon = SIGNS.indexOf(placement.sign) * 30 + placement.degree;
    const angle = (lon - 90) * (Math.PI / 180);
    const radius = R - 26;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="#0B0E15" stroke="rgba(198,204,218,0.16)"/>`
      + `<text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-size="14" fill="#EEF1F7" font-family="JetBrains Mono, monospace">${GLYPH[placement.body] ?? '·'}</text></g>`;
  }).join('\n      ');
  return `<div class="wheel">
      <svg viewBox="0 0 320 320" role="img" aria-label="Chart wheel for ${escape(person.displayName)}: ten bodies by sign and degree. No house ring — the birth time is unknown.">
      ${sectors}
      <circle cx="${cx}" cy="${cy}" r="${R - 46}" fill="none" stroke="rgba(198,204,218,0.10)"/>
      ${bodies}
      </svg>
      <p class="mono wheel__caption">Positions at 12:00 civil time in ${escape(person.birthPlace.displayLabel)} — a reference instant, not a birth time.</p>
    </div>`;
}

function qualityBlock(person) {
  const uncertain = person.moon.uncertain;
  return `<div class="quality" style="--sign: var(--${person.sunSign.slug})">
        <strong>Birth date sourced. Birth time unknown.${uncertain ? ' Moon sign undetermined.' : ''}</strong>
        <span>Without an hour there is no rising sign, no houses and no angles. Everything below is what the day itself settles.</span>
      </div>`;
}

function readingBlocks(slug, limit = 5) {
  const page = copy[slug];
  return `<div class="read">
        ${page.blocks.slice(0, limit).map((block) => `<div class="read__block">
          <h3>${escape(block.title)}</h3>
          <p>${escape(block.text)}</p>
        </div>`).join('\n        ')}
      </div>`;
}

function personHead(person, { portrait = null, discSize = 62 } = {}) {
  const figure = portrait
    ? `<div class="person-head__figure">
          <img src="${portrait.src}" width="116" height="140" alt="${escape(person.displayName)}">
          <p class="credit">${portrait.credit}</p>
        </div>`
    : '';
  return `<div class="person-head">
        ${figure}
        <div class="person-head__body">
          ${disc(person.sunSign.slug, discSize, 'person-head__disc')}
          <h1 class="display">${escape(person.displayName)}</h1>
          <p class="identity">${escape(person.shortDescription)}</p>
          <p class="mono" style="margin-top:8px">${SIGN_NAMES[person.sunSign.slug]} ${person.sunSign.degree.toFixed(1)}° · born ${longDate(person.birthDate.displayedDate)}</p>
        </div>
      </div>`;
}

function disclosureRows(person, { open = false } = {}) {
  const coordinates = person.birthPlace.coordinates;
  const rows = [
    ['Source article', `en.wikipedia.org/wiki/${escape(person.sources.wikipedia.title.replace(/ /gu, '_'))} · rev ${person.sources.wikipedia.revisionId}`],
    ['Wikidata', `${person.qid} · rev ${person.sources.wikidata.lastrevid}`],
    ['Retrieved', person.sources.retrievedAtUtc],
    ['Birth date as stored', `${person.birthDate.storedValue} · day precision`],
    ['Calendar model', `${person.birthDate.calendarModel} · ${escape(person.birthDate.calendarConversion)}`],
    ['Birthplace', `${escape(person.birthPlace.normalisedLabel)} · ${person.birthPlace.displayEntity}${person.birthPlace.displayEntity !== person.birthPlace.entity ? ` · recorded on Wikidata as ${escape(person.birthPlace.entityLabel)} (${person.birthPlace.entity})` : ''}`],
    ['Coordinates', `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)} · from ${escape(coordinates.sourceEntityLabel)}${coordinates.escalationSteps ? ` (one step up — ${escape(coordinates.precisionDowngrade)})` : ''}`],
    ['Zone and offset', `${person.computation.timeZone} · ${person.computation.utcOffsetMinutesAtBirth} min from UTC`],
    ['Reference instant', `${person.computation.utcInstant} · noon civil time, not a birth time`],
    ['Omitted', 'rising sign, houses, angles, sect — all require a birth time'],
    ['Moon across the day', `${person.unknownTimeErrorBandDegrees.Moon.toFixed(2)}° · ${person.moon.uncertain ? `${SIGN_NAMES[person.moon.signAtCivilDayStart]} → ${SIGN_NAMES[person.moon.signAtCivilDayEnd]}` : `stays in ${SIGN_NAMES[person.moon.sign]}`}`],
    ['Engine', `${escape(person.computationInputVersion.ephemeris)} · aspects ${escape(person.computationInputVersion.aspectTable)}`],
    ['Portrait', person.portrait.available ? escape(person.portrait.renderedAttribution) : `none — ${escape(person.portrait.reason)}`],
  ];
  return `<div class="disclosure">
        <div class="disclosure__summary">
          <span><strong>Where this comes from</strong><small>Sources, revisions, and exactly what the chart assumes</small></span>
          <span class="disclosure__mark">${open ? '−' : '+'}</span>
        </div>
        ${open ? `<dl class="rows">
          ${rows.map(([term, value]) => `<div class="row"><dt>${escape(term)}</dt><dd>${value}</dd></div>`).join('\n          ')}
        </dl>
        <p class="fine" style="padding-bottom:12px">Something wrong here? <a href="mailto:people@zodiacs.org">Ask us to correct or remove it</a>.</p>` : ''}
      </div>`;
}

function tile(person) {
  return `<div class="tile">
          ${disc(person.sunSign.slug, 38)}
          <div class="tile__body">
            <span class="tile__name">${escape(person.displayName)}</span>
            <span class="tile__meta">${SIGN_NAMES[person.sunSign.slug]} · born ${longDate(person.birthDate.displayedDate)}</span>
            <span class="tile__desc">${escape(person.shortDescription)}</span>
          </div>
        </div>`;
}

/* Attach raw computed records for the wheel. */
for (const person of manifest.people) {
  person.__computedRaw = await readFile(join(PILOT, 'computed', `${person.slug}.json`), 'utf8');
}

const PORTRAITS = {
  'ada-lovelace': {
    src: 'assets/portrait-ada-lovelace.jpg',
    credit: 'Antoine Claudet · public domain · <a href="https://commons.wikimedia.org/wiki/File:Ada_Byron_daguerreotype_by_Antoine_Claudet_1843_or_1850_-_cropped.png">Wikimedia Commons</a>',
  },
  'rosalind-franklin': {
    src: 'assets/portrait-rosalind-franklin.jpg',
    credit: 'MRC Laboratory of Molecular Biology · <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a> · <a href="https://commons.wikimedia.org/wiki/File:Rosalind_Franklin.jpg">Wikimedia Commons</a>',
  },
};

const boards = {};

/* ── 1. Directory, default ──────────────────────────────────────────── */
boards['directory-default'] = page({
  title: 'Proof 1 — People directory, default',
  kicker: 'Phase 5A People · proof 1',
  heading: 'The directory as it first loads',
  intro: 'Handoff §3 and §9.1. Sign first, because that is what a visitor to an astrology site is actually browsing by. No ranking, no trending, no infinite feed. Every tile carries the sourced date and the identifying line; the count line states the unknown-time truth once, for the whole set.',
  body: board(
    '<strong>Default.</strong> H1, lede, sign rail (twelve canonical pastel discs), discipline chips, name filter, count line. Nine of the twenty tiles shown; the live directory renders all twenty.',
    `    <div class="surface surface--wide">
      <span class="kicker">People</span>
      <h1 class="display">People</h1>
      <p class="lede" style="margin-top:10px;max-width:60ch">Charts for people whose birth dates are a matter of public record. Each one is computed here, from a sourced date, with the parts we cannot know left visibly empty.</p>
      <p class="mono--label mono" style="margin:18px 0 7px">By sign</p>
      <div class="disc-rail">${SIGNS.map((sign) => disc(sign, 46)).join('')}</div>
      <p class="mono--label mono" style="margin:12px 0 7px">By discipline</p>
      <div class="chips">${['science', 'writing', 'music', 'art', 'architecture', 'sport', 'public life'].map((item) => `<span class="chip">${item}</span>`).join('')}</div>
      <div class="field" style="margin-top:16px;max-width:340px">
        <label for="find">Find a name</label>
        <div class="input" id="find">Start typing a name…</div>
      </div>
      <p class="mono">20 people. All birth times unknown unless a page says otherwise.</p>
      <div class="dir-grid" style="margin-top:14px">
${['ada-lovelace', 'ella-fitzgerald', 'frida-kahlo', 'katherine-johnson', 'rosalind-franklin', 'serena-williams', 'virginia-woolf', 'zaha-hadid', 'walt-whitman'].map((slug) => tile(people[slug])).join('\n')}
      </div>
      <p class="fine" style="margin-top:16px">Something wrong on one of these pages? <a href="mailto:people@zodiacs.org">Ask us to correct or remove it</a>.</p>
    </div>`,
  ),
});

/* ── 2. Directory, filtered ─────────────────────────────────────────── */
boards['directory-filtered'] = page({
  title: 'Proof 2 — People directory, filtered',
  kicker: 'Phase 5A People · proof 2',
  heading: 'A filter applied, and the way back out',
  intro: 'Handoff §9.2. The applied filter is a chip with its own clear control; the result line counts against the total so the reader always knows how much they are not seeing. Without JavaScript this is a link to <code>/people/?sign=leo</code>, server-rendered — see proof 15.',
  body: board(
    '<strong>Filtered: Leo.</strong> The rail marks the active disc, the chip carries a clear control, and the count is stated against the total. Both Leo people are 102 years apart — the era-separation rule doing its visible work.',
    `    <div class="surface surface--wide">
      <h1 class="display" style="font-size:30px">People</h1>
      <p class="mono--label mono" style="margin:16px 0 7px">By sign</p>
      <div class="disc-rail">${SIGNS.map((sign) => disc(sign, 46, sign === 'leo' ? 'is-on' : '')).join('')}</div>
      <div class="chips" style="margin-top:14px">
        <span class="chip chip--on">Leo <span class="x">✕</span></span>
        <span class="chip">Clear Leo</span>
      </div>
      <p class="mono" style="margin-top:14px">2 of 20 people.</p>
      <div class="dir-grid" style="margin-top:10px">
${['emily-bronte', 'rosalind-franklin'].map((slug) => tile(people[slug])).join('\n')}
      </div>
      <div class="btn-row" style="margin-top:16px"><span class="btn btn--ghost">Show everyone</span></div>
    </div>`,
  ),
});

/* ── 3. Directory, empty ────────────────────────────────────────────── */
boards['directory-empty'] = page({
  title: 'Proof 3 — People directory, no results',
  kicker: 'Phase 5A People · proof 3',
  heading: 'Nothing matches — composed, not apologetic',
  intro: 'Handoff §9.3. The empty state explains the real reason the directory is small (every person was researched one at a time) instead of implying the reader made a mistake. One way out, clearly labelled.',
  body: board(
    '<strong>Empty result.</strong> Filters remain visible and clearable above the message, so the reader can see exactly what produced the emptiness.',
    `    <div class="surface surface--wide">
      <h1 class="display" style="font-size:30px">People</h1>
      <div class="chips" style="margin-top:14px">
        <span class="chip chip--on">Aquarius <span class="x">✕</span></span>
        <span class="chip chip--on">Music <span class="x">✕</span></span>
      </div>
      <p class="mono" style="margin-top:14px">0 of 20 people.</p>
      <div class="notice" style="margin-top:12px">
        <h3>Nothing matches that yet.</h3>
        <p>This directory is small on purpose — every person here was researched and reviewed one at a time. Try another sign, or clear the filters.</p>
        <div class="btn-row"><span class="btn btn--primary">Show everyone</span></div>
      </div>
    </div>`,
  ),
});

/* ── 4. Exact-time design fixture ───────────────────────────────────── */
boards['profile-exact-fixture'] = page({
  title: 'Proof 4 — Exact-time profile (design fixture)',
  kicker: 'Phase 5A People · proof 4',
  heading: 'What an exact birth time would add',
  intro: 'Handoff §9.7. <strong>No allowed source publishes a birth time for any of the twenty pilot people</strong>, so this state cannot be shown with real sourced data. It uses the repository’s existing non-production fixture values and is labelled as a design fixture in the board and in the page chrome itself. It appears in no manifest, no directory and no index.',
  body: board(
    '<strong>Design fixture.</strong> The only board on this page that is not real sourced data. The label is part of the page, not the board chrome — a fixture that can be mistaken for a person is a defect.',
    `    <div class="surface">
      <span class="tag tag--warn">Design fixture — not a real person</span>
      <div class="person-head">
        <div class="person-head__body">
          ${disc('gemini', 62, 'person-head__disc')}
          <h1 class="display">Design fixture</h1>
          <p class="identity">Repository test values · 1990-06-15, 08:30 · New York</p>
          <p class="mono" style="margin-top:8px">Gemini 24.3° · Rising Leo 14.8°</p>
        </div>
      </div>
      <div class="quality" style="--sign: var(--gemini)">
        <strong>Birth date and time sourced.</strong>
        <span>With an hour, the chart gains its rising sign, houses and angles. Nothing on this page is about a real person.</span>
      </div>
      <div class="read">
        <div class="read__block">
          <h3>What the hour adds</h3>
          <p>An exact time fixes the ascendant, and with it the whole house framework — which part of life each planet is read as furnishing. It also settles the Moon to a degree rather than a neighbourhood, and it makes sect meaningful: whether the Sun was above or below the horizon, which the tradition treats as the chart’s basic temperature.</p>
        </div>
        <div class="read__block">
          <h3>Why the pilot has none of this</h3>
          <p>Twenty people were researched for the pilot and not one has a published birth time in Wikidata or Wikipedia. Astrology sites often carry times for public figures; this site does not use those sources, so the honest position is that the hour is unknown and the houses stay absent.</p>
        </div>
      </div>
    </div>`,
  ),
});

/* ── 5. Unknown-time profile (real) ─────────────────────────────────── */
{
  const person = people['vincent-van-gogh'];
  boards['profile-unknown-time'] = page({
    title: 'Proof 5 — Unknown-time profile (real pilot record)',
    kicker: 'Phase 5A People · proof 5',
    heading: 'The pilot’s normal state, with real sourced data',
    intro: 'Handoff §9.4. Every word of the reading below was composed from this record’s own computed facts. The reading comes first; the machinery is one closed disclosure away. There is no house ring on the wheel because there are no houses — absent, not empty.',
    body: board(
      `<strong>Vincent van Gogh · ${person.qid}.</strong> Sun ${person.sunSign.degree.toFixed(2)}° ${SIGN_NAMES[person.sunSign.slug]}, Moon settled, no licensed portrait (the Commons credit names the subject — handoff §10 rule 4). ${copy['vincent-van-gogh'].measurements.originalWords} original words, ${copy['vincent-van-gogh'].measurements.substantiveStatements} substantive statements.`,
      `    <div class="surface">
      ${personHead(person)}
      ${qualityBlock(person)}
      <p class="lede">${escape(copy['vincent-van-gogh'].lede)}</p>
      ${wheel(person)}
      ${readingBlocks('vincent-van-gogh')}
      <div class="btn-row" style="margin-top:18px">
        <a class="btn btn--ghost" href="#">Everyone born on ${birthdayLabel(person.birthDate.displayedDate)}</a>
        <a class="btn btn--text" href="#">The Aries guide</a>
      </div>
      ${disclosureRows(person)}
    </div>`,
    ),
  });
}

/* ── 6. Uncertain Moon (real) ───────────────────────────────────────── */
{
  const person = people['katherine-johnson'];
  const moonBlock = copy['katherine-johnson'].blocks.find((block) => block.key === 'moon');
  boards['profile-uncertain-moon'] = page({
    title: 'Proof 6 — Uncertain Moon',
    kicker: 'Phase 5A People · proof 6',
    heading: 'When the Moon changed sign during the day',
    intro: 'Handoff §9.5. Eleven of the twenty pilot people have this state, so it is designed as ordinary rather than as a warning. The label gains a third clause, the Moon block replaces the settled one, and no sign is chosen. The screen-reader wording reads the whole sentence — no symbol carries the meaning.',
    body: board(
      `<strong>Katherine Johnson · ${person.qid}.</strong> The Moon crossed ${SIGN_NAMES[person.moon.signAtCivilDayStart]} → ${SIGN_NAMES[person.moon.signAtCivilDayEnd]} across the civil day at the birthplace, travelling ${person.unknownTimeErrorBandDegrees.Moon.toFixed(2)}°. Eleven of twenty pilot records land here.`,
      `    <div class="surface">
      ${personHead(person)}
      ${qualityBlock(person)}
      <p class="lede">${escape(copy['katherine-johnson'].lede)}</p>
      <div class="read">
        <div class="read__block">
          <h3>${escape(moonBlock.title)}</h3>
          <p>${escape(moonBlock.text)}</p>
        </div>
        ${copy['katherine-johnson'].blocks.filter((block) => block.key !== 'moon').slice(0, 2).map((block) => `<div class="read__block">
          <h3>${escape(block.title)}</h3>
          <p>${escape(block.text)}</p>
        </div>`).join('\n        ')}
      </div>
      <p class="fine" style="margin-top:14px">Announced to a screen reader as: “Moon sign undetermined. The Moon crossed from ${SIGN_NAMES[person.moon.signAtCivilDayStart]} into ${SIGN_NAMES[person.moon.signAtCivilDayEnd]} during that day.”</p>
      ${disclosureRows(person)}
    </div>`,
    ),
  });
}

/* ── 7. Cusp-uncertain (designed; excluded from the pilot) ──────────── */
{
  const row = byScreen['srinivasa-ramanujan'];
  boards['profile-cusp-uncertain'] = page({
    title: 'Proof 7 — Cusp-uncertain state',
    kicker: 'Phase 5A People · proof 7',
    heading: 'Both signs, at equal weight',
    intro: 'Handoff §8 and §9.6. <strong>No pilot record is cusp-ambiguous</strong> — the rule excludes them. This board designs the state anyway, because roughly one date in twelve carries a solar ingress and the expansion will meet it constantly. The figures are the real screening output for an excluded candidate; no such page would be published in Phase 5A.',
    body: board(
      `<strong>State design, not a pilot page.</strong> Real screening data: solar ingress ${row.cusp.fromSign} → ${row.cusp.toSign} at ${row.cusp.boundaryUtc} (shown to the reader as ${toMinuteUtc(row.cusp.boundaryUtc)}), inside the 24-hour UTC window of ${row.gregorianDate}. Excluded by the rule; never indexable even if published.`,
      `    <div class="surface">
      <span class="tag">State design · this candidate is excluded from the pilot</span>
      <div class="dual" style="margin-bottom:12px">
        ${disc(row.cusp.fromSign, 52)}${disc(row.cusp.toSign, 52)}
      </div>
      <h1 class="display">Srinivasa Ramanujan</h1>
      <p class="identity">Mathematician · India · 1887–1920</p>
      <div class="quality" style="--sign: var(--${row.cusp.toSign})">
        <strong>Birth date sourced. Sun sign undetermined.</strong>
        <span>The Sun crossed signs during the day this person was born, and the hour is not recorded.</span>
      </div>
      <div class="read">
        <div class="read__block">
          <h3>Two signs, and the day cannot choose</h3>
          <p>The Sun crossed from ${SIGN_NAMES[row.cusp.fromSign]} into ${SIGN_NAMES[row.cusp.toSign]} at ${toMinuteUtc(row.cusp.boundaryUtc)} — inside the day Srinivasa Ramanujan was born. Which sign the Sun was in depends on the hour, and the hour is not recorded. Both discs are shown at equal weight because the honest answer is both.</p>
        </div>
        <div class="read__block">
          <h3>What can still be said</h3>
          <p>Everything that does not depend on which side the Sun fell: the slower placements, the aspects that hold across the whole day, and the classical dignities of the planets whose signs never changed. The Sun’s own degree is given as a range rather than a number.</p>
        </div>
      </div>
      <p class="fine" style="margin-top:14px"><strong>Index consequence:</strong> this page is not listed in search. Its central fact is undetermined.</p>
    </div>`,
    ),
  });
}

/* ── 8. Dual date (Option B, specified but inactive) ────────────────── */
{
  const row = byScreen['johann-sebastian-bach'];
  boards['profile-dual-date'] = page({
    title: 'Proof 8 — Dual-date state (Option B, specified not active)',
    kicker: 'Phase 5A People · proof 8',
    heading: 'Old Style, New Style, and which one the chart uses',
    intro: 'Handoff §6 and §9.8. Phase 5A adopts <strong>Option A — exclude</strong>, so no Julian-dated birth is in the pilot. This board renders the Option B treatment so the expansion inherits a decision instead of rediscovering the problem. The figures are the real screening output for an excluded candidate.',
    body: board(
      `<strong>Specified, not active.</strong> Real screening data: stored ${row.storedDate} (${row.calendarModel}), which converts to ${row.gregorianDate} proleptic Gregorian — ten days apart. Under Option B the displayed date and the birthday cross-link use the stated date; the chart uses the converted instant.`,
      `    <div class="surface">
      <span class="tag">Option B · specified for the expansion, not active in Phase 5A</span>
      ${disc('aries', 62, 'person-head__disc')}
      <h1 class="display">Johann Sebastian Bach</h1>
      <p class="identity">Composer · Germany · 1685–1750</p>
      <p class="mono" style="margin-top:8px">Born ${longDate(row.storedDate)} (Old Style)</p>
      <div class="quality" style="--sign: var(--aries)">
        <strong>Birth date sourced, Old Style.</strong>
        <span>The stated date and the computed moment sit in two different calendars. Both are shown.</span>
      </div>
      <div class="read">
        <div class="read__block">
          <h3>Two calendars, one moment</h3>
          <p>Johann Sebastian Bach’s birth was recorded as ${longDate(row.storedDate)} in the Julian calendar, which was still in local use. The same moment is ${longDate(row.gregorianDate)} in the calendar we use now — the two run ten days apart. The date shown is the one that was written down; the chart is computed from the moment it names.</p>
        </div>
      </div>
      <div class="disclosure">
        <div class="disclosure__summary"><span><strong>Where this comes from</strong><small>Both dates, and which key each surface uses</small></span><span class="disclosure__mark">−</span></div>
        <dl class="rows">
          <div class="row"><dt>Stated date</dt><dd>${row.storedDate} · Julian, as recorded</dd></div>
          <div class="row"><dt>Calendar model</dt><dd>proleptic-julian</dd></div>
          <div class="row"><dt>Converted instant</dt><dd>${row.gregorianDate} · proleptic Gregorian</dd></div>
          <div class="row"><dt>Conversion</dt><dd>Julian date → Julian Day Number → proleptic Gregorian</dd></div>
          <div class="row"><dt>Displayed date</dt><dd>${row.storedDate} · the historically stated date</dd></div>
          <div class="row"><dt>Birthday cross-link</dt><dd>/birthday/march-21/ · keyed to the stated date</dd></div>
          <div class="row"><dt>Chart computed from</dt><dd>${row.gregorianDate}, noon civil time at the birthplace</dd></div>
        </dl>
      </div>
    </div>`,
    ),
  });
}

/* ── 9. Provenance expanded (real, with coordinate escalation) ──────── */
{
  const person = people['frida-kahlo'];
  boards['provenance-expanded'] = page({
    title: 'Proof 9 — Evidence disclosure, expanded',
    kicker: 'Phase 5A People · proof 9',
    heading: 'Everything the page assumed, in one open panel',
    intro: 'Handoff §9.14. The existing <code>EvidenceDisclosure</code> pattern, closed by default and opened here. This record is the pilot’s single coordinate-escalation case: Coyoacán carries no coordinate claim, so Mexico City’s are used and the downgrade is stated in the panel rather than hidden in a field.',
    body: board(
      `<strong>Frida Kahlo · ${person.qid}.</strong> Sources with revision ids, retrieval time, calendar model, the escalated coordinate with its reason, the resolved historical offset (${person.computation.utcOffsetMinutesAtBirth} minutes — local mean time, pre-standardisation), what was omitted and why, and the correction route.`,
      `    <div class="surface">
      ${personHead(person)}
      ${qualityBlock(person)}
      ${disclosureRows(person, { open: true })}
    </div>`,
    ),
  });
}

/* ── 10. Missing portrait ───────────────────────────────────────────── */
boards['portrait-missing'] = page({
  title: 'Proof 10 — No licensed portrait',
  kicker: 'Phase 5A People · proof 10',
  heading: 'When there is no portrait we can publish',
  intro: 'Handoff §9.12 and §10. No placeholder silhouette, no initials block, no generated likeness. The pastel Sun disc grows to 96 px and the space the portrait would have taken simply is not there. Three of the twenty pilot records land here, each for a different fail-closed reason.',
  body: board(
    '<strong>Two of the three real cases.</strong> Zaha Hadid’s Commons file is licensed FAL, outside the accepted set. Vincent van Gogh’s file records the subject as its creator, so a credit would misstate who licensed the reproduction. Both reasons are recorded on the record and shown in the disclosure.',
    `    <div class="surface surface--narrow">
      <div class="person-head">
        <div class="person-head__body">
          ${disc('scorpio', 96, 'person-head__disc person-head__disc--large')}
          <h1 class="display" style="font-size:30px">Zaha Hadid</h1>
          <p class="identity">${escape(people['zaha-hadid'].shortDescription)}</p>
          <p class="mono" style="margin-top:8px">Scorpio ${people['zaha-hadid'].sunSign.degree.toFixed(1)}° · born ${longDate(people['zaha-hadid'].birthDate.displayedDate)}</p>
        </div>
      </div>
      <p class="fine" style="margin-top:14px">No portrait: licence “FAL” is outside the accepted set.</p>
    </div>
    <div class="surface surface--narrow">
      <div class="person-head">
        <div class="person-head__body">
          ${disc('aries', 96, 'person-head__disc person-head__disc--large')}
          <h1 class="display" style="font-size:30px">Vincent van Gogh</h1>
          <p class="identity">${escape(people['vincent-van-gogh'].shortDescription)}</p>
          <p class="mono" style="margin-top:8px">Aries ${people['vincent-van-gogh'].sunSign.degree.toFixed(1)}° · born ${longDate(people['vincent-van-gogh'].birthDate.displayedDate)}</p>
        </div>
      </div>
      <p class="fine" style="margin-top:14px">No portrait: the recorded creator is the subject, so the licence holder of the reproduction cannot be credited accurately.</p>
    </div>`,
  ),
});

/* ── 11. Portrait with rendered attribution ─────────────────────────── */
boards['portrait-attribution'] = page({
  title: 'Proof 11 — Portrait with rendered licence attribution',
  kicker: 'Phase 5A People · proof 11',
  heading: 'The credit is part of the image, not part of the metadata',
  intro: 'Handoff §9.13 and §10. CC BY and CC BY-SA place an obligation on the published page, so the credit renders below every portrait, always visible, never hover-only, and inside the image lockup so it cannot be cropped away. Public-domain files are credited too — the obligation differs, the courtesy does not.',
  body: board(
    '<strong>Both licence classes, real files.</strong> Ada Lovelace: public domain, creator linked to the file page. Rosalind Franklin: CC BY-SA 4.0, creator plus a licence-deed link plus the source. On a share card that cannot carry a legible credit, the portrait is dropped and the pastel disc is used instead.',
    `    <div class="surface">
      ${personHead(people['ada-lovelace'], { portrait: PORTRAITS['ada-lovelace'] })}
      ${qualityBlock(people['ada-lovelace'])}
    </div>
    <div class="surface">
      ${personHead(people['rosalind-franklin'], { portrait: PORTRAITS['rosalind-franklin'] })}
      ${qualityBlock(people['rosalind-franklin'])}
    </div>`,
  ),
});

/* ── 12. Birthday cross-link, both directions ───────────────────────── */
{
  const person = people['ada-lovelace'];
  boards['birthday-crosslink'] = page({
    title: 'Proof 12 — Birthday cross-link and related people',
    kicker: 'Phase 5A People · proof 12',
    heading: 'Both directions, and the cap that keeps it quiet',
    intro: 'Handoff §17. Person → birthday uses the Gregorian date; all twenty pilot links resolve against committed pages. Birthday → person is a capped list of at most three names, omitted entirely when no person matches — the existing 366 birthday pages gain nothing else.',
    body: board(
      `<strong>Ada Lovelace → /birthday/december-10/ → back.</strong> Related people are at most three same-sign names, as a plain list. There is no carousel: that is this phase’s removed accessory (handoff §14).`,
      `    <div class="surface">
      <span class="tag">On the person page</span>
      <h2 class="display">Ada Lovelace</h2>
      <div class="btn-row" style="margin-top:14px">
        <a class="btn btn--ghost" href="#">Everyone born on ${birthdayLabel(person.birthDate.displayedDate)}</a>
        <a class="btn btn--text" href="#">The Sagittarius guide</a>
      </div>
      <p class="mono--label mono" style="margin:20px 0 8px">Also Sagittarius</p>
      <p class="fine" style="margin:0">The pilot has one Sagittarius, so this list is empty and the whole block is omitted rather than shown empty.</p>
    </div>
    <div class="surface">
      <span class="tag">On the existing birthday page</span>
      <h2 class="display">Born on December 10</h2>
      <p class="fine" style="margin-top:8px">The birthday page is unchanged except for this one block, appended after the reading.</p>
      <p class="mono--label mono" style="margin:18px 0 8px">People born on this date</p>
      <div class="dir-grid">${tile(person)}</div>
      <p class="fine" style="margin-top:12px">Capped at three. Absent entirely when no person in the manifest matches the date.</p>
    </div>`,
    ),
  });
}

/* ── 13. Share sheet ────────────────────────────────────────────────── */
boards['share-sheet'] = page({
  title: 'Proof 13 — Share sheet',
  kicker: 'Phase 5A People · proof 13',
  heading: 'Sharing a chart, not a person',
  intro: 'Handoff §9.15. The share text names the chart and its sourcing, never a claim about the person. The card carries no portrait unless the file is public domain or CC0 — an attribution cannot be relied on to travel with an image once it leaves the page.',
  body: board(
    '<strong>Share row and sheet.</strong> Existing <code>ShareRow</code> pattern. Copy link, share sheet, download card. Nothing here uploads anything: the card is rendered client-side, as it is everywhere else on the site.',
    `    <div class="surface surface--narrow">
      <div class="sheet">
        <span class="kicker">Share</span>
        <h3 style="margin:0">Ada Lovelace’s chart</h3>
        <p class="fine" style="margin:0">“Ada Lovelace’s chart, computed from a sourced birth date”</p>
        <div class="input" style="font-family:var(--mono);font-size:11.5px">https://zodiacs.org/people/ada-lovelace/</div>
        <div class="btn-row">
          <span class="btn btn--primary">Share</span>
          <span class="btn btn--ghost">Copy link</span>
          <span class="btn btn--ghost">Download the card</span>
        </div>
        <p class="fine" style="margin:0">The card shows the pastel sign disc, not the portrait — a licence credit cannot be relied on to travel with an image.</p>
      </div>
    </div>`,
  ),
});

/* ── 14. OG card ────────────────────────────────────────────────────── */
boards['og-card'] = page({
  title: 'Proof 14 — Open Graph card',
  kicker: 'Phase 5A People · proof 14',
  heading: 'The card, at its canonical share size',
  intro: 'Handoff §9.15 and §17. 1200×630 in the existing v2 card language, generated by <code>scripts/build-og-void.mjs</code> and verified by <code>scripts/verify-og-cards.mjs</code>. Name, pastel disc, exact Sun degree, and the unknown-time truth stated on the card itself so it travels with the image.',
  body: board(
    '<strong>1200×630, rendered here at 600 px wide.</strong> This is the only board rendered once rather than at four widths: a share card has one canonical size.',
    `    <div class="og">
      <div class="og__top">
        <div>
          <p class="og__sub">Zodiacs.org · People</p>
          <h2 class="og__name">Ada Lovelace</h2>
        </div>
        ${disc('sagittarius', 84)}
      </div>
      <p style="font-size:17px;color:#8E96AB;margin:0;max-width:34ch;line-height:1.45">${escape(people['ada-lovelace'].shortDescription)}</p>
      <div class="og__foot">
        <span>Sagittarius ${people['ada-lovelace'].sunSign.degree.toFixed(1)}°</span>
        <span>Birth time unknown</span>
      </div>
    </div>`,
  ),
});

/* ── 15. No JavaScript ──────────────────────────────────────────────── */
boards['no-javascript'] = page({
  title: 'Proof 15 — No JavaScript',
  kicker: 'Phase 5A People · proof 15',
  heading: 'Everything that matters is in the HTML',
  intro: 'Handoff §15. The directory, every filter result, every person page, the chart wheel (server-rendered SVG), the data-quality label and the evidence disclosure all work without JavaScript. Filters are real links; the disclosure is a native <code>&lt;details&gt;</code>. Only the type-ahead field needs JS, and it is hidden without it.',
  body: board(
    '<strong>Directory without JS.</strong> Each sign disc is an anchor to a server-rendered URL. The name field is absent rather than present-and-dead.',
    `    <div class="surface surface--wide">
      <h1 class="display" style="font-size:30px">People</h1>
      <p class="mono--label mono" style="margin:16px 0 7px">By sign — each disc is a link</p>
      <div class="disc-rail">${SIGNS.map((sign) => disc(sign, 46)).join('')}</div>
      <p class="mono" style="margin-top:8px">/people/?sign=leo · /people/?sign=virgo · … each rendered on the server</p>
      <p class="fine">The “Find a name” field is not rendered at all without JavaScript. A dead input is worse than an absent one.</p>
      <div class="dir-grid" style="margin-top:12px">${['emily-bronte', 'clara-schumann'].map((slug) => tile(people[slug])).join('\n')}</div>
    </div>`,
  ) + board(
    '<strong>Person page without JS.</strong> The reading, the wheel, the label and the disclosure are all server-rendered. The disclosure is a native details element, open here by keyboard alone.',
    `    <div class="surface">
      ${personHead(people['emily-bronte'])}
      ${qualityBlock(people['emily-bronte'])}
      <p class="lede">${escape(copy['emily-bronte'].lede)}</p>
      ${wheel(people['emily-bronte'])}
      ${disclosureRows(people['emily-bronte'], { open: true })}
    </div>`,
  ),
});

/* ── 16. Withheld ───────────────────────────────────────────────────── */
boards.withheld = page({
  title: 'Proof 16 — Withheld at the subject’s request',
  kicker: 'Phase 5A People · proof 16',
  heading: 'Unlisted, without a word against the subject',
  intro: 'Handoff §9.11 and §13. A withheld page still resolves and still reads normally; it is out of search, out of the sitemap and out of the birthday cross-link. The copy is explicit that the request implies nothing about the subject — the whole point of the state is that asking to be delisted is not an admission of anything.',
  body: board(
    '<strong>Withheld (noindex).</strong> The name shown is a placeholder for the board only. After a full removal the route returns 410 Gone and every generated surface drops the record, with the decision retained so a later ingestion pass cannot reinstate it.',
    `    <div class="surface">
      <div class="notice">
        <h3>This page is not listed</h3>
        <p>At the subject’s request, this page is no longer listed in search or in the directory. Nothing about that request implies anything about the subject.</p>
      </div>
      <div style="margin-top:18px">
        ${disc('libra', 62, 'person-head__disc')}
        <h1 class="display" style="font-size:30px">[Subject name]</h1>
        <p class="identity">The page renders normally below this point.</p>
      </div>
      <div class="disclosure" style="margin-top:16px">
        <div class="disclosure__summary"><span><strong>Where this comes from</strong><small>Sources, revisions, and the withholding record</small></span><span class="disclosure__mark">−</span></div>
        <dl class="rows">
          <div class="row"><dt>Suppression status</dt><dd>noindex · at the subject’s request</dd></div>
          <div class="row"><dt>Removed from</dt><dd>sitemap · search index · birthday cross-link · related-people rails</dd></div>
          <div class="row"><dt>Robots</dt><dd>noindex, nofollow</dd></div>
          <div class="row"><dt>On full removal</dt><dd>route returns 410 Gone; OG asset deleted; decision retained permanently</dd></div>
        </dl>
      </div>
    </div>`,
  ),
});

/* ── 17. Conflicting evidence (real screening data) ─────────────────── */
{
  const row = byScreen['umm-kulthum'];
  const dates = row.reasons[0].match(/(\d{4}-\d{2}-\d{2}) vs (\d{4}-\d{2}-\d{2})/u);
  boards['conflicting-evidence'] = page({
    title: 'Proof 17 — Conflicting evidence',
    kicker: 'Phase 5A People · proof 17',
    heading: 'Two dates, and no way to choose between them',
    intro: 'Handoff §9.10. Both live values are shown and no chart is computed from either. This is a real screening result: the candidate carries two non-deprecated day-precision birth dates on Wikidata, neither marked superseded. Never indexable, and never resolved by picking the likelier one.',
    body: board(
      `<strong>Real screening data.</strong> ${escape(row.displayName)} · ${row.qid} · ${escape(row.reasons[0])}. Excluded from the pilot by the rule; this board designs the state the expansion will need.`,
      `    <div class="surface">
      <span class="tag">State design · this candidate is excluded from the pilot</span>
      <h1 class="display" style="font-size:30px">${escape(row.displayName)}</h1>
      <div class="notice" style="margin-top:14px">
        <h3>The sources disagree</h3>
        <p>Two different birth dates are on the public record for ${escape(row.displayName)}: ${longDate(dates[1])} and ${longDate(dates[2])}. Neither is marked as superseded, and we have no way to choose between them from the sources this site allows. Both are shown; no chart is computed from either.</p>
      </div>
      <dl class="rows" style="margin-top:16px">
        <div class="row"><dt>Value A</dt><dd>${dates[1]} · day precision · proleptic Gregorian · normal rank</dd></div>
        <div class="row"><dt>Value B</dt><dd>${dates[2]} · day precision · proleptic Gregorian · normal rank</dd></div>
        <div class="row"><dt>Chart</dt><dd>not computed</dd></div>
        <div class="row"><dt>Sun sign</dt><dd>not stated</dd></div>
        <div class="row"><dt>Indexable</dt><dd>no</dd></div>
      </dl>
    </div>`,
    ),
  });
}

/* ── 18. Broken image and offline ───────────────────────────────────── */
boards['error-states'] = page({
  title: 'Proof 18 — Broken image and offline',
  kicker: 'Phase 5A People · proof 18',
  heading: 'Two failures that should not look like failures',
  intro: 'Handoff §9.16. A portrait that fails to load removes its own figure and falls back to the no-portrait lockup — no broken-image icon, no empty box. Offline, the person page is ordinary static HTML: the positions are already in the document, so nothing about the reading needs the network.',
  body: board(
    '<strong>Broken portrait.</strong> Left: what the browser would show without handling. Right: the fallback, which is simply the no-portrait lockup from proof 10.',
    `    <div class="surface surface--narrow">
      <span class="tag">Unhandled — never shipped</span>
      <div class="person-head">
        <div class="broken">image failed<br>to load</div>
        <div class="person-head__body">
          <h1 class="display" style="font-size:26px">Rosalind Franklin</h1>
          <p class="identity">${escape(people['rosalind-franklin'].shortDescription)}</p>
        </div>
      </div>
    </div>
    <div class="surface surface--narrow">
      <span class="tag">Shipped fallback</span>
      <div class="person-head">
        <div class="person-head__body">
          ${disc('leo', 96, 'person-head__disc person-head__disc--large')}
          <h1 class="display" style="font-size:26px">Rosalind Franklin</h1>
          <p class="identity">${escape(people['rosalind-franklin'].shortDescription)}</p>
        </div>
      </div>
    </div>`,
  ) + board(
    '<strong>Offline.</strong> The existing service worker is network-first for HTML and serves its offline fallback. A person page already in the cache reads completely, because the chart is in the HTML rather than fetched.',
    `    <div class="surface">
      <div class="notice">
        <h3>You are offline</h3>
        <p>This page was already saved on this device, so it reads in full. Anything you have not visited yet will need a connection.</p>
      </div>
      <div style="margin-top:16px">
        ${personHead(people['clara-schumann'])}
        ${qualityBlock(people['clara-schumann'])}
        <p class="lede">${escape(copy['clara-schumann'].lede)}</p>
      </div>
    </div>`,
  ),
});

/* ── 19. Reduced motion ─────────────────────────────────────────────── */
boards['reduced-motion'] = page({
  title: 'Proof 19 — Reduced motion, settled',
  kicker: 'Phase 5A People · proof 19',
  heading: 'The whole page, final on first paint',
  intro: 'Handoff §14. Under <code>prefers-reduced-motion: reduce</code> the one orchestrated moment — the chart wheel’s entrance — does not play, and every element renders at its final position and opacity. Nothing on the page depends on an animation completing, so there is no state a reduced-motion visitor can fail to reach.',
  body: board(
    '<strong>Settled render.</strong> Captured with reduced motion forced. Identical in content to proof 5; the difference is that no transition ever ran.',
    `    <div class="surface">
      ${personHead(people['serena-williams'])}
      ${qualityBlock(people['serena-williams'])}
      <p class="lede">${escape(copy['serena-williams'].lede)}</p>
      ${wheel(people['serena-williams'])}
      ${readingBlocks('serena-williams', 2)}
    </div>`,
  ),
});

/* ── 20. Keyboard focus ─────────────────────────────────────────────── */
boards['keyboard-focus'] = page({
  title: 'Proof 20 — Keyboard focus traversal',
  kicker: 'Phase 5A People · proof 20',
  heading: 'Every control reachable, every ring visible',
  intro: 'Handoff §15. Tab order follows reading order. The focus ring is the site’s existing 2 px outline at 3 px offset, drawn here on each control in sequence. Minimum target 44×44 px. The evidence disclosure opens from the keyboard because it is a native <code>&lt;details&gt;</code>, not a scripted panel.',
  body: board(
    '<strong>Tab sequence on a person page.</strong> 1 skip link → 2 sign disc link → 3 birthday cross-link → 4 sign guide → 5 disclosure summary → 6 correction link → 7 share.',
    `    <div class="surface">
      <div class="btn-row" style="margin-bottom:16px"><span class="btn btn--ghost focused">Skip to the reading<span class="focus-tag">1</span></span></div>
      ${personHead(people['walt-whitman'])}
      <div class="btn-row" style="margin-top:16px">
        <a class="btn btn--ghost focused" href="#">Everyone born on May 31<span class="focus-tag">3</span></a>
        <a class="btn btn--text focused" href="#">The Gemini guide<span class="focus-tag">4</span></a>
      </div>
      <div class="disclosure focused" style="margin-top:16px">
        <div class="disclosure__summary"><span><strong>Where this comes from<span class="focus-tag">5</span></strong><small>Opens with Enter or Space — a native details element</small></span><span class="disclosure__mark">+</span></div>
      </div>
      <p class="fine" style="margin-top:14px"><a class="focused" href="mailto:people@zodiacs.org">Ask us to correct or remove it<span class="focus-tag">6</span></a></p>
      <div class="btn-row"><span class="btn btn--primary focused">Share<span class="focus-tag">7</span></span></div>
    </div>`,
  ),
});

/* ── 21. 200% zoom ──────────────────────────────────────────────────── */
boards['zoom-200'] = page({
  title: 'Proof 21 — 200% zoom reflow',
  kicker: 'Phase 5A People · proof 21',
  heading: 'Doubled, and still one column with no sideways scroll',
  intro: 'Handoff §15. Captured at double device pixel ratio with a halved viewport, which is what 200% zoom actually produces. Data rows wrap to two lines rather than truncating, the portrait lockup stacks, and no control is clipped.',
  body: board(
    '<strong>200% zoom.</strong> The disclosure rows are the tightest element — they drop their two-column grid below 560 px and stack label above value.',
    `    <div class="surface">
      ${personHead(people['rigoberta-menchu'])}
      ${qualityBlock(people['rigoberta-menchu'])}
      <p class="lede">${escape(copy['rigoberta-menchu'].lede)}</p>
      ${disclosureRows(people['rigoberta-menchu'], { open: true })}
    </div>`,
  ),
});

let count = 0;
for (const [name, html] of Object.entries(boards)) {
  // Empty optional partials leave indentation-only lines; strip trailing
  // whitespace so `git diff --check` stays clean.
  await writeFile(join(OUT, `${name}.html`), html.replace(/[ \t]+$/gmu, ''), 'utf8');
  count += 1;
}
console.log(`Wrote ${count} proof boards to docs/acceptance/phase5-people/`);
console.log(Object.keys(boards).join('\n'));
