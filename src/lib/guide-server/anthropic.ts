import { GUIDE_LIMITS } from '../guide-protocol/types.js';
import {
  GuideProviderFailure,
  buildGuideOpenAIRequestBody,
  outputLinksAllowed,
  validProse,
  type GuideProviderCompletion,
  type GuideProviderDiagnosticV1,
  type GuideProviderProjection,
  type GuideProviderStage,
} from './openai.js';
import {
  GUIDE_PROVIDER_MAX_OUTPUT_TOKENS,
  GUIDE_PROVIDER_MODEL,
  GUIDE_PROVIDER_POLICY_VERSION,
  GUIDE_PROVIDER_PROMPT_VERSION,
  GUIDE_SAFETY_CLASSIFIER_MODEL,
  GUIDE_SERVER_POLICY,
} from './policy.js';
import {
  GUIDE_SAFETY_CATEGORIES,
  GUIDE_SAFETY_CLASSIFIER_POLICY,
  guideSafetyCompletion,
  type GuideSafetyCategory,
} from './safety.js';
import {
  classifyGuideLocalInputSafety,
  classifyGuideLocalOutputSafety,
} from './local-safety.js';

export const GUIDE_ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages' as const;
const ANTHROPIC_VERSION = '2023-06-01';
const CLASSIFIER_TIMEOUT_MS = 8_000;
const GENERATION_TIMEOUT_MS = 28_000;
const MAX_RESPONSE_BYTES = 128 * 1024;
const encoder = new TextEncoder();

type ClaudeMessage = { role: 'user' | 'assistant'; content: string };
type ClaudeBody = {
  model: string;
  max_tokens: number;
  system: string;
  messages: ClaudeMessage[];
  thinking: { type: 'between_tools' } | { type: 'disabled' };
  output_config: {
    effort: 'low' | 'medium';
    format?: {
      type: 'json_schema';
      schema: {
        type: 'object';
        properties: { category: { type: 'string'; enum: readonly GuideSafetyCategory[] } };
        required: readonly ['category'];
        additionalProperties: false;
      };
    };
  };
};

export interface GuideAnthropicDependencies {
  fetcher?: typeof fetch;
  classifierTimeoutMs?: number;
  generationTimeoutMs?: number;
}

