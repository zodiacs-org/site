/** Birthplace coordinates in results and links: two decimal places, about a kilometre. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
