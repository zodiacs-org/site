// The hosted MCP endpoint, https://zodiacs.org/mcp. vercel.json rewrites /mcp
// and /mcp/health to api/compatibility.ts with the __zodiacs_mcp parameter,
// and that function hands the request here before any route of its own, so the
// endpoint adds no deployed function; the underscore keeps this directory from
// deploying as one. The server is src/mcp/hosted-server.ts and its transport
// src/mcp/hosted-http.ts, bundled with the engine into ./remote.mjs by
// scripts/build-mcp-remote.mjs, which also clears the engine's per-request
// memos when each request completes, as the compute API's bundle does.
import { createHostedMcpHandler } from './remote.mjs';

const hostedMcp = createHostedMcpHandler();

export default async function mcp(req: any, res: any): Promise<void> {
  await hostedMcp(req, res);
}
