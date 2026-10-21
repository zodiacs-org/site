import { describe, expect, it, vi } from 'vitest';
import {
  GUIDE_OPENAI_RESPONSES_URL,
  GuideProviderFailure,
  buildGuideOpenAIRequestBody,
  buildGuideOpenAITransportRequest,
  parseGuideOpenAIProviderEvent,
  streamGuideOpenAIResponse,
  type GuideProviderProjection,
} from './openai';
import {
  GUIDE_PROVIDER_MODEL,
  GUIDE_PROVIDER_PROMPT_VERSION,
  GUIDE_SERVER_POLICY,
} from './policy';

function projection(overrides: Partial<GuideProviderProjection> = {}): GuideProviderProjection {
  return {
    baseContext: {
      ownerChart: {
        slot: 'owner_chart',
        state: 'active',
        source: {
          kind: 'owner_chart',
          title: 'My chart',
          facts: 'Sun in Leo. Moon in Taurus.',
          subject: {
            boundary: 'root_user',
            subjectId: 'self',
            subjectName: 'You',
            subjectIsUser: true,
          },
          containsThirdPartyData: false,
        },
      },
      todaySky: {
        slot: 'today_sky',
        state: 'active',
        source: {
          kind: 'today_sky',
          title: "Today's sky",
          facts: 'The Moon is in Virgo.',
          subject: {
            boundary: 'public_reference',
            subjectId: 'sky:2026-08-12',
            subjectName: null,
            subjectIsUser: false,
          },
          containsThirdPartyData: false,
        },
      },
    },
    attachments: [],
    publicKnowledge: {
      version: 'guide-public-knowledge-2026-08-20.1',
      entries: [{
        id: 'astrology-method',
        title: 'How Zodiacs.org treats astrology',
        canonicalPath: '/methodology/',
        topics: ['astrology'],
        facts: 'Astrology is interpretive rather than scientific causation.',
      }],
      allowedPaths: ['/methodology/'],
    },
    history: [
      { author: 'user', content: 'What should I notice today?' },
      { author: 'guide', content: 'Slow down and check the practical details.' },
    ],
    userMessage: 'What is one useful next step?',
    ...overrides,
  };
}

function providerStream(events: unknown[]): Response {
  const bytes = new TextEncoder().encode(events.map((event) => (
    `event: ${String((event as any).type ?? 'message')}\ndata: ${JSON.stringify(event)}\n\n`
  )).join(''));
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }), {
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8' },
  });
}

function openAIFetch(provider: () => Response) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => provider());
}

