/**
 * Build-time Verified Sky Badge derived from src/data/accuracy/latest.json.
 * Pure functions: snapshot + build date in, badge state, SVG and JSON out.
 */

const DAY_MS = 86_400_000;
const MAX_FRESH_DAYS = 14;
const MONTHS = Object.freeze([
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);

/**
 * Colours taken directly from src/styles/tokens.css (DESIGN.md Cosmic Void palette).
 * Every pair exceeds WCAG 2.2 AA 4.5:1 contrast and keeps its own background so
 * the badge reads on both light and dark surfaces.
 */
export const BADGE_COLORS = Object.freeze({
  leftBg: '#0F121A', // --void-2
  leftText: '#EEF1F7', // --ink-0
  passBg: '#B9D4BE', // --sign-taurus (used only in the pass state)
  passText: '#060709', // --void-0
  neutralBg: '#1C2130', // --void-4 (used for stale and attention; never red or green)
  neutralText: '#EEF1F7', // --ink-0
});

export const BADGE_RECEIPT_URL = 'https://zodiacs.org/developers/accuracy/';
export const BADGE_SVG_URL = 'https://zodiacs.org/badges/sky-check.svg';
export const BADGE_REFERENCE = 'NASA JPL Horizons';

/**
 * True only for stable semantic versions >= 1.1.0.
 * Prereleases such as 1.1.0-rc.2 are strictly older than 1.1.0 and return false.
 */
export function isEngineAtLeast110(version) {
  if (typeof version !== 'string') return false;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/u.exec(version.trim());
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const prerelease = match[4];
  if (major > 1) return true;
  if (major < 1) return false;
  if (minor > 1) return true;
  if (minor < 1) return false;
  return !prerelease;
}

/** Extract the vendored or semver version string from a package.json dependency spec. */
export function engineVersionFromDependency(spec) {
  if (typeof spec !== 'string') return null;
  const tgz = /zodiacs-engine-(.+)\.tgz$/u.exec(spec.trim());
  if (tgz) return tgz[1];
  const bare = /^[~^]?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/u.exec(spec.trim());
  return bare ? bare[1] : null;
}

function parseUtcDateMs(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const ms = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(ms).toISOString().slice(0, 10);
  return roundTrip === value ? ms : null;
}

export function formatBadgeDate(isoDate) {
  const ms = parseUtcDateMs(isoDate);
  if (ms === null) throw new Error(`Invalid UTC date: ${isoDate}`);
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Compute badge state, strings, JSON payload and SVG markup from an accuracy snapshot.
 * Returns null if the snapshot is missing/invalid or if the snapshot or site engine
 * version is older than stable 1.1.0.
 *
 * @param {any} snapshot
 * @param {Date | string} [today]
 * @param {{ siteEngineVersion?: string | null }} [options]
 */
export function skyCheckBadge(snapshot, today = new Date(), { siteEngineVersion = null } = {}) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const checkedMs = parseUtcDateMs(snapshot.date);
  const todayMs = parseUtcDateMs(today);
  if (checkedMs === null || todayMs === null) return null;

  const engineVersion = snapshot.engine?.version;
  if (!isEngineAtLeast110(engineVersion)) return null;
  if (siteEngineVersion !== null && !isEngineAtLeast110(siteEngineVersion)) return null;

  const suite = snapshot.sets?.suite;
  const rolling = snapshot.sets?.rolling;
  if (
    !suite || !rolling
    || !Number.isInteger(suite.total) || !Number.isInteger(suite.within)
    || !Number.isInteger(rolling.total) || !Number.isInteger(rolling.within)
    || suite.total < 0 || rolling.total < 0
    || suite.within < 0 || rolling.within < 0
    || suite.within > suite.total || rolling.within > rolling.total
  ) {
    return null;
  }

  const within = suite.within + rolling.within;
  const total = suite.total + rolling.total;
  if (total === 0) return null;

  const ageDays = Math.floor((todayMs - checkedMs) / DAY_MS);
  const dateLabel = formatBadgeDate(snapshot.date);
  const left = 'sky positions';

  let state;
  let right;
  if (ageDays > MAX_FRESH_DAYS) {
    state = 'stale';
    right = `last checked ${dateLabel}`;
  } else if (within === total) {
    state = 'pass';
    right = `${within} of ${total} match NASA · ${dateLabel}`;
  } else {
    state = 'attention';
    right = `${within} of ${total} match NASA · ${dateLabel}`;
  }

  const label = `${left}: ${right}`;
  const ephemeris = snapshot.engine?.ephemerides?.[0]?.name ?? 'jpl-de440';
  const json = {
    state,
    checked: snapshot.date,
    within,
    total,
    engine: engineVersion,
    ephemeris,
    reference: BADGE_REFERENCE,
    receipt: BADGE_RECEIPT_URL,
  };
  const svg = renderBadgeSvg({ state, left, right, label });
  return { state, left, right, label, ageDays, json, svg };
}

function escapeXml(text) {
  return String(text)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

function estimateTextWidth(text) {
  // Compact width estimate for 11px sans-serif so text sits comfortably with padding.
  let width = 0;
  for (const ch of text) {
    if (' ilI.,·1'.includes(ch)) width += 3.8;
    else if ('MW'.includes(ch)) width += 9.2;
    else if (/[A-Z]/u.test(ch)) width += 7.2;
    else width += 6.2;
  }
  return Math.ceil(width);
}

export function renderBadgeSvg({ state, left, right, label }) {
  const rightBg = state === 'pass' ? BADGE_COLORS.passBg : BADGE_COLORS.neutralBg;
  const rightText = state === 'pass' ? BADGE_COLORS.passText : BADGE_COLORS.neutralText;
  const leftWidth = estimateTextWidth(left) + 16;
  const rightWidth = estimateTextWidth(right) + 16;
  const totalWidth = leftWidth + rightWidth;
  const height = 22;
  const leftX = (leftWidth / 2).toFixed(1);
  const rightX = (leftWidth + rightWidth / 2).toFixed(1);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" role="img" aria-label="${escapeXml(label)}">`,
    `<title>${escapeXml(label)}</title>`,
    `<rect width="${leftWidth}" height="${height}" fill="${BADGE_COLORS.leftBg}"/>`,
    `<rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${rightBg}"/>`,
    `<g font-family="system-ui,Segoe UI,Helvetica,Arial,sans-serif" font-size="11" text-anchor="middle" dominant-baseline="central">`,
    `<text x="${leftX}" y="11" fill="${BADGE_COLORS.leftText}">${escapeXml(left)}</text>`,
    `<text x="${rightX}" y="11" fill="${rightText}" font-weight="600">${escapeXml(right)}</text>`,
    '</g>',
    '</svg>',
  ].join('');
}

export function badgeEmbedSnippets(badge) {
  const alt = badge.label;
  const markdown = `[![${alt}](${BADGE_SVG_URL})](${BADGE_RECEIPT_URL})`;
  const html = `<a href="${BADGE_RECEIPT_URL}"><img src="${BADGE_SVG_URL}" alt="${escapeXml(alt)}" /></a>`;
  return { markdown, html };
}
