import { describe, expect, it, vi } from 'vitest';
import {
  GUIDE_ANTHROPIC_MESSAGES_URL,
  streamSafeGuideAnthropicResponse,
} from './anthropic';
import { GuideProviderFailure, type GuideProviderProjection } from './openai';
import { GUIDE_PROVIDER_MODEL, GUIDE_SAFETY_CLASSIFIER_MODEL, GUIDE_SAFETY_RESPONSE_MODEL } from './policy';

const KEY = 'sk-ant-test-value-long-enough';

function projection(): GuideProviderProjection {
  return {
    baseContext: {
      ownerChart: {
        slot: 'owner_chart', state: 'active',
        source: {
          kind: 'owner_chart', title: 'My chart', facts: 'Sun in Leo.',
          subject: { boundary: 'root_user', subjectId: 'self', subjectName: 'You', subjectIsUser: true },
          containsThirdPartyData: false,
        },
      },
      todaySky: { slot: 'today_sky', state: 'unavailable', source: null },
    },
    attachments: [],
    publicKnowledge: { version: 'guide-public-knowledge-2026-08-20.1', entries: [], allowedPaths: [] },
    history: [],
    userMessage: 'What is one useful next step?',
  };
}

function claudeMessage(model: string, text: string, stopReason = 'end_turn') {
  return Response.json({
    type: 'message', role: 'assistant', model,
    stop_reason: stopReason,
    content: [{ type: 'text', text }],
    usage: { input_tokens: 21, output_tokens: 9 },
  });
}

function sequence(...responses: Response[]) {
  let index = 0;
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => (
    responses[index++] ?? Response.json({}, { status: 500 })
  ));
}

describe('Guide Claude provider boundary', () => {
  it('uses workspace Claude credentials and releases only the fully classified answer', async () => {
    const fetcher = sequence(
      claudeMessage(GUIDE_SAFETY_CLASSIFIER_MODEL, '{"category":"allowed"}'),
      claudeMessage(GUIDE_PROVIDER_MODEL, 'Notice one useful detail today.'),
      claudeMessage(GUIDE_SAFETY_CLASSIFIER_MODEL, '{"category":"allowed"}'),
    );
    const deltas: string[] = [];
    const completion = await streamSafeGuideAnthropicResponse(
      KEY, projection(), (delta) => { deltas.push(delta); }, new AbortController().signal, { fetcher },
    );
    expect(deltas).toEqual(['Notice one useful detail today.']);
    expect(completion.modelId).toBe(GUIDE_PROVIDER_MODEL);
    expect(completion.usage).toEqual({ inputTokens: 21, outputTokens: 9 });
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetcher.mock.calls) {
      const request = init as RequestInit & { headers: Record<string, string>; body: string };
      expect(url).toBe(GUIDE_ANTHROPIC_MESSAGES_URL);
      expect(request.headers['x-api-key']).toBe(KEY);
      expect(request.headers['anthropic-version']).toBe('2023-06-01');
      expect(request.body).not.toContain(KEY);
    }
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body)).model).toBe(GUIDE_SAFETY_CLASSIFIER_MODEL);
    expect(JSON.parse(String(fetcher.mock.calls[1]![1]!.body))).toMatchObject({
      model: GUIDE_PROVIDER_MODEL,
      thinking: { type: 'between_tools' },
      output_config: { effort: 'medium' },
    });
  });

  it('does not release generated text when the output classifier rejects it', async () => {
    const fetcher = sequence(
      claudeMessage(GUIDE_SAFETY_CLASSIFIER_MODEL, '{"category":"allowed"}'),
      claudeMessage(GUIDE_PROVIDER_MODEL, 'You should buy it today.'),
      claudeMessage(GUIDE_SAFETY_CLASSIFIER_MODEL, '{"category":"financial"}'),
    );
    const deltas: string[] = [];
    const completion = await streamSafeGuideAnthropicResponse(
      KEY, projection(), (delta) => { deltas.push(delta); }, new AbortController().signal, { fetcher },
    );
    expect(completion.modelId).toBe(GUIDE_SAFETY_RESPONSE_MODEL);
    expect(deltas).toEqual([completion.outputText]);
    expect(deltas.join('')).not.toContain('buy it today');
  });

  it('fails closed on a wrong model and never releases its output', async () => {
    const fetcher = sequence(
      claudeMessage(GUIDE_SAFETY_CLASSIFIER_MODEL, '{"category":"allowed"}'),
      claudeMessage('claude-opus-5-5', 'Unverified text.'),
    );
    const onDelta = vi.fn();
    await expect(streamSafeGuideAnthropicResponse(
      KEY, projection(), onDelta, new AbortController().signal, { fetcher },
    )).rejects.toMatchObject({ code: 'invalid_response' } satisfies Partial<GuideProviderFailure>);
    expect(onDelta).not.toHaveBeenCalled();
  });
});
