/**
 * Verifies a freshly installed copy of this package, in whatever directory it
 * was extracted into.
 *
 *   npm install && npm run verify
 *
 * It launches ./server.mjs as a real child process, speaks MCP to it with the
 * official client SDK, calls all three tools, checks a handful of values it can
 * verify without a second astrology engine, refuses two bad requests and shows
 * the session still works afterwards. The client checks every result against
 * the output schema the server declares, so a result that does not match
 * stops the run. Exit 0 means the install works.
 *
 * Every birth detail below is synthetic: London and Longyearbyen on dates
 * chosen for what they exercise.
 */
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('./server.mjs', import.meta.url));
const LONDON = { utc: '1990-06-15T13:30:00Z', latitude: 51.5074, longitude: -0.1278 };
const POLAR = { utc: '1990-12-15T09:00:00Z', latitude: 78.2232, longitude: 15.6267 };

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok || detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures += 1;
};

const client = new Client({ name: 'zodiacs-mcp-verify', version: '1.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER], stderr: 'inherit' });

async function call(name, args) {
  const result = await client.callTool({ name, arguments: args });
  return result.isError
    ? { refused: result.content?.[0]?.text ?? '' }
    : { value: result.structuredContent };
}

try {
  await client.connect(transport);
  const info = client.getServerVersion();
  check('the server starts and initializes', info?.name === 'zodiacs-mcp-server', info);

  const listed = (await client.listTools()).tools;
  const tools = listed.map((tool) => tool.name).sort();
  check('all three tools are listed', tools.join(',')
    === 'calculate_natal_chart,compare_calculation_records,get_capabilities', tools);
  const resources = (await client.listResources()).resources.map((resource) => resource.uri);
  check('every tool declares an output schema, and both resources are listed',
    listed.every((tool) => tool.outputSchema?.type === 'object')
    && resources.join(',') === 'zodiacs://conventions,zodiacs://methodology', resources);

  const capabilities = (await call('get_capabilities', {})).value;
  check('capabilities name the engine and its release status',
    capabilities?.engine?.name === '@zodiacs/engine'
    && capabilities.engine.releaseStatus === 'published' && capabilities.engine.registry === 'npm', capabilities?.engine);
  check('capabilities state that a local server is not a local assistant',
    /not a local AI experience/.test(capabilities?.privacy?.assistant ?? ''));

  const chart = (await call('calculate_natal_chart', LONDON)).value;
  check('an ordinary chart returns twelve bodies, four angles and twelve cusps',
    chart?.bodies?.length === 12 && Object.keys(chart.angles ?? {}).length === 4
    && chart.cusps?.length === 12);
  check('the chart result does not repeat the birth details back',
    !JSON.stringify(chart).includes(LONDON.utc));

  const polar = (await call('calculate_natal_chart', { ...POLAR, houseSystem: 'placidus' })).value;
  check('a polar chart reports the house system it could actually use',
    polar?.houses?.requested === 'placidus' && polar.houses.actual === 'whole', polar?.houses);

  const left = (await call('calculate_natal_chart', { ...LONDON, output: 'record' })).value;
  const right = (await call('calculate_natal_chart', { ...LONDON, houseSystem: 'whole', output: 'record' })).value;
  check('record output is a calculation record',
    JSON.parse(left?.record ?? '{}').schema === 'zodiacs.natal-envelope.draft-v1');

  const same = (await call('compare_calculation_records', { left: left.record, right: left.record })).value;
  check('one record against itself compares identical', same?.identical === true, same?.counts);

  const houses = (await call('compare_calculation_records', { left: left.record, right: right.record })).value;
  check('a house-system difference moves all twelve cusps',
    houses?.identical === false
    && houses.differences.filter((row) => /^cusp-\d+$/.test(row.id)).length === 12, houses?.counts);
  check('the house-system cause is reproduced by recalculating locally',
    houses?.explanations?.some((row) => row.evidence === 'reproduced'));
  check('the comparison says its own output is not anonymous',
    /not anonymous/.test(houses?.disclosure ?? ''));
  // The headline behaviour of rc.2 had no check here at all: a rebuild that
  // dropped the withholding would still have passed this verifier. An AI review
  // of the shipped archive found that, so the two halves of it are pinned here,
  // in the artifact an outside builder runs, not only in the repository drives.
  check('the default comparison leaves the birth details out of its answer',
    !JSON.stringify(houses ?? {}).includes(LONDON.utc)
    && !JSON.stringify(houses ?? {}).includes(String(LONDON.latitude)),
    houses?.withheld);
  const full = (await call('compare_calculation_records',
    { left: left.record, right: right.record, output: 'full' })).value;
  check('asking for the full output returns the values it withheld',
    full?.differences?.some((row) => /^cusp-\d+$/.test(row.id) && typeof row.left === 'string'),
    full?.output);

  const badDate = await call('calculate_natal_chart', { ...LONDON, utc: '2001-02-29T00:00:00Z' });
  check('a date that does not exist is refused', Boolean(badDate.refused), badDate.refused);
  const badRecord = await call('compare_calculation_records', { left: '{oops', right: left.record });
  check('a record that is not JSON is refused', /not valid JSON/.test(badRecord.refused ?? ''), badRecord.refused);

  const after = (await call('calculate_natal_chart', LONDON)).value;
  check('the session still works after both refusals', after?.bodies?.length === 12);
} catch (error) {
  check('the verification ran to completion', false, error instanceof Error ? error.message : String(error));
} finally {
  await client.close().catch(() => {});
}

console.log(failures === 0
  ? '\nzodiacs-mcp-server: install verified.'
  : `\nzodiacs-mcp-server: ${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
