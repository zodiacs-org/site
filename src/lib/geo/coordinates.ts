/** Birthplace coordinates in results and links: two decimal places, about a kilometre. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The longitude cannot define a rising sign at either pole of the rounded birthplace grid. */
export function isGeographicPole(latitude: number): boolean {
  return Math.abs(roundCoordinate(latitude)) === 90;
}
