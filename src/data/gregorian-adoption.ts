/**
 * When each country's civil calendar changed to the Gregorian (New Style),
 * for the birth forms' calendar notes (engine brief step 1.13b). Loaded only
 * with the calendar control, never in a page's first bundle.
 *
 * One date per present-day country: the first New Style day where most of
 * that country's births were recorded. Where regions changed at different
 * times, the row's comment says which region the date belongs to and names
 * the others. `lastJulian` is the Old Style day before it, for countries whose
 * earlier civil calendar was the Julian (for Turkey, the Rumi calendar, which
 * kept Julian days and months). The five countries whose earlier calendar was
 * a different one have no `lastJulian`: the site cannot convert from those,
 * and their note says so.
 *
 * `country` is the name the GeoNames city index gives the country
 * (public/data/cities/index.json), which is the only country field a picked
 * birthplace carries; `code` is the ISO 3166-1 alpha-2 code, used for the
 * country's name in the reader's language.
 *
 * Sources, cited per row (dates are encyclopaedic facts; no prose is copied):
 * - wikipedia: "List of adoption dates of the Gregorian calendar by country",
 *   English Wikipedia, read 2026-09-25; its rows cite Grotefend, Ginzel and
 *   the laws that made each change.
 * - tzdb: the IANA time zone database 2025c (the release @zodiacs/engine/geo
 *   ships, its TZDB), file `calendars`, which quotes H. Grotefend,
 *   Taschenbuch der Zeitrechnung (1941), pp. 26–28. Public domain.
 * - lv, fi: the Latvian and Finnish Wikipedia articles on the Gregorian
 *   calendar ("Gregora kalendārs", "Gregoriaaninen kalenteri"), read
 *   2026-09-25, where the English list is silent or the sources disagree.
 */
export type AdoptionSource = 'wikipedia' | 'tzdb' | 'lv' | 'fi';

export interface GregorianAdoption {
  /** ISO 3166-1 alpha-2. */
  readonly code: string;
  /** The country as the GeoNames city index names it. */
  readonly country: string;
  /** The first New Style day, YYYY-MM-DD. */
  readonly firstGregorian: string;
  /** The last Old Style day before it; absent where the calendar before was not the Julian. */
  readonly lastJulian?: string;
  readonly sources: readonly AdoptionSource[];
}