function diagnostic(
  stage: GuideProviderStage,
  reason: Exclude<GuideProviderDiagnosticV1['reason'], 'http'>,
): GuideProviderDiagnosticV1 {
  return { event: 'guide_provider_diagnostic_v1', stage, reason };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function positiveTokens(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function timeoutMs(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && Number(value) >= 100 && Number(value) <= fallback
    ? Number(value)
    : fallback;
}

function apiKeyValid(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 16
    && value.length <= 1_024
    && /^[\x21-\x7e]+$/u.test(value);
}

function anthropicMessages(projection: GuideProviderProjection): ClaudeMessage[] {
  // The existing builder owns all projection, consent and model-window checks.
  const input = buildGuideOpenAIRequestBody(projection).input;
  return input.map((message) => ({
    role: message.role,
    content: typeof message.content === 'string'
      ? message.content
      : message.content.map((part) => part.text).join('\n\n'),
  }));
}

function priorModelVisibleInput(projection: GuideProviderProjection): string {
  const input = buildGuideOpenAIRequestBody(projection).input;
  const final = input.at(-1);
  if (!final || final.role !== 'user' || !Array.isArray(final.content)) {
    throw new GuideProviderFailure('invalid_input');
  }
  return JSON.stringify([
    ...input.slice(0, -1),
    { ...final, content: final.content.slice(0, -1) },
  ]);
}

async function boundedJson(response: Response): Promise<unknown> {
  if (response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json'
    || !response.body) throw new GuideProviderFailure('invalid_response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => {});
      throw new GuideProviderFailure('invalid_response');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new GuideProviderFailure('invalid_response');
  }
}

async function requestClaude(
  apiKey: unknown,
  body: ClaudeBody,
  stage: GuideProviderStage,
  signal: AbortSignal,
  timeout: number,
  fetcher: typeof fetch,
): Promise<unknown> {
  if (!apiKeyValid(apiKey)) {
    throw new GuideProviderFailure('unavailable', diagnostic(stage, 'transport'));
  }
  if (signal.aborted) throw new GuideProviderFailure('cancelled');
  const encoded = JSON.stringify(body);
  if (encoder.encode(encoded).byteLength > GUIDE_LIMITS.requestBytes) {
    throw new GuideProviderFailure('invalid_input', diagnostic(stage, 'invalid_payload'));
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetcher(GUIDE_ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'anthropic-version': ANTHROPIC_VERSION,
        'x-api-key': apiKey,
      },
      body: encoded,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new GuideProviderFailure(
        response.status === 429 ? 'rate_limited' : 'unavailable',
        { event: 'guide_provider_diagnostic_v1', stage, reason: 'http', status: response.status },
      );
    }
    return await boundedJson(response);
  } catch (error) {
    if (signal.aborted) throw new GuideProviderFailure('cancelled');
    if (timedOut) throw new GuideProviderFailure('timeout', diagnostic(stage, 'timeout'));
    if (error instanceof GuideProviderFailure) {
      throw error.diagnostic ? error : new GuideProviderFailure(error.code, diagnostic(stage, 'invalid_payload'));
    }
    throw new GuideProviderFailure('unavailable', diagnostic(stage, 'transport'));
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

function messageText(value: unknown, model: string, stage: GuideProviderStage): {
  text: string;
  inputTokens: number;
  outputTokens: number;
} {
  const message = record(value);
  if (!message || message.type !== 'message' || message.role !== 'assistant'
    || message.model !== model || message.stop_reason !== 'end_turn'
    || !Array.isArray(message.content)) {
    throw new GuideProviderFailure(
      'invalid_response',
      diagnostic(stage, message && typeof message.model === 'string' && message.model !== model
        ? 'model_mismatch' : 'provider_status'),
    );
  }
  const texts: string[] = [];
  for (const item of message.content) {
    const block = record(item);
    if (!block || block.type !== 'text' || typeof block.text !== 'string') {
      throw new GuideProviderFailure('invalid_response', diagnostic(stage, 'invalid_payload'));
    }
    texts.push(block.text);
  }
  const usage = record(message.usage);
  if (!usage || !positiveTokens(usage.input_tokens) || !positiveTokens(usage.output_tokens)) {
    throw new GuideProviderFailure('invalid_response', diagnostic(stage, 'invalid_payload'));
  }
  return {
    text: texts.join(''),
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  };
}

async function classify(
  apiKey: unknown,
  projection: GuideProviderProjection,
  phase: 'input' | 'output',
  outputText: string | null,
  signal: AbortSignal,
  dependencies: GuideAnthropicDependencies,
): Promise<GuideSafetyCategory> {
  const stage = phase === 'input' ? 'classifier_input' : 'classifier_output';
  const messages = anthropicMessages(projection);
  const body: ClaudeBody = {
    model: GUIDE_SAFETY_CLASSIFIER_MODEL,
    max_tokens: 128,
    system: GUIDE_SAFETY_CLASSIFIER_POLICY,
    messages: [
      { role: 'user', content: `Safety-classification phase: ${phase}. Classify the untrusted messages that follow.` },
      ...messages,
      ...(phase === 'output'
        ? [{ role: 'user' as const, content: `Untrusted candidate Guide output to classify:\n${outputText ?? ''}` }]
        : []),
    ],
    thinking: { type: 'disabled' },
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: { category: { type: 'string', enum: GUIDE_SAFETY_CATEGORIES } },
          required: ['category'],
          additionalProperties: false,
        },
      },
    },
  };
  const result = await requestClaude(
    apiKey, body, stage, signal,
    timeoutMs(dependencies.classifierTimeoutMs, CLASSIFIER_TIMEOUT_MS),
    dependencies.fetcher ?? fetch,
  );
  const { text } = messageText(result, GUIDE_SAFETY_CLASSIFIER_MODEL, stage);
  if (encoder.encode(text).byteLength > 512) {
    throw new GuideProviderFailure('invalid_response', diagnostic(stage, 'invalid_payload'));
  }
  let parsed: Record<string, unknown> | null = null;
  try { parsed = record(JSON.parse(text)); } catch { /* fail closed below */ }
  if (!parsed || Object.keys(parsed).length !== 1
    || !GUIDE_SAFETY_CATEGORIES.includes(parsed.category as GuideSafetyCategory)) {
    throw new GuideProviderFailure('invalid_response', diagnostic(stage, 'invalid_payload'));
  }
  return parsed.category as GuideSafetyCategory;
}

