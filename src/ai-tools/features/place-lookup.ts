/**
 * Resolve a place name to coordinates and a time zone with the same GeoNames
 * index the calculators use (public/data/cities/, cities of 15,000 people or
 * more). A name is display text until it matches a city exactly. When the
 * name and the supplied coordinates or zone disagree, the supplied values
 * are kept and the answer says so. Pure: no network, storage or logging.
 */
import { fold, foldedQuery, queryRows, shardKey, type City, type CityIndex, type Row } from '../../lib/geo/rank';
import { PLACE_SHARDS } from '../../mcp/places';
import indexJson from '../../../public/data/cities/index.json';

const index = indexJson as unknown as CityIndex;
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
/** A city centre and a point in the same city stay inside this. */
const MATCH_KM = 80;

export interface Located {
  latitude?: number;
  longitude?: number;
  zone?: string;
  place?: string;
  placeNote?: string;
}

function cityFrom(row: Row): City {
  return {
    name: row[0],
    admin1: index.admin1[row[2]] ?? '',
    country: index.countries[row[3]] ?? '',
    lat: row[4] / 100,
    lon: row[5] / 100,
    tz: index.tz[row[6]] ?? '',
    pop: row[7],
  };
}

function countryName(code: string): string {
  try { return regionNames.of(code) ?? code; } catch { return code; }
}

function labelOf(city: City): string {
  const country = countryName(city.country);
  const admin = city.admin1 && fold(city.admin1) !== fold(city.name) ? `, ${city.admin1}` : '';
  return `${city.name}${admin}, ${country}`;
}

function exactCities(query: string): City[] {
  const q = foldedQuery(query.replace(/\./gu, ''));
  if (!q) return [];
  const rows = queryRows(index, PLACE_SHARDS[shardKey(q)] ?? [], shardKey(q));
  const found: City[] = [];
  for (const row of rows) {
    const name = fold(row[0]).replace(/\./gu, '');
    const ascii = row[1] === 0 ? name : fold(String(row[1])).replace(/\./gu, '');
    if (name === q || ascii === q) found.push(cityFrom(row));
  }
  return found;
}

function hintMatches(city: City, hint: string): boolean {
  const folded = fold(hint);
  if (!folded) return false;
  return fold(city.admin1).includes(folded) || fold(city.country) === folded || fold(countryName(city.country)) === folded || fold(labelOf(city)).includes(folded);
}

/** True when two zone names are the same clock, including a legacy link such as US/Eastern. */
function sameZone(left: string, right: string): boolean {
  if (left.toLowerCase() === right.toLowerCase()) return true;
  const resolved = (name: string) => {
    try { return new Intl.DateTimeFormat('en-US', { timeZone: name }).resolvedOptions().timeZone; } catch { return name; }
  };
  return resolved(left) === resolved(right);
}

function kmBetween(latA: number, lonA: number, latB: number, lonB: number): number {
  const toRad = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Fill coordinates and a time zone from a place name when they were not
 * given, and name a mismatch when they were. The place string itself is
 * left as the person wrote it.
 */
export function applyPlace<T extends { place?: string; latitude?: number; longitude?: number; zone?: string }>(args: T): T & { placeNote?: string } {
  if (!args.place) return args;
  const [head, ...rest] = args.place.split(',');
  const hint = rest.join(',').trim();
  const matches = exactCities(head.trim());
  if (matches.length === 0) {
    return { ...args, placeNote: 'No city in the place list has that name, so it is shown as written and is not used for coordinates or the time zone.' };
  }
  const hinted = hint ? matches.filter((city) => hintMatches(city, hint)) : [];
  const chosen = (hinted.length > 0 ? hinted : matches)[0];
  const label = labelOf(chosen);
  const ambiguous = (hinted.length > 0 ? hinted : matches).length > 1;
  const assumed = ambiguous ? ` Using ${label}, the largest match. Say if you meant another.` : '';
  const ignoredHint = hint && hinted.length === 0 ? ` The words after the comma did not match that city.` : '';
  const hasCoords = args.latitude !== undefined && args.longitude !== undefined;
  if (!hasCoords) {
    return {
      ...args,
      latitude: chosen.lat,
      longitude: chosen.lon,
      zone: args.zone ?? chosen.tz,
      placeNote: `Place read as ${label} (${chosen.lat.toFixed(2)}, ${chosen.lon.toFixed(2)}, ${chosen.tz}).${assumed}${ignoredHint}`,
    };
  }
  const km = kmBetween(args.latitude!, args.longitude!, chosen.lat, chosen.lon);
  const zoneOff = !!args.zone && !sameZone(args.zone, chosen.tz);
  if (km > MATCH_KM || zoneOff) {
    const where = km > MATCH_KM ? `about ${Math.round(km)} km from the coordinates given` : 'near the coordinates given';
    const zone = zoneOff ? ` Its time zone is ${chosen.tz}, not ${args.zone}.` : '';
    return { ...args, placeNote: `The place name matches ${label} (${chosen.lat.toFixed(2)}, ${chosen.lon.toFixed(2)}), ${where}.${zone} The chart uses the coordinates and time zone you supplied. Check them if the rising sign matters.${assumed}` };
  }
  return assumed || ignoredHint ? { ...args, placeNote: `${label}.${assumed}${ignoredHint}` } : args;
}
