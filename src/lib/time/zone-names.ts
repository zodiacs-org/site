/**
 * The exact tzdb spelling of a time zone name given in any letter case.
 *
 * Intl reads a zone name in any letter case, and so does the engine's
 * resolver, but an answer should name the zone as tzdb does. A caller that
 * takes a name from outside, such as the compute API, maps it here first, so
 * that the resolver only ever sees tzdb spellings (and caches one formatter
 * per spelling) and an answer names the zone as tzdb does: america/new_york
 * becomes America/New_York.
 *
 * The names are those of the runtime's Intl data and of tzdata 2025c with its
 * backzone file, which the engine ships (src/data/tz-names.json). No two of
 * them differ only in letter case. A name neither has maps to nothing, even
 * where Intl would accept it (US/Pacific-New, SystemV/AST4, or a UTC offset
 * such as +05:30). Nothing here keeps anything but the names.
 *
 * No page imports this module; the calculators take zone names from the
 * city index, which spells them as tzdb does.
 */
import { loadModule } from '../module-load';

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

let tzdbNames: Promise<ReadonlyMap<string, string>> | null = null;

/** The spelling of tzdata 2025c with backzone, loaded once; a failed load is not remembered. */
function tzdbName(key: string): Promise<string | undefined> {
  if (!tzdbNames) {
    const pending = loadModule(() => import('../../data/tz-names.json'))
      .then(({ default: table }) => byKey(table.names));
    tzdbNames = pending;
    void pending.catch(() => {
      if (tzdbNames === pending) tzdbNames = null;
    });
  }
  return tzdbNames.then((names) => names.get(key));
}

/**
 * The tzdb spelling of `name` in any letter case, or null when neither the
 * runtime nor tzdata 2025c with backzone knows it. Rejects with a
 * ModuleLoadError when the names cannot be loaded.
 */
export async function canonicalZoneName(name: string): Promise<string | null> {
  if (typeof name !== 'string') return null;
  const key = nameKey(name);
  if (key === null) return null;
  return intlName(key) ?? (await tzdbName(key)) ?? null;
}