export const GREGORIAN_ADOPTION: readonly GregorianAdoption[] = [
  // Transcaucasian Democratic Federative Republic, with Azerbaijan and Georgia.
  { code: 'AM', country: 'Armenia', lastJulian: '1918-04-17', firstGregorian: '1918-05-01', sources: ['wikipedia'] },
  // "Austria and Bohemia", 6 → 17 January 1584 (tzdb). The English list gives
  // Salzburg February 1583 and the other Austrian lands October–December 1583;
  // this is the later date.
  { code: 'AT', country: 'Austria', lastJulian: '1584-01-06', firstGregorian: '1584-01-17', sources: ['tzdb', 'wikipedia'] },
  { code: 'AZ', country: 'Azerbaijan', lastJulian: '1918-04-17', firstGregorian: '1918-05-01', sources: ['wikipedia'] },
  // The prince-bishopric of Liège, the last of the Belgian lands; Flanders,
  // Brabant and the Spanish Netherlands changed in December 1582.
  { code: 'BE', country: 'Belgium', lastJulian: '1583-02-10', firstGregorian: '1583-02-21', sources: ['tzdb', 'wikipedia'] },
  { code: 'BG', country: 'Bulgaria', lastJulian: '1916-03-31', firstGregorian: '1916-04-14', sources: ['wikipedia'] },
  // The Soviet decree. The Grodno governorate, under German occupation,
  // changed on 5 September 1915.
  { code: 'BY', country: 'Belarus', lastJulian: '1918-01-31', firstGregorian: '1918-02-14', sources: ['wikipedia'] },
  // The British colonies. New France kept France's date, 20 December 1582.
  { code: 'CA', country: 'Canada', lastJulian: '1752-09-02', firstGregorian: '1752-09-14', sources: ['wikipedia'] },
  // Appenzell Ausserrhoden, the last canton. The Catholic cantons changed in
  // 1584 and the main Protestant ones on 12 January 1701; some Protestant
  // communes of Graubünden held out until 1783–1812 (in Schiers and Grüsch,
  // 25 December 1811 was followed by 7 January 1812).
  { code: 'CH', country: 'Switzerland', lastJulian: '1798-12-13', firstGregorian: '1798-12-25', sources: ['wikipedia'] },
  // The Chinese calendar before; the change was not complete until 1929, and
  // the Chinese calendar stayed in wide use.
  { code: 'CN', country: 'China', firstGregorian: '1912-01-01', sources: ['wikipedia'] },
  // Moravia, the last region; Bohemia and Silesia changed on 17 January 1584.
  { code: 'CZ', country: 'Czechia', lastJulian: '1584-10-15', firstGregorian: '1584-10-26', sources: ['wikipedia'] },
  // The Protestant states; the Catholic states changed in 1583–1585.
  { code: 'DE', country: 'Germany', lastJulian: '1700-02-18', firstGregorian: '1700-03-01', sources: ['tzdb', 'wikipedia'] },
  { code: 'DK', country: 'Denmark', lastJulian: '1700-02-18', firstGregorian: '1700-03-01', sources: ['tzdb', 'wikipedia'] },
  { code: 'EE', country: 'Estonia', lastJulian: '1918-02-15', firstGregorian: '1918-03-01', sources: ['wikipedia'] },
  // The Coptic calendar (for fiscal purposes) and the Islamic calendar before.
  { code: 'EG', country: 'Egypt', firstGregorian: '1875-09-11', sources: ['wikipedia'] },
  { code: 'ES', country: 'Spain', lastJulian: '1582-10-04', firstGregorian: '1582-10-15', sources: ['tzdb', 'wikipedia'] },
  // With Sweden. The Grand Duchy kept the Gregorian calendar under Russian
  // rule, 1809–1917 (fi); the list tzdb quotes counts Finland with Russia.
  { code: 'FI', country: 'Finland', lastJulian: '1753-02-17', firstGregorian: '1753-03-01', sources: ['wikipedia', 'fi'] },
  // Protestant Alsace changed in 1682 and Lorraine in 1760. The Republican
  // calendar was in civil use from 1793 to 1805; the forms do not convert it.
  { code: 'FR', country: 'France', lastJulian: '1582-12-09', firstGregorian: '1582-12-20', sources: ['tzdb', 'wikipedia'] },
  { code: 'GB', country: 'United Kingdom', lastJulian: '1752-09-02', firstGregorian: '1752-09-14', sources: ['tzdb', 'wikipedia'] },
  { code: 'GE', country: 'Georgia', lastJulian: '1918-04-17', firstGregorian: '1918-05-01', sources: ['wikipedia'] },
  // Mount Athos keeps the Julian calendar.
  { code: 'GR', country: 'Greece', lastJulian: '1923-02-15', firstGregorian: '1923-03-01', sources: ['wikipedia'] },
  // The legal change; tzdb dates its first use to 1584.
  { code: 'HU', country: 'Hungary', lastJulian: '1587-10-21', firstGregorian: '1587-11-01', sources: ['tzdb', 'wikipedia'] },
  // The same act as Great Britain.
  { code: 'IE', country: 'Ireland', lastJulian: '1752-09-02', firstGregorian: '1752-09-14', sources: ['wikipedia'] },
  // Most states; Tyrol and Brixen changed in 1583.
  { code: 'IT', country: 'Italy', lastJulian: '1582-10-04', firstGregorian: '1582-10-15', sources: ['tzdb', 'wikipedia'] },
  // The Japanese lunisolar calendar before.
  { code: 'JP', country: 'Japan', firstGregorian: '1873-01-01', sources: ['wikipedia'] },
  // The Korean calendar before, for both Koreas.
  { code: 'KP', country: 'North Korea', firstGregorian: '1896-01-01', sources: ['wikipedia'] },
  { code: 'KR', country: 'South Korea', firstGregorian: '1896-01-01', sources: ['wikipedia'] },
  // The Kovno and Vilna governorates under German administration (its
  // ordinance of 21 May 1915); Lithuania had kept the Julian calendar since
  // Russian rule began (1800).
  { code: 'LT', country: 'Lithuania', lastJulian: '1915-05-11', firstGregorian: '1915-05-25', sources: ['wikipedia'] },
  { code: 'LU', country: 'Luxembourg', lastJulian: '1582-12-20', firstGregorian: '1582-12-31', sources: ['wikipedia'] },
  // Vidzeme and Latgale, by the Iskolat's decree (lv). German-occupied
  // Courland changed in 1915 and Riga in 1917.
  { code: 'LV', country: 'Latvia', lastJulian: '1918-01-31', firstGregorian: '1918-02-14', sources: ['lv', 'wikipedia'] },
  // The Kingdom of Serbs, Croats and Slovenes, with North Macedonia and
  // Serbia; Vojvodina, Hungarian until 1918, used the Gregorian calendar.
  { code: 'ME', country: 'Montenegro', lastJulian: '1919-01-14', firstGregorian: '1919-01-28', sources: ['wikipedia'] },
  { code: 'MK', country: 'North Macedonia', lastJulian: '1919-01-14', firstGregorian: '1919-01-28', sources: ['wikipedia'] },
  // Drenthe, the last province. Holland and Zeeland changed in 1582–1583,
  // the other provinces in 1700–1701.
  { code: 'NL', country: 'The Netherlands', lastJulian: '1701-04-30', firstGregorian: '1701-05-12', sources: ['wikipedia'] },
  { code: 'NO', country: 'Norway', lastJulian: '1700-02-18', firstGregorian: '1700-03-01', sources: ['tzdb', 'wikipedia'] },
  // Silesia changed in 1584 and the Brandenburg lands in 1700. Records of
  // the Russian period often give both dates.
  { code: 'PL', country: 'Poland', lastJulian: '1582-10-04', firstGregorian: '1582-10-15', sources: ['tzdb', 'wikipedia'] },
  { code: 'PT', country: 'Portugal', lastJulian: '1582-10-04', firstGregorian: '1582-10-15', sources: ['tzdb', 'wikipedia'] },
  // Transylvania, Banat and Bukovina, part of Austria-Hungary until 1918,
  // used the Gregorian calendar.
  { code: 'RO', country: 'Romania', lastJulian: '1919-03-31', firstGregorian: '1919-04-14', sources: ['wikipedia'] },
  { code: 'RS', country: 'Serbia', lastJulian: '1919-01-14', firstGregorian: '1919-01-28', sources: ['wikipedia'] },
  { code: 'RU', country: 'Russia', lastJulian: '1918-01-31', firstGregorian: '1918-02-14', sources: ['tzdb', 'wikipedia'] },
  // After the Swedish calendar of 1700–1712.
  { code: 'SE', country: 'Sweden', lastJulian: '1753-02-17', firstGregorian: '1753-03-01', sources: ['tzdb', 'wikipedia'] },
  // The Rumi calendar kept Julian days and months until then, and its own
  // year count until 1926, so a date given with its Common Era year is Old Style.
  { code: 'TR', country: 'Turkey', lastJulian: '1917-02-15', firstGregorian: '1917-03-01', sources: ['wikipedia'] },
  // The Ukrainian People's Republic. Areas under Soviet control followed
  // Russia on 14 February; Galicia and Bukovina, Austrian until 1918, used the
  // Gregorian calendar.
  { code: 'UA', country: 'Ukraine', lastJulian: '1918-02-15', firstGregorian: '1918-03-01', sources: ['wikipedia'] },
  // The British colonies. Alaska, Russian until 1867, kept the Julian
  // calendar until 18 October 1867; the French and Spanish lands had the
  // Gregorian from 1582.
  { code: 'US', country: 'United States', lastJulian: '1752-09-02', firstGregorian: '1752-09-14', sources: ['wikipedia'] },
];

/** The row for a birthplace's country, by its GeoNames name. */
export function gregorianAdoption(country: string | undefined): GregorianAdoption | undefined {
  return country ? GREGORIAN_ADOPTION.find((row) => row.country === country) : undefined;
}
