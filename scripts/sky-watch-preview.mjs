/** Operator runner; explicit invocation only. No automatic notifications or production changes. */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { configuredSkyWatch, createAiNodeHandler, runSkyWatchTick, digest } from '../integrations/generated/sky-watch.mjs';

const command = process.argv[2];
if (!['serve', 'tick', 'grant', 'revoke'].includes(command)) {
  console.error('Usage: node scripts/sky-watch-preview.mjs serve|tick|grant <private-output-file>|revoke <principal-id>');
  process.exitCode = 1;
} else {
  try {
    const watch = configuredSkyWatch(process.env);
    if (!watch) throw new Error('disabled');
    if (command === 'tick') console.log(JSON.stringify(await runSkyWatchTick()));
    else if (command === 'grant') {
      if (!process.argv[3]) throw new Error('output-file-required');
      const token = `zsw_${randomBytes(32).toString('base64url')}`;
      // Reserve the file first; never overwrite credentials or print them to logs.
      await writeFile(process.argv[3], JSON.stringify({ token }) + '\n', { flag: 'wx', mode: 0o600 });
      const principal = await watch.rpc('grant', { token_hash: digest(token) });
      await writeFile(process.argv[3], JSON.stringify({ ...principal, token }) + '\n', { mode: 0o600 });
      console.log('A seven-day preview grant was written to the private output file.');
    } else if (command === 'revoke') {
      if (!/^[0-9a-f-]{36}$/.test(process.argv[3] ?? '')) throw new Error('principal-required');
      await watch.rpc('revoke', { owner: process.argv[3] });
      console.log('The preview grant and its watches were revoked.');
    } else {
      const port = Number(process.env.ZODIACS_SKY_WATCH_PORT ?? 8793);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid-port');
      // This listener is loopback-only. Deployed MCP requests use the ordinary Firewall + atomic quotas.
      let calls = 0, minute = 0;
      const limit = async () => {
        const current = Math.floor(Date.now() / 60_000); if (current !== minute) { minute = current; calls = 0; }
        return ++calls <= 40 ? 'allowed' : 'limited';
      };
      const handler = createAiNodeHandler({ skyWatch: watch, allowedHosts: [`127.0.0.1:${port}`], rateLimit: limit,
        atomicQuota: async () => 'allowed', env: { ...process.env, ZODIACS_MCP_ENABLED: '1' } });
      const server = createServer((req, res) => void handler(req, res));
      server.listen(port, '127.0.0.1', () => console.log(`Sky Watch authenticated preview: http://127.0.0.1:${port}/mcp`));
      for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
    }
  } catch { console.error('Sky Watch preview could not complete the operation. Check preview configuration and database migration; no credentials were logged.'); process.exitCode = 1; }
}
