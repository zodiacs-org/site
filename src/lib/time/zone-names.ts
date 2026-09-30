/**
 * The exact tzdb spelling of a time zone name given in any letter case.
 *
 * Intl reads a zone name in any letter case, but the tables this directory
 * keys by name (the local mean time eras, the pinned zone history) spell each
 * name as tzdb does. A caller that takes a name from outside, such as the
 * compute API, maps it here first, so that every table sees one spelling and
 * an answer names the zone as tzdb does: america/new_york becomes
 * America/New_York.
 *
 * The names are those of the runtime's Intl data, the local mean time table,
 * and the pinned release (its history files and the zones it leaves out).
 * No two of them differ only in letter case. A name none of them has maps to
 * nothing, even where Intl would accept it (US/Pacific-New, SystemV/AST4,
 * or a UTC offset such as +05:30). Nothing here keeps anything but the names.
 *
 * No page imports this module; the calculators take zone names from the
 * city index, which spells them as tzdb does.
 */
import { loadModule } from '../module-load';
import { historyBucket } from './tz-history-load';

/** A zone name with its ASCII letters lower-cased, as Intl compares names; null for anything else. */
function nameKey(name: string): string | null {
  return /^[\x21-\x7e]{1,64}$/u.test(name) ? name.replace(/[A-Z]/gu, (letter) => letter.toLowerCase()) : null;
}

function byKey(names: Iterable<string>): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const name of names) {
    const key = nameKey(name);
    if (key !== null) map.set(key, name);
  }
  return map;
}

let intlNames: ReadonlyMap<string, string> | null = null;

function intlName(key: string): string | undefined {
  if (!intlNames) {
    intlNames = byKey(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []);
  }
  return intlNames.get(key);
}

let lmtNames: Promise<ReadonlyMap<string, string>> | null = null;

function lmtName(key: string): Promise<string | undefined> {
  if (!lmtNames) {
    const pending = loadModule(() => import('../../data/tz-lmt.json'))
      .then(({ default: table }) => byKey(Object.keys(table.eras)));
    lmtNames = pending;
    void pending.catch(() => {
      if (lmtNames === pending) lmtNames = null;
    });
  }
  return lmtNames.then((names) => names.get(key));
}

/** The pinned release's spelling: from the history file the name hashes to, or its list of zones left out. */
async function pinnedName(key: string): Promise<string | undefined> {
  const [bucket, excluded] = await Promise.all([
    loadModule(() => import(`../../data/tz-history/2025c/${historyBucket(key)}.json`)),
    loadModule(() => import('../../data/tz-history/2025c/excluded.json')),
  ]);
  const zones = Object.keys((bucket as { default: { zones: Record<string, unknown> } }).default.zones);
  return zones.find((zone) => nameKey(zone) === key)
    ?? Object.keys(excluded.default.excluded).find((zone) => nameKey(zone) === key);
}

/**
 * The tzdb spelling of `name` in any letter case, or null when neither the
 * runtime nor the pinned tables know it. Rejects with a ModuleLoadError when a
 * table cannot be loaded.
 */
export async function canonicalZoneName(name: string): Promise<string | null> {
  if (typeof name !== 'string') return null;
  const key = nameKey(name);
  if (key === null) return null;
  return intlName(key) ?? (await lmtName(key)) ?? (await pinnedName(key)) ?? null;
}
