import { AI_TOOL_NAMES, type AiToolName } from './contracts';
import { serviceRpc } from './quota';

export const USAGE_HOSTS = ['chatgpt', 'claude', 'other'] as const;
export type UsageHost = typeof USAGE_HOSTS[number];
type Environment = Readonly<Record<string, string | undefined>>;

/** A count gives up after this long. No reply ever waits for it. */
export const USAGE_TIMEOUT_MS = 1500;

/** The coarse assistant family behind a request. The User-Agent is read here and
 * nowhere else in the counter; it is never stored, logged or forwarded.
 */
export function usageHostFamily(userAgent: unknown): UsageHost {
  if (typeof userAgent !== 'string') return 'other';
  if (/openai|chatgpt/i.test(userAgent)) return 'chatgpt';
  if (/claude|anthropic/i.test(userAgent)) return 'claude';
  return 'other';
}

/** Adds one to today's counter for this deployment scope, tool and host family.
 * The request body carries exactly those three fixed values; the day comes from
 * the database clock. Without full preview/production configuration it does
 * nothing. Resolves false on refusal, failure or timeout and never throws.
 */
export async function countAiToolCall(tool: AiToolName, host: UsageHost, env: Environment, fetcher: typeof fetch = fetch): Promise<boolean> {
  const rpc = serviceRpc(env);
  if (!rpc || !(AI_TOOL_NAMES as readonly string[]).includes(tool) || !(USAGE_HOSTS as readonly string[]).includes(host)) return false;
  try {
    const response = await fetcher(`${rpc.url}/rest/v1/rpc/zodiacs_mcp_usage_count_v1`, {
      method: 'POST', headers: rpc.headers, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(USAGE_TIMEOUT_MS), body: JSON.stringify({ usage_scope: rpc.scope, usage_tool: tool, usage_host: host }),
    });
    // Nothing is read from the reply; releasing it frees the connection.
    await response.body?.cancel().catch(() => {});
    return response.ok;
  } catch { return false; }
}
