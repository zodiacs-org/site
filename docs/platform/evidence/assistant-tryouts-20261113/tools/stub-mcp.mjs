#!/usr/bin/env node
// A stdio MCP server that lists the tools of a saved tools/list (name, title, description, inputSchema, annotations)
// and records every tools/call. With FORWARD set it passes the call on to that MCP endpoint (the live connector,
// read-only) and returns its answer; without it, it answers that the call was recorded.
// Usage: TOOLS=tools-list.json LOG=calls.jsonl [FORWARD=https://zodiacs.org/mcp] node stub-mcp.mjs
import { readFileSync, appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const tools = JSON.parse(readFileSync(process.env.TOOLS, 'utf8')).tools
  .map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations }));
const send = (message) => process.stdout.write(JSON.stringify(message) + '\n');

async function forward(params) {
  const response = await fetch(process.env.FORWARD, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params }) });
  const text = await response.text();
  const body = JSON.parse(response.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').find((line) => line.startsWith('data: ')).slice(6) : text);
  return { status: response.status, body };
}

for await (const line of createInterface({ input: process.stdin })) {
  if (!line.trim()) continue;
  const { id, method, params } = JSON.parse(line);
  if (id === undefined) continue;
  if (method === 'initialize') send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'zodiacs', version: 'tryout' } } });
  else if (method === 'tools/list') send({ jsonrpc: '2.0', id, result: { tools } });
  else if (method === 'tools/call') {
    const record = { at: new Date().toISOString(), name: params.name, arguments: params.arguments ?? {} };
    let result = { content: [{ type: 'text', text: 'Dry run: the call was recorded. No result is returned in this run.' }] };
    if (process.env.FORWARD) {
      try {
        const { status, body } = await forward({ name: params.name, arguments: params.arguments ?? {} });
        record.live = { status, isError: body.result?.isError ?? !!body.error, ok: body.result?.structuredContent?.ok, error: body.error?.message ?? body.result?.structuredContent?.error?.code };
        if (body.result) result = { content: body.result.content, isError: body.result.isError };
        else result = { content: [{ type: 'text', text: JSON.stringify(body.error) }], isError: true };
      } catch (error) { record.live = { failed: String(error) }; }
    }
    appendFileSync(process.env.LOG, JSON.stringify(record) + '\n');
    send({ jsonrpc: '2.0', id, result });
  } else if (method === 'ping') send({ jsonrpc: '2.0', id, result: {} });
  else send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
}