describe('Legacy Guide OpenAI adapter', () => {
  it('pins model, immutable policy, bounded output, and store false', () => {
    const body = buildGuideOpenAIRequestBody(projection());
    expect(body).toMatchObject({
      model: GUIDE_PROVIDER_MODEL,
      instructions: GUIDE_SERVER_POLICY,
      max_output_tokens: 700,
      stream: true,
      store: false,
      background: false,
      truncation: 'disabled',
      metadata: {
        product: 'guide',
        prompt_version: GUIDE_PROVIDER_PROMPT_VERSION,
      },
    });
    const currentInput = body.input.at(-1);
    if (!currentInput || currentInput.role !== 'user' || !Array.isArray(currentInput.content)) {
      throw new Error('Expected the current user turn to use multipart Responses input');
    }
    expect(currentInput.content[0]?.text).toContain('untrusted_context_data');
    expect(currentInput.content[0]?.text).toContain('Sun in Leo');
    expect(JSON.stringify(body)).not.toContain('11111111-1111');
  });

  it('replays a two-turn transcript with documented Responses EasyInputMessage history', () => {
    const body = buildGuideOpenAIRequestBody(projection());

    expect(body.input.slice(0, -1)).toEqual([
      {
        role: 'user',
        content: 'What should I notice today?',
      },
      {
        type: 'message',
        role: 'assistant',
        phase: 'final_answer',
        content: 'Slow down and check the practical details.',
      },
    ]);
    const currentInput = body.input.at(-1);
    if (!currentInput || currentInput.role !== 'user' || !Array.isArray(currentInput.content)) {
      throw new Error('Expected the current user turn to use multipart Responses input');
    }
    expect(currentInput.content).toHaveLength(2);
    expect(currentInput.content[0]).toMatchObject({ type: 'input_text' });
    expect(currentInput.content[1]).toEqual({
      type: 'input_text',
      text: 'What is one useful next step?',
    });
    expect(body.input.filter(({ role }) => role === 'assistant')).toEqual([
      {
        type: 'message',
        role: 'assistant',
        phase: 'final_answer',
        content: 'Slow down and check the practical details.',
      },
    ]);
  });

  it('keeps the reused server key only in the outbound Authorization header', () => {
    const key = 'sk-server-only-example-value';
    const controller = new AbortController();
    const request = buildGuideOpenAITransportRequest(
      key,
      buildGuideOpenAIRequestBody(projection()),
      controller.signal,
    );
    expect(request.url).toBe(GUIDE_OPENAI_RESPONSES_URL);
    expect(request.headers.authorization).toBe(`Bearer ${key}`);
    expect(request.body).not.toContain(key);
    expect(JSON.parse(request.body)).toMatchObject({ store: false, model: GUIDE_PROVIDER_MODEL });
  });

  it('parses only text deltas and bounded completion metadata', () => {
    expect(parseGuideOpenAIProviderEvent(
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hello "}',
    )).toEqual({ type: 'delta', text: 'Hello ' });
    expect(parseGuideOpenAIProviderEvent(
      'data: {"type":"response.completed","response":{"status":"completed","model":"claude-sonnet-5-5","usage":{"input_tokens":10,"output_tokens":2}}}',
    )).toEqual({
      type: 'completed',
      usage: { inputTokens: 10, outputTokens: 2 },
    });
    expect(parseGuideOpenAIProviderEvent(
      'data: {"type":"response.created","response":{"id":"private-provider-id"}}',
    )).toBeNull();
    let mismatch: unknown;
    try {
      parseGuideOpenAIProviderEvent(
        'data: {"type":"response.completed","response":{"status":"completed","model":"fallback-model","usage":{"input_tokens":10,"output_tokens":2}}}',
      );
    } catch (error) {
      mismatch = error;
    }
    expect(mismatch).toBeInstanceOf(GuideProviderFailure);
    expect(mismatch).toMatchObject({
      code: 'invalid_response',
      diagnostic: {
        event: 'guide_provider_diagnostic_v1',
        stage: 'generation',
        reason: 'model_mismatch',
      },
    });
    expect(JSON.stringify(mismatch)).not.toContain('fallback-model');
  });

  it('streams sanitized text without exposing provider IDs or raw events', async () => {
    const deltas: string[] = [];
    const fetcher = openAIFetch(() => providerStream([
      { type: 'response.created', response: { id: 'resp_private' } },
      { type: 'response.output_text.delta', delta: 'One ' },
      { type: 'response.output_text.delta', delta: 'step.' },
      {
        type: 'response.completed',
        response: {
          id: 'resp_private',
          status: 'completed',
          model: 'claude-sonnet-5-5',
          usage: { input_tokens: 100, output_tokens: 8 },
        },
      },
    ]));
    const completion = await streamGuideOpenAIResponse(
      'sk-server-only-example-value',
      projection(),
      (delta) => { deltas.push(delta); },
      new AbortController().signal,
      { fetcher: fetcher as typeof fetch },
    );
    expect(deltas).toEqual(['One ', 'step.']);
    expect(completion).toEqual({
      modelId: 'claude-sonnet-5-5',
      promptVersion: GUIDE_PROVIDER_PROMPT_VERSION,
      policyVersion: expect.any(String),
      usage: { inputTokens: 100, outputTokens: 8 },
      outputText: 'One step.',
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]![0]).toBe(GUIDE_OPENAI_RESPONSES_URL);
    const request = fetcher.mock.calls[0]![1]!;
    expect(JSON.parse(String(request.body))).toMatchObject({ store: false, background: false });
  });

  it('rejects malformed provider output and never forwards provider error text', async () => {
    const fetcher = openAIFetch(() => providerStream([
      { type: 'response.output_text.delta', delta: 'Partial' },
      { type: 'error', message: 'secret provider diagnostic' },
    ]));
    await expect(streamGuideOpenAIResponse(
      'sk-server-only-example-value',
      projection(),
      () => {},
      new AbortController().signal,
      { fetcher: fetcher as typeof fetch },
    )).rejects.toMatchObject({
      code: 'invalid_response',
      diagnostic: {
        event: 'guide_provider_diagnostic_v1',
        stage: 'generation',
        reason: 'provider_status',
      },
    });
  });

  it('allows only server-selected Zodiacs links in completed output', async () => {
    const streamWithText = (text: string) => providerStream([
      { type: 'response.output_text.delta', delta: text },
      {
        type: 'response.completed',
        response: {
          status: 'completed',
          model: 'claude-sonnet-5-5',
          usage: { input_tokens: 10, output_tokens: 10 },
        },
      },
    ]);
    const allowedFetcher = openAIFetch(() => streamWithText('See [Methodology](/methodology/).'));
    await expect(streamGuideOpenAIResponse(
      'sk-server-only-example-value',
      projection(),
      () => {},
      new AbortController().signal,
      { fetcher: allowedFetcher as typeof fetch },
    )).resolves.toMatchObject({ outputText: 'See [Methodology](/methodology/).' });

    const moonProjection = projection({
      publicKnowledge: {
        version: 'guide-public-knowledge-2026-08-20.1',
        entries: [{
          id: 'moon-sign',
          title: 'Moon sign',
          canonicalPath: '/moon-sign/',
          topics: ['moon sign', 'sun sign'],
          facts: 'The Sun and Moon signs describe different parts of a chart.',
        }],
        allowedPaths: ['/moon-sign/'],
      },
    });
    const allowedMoonFetcher = openAIFetch(() => streamWithText(
      'Compare the two at /moon-sign/.',
    ));
    await expect(streamGuideOpenAIResponse(
      'sk-server-only-example-value',
      moonProjection,
      () => {},
      new AbortController().signal,
      { fetcher: allowedMoonFetcher as typeof fetch },
    )).resolves.toMatchObject({ outputText: 'Compare the two at /moon-sign/.' });

    const unselectedMoonFetcher = openAIFetch(() => streamWithText(
      'Compare the two at /moon-sign/.',
    ));
    await expect(streamGuideOpenAIResponse(
      'sk-server-only-example-value',
      projection(),
      () => {},
      new AbortController().signal,
      { fetcher: unselectedMoonFetcher as typeof fetch },
    )).rejects.toMatchObject({
      code: 'invalid_response',
      diagnostic: {
        event: 'guide_provider_diagnostic_v1',
        stage: 'generation',
        reason: 'output_policy',
      },
    });

    const disallowedFetcher = openAIFetch(() => streamWithText('Visit https://evil.example now.'));
    await expect(streamGuideOpenAIResponse(
      'sk-server-only-example-value',
      projection(),
      () => {},
      new AbortController().signal,
      { fetcher: disallowedFetcher as typeof fetch },
    )).rejects.toMatchObject({
      code: 'invalid_response',
      diagnostic: {
        event: 'guide_provider_diagnostic_v1',
        stage: 'generation',
        reason: 'output_policy',
      },
    });

    const allowedBareFetcher = openAIFetch(() => streamWithText('Read /methodology/ for details.'));
    await expect(streamGuideOpenAIResponse(
      'sk-server-only-example-value',
      projection(),
      () => {},
      new AbortController().signal,
      { fetcher: allowedBareFetcher as typeof fetch },
    )).resolves.toMatchObject({ outputText: 'Read /methodology/ for details.' });

    for (const output of [
      'Visit /terminal/ next.',
      'Visit https://zodiacs.org:444/methodology/ next.',
    ]) {
      const fetcher = openAIFetch(() => streamWithText(output));
      await expect(streamGuideOpenAIResponse(
        'sk-server-only-example-value',
        projection(),
        () => {},
        new AbortController().signal,
        { fetcher: fetcher as typeof fetch },
      )).rejects.toMatchObject({ code: 'invalid_response' });
    }
  });

  it('does not start a provider request after cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn();
    await expect(streamGuideOpenAIResponse(
      'sk-server-only-example-value',
      projection(),
      () => {},
      controller.signal,
      { fetcher: fetcher as typeof fetch },
    )).rejects.toMatchObject({ code: 'cancelled' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('enforces the final Guide message bound across many valid deltas', async () => {
    const fetcher = openAIFetch(() => providerStream([
      { type: 'response.output_text.delta', delta: 'a'.repeat(2_000) },
      { type: 'response.output_text.delta', delta: 'b'.repeat(500) },
      {
        type: 'response.completed',
        response: {
          status: 'completed',
          model: 'claude-sonnet-5-5',
          usage: { input_tokens: 10, output_tokens: 10 },
        },
      },
    ]));
    await expect(streamGuideOpenAIResponse(
      'sk-server-only-example-value',
      projection(),
      () => {},
      new AbortController().signal,
      { fetcher: fetcher as typeof fetch },
    )).rejects.toMatchObject({ code: 'response_too_large' });
  });

  it('fails closed for mismatched ownership and oversized model input', () => {
    const wrongOwner = projection();
    wrongOwner.baseContext.ownerChart.source!.subject = {
      boundary: 'saved_person',
      subjectId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      subjectName: 'Someone else',
      subjectIsUser: false,
    };
    wrongOwner.baseContext.ownerChart.source!.containsThirdPartyData = true;
    expect(() => buildGuideOpenAIRequestBody(wrongOwner)).toThrow(GuideProviderFailure);

    expect(() => buildGuideOpenAIRequestBody(projection({
      userMessage: 'x'.repeat(2_401),
    }))).toThrow(GuideProviderFailure);
  });
});
