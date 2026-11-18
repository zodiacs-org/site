/**
 * The switches the November 2026 tools ship behind. A flag is on only when its
 * environment variable is exactly '1': unset, empty, '0', 'true' and ' 1' are
 * all off. Pages, the sitemap and the navigation read them at build time
 * (set them in the shell, as plain Node generators do not read .env files);
 * the share function reads the same names from process.env at run time. Every
 * branch that adds one of these tools carries this same file, so the branches
 * merge in any order. Build-time only: never import it from src/server/.
 */
const node: Readonly<Record<string, string | undefined>> = typeof process !== 'undefined' && process.env ? process.env : {};

const BUILD = {
  PUBLIC_YEAR_SCORE_ENABLED: import.meta.env.PUBLIC_YEAR_SCORE_ENABLED ?? node.PUBLIC_YEAR_SCORE_ENABLED,
  PUBLIC_YEAR_PEOPLE_ENABLED: import.meta.env.PUBLIC_YEAR_PEOPLE_ENABLED ?? node.PUBLIC_YEAR_PEOPLE_ENABLED,
  PUBLIC_BIRTHDAY_REPORT_ENABLED: import.meta.env.PUBLIC_BIRTHDAY_REPORT_ENABLED ?? node.PUBLIC_BIRTHDAY_REPORT_ENABLED,
  PUBLIC_SOLAR_RETURN_SHARE_ENABLED: import.meta.env.PUBLIC_SOLAR_RETURN_SHARE_ENABLED ?? node.PUBLIC_SOLAR_RETURN_SHARE_ENABLED,
  PUBLIC_GOOD_DAYS_ENABLED: import.meta.env.PUBLIC_GOOD_DAYS_ENABLED ?? node.PUBLIC_GOOD_DAYS_ENABLED,
  PUBLIC_TAROT_ENABLED: import.meta.env.PUBLIC_TAROT_ENABLED ?? node.PUBLIC_TAROT_ENABLED,
  PUBLIC_NUMEROLOGY_SHARE_ENABLED: import.meta.env.PUBLIC_NUMEROLOGY_SHARE_ENABLED ?? node.PUBLIC_NUMEROLOGY_SHARE_ENABLED,
  PUBLIC_VEDIC_SIGNS_ENABLED: import.meta.env.PUBLIC_VEDIC_SIGNS_ENABLED ?? node.PUBLIC_VEDIC_SIGNS_ENABLED,
  PUBLIC_YOUR_DAY_ENABLED: import.meta.env.PUBLIC_YOUR_DAY_ENABLED ?? node.PUBLIC_YOUR_DAY_ENABLED,
  PUBLIC_RETROGRADES_FOR_YOU_ENABLED: import.meta.env.PUBLIC_RETROGRADES_FOR_YOU_ENABLED ?? node.PUBLIC_RETROGRADES_FOR_YOU_ENABLED,
  PUBLIC_ASTROCARTOGRAPHY_ENABLED: import.meta.env.PUBLIC_ASTROCARTOGRAPHY_ENABLED ?? node.PUBLIC_ASTROCARTOGRAPHY_ENABLED,
} as const;

export type LaunchFlag = keyof typeof BUILD;
export const LAUNCH_FLAGS = Object.keys(BUILD) as LaunchFlag[];
type Env = Readonly<Record<string, string | undefined>>;

/** A flag that needs another on as well: the people pages link to the calculator. */
const REQUIRES: Partial<Record<LaunchFlag, LaunchFlag>> = { PUBLIC_YEAR_PEOPLE_ENABLED: 'PUBLIC_YEAR_SCORE_ENABLED' };

/** True only when the flag, and any flag it needs, is exactly '1'. Pass `env` in a test. */
export function launchFlagOn(name: LaunchFlag, env: Env = BUILD): boolean {
  if (env[name] !== '1') return false;
  const needs = REQUIRES[name];
  return needs ? launchFlagOn(needs, env) : true;
}
