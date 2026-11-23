#!/usr/bin/env node
/**
 * Serves the hosted MCP on 127.0.0.1 with production's switches: the server on and the occasion tools on, accounts
 * off. ZODIACS_COVERAGE_ENABLED=1 in the shell also offers the 0.6.0 tools, as production will once the owner
 * switches them on, and ZODIACS_SKY_EVENTS_ENABLED=1 with it adds search_sky_events, the natal chart's nodes and house
 * systems, and Chiron; ZODIACS_NUMEROLOGY_ENABLED=1 with it adds get_numerology, and ZODIACS_TAROT_ENABLED=1 with it
 * adds draw_tarot. Rate limits, quotas and usage counting are stand-ins that allow every call.
 *
 * By default it serves the published runtime (api/_ai/published/runtime.mjs) at /mcp, as production's /mcp does. That
 * runtime is frozen, so a tool added since it was published, such as draw_tarot, is not in it whatever the switches
 * say. --candidate serves the candidate runtime (api/_ai/runtime.mjs) as production's /mcp/de440 does, at /mcp/de440,
 * with the site's own data files. For reviewing a change before it is deployed:
 *
 *   node scripts/serve-hosted-mcp.mjs 4521               # the published /mcp, at http://127.0.0.1:4521/mcp
 *   ZODIACS_COVERAGE_ENABLED=1 ZODIACS_TAROT_ENABLED=1 node scripts/serve-hosted-mcp.mjs 4521 --candidate
 *                                                        # the candidate, at http://127.0.0.1:4521/mcp/de440
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SWITCHES = ['ZODIACS_COVERAGE_ENABLED', 'ZODIACS_SKY_EVENTS_ENABLED', 'ZODIACS_NUMEROLOGY_ENABLED', 'ZODIACS_TAROT_ENABLED'];

/** The port, the runtime and the path to serve, from the command line. */
export function reviewTarget(argv) {
  const candidate = argv.includes('--candidate');
  const port = Number(argv.find((arg) => /^\d+$/u.test(arg)) ?? 4521);
  return { port, candidate, path: candidate ? '/mcp/de440' : '/mcp' };
}

/** The handler's switches: production's, plus each optional switch the shell sets to exactly '1'. */
export function reviewEnv(shell) {
  return { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ...Object.fromEntries(SWITCHES.filter((name) => shell[name] === '1').map((name) => [name, '1'])) };
}

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

/** Starts the review server; resolves once it listens. Port 0 picks a free one. */
export async function serveHostedMcp({ port, candidate, shell = process.env }) {
  const { createAiNodeHandler } = candidate ? await import('../api/_ai/runtime.mjs') : await import('../api/_ai/published/runtime.mjs');
  const data = candidate
    ? { horoscopeWindow: '../src/data/horoscope-window.json', horoscopeProgram: '../src/data/horoscope-program.json' }
    : { horoscopeWindow: '../api/_ai/published/horoscope-window.json', horoscopeProgram: '../api/_ai/published/horoscope-program.json' };
  const [horoscopeWindow, horoscopeMonths, horoscopeProgram] = await Promise.all([json(data.horoscopeWindow), json('../src/data/horoscope-months.json'), json(data.horoscopeProgram)]);
  let handle = async () => {};
  const server = createServer((request, response) => {
    // /mcp/de440 reaches the candidate as vercel.json's rewrite does: /mcp with the route key.
    if (candidate) request.url = request.url.replace(/^\/mcp\/de440\/?(?=$|\?)/u, '/mcp?__zodiacs_ai=de440');
    void handle(request, response);
  });
  await new Promise((done) => server.listen(port, '127.0.0.1', done));
  const host = `127.0.0.1:${server.address().port}`;
  handle = createAiNodeHandler({
    env: reviewEnv(shell),
    allowedHosts: [host],
    rateLimit: async () => 'allowed',
    atomicQuota: async () => 'allowed',
    countUsage: async () => undefined,
    dependencies: { horoscopeWindow: async () => horoscopeWindow, horoscopeMonths: async () => horoscopeMonths, horoscopeProgram: async () => horoscopeProgram },
    ...(candidate ? { de440: true } : {}),
  });
  return { server, host };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = reviewTarget(process.argv.slice(2));
  const { host } = await serveHostedMcp(target);
  console.log(`serving http://${host}${target.path}`);
}