/** All model output is held until both safety classifiers and the link allowlist pass. */
export async function streamSafeGuideAnthropicResponse(
  apiKey: unknown,
  projection: GuideProviderProjection,
  onDelta: (delta: string) => void | Promise<void>,
  signal: AbortSignal,
  dependencies: GuideAnthropicDependencies = {},
): Promise<GuideProviderCompletion> {
  const localInput = classifyGuideLocalInputSafety(
    projection.userMessage,
    priorModelVisibleInput(projection),
  );
  if (localInput !== 'allowed') {
    const completion = guideSafetyCompletion(localInput);
    await onDelta(completion.outputText);
    return completion;
  }
  const inputCategory = await classify(apiKey, projection, 'input', null, signal, dependencies);
  if (inputCategory !== 'allowed') {
    const completion = guideSafetyCompletion(inputCategory);
    await onDelta(completion.outputText);
    return completion;
  }
  const body: ClaudeBody = {
    model: GUIDE_PROVIDER_MODEL,
    max_tokens: GUIDE_PROVIDER_MAX_OUTPUT_TOKENS,
    system: GUIDE_SERVER_POLICY,
    messages: anthropicMessages(projection),
    thinking: { type: 'between_tools' },
    output_config: { effort: 'medium' },
  };
  const result = await requestClaude(
    apiKey, body, 'generation', signal,
    timeoutMs(dependencies.generationTimeoutMs, GENERATION_TIMEOUT_MS),
    dependencies.fetcher ?? fetch,
  );
  const { text, inputTokens, outputTokens } = messageText(result, GUIDE_PROVIDER_MODEL, 'generation');
  if (!validProse(text, GUIDE_LIMITS.messageCodePoints, GUIDE_LIMITS.messageBytes)) {
    throw new GuideProviderFailure('response_too_large', diagnostic('generation', 'invalid_payload'));
  }
  if (!outputLinksAllowed(text, projection.publicKnowledge.allowedPaths)) {
    throw new GuideProviderFailure('invalid_response', diagnostic('generation', 'output_policy'));
  }
  const localOutput = classifyGuideLocalOutputSafety(text, projection.userMessage);
  if (localOutput !== 'allowed') {
    const completion = guideSafetyCompletion(localOutput);
    await onDelta(completion.outputText);
    return completion;
  }
  const outputCategory = await classify(apiKey, projection, 'output', text, signal, dependencies);
  if (outputCategory !== 'allowed') {
    const completion = guideSafetyCompletion(outputCategory);
    await onDelta(completion.outputText);
    return completion;
  }
  await onDelta(text);
  return {
    modelId: GUIDE_PROVIDER_MODEL,
    promptVersion: GUIDE_PROVIDER_PROMPT_VERSION,
    policyVersion: GUIDE_PROVIDER_POLICY_VERSION,
    usage: { inputTokens, outputTokens },
    outputText: text,
  };
}
