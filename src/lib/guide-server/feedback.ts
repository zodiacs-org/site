/**
 * Guide's answer votes, counted by UTC day in Supabase
 * (`guide_feedback_count_v1`, migration 20261106015900_guide_feedback_daily):
 * the RPC receives the vote, 'up' or 'down', and nothing else. No visitor,
 * conversation, question, answer or request detail is sent or logged. A
 * failed count is dropped silently; it never changes the vote's 204.
 */
import type { GuideFeedbackVote } from './handler.js';
import { guideServiceRpc } from './quota.js';

const GUIDE_FEEDBACK_TIMEOUT_MS = 3_000;

/** Adds one vote to today's count. Resolves true when it was counted; never rejects. */
export async function countGuideFeedback(
  fetcher: typeof fetch,
  env: Record<string, unknown>,
  vote: GuideFeedbackVote,
): Promise<boolean> {
  if (vote !== 'up' && vote !== 'down') return false;
  const rpc = guideServiceRpc(env, 'guide_feedback_count_v1');
  if (!rpc) return false;
  try {
    const response = await fetcher(rpc.url, {
      method: 'POST',
      headers: rpc.headers,
      body: JSON.stringify({ feedback_vote: vote }),
      signal: AbortSignal.timeout(GUIDE_FEEDBACK_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => {});
    return response.ok;
  } catch {
    return false;
  }
}
