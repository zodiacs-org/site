/**
 * Serves, on 127.0.0.1, what the ChatGPT plugin gate tests when it is given no
 * BASE_URL: the published /mcp connector behind vercel.json's rewrites, and
 * dist/ when a build exists (tests/helpers/chatgpt-gate-server.ts).
 *
 *   npx vite-node --script scripts/serve-chatgpt-gate.ts 4530
 *   BASE_URL=http://127.0.0.1:4530 npm run test:chatgpt-gate
 */
import { startGateServer } from '../tests/helpers/chatgpt-gate-server';

const port = Number(process.argv[2] ?? 4530);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Give a port from 1024 to 65535.');
const server = await startGateServer(port);
console.log(`ChatGPT plugin gate server: ${server.baseUrl}/mcp${server.servesPages ? ' and the built site' : ' (no dist/ build, so no pages)'}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void server.close().then(() => process.exit(0)); });
