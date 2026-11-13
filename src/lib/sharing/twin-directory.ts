import { DIRECTORY_PEOPLE } from '../people';
import type { TwinPerson } from './twins';

/**
 * The public figures /chart-twins/ matches against: each directory person's name, Sun sign and settled Moon sign,
 * nothing else. The page passes it to its island, and /data/chart-twins.json serves it to the page's WebMCP tool.
 */
export const TWIN_DIRECTORY: readonly TwinPerson[] = Object.freeze(DIRECTORY_PEOPLE.map((person) => Object.freeze({
  slug: person.slug,
  name: person.displayName,
  sun: person.sunSign.slug,
  moon: person.moon.uncertain ? null : person.moon.sign,
})));
