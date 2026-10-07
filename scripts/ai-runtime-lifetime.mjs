/** Mirror main's audited server lifetime policy for each generated AI runtime. */
export function addAiLifetimeBoundary(generated, local) {
  const tool = 'async function executeAiTool(tool, input, dependencies, context = {}) {';
  const respond = 'function respond(run2) {';
  for (const marker of ['var last;', 'var last;\nfunction eclipticFrame(tt) {', '  last = {\n    tt,\n    rows: [', 'var pluto_cache = [];', 'var CalcMoonCount = 0;', tool, ...(local ? [respond] : [])]) {
    if (generated.split(marker).length !== 2) throw new Error(`AI private state changed; review cleanup: ${marker}`);
  }
  if (/\b(?:cache_e_tilt|sidereal_time_cache)\b|\bvar last\d+\b/u.test(generated)) throw new Error('Another time cache is bundled; review AI cleanup');
  let result = generated.replace(tool, 'async function executeAiToolWithoutLifetimeBoundary(tool, input, dependencies, context = {}) {');
  if (local) result = result.replace(respond, 'function respondWithoutLifetimeBoundary(run2) {');
  result += `
// Calculations are synchronous; clearing cannot interrupt another calculation.
// Async timezone work uses a separate resolver per public-sky tool call.
function clearAiEngineState() {
  last = undefined;
  pluto_cache.length = 0;
  CalcMoonCount = 0;
}
async function executeAiTool(tool, input, dependencies, context = {}) {
  try { return await executeAiToolWithoutLifetimeBoundary(tool, input, dependencies, context); }
  finally { clearAiEngineState(); }
}
`;
  if (local) result += `
function respond(run) {
  try { return respondWithoutLifetimeBoundary(run); }
  finally { clearAiEngineState(); }
}
`;
  return result;
}
