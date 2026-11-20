import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const exec = promisify(execFile);

async function runWarmUp(enabled: boolean) {
  // Node loads the shipped runtime directly, as it does on the server.
  // Keep Vitest's transform of the embedded ephemeris outside the timing gate.
  const { stdout } = await exec(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', `
    let fetches = 0;
    globalThis.fetch = async () => {
      fetches += 1;
      throw new Error('the warm-up must not fetch');
    };
    const { warmUp } = await import('./api/_ai/handler.ts');
    const statuses = await warmUp();
    console.log(JSON.stringify({ statuses, fetches }));
  `], {
    cwd: new URL('../../', import.meta.url),
    env: {
      NODE_ENV: 'production',
      ZODIACS_MCP_ENABLED: enabled ? '1' : '0',
      ZODIACS_OCCASIONS_ENABLED: '1',
    },
    timeout: 5000,
  });
  return JSON.parse(stdout);
}

// api/compatibility.ts awaits warmUp while a Vercel instance starts, so it must stay inside the instance and never fail it.
describe('the /mcp warm-up', () => {
  it('answers initialize and tools/list inside the instance without reaching the network', async () => {
    await expect(runWarmUp(true)).resolves.toEqual({ statuses: [200, 200], fetches: 0 });
  });

  it('resolves, without throwing, while the server is switched off', async () => {
    await expect(runWarmUp(false)).resolves.toEqual({ statuses: [503, 503], fetches: 0 });
  });
});
