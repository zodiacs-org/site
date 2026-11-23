/**
 * The birthplace as the page reads it: rounded to two decimals, as every tool
 * rounds a place it is given (roundCoordinate in src/ai-tools/plain-text.ts,
 * which browser code may not import; a test holds the two equal). Pure.
 */
export function roundPlace(value: number): number {
  return Math.round(value * 100) / 100;
}
