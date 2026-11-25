/**
 * Ids and labels for places in the birthplace index (src/lib/geo/rank.ts): a stable id for each row, and labels that
 * tell same-named places apart. Import-free apart from types, so a picker can load it without the search.
 */
import type { CityIndex, Row } from './rank';

/** A place as the id and label helpers read it: a City, or a Row read through its index. */
export interface PlacePoint {
  name: string;
  admin1: string;
  country: string;
  lat: number;
  lon: number;
}

/** cyrb53: a 53-bit string hash, the same in every JavaScript engine. */
function hash53(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * A stable id for a place in the index, such as `p1x2y3z4a5b6`. The index carries no GeoNames id, so the id is a hash
 * of what identifies the row: its name, region, country and the coordinates it stores (hundredths of a degree). No two
 * rows share all five (Bristol, Tennessee and Bristol, Virginia share a name and coordinates), so no two share an id,
 * and a row keeps its id for as long as the index keeps the row.
 */
export function placeId(place: PlacePoint): string {
  const key = [place.name, place.admin1, place.country, Math.round(place.lat * 100), Math.round(place.lon * 100)].join('|');
  return `p${hash53(key).toString(36).padStart(11, '0')}`;
}

/** A Row as a PlacePoint, through its index's tables. */
export function rowPoint(index: CityIndex, row: Row): PlacePoint {
  return { name: row[0], admin1: index.admin1[row[2]] ?? '', country: index.countries[row[3]] ?? '', lat: row[4] / 100, lon: row[5] / 100 };
}

/** "24.59° N, 73.71° E": coordinates to two decimals, as the index stores them. */
export function coordinateText(lat: number, lon: number): string {
  const part = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(2)}° ${value < 0 ? negative : positive}`;
  return `${part(lat, 'N', 'S')}, ${part(lon, 'E', 'W')}`;
}

/** "Udaipur, Rajasthan, India": the name, region and country. */
export function placeLabelText(place: Pick<PlacePoint, 'name' | 'admin1' | 'country'>): string {
  return [place.name, place.admin1, place.country].filter(Boolean).join(', ');
}

/**
 * For each place in a list, what tells it apart from the others shown with it: its coordinates to two decimals when
 * another place in the list has the same name, region and country (the index has no district or county to show
 * instead), otherwise nothing. "24.59° N, 73.71° E" for one Udaipur, Rajasthan, India and "27.72° N, 75.47° E" for
 * the other.
 */
export function placeDistinctions(places: readonly PlacePoint[]): string[] {
  const counts = new Map<string, number>();
  for (const place of places) counts.set(placeLabelText(place), (counts.get(placeLabelText(place)) ?? 0) + 1);
  return places.map((place) => ((counts.get(placeLabelText(place)) ?? 0) > 1 ? coordinateText(place.lat, place.lon) : ''));
}

/** Each place's label, with its coordinates in brackets where placeDistinctions needs them. */
export function distinctPlaceLabels(places: readonly PlacePoint[]): string[] {
  const extra = placeDistinctions(places);
  return places.map((place, i) => (extra[i] ? `${placeLabelText(place)} (${extra[i]})` : placeLabelText(place)));
}
