import {
  GUIDE_LIMITS,
  GUIDE_SCHEMAS,
  type GuideAccountContextMutationDraftV1,
  type GuideAnonymousImportPreviewAuthorityDraftV1,
  type GuideAuthorizationStateDraftV1,
  type GuideContextSourceDraftV1,
  type GuideContextMutationDraftV1,
  type GuideConversationDraftV1,
  type GuideDraftHandoffDraftV1,
  type GuideLiveOwnerFenceDraftV1,
  type GuideStreamAccumulatorDraftV1,
  type GuideStreamEventDraftV1,
  type GuideStreamLiveAuthorityDraftV1,
  type GuideTurnOperationReceiptDraftV1,
  type GuideTurnRequestDraftV1,
} from './types.js';
import { guideModelHistory } from './context-state.js';
import {
  guideUtf8Bytes,
  parseGuideAccountContextMutationDraftV1,
  parseGuideContextSourceDraftV1,
  parseGuideContextMutationDraftV1,
  parseGuideConversationDraftV1,
  parseGuideDraftHandoffDraftV1,
  parseGuideExplicitAnonymousImportDraftV1,
  parseGuideStreamEventDraftV1,
  parseGuideTurnRequestDraftV1,
  parseGuideTurnOperationReceiptDraftV1,
} from './validators.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DIGEST = /^[a-f0-9]{64}$/u;
const SERVER_SEMANTIC_VERIFIER = /^[1-9][0-9]{0,5}:[a-f0-9]{64}$/u;
const LEGACY_ASSISTANT_MESSAGE_CODE_UNITS = 1_200;

export function guideGenerationAllowed(authorization: GuideAuthorizationStateDraftV1): boolean {
  return authorization.cloudProcessingConsent === 'granted'
    && authorization.generationEntitlement === 'allowed';
}

/** UI eligibility only; never use this as server authorization. */
export function guideAccountSyncUiEligible(
  authorization: GuideAuthorizationStateDraftV1,
  authenticated: boolean,
): boolean {
  return authenticated && authorization.conversationSyncConsent === 'granted';
}

/** Read/export/delete never depend on generation entitlement or rollout state. */
export function guidePrivacyControlAllowed(
  authenticatedAccountId: string | null,
  resourceAccountId: string,
): boolean {
  return authenticatedAccountId !== null
    && UUID.test(authenticatedAccountId)
    && UUID.test(resourceAccountId)
    && authenticatedAccountId === resourceAccountId;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(',')}}`;
}

async function sha256Hex(value: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function sourceScope(source: GuideContextSourceDraftV1 | null) {
  return source === null ? null : {
    kind: source.kind,
    sourceId: source.sourceId,
    sourceRevision: source.sourceRevision,
    contentDigest: source.contentDigest,
    subject: {
      boundary: source.subject.boundary,
      subjectId: source.subject.subjectId,
      subjectIsUser: source.subject.subjectIsUser,
    },
  };
}

/**
 * Recomputes a local source digest from the exact model-visible projection.
 * A protected server uses this value instead of trusting a client digest.
 */
export async function createGuideLocalSourceContentDigestDraftV1(
  candidate: GuideContextSourceDraftV1,
): Promise<string | null> {
  const source = parseGuideContextSourceDraftV1(candidate);
  if (!source || source.persistence !== 'local_only' || source.facts === null) return null;
  return sha256Hex(canonicalJson({
    domain: 'zodiacs.guide.source-content.draft.v1',
    kind: source.kind,
    sourceId: source.sourceId,
    sourceRevision: source.sourceRevision,
    title: source.title,
    facts: source.facts,
    subject: source.subject,
    containsThirdPartyData: source.containsThirdPartyData,
  }));
}

async function contextScopeDigest(
  conversationId: string,
  contextEpoch: number,
  modelHistoryStartSequence: number,
  baseContext: GuideConversationDraftV1['baseContext'],
  attachments: GuideContextSourceDraftV1[],
  history: GuideConversationDraftV1['messages'],
): Promise<string | null> {
  const sourceCandidates = [
    baseContext.ownerChart.source,
    baseContext.todaySky.source,
    ...attachments,
  ];
  const scopedSources: Array<GuideContextSourceDraftV1 | null> = [];
  for (const source of sourceCandidates) {
    if (source === null) {
      scopedSources.push(null);
      continue;
    }
    if (source.persistence === 'account_reference') {
      scopedSources.push(source);
      continue;
    }
    const contentDigest = await createGuideLocalSourceContentDigestDraftV1(source);
    if (!contentDigest) return null;
    scopedSources.push({ ...source, contentDigest });
  }
  const [ownerChartSource, todaySkySource, ...attachmentSources] = scopedSources;
  const historyProjection = [];
  for (const message of history) {
    const contentDigest = await sha256Hex(message.content);
    if (!contentDigest) return null;
    historyProjection.push({
      sequence: message.sequence,
      messageId: message.messageId,
      author: message.author,
      contentDigest,
    });
  }
  return sha256Hex(canonicalJson({
    domain: 'zodiacs.guide.context-scope.draft.v1',
    conversationId,
    contextEpoch,
    modelHistoryStartSequence,
    history: historyProjection,
    base: [
      { slot: 'owner_chart', state: baseContext.ownerChart.state, source: sourceScope(ownerChartSource ?? null) },
      { slot: 'today_sky', state: baseContext.todaySky.state, source: sourceScope(todaySkySource ?? null) },
    ],
    attachments: attachmentSources.map((source) => sourceScope(source ?? null)),
  }));
}

/** Canonical disclosure scope for an authoritative conversation snapshot. */
export async function createGuideContextScopeDigestDraftV1(
  candidateState: GuideConversationDraftV1,
): Promise<string | null> {
  const state = parseGuideConversationDraftV1(candidateState);
  if (!state || state.modelContextState !== 'active') return null;
  return contextScopeDigest(
    state.conversationId,
    state.contextEpoch,
    state.modelHistoryStartSequence,
    state.baseContext,
    state.attachments,
    guideModelHistory(state),
  );
}

/** Same scope algorithm for the protected non-persistent request path. */
export async function createGuideEphemeralContextScopeDigestDraftV1(
  candidateRequest: GuideTurnRequestDraftV1,
): Promise<string | null> {
  const request = parseGuideTurnRequestDraftV1(candidateRequest);
  if (!request || request.mode !== 'ephemeral') return null;
  return contextScopeDigest(
    request.conversationId,
    request.contextEpoch,
    request.ephemeralContext.modelHistoryStartSequence,
    request.ephemeralContext.baseContext,
    request.ephemeralContext.attachments,
    request.ephemeralContext.history,
  );
}

/**
 * Produces an in-memory-only retry verifier without server authority. It must
 * never be persisted, logged, or uploaded; authenticated sync replaces local
 * receipts with a server HMAC result.
 */
export async function createGuideLocalMutationVerifier(
  candidate: GuideContextMutationDraftV1,
): Promise<string | null> {
  const mutation = parseGuideContextMutationDraftV1(candidate);
  if (!mutation) return null;
  const hex = await sha256Hex(canonicalJson(mutation));
  if (!hex) return null;
  return `local:${hex}`;
}

export type GuideTurnStartDecision =
  | 'allowed'
  | 'invalid_state'
  | 'invalid_request'
  | 'conversation_mismatch'
  | 'revision_conflict'
  | 'context_changed'
  | 'model_context_disabled'
  | 'consent_required'
  | 'consent_policy_mismatch'
  | 'consent_scope_mismatch'
  | 'entitlement_required'
  | 'authentication_required'
  | 'account_boundary_conflict'
  | 'sync_consent_required'
  | 'request_too_large'
  | 'persistence_mismatch';

export interface GuideTurnAuthoritySnapshot {
  owner: GuideLiveOwnerFenceDraftV1;
  processingPolicyVersion: string;
  processingConsentRevision: number;
  processingDisclosureId: string;
  processingContextEpoch: number;
  processingContextScopeDigest: string;
  /** Recomputed by the server from the exact authoritative model input. */
  currentContextEpoch: number;
  currentContextScopeDigest: string;
  currentModelInputBytes: number;
}

function ownerMatchesState(
  state: GuideConversationDraftV1,
  owner: GuideLiveOwnerFenceDraftV1,
): boolean {
  if (state.ownerBoundary.kind !== owner.kind) return false;
  return state.ownerBoundary.kind === 'account'
    ? owner.kind === 'account' && state.ownerBoundary.accountId === owner.accountId
    : owner.kind === 'anonymous' && state.ownerBoundary.localOwnerId === owner.localOwnerId;
}

/**
 * Pure preflight only. A protected server repeats these checks after deriving
 * account ownership and entitlement; a client result is never authority.
 */
export function guideTurnStartDecision(
  candidateState: GuideConversationDraftV1,
  candidateRequest: GuideTurnRequestDraftV1,
  authorization: GuideAuthorizationStateDraftV1,
  authority: GuideTurnAuthoritySnapshot,
): GuideTurnStartDecision {
  const state = parseGuideConversationDraftV1(candidateState);
  if (!state) return 'invalid_state';
  const request = parseGuideTurnRequestDraftV1(candidateRequest);
  if (!request) return 'invalid_request';
  if (request.clientAuthEpoch !== authority.owner.clientAuthEpoch
    || !ownerMatchesState(state, authority.owner)) return 'account_boundary_conflict';
  if (state.conversationId !== request.conversationId) return 'conversation_mismatch';
  if (state.revision !== request.baseRevision) return 'revision_conflict';
  if (state.contextEpoch !== request.contextEpoch) return 'context_changed';
  if (state.modelContextState !== 'active') return 'model_context_disabled';
  if (authorization.cloudProcessingConsent !== 'granted') return 'consent_required';
  if (request.consent.policyVersion !== authority.processingPolicyVersion
    || request.consent.consentRevision !== authority.processingConsentRevision) {
    return 'consent_policy_mismatch';
  }
  if (request.consent.disclosureId !== authority.processingDisclosureId
    || request.consent.disclosedContextEpoch !== authority.processingContextEpoch
    || request.consent.contextScopeDigest !== authority.processingContextScopeDigest
    || request.contextEpoch !== authority.processingContextEpoch) return 'consent_scope_mismatch';
  if (state.contextEpoch !== authority.currentContextEpoch
    || request.contextEpoch !== authority.currentContextEpoch) return 'context_changed';
  if (request.consent.contextScopeDigest !== authority.currentContextScopeDigest
    || authority.processingContextScopeDigest !== authority.currentContextScopeDigest) {
    return 'consent_scope_mismatch';
  }
  if (authorization.generationEntitlement !== 'allowed') return 'entitlement_required';
  if (!Number.isSafeInteger(authority.currentModelInputBytes)
    || authority.currentModelInputBytes < 0
    || authority.currentModelInputBytes > GUIDE_LIMITS.modelWindowBytes) {
    return 'request_too_large';
  }
  if (request.mode === 'account') {
    if (authority.owner.kind !== 'account' || state.ownerBoundary.kind !== 'account') {
      return 'authentication_required';
    }
    if (authorization.conversationSyncConsent !== 'granted') return 'sync_consent_required';
    return state.persistence === 'account_synced' ? 'allowed' : 'persistence_mismatch';
  }
  return state.persistence === 'memory_only' ? 'allowed' : 'persistence_mismatch';
}

export type GuideTrustedSourceAuthority = 'account_v2_self_chart' | 'public_source_catalog';

export interface GuideTrustedSourceResolution {
  authority: GuideTrustedSourceAuthority;
  source: GuideContextSourceDraftV1;
}

/** Policy applies only after a server lookup under the bearer-derived account. */
export function guideTrustedSourceMaySyncToAccount(
  candidate: GuideTrustedSourceResolution,
): boolean {
  const source = parseGuideContextSourceDraftV1(candidate.source);
  if (!source || source.persistence !== 'account_reference') return false;
  if (source.kind === 'chart' || source.kind === 'owner_chart') {
    return candidate.authority === 'account_v2_self_chart'
      && source.subject.boundary === 'root_user'
      && source.subject.subjectIsUser === true;
  }
  return candidate.authority === 'public_source_catalog'
    && ['today_sky', 'today', 'site_page', 'historical_date', 'learn_term'].includes(source.kind)
    && source.subject.boundary === 'public_reference'
    && source.subject.subjectIsUser === false;
}

export function hydrateGuideAccountContextMutation(
  candidateMutation: GuideAccountContextMutationDraftV1,
  trustedResolution: GuideTrustedSourceResolution | null,
  liveOwner: GuideLiveOwnerFenceDraftV1,
): GuideContextMutationDraftV1 | null {
  const mutation = parseGuideAccountContextMutationDraftV1(candidateMutation);
  if (!mutation
    || liveOwner.kind !== 'account'
    || !UUID.test(liveOwner.accountId)
    || !UUID.test(liveOwner.sessionId)
    || mutation.clientAuthEpoch !== liveOwner.clientAuthEpoch) return null;
  const common = {
    schema: GUIDE_SCHEMAS.contextMutation,
    conversationId: mutation.conversationId,
    operationId: mutation.operationId,
    baseRevision: mutation.baseRevision,
  } as const;
  if (mutation.operation === 'remove') {
    return parseGuideContextMutationDraftV1({
      ...common, operation: 'remove', sourceId: mutation.sourceId,
    });
  }
  if (mutation.operation === 'clear') {
    return parseGuideContextMutationDraftV1({
      ...common, operation: 'clear', scope: mutation.scope,
    });
  }
  if (!trustedResolution || !guideTrustedSourceMaySyncToAccount(trustedResolution)) return null;
  const source = parseGuideContextSourceDraftV1(trustedResolution.source);
  const reference = mutation.operation === 'attach'
    ? mutation.sourceRef
    : mutation.replacementRef;
  if (!source
    || source.kind !== reference?.kind
    || source.sourceId !== reference.sourceId
    || source.sourceRevision !== reference.sourceRevision) return null;
  if (mutation.operation === 'attach') {
    return parseGuideContextMutationDraftV1({ ...common, operation: 'attach', source });
  }
  return parseGuideContextMutationDraftV1({
    ...common,
    operation: 'replace',
    targetSourceId: mutation.targetSourceId,
    replacement: source,
  });
}

/** Canonical preimage digest; production stores only a service HMAC over it. */
export async function createGuideAccountContextMutationSemanticDigestDraftV1(
  candidateMutation: GuideAccountContextMutationDraftV1,
  derivedAccountId: string,
  authSessionId: string,
  resolvedContentDigest: string | null,
): Promise<string | null> {
  const mutation = parseGuideAccountContextMutationDraftV1(candidateMutation);
  if (!mutation || !UUID.test(derivedAccountId) || !UUID.test(authSessionId)) return null;
  const sourceMutation = mutation.operation === 'attach' || mutation.operation === 'replace';
  if (sourceMutation ? !resolvedContentDigest || !DIGEST.test(resolvedContentDigest)
    : resolvedContentDigest !== null) return null;
  return sha256Hex(canonicalJson({
    domain: 'zodiacs.guide.account-context-mutation-semantic.draft.v1',
    accountId: derivedAccountId,
    authSessionId,
    mutation,
    resolvedContentDigest,
  }));
}

export type GuideExplicitImportDecision =
  | 'allowed'
  | 'account_boundary_conflict'
  | 'preview_changed'
  | 'source_policy_rejected'
  | 'invalid';

/**
 * Pure local review only. A future import endpoint must derive the destination
 * account from its bearer token and revalidate every adopted source.
 */
export async function reviewExplicitAnonymousImport(
  candidateRequest: unknown,
  candidateConversation: unknown,
  authority: GuideAnonymousImportPreviewAuthorityDraftV1,
  liveOwner: GuideLiveOwnerFenceDraftV1,
): Promise<GuideExplicitImportDecision> {
  const request = parseGuideExplicitAnonymousImportDraftV1(candidateRequest);
  const conversation = parseGuideConversationDraftV1(candidateConversation);
  if (!request || !conversation
    || !UUID.test(authority.authenticatedAccountId)
    || !UUID.test(authority.previewId)
    || !UUID.test(authority.conversationId)
    || !UUID.test(authority.localOwnerId)
    || !UUID.test(authority.lineageId)
    || !DIGEST.test(authority.snapshotDigest)
    || !SERVER_SEMANTIC_VERIFIER.test(authority.lineageVerifier)
    || !SERVER_SEMANTIC_VERIFIER.test(authority.semanticVerifier)
    || authority.provenance !== 'anonymous_never_bound'
    || authority.provenanceSource !== 'account_v2_boundary'
    || authority.lineageState !== 'unclaimed') return 'invalid';
  if (liveOwner.kind !== 'account'
    || !UUID.test(liveOwner.accountId)
    || !UUID.test(liveOwner.sessionId)
    || liveOwner.accountId !== authority.authenticatedAccountId
    || request.clientAuthEpoch !== liveOwner.clientAuthEpoch
    || request.clientAuthEpoch !== authority.clientAuthEpoch) return 'account_boundary_conflict';
  if (conversation.ownerBoundary.kind !== 'anonymous'
    || conversation.ownerBoundary.localOwnerId !== request.localOwnerId
    || request.localOwnerId !== authority.localOwnerId) return 'account_boundary_conflict';
  if (conversation.persistence !== 'memory_only'
    || [...conversation.attachments, conversation.baseContext.ownerChart.source,
      conversation.baseContext.todaySky.source]
      .some((source) => source !== null && (
        source.persistence !== 'local_only'
        || source.kind === 'saved_person'
        || source.subject.boundary === 'saved_person'
      ))) return 'source_policy_rejected';
  const recomputedSnapshotDigest = await createGuideAnonymousImportSnapshotDigestDraftV1(
    conversation,
  );
  if (recomputedSnapshotDigest === null) return 'invalid';
  if (request.previewId !== authority.previewId
    || request.lineageId !== authority.lineageId
    || request.conversationId !== authority.conversationId
    || request.conversationId !== conversation.conversationId
    || request.previewRevision !== authority.previewRevision
    || request.previewRevision !== conversation.revision
    || request.previewContextEpoch !== authority.previewContextEpoch
    || request.previewContextEpoch !== conversation.contextEpoch
    || request.snapshotDigest !== authority.snapshotDigest
    || request.snapshotDigest !== recomputedSnapshotDigest) return 'preview_changed';
  return 'allowed';
}

/** Server recomputation used to bind an explicit import preview to exact bytes. */
export async function createGuideAnonymousImportSnapshotDigestDraftV1(
  candidateConversation: unknown,
): Promise<string | null> {
  const conversation = parseGuideConversationDraftV1(candidateConversation);
  if (!conversation
    || conversation.ownerBoundary.kind !== 'anonymous'
    || conversation.persistence !== 'memory_only') return null;
  return sha256Hex(canonicalJson({
    domain: 'zodiacs.guide.anonymous-import-snapshot.draft.v1',
    conversation,
  }));
}

/** Accepts a handoff only as a visible draft; this function has no side effects. */
export function createGuideDraftHandoff(
  candidate: GuideDraftHandoffDraftV1,
  candidateState: GuideConversationDraftV1,
): GuideDraftHandoffDraftV1 | null {
  const handoff = parseGuideDraftHandoffDraftV1(candidate);
  const state = parseGuideConversationDraftV1(candidateState);
  if (!handoff || !state || handoff.conversationId !== state.conversationId) return null;
  const activeSources = [
    state.baseContext.ownerChart.state === 'active' ? state.baseContext.ownerChart.source : null,
    state.baseContext.todaySky.state === 'active' ? state.baseContext.todaySky.source : null,
    ...state.attachments,
  ].filter((source): source is GuideContextSourceDraftV1 => source !== null);
  return handoff.sourceRefs.every((reference) => activeSources.some((source) => (
    source.sourceId === reference.sourceId && source.sourceRevision === reference.sourceRevision
  ))) ? handoff : null;
}

export function retryGuideTurnRequest(
  priorCandidate: GuideTurnRequestDraftV1,
  nextAttemptId: string,
): GuideTurnRequestDraftV1 | null {
  const prior = parseGuideTurnRequestDraftV1(priorCandidate);
  if (!prior || !UUID.test(nextAttemptId) || nextAttemptId === prior.attemptId) return null;
  return parseGuideTurnRequestDraftV1({
    ...prior,
    attemptId: nextAttemptId,
    retryOfAttemptId: prior.attemptId,
  });
}

/**
 * Testable digest of the account-scoped semantic preimage. Production stores
 * only a service HMAC over this domain, never this digest or raw preimage.
 */
export async function createGuideTurnSemanticDigestDraftV1(
  candidateRequest: GuideTurnRequestDraftV1,
  derivedAccountId: string,
): Promise<string | null> {
  const request = parseGuideTurnRequestDraftV1(candidateRequest);
  if (!request || request.mode !== 'account' || !UUID.test(derivedAccountId)) return null;
  return sha256Hex(canonicalJson({
    domain: 'zodiacs.guide.turn-semantic.draft.v1',
    accountId: derivedAccountId,
    conversationId: request.conversationId,
    operationId: request.operationId,
    turnId: request.turnId,
    userMessageId: request.userMessage.messageId,
    userMessage: request.userMessage.content,
    baseRevision: request.baseRevision,
    contextEpoch: request.contextEpoch,
    policyVersion: request.consent.policyVersion,
    consentRevision: request.consent.consentRevision,
    disclosureId: request.consent.disclosureId,
    contextScopeDigest: request.consent.contextScopeDigest,
  }));
}

export type GuideTurnIdempotencyDecision =
  | 'new_reservation'
  | 'replay_in_progress'
  | 'replay_completed'
  | 'replay_cancelled'
  | 'retry_before_provider'
  | 'mutation_conflict'
  | 'invalid_request'
  | 'invalid_receipt'
  | 'invalid_semantic_verifier';

/** This lookup must run before base-revision preflight for every account retry. */
export function guideTurnIdempotencyDecision(
  candidateReceipt: GuideTurnOperationReceiptDraftV1 | null,
  candidateRequest: GuideTurnRequestDraftV1,
  semanticVerifier: string,
): GuideTurnIdempotencyDecision {
  const request = parseGuideTurnRequestDraftV1(candidateRequest);
  if (!request || request.mode !== 'account') return 'invalid_request';
  if (!SERVER_SEMANTIC_VERIFIER.test(semanticVerifier)) return 'invalid_semantic_verifier';
  if (candidateReceipt === null) return 'new_reservation';
  const receipt = parseGuideTurnOperationReceiptDraftV1(candidateReceipt);
  if (!receipt) return 'invalid_receipt';
  if (receipt.conversationId !== request.conversationId
    || receipt.operationId !== request.operationId
    || receipt.turnId !== request.turnId
    || receipt.userMessageId !== request.userMessage.messageId
    || receipt.semanticVerifier !== semanticVerifier) return 'mutation_conflict';
  if (receipt.status === 'reserved') return 'replay_in_progress';
  if (receipt.status === 'completed') return 'replay_completed';
  if (receipt.status === 'cancelled') return 'replay_cancelled';
  return request.attemptId !== receipt.activeAttemptId
    && request.retryOfAttemptId === receipt.activeAttemptId
    ? 'retry_before_provider'
    : 'mutation_conflict';
}

export type GuideTurnAdmissionDecision = GuideTurnStartDecision | GuideTurnIdempotencyDecision;

/**
 * Account operation lookup intentionally precedes new-turn revision checks.
 * Completed/cancelled/in-progress replays still require the exact live owner,
 * but do not invoke the provider or fail only because the original turn moved
 * the conversation revision forward.
 */
export function guideTurnAdmissionDecision(
  candidateState: GuideConversationDraftV1,
  candidateRequest: GuideTurnRequestDraftV1,
  authorization: GuideAuthorizationStateDraftV1,
  authority: GuideTurnAuthoritySnapshot,
  candidateReceipt: GuideTurnOperationReceiptDraftV1 | null,
  semanticVerifier: string,
): GuideTurnAdmissionDecision {
  const request = parseGuideTurnRequestDraftV1(candidateRequest);
  const state = parseGuideConversationDraftV1(candidateState);
  if (!request) return 'invalid_request';
  if (!state) return 'invalid_state';
  if (request.clientAuthEpoch !== authority.owner.clientAuthEpoch
    || !ownerMatchesState(state, authority.owner)) return 'account_boundary_conflict';
  if (state.conversationId !== request.conversationId) return 'conversation_mismatch';
  if (request.mode === 'ephemeral') {
    return guideTurnStartDecision(state, request, authorization, authority);
  }
  const idempotency = guideTurnIdempotencyDecision(
    candidateReceipt,
    request,
    semanticVerifier,
  );
  if (['invalid_request', 'invalid_receipt', 'invalid_semantic_verifier', 'mutation_conflict']
    .includes(idempotency)) return idempotency;
  if (idempotency === 'replay_in_progress'
    || idempotency === 'replay_completed'
    || idempotency === 'replay_cancelled') {
    return idempotency;
  }
  const preflight = guideTurnStartDecision(state, request, authorization, authority);
  if (preflight !== 'allowed') return preflight;
  return idempotency === 'retry_before_provider' ? 'retry_before_provider' : 'allowed';
}

export function createGuideStreamAccumulator(
  stateCandidate: GuideConversationDraftV1,
  requestCandidate: GuideTurnRequestDraftV1,
  ownerFence: GuideLiveOwnerFenceDraftV1,
): GuideStreamAccumulatorDraftV1 | null {
  const state = parseGuideConversationDraftV1(stateCandidate);
  const request = parseGuideTurnRequestDraftV1(requestCandidate);
  if (!state || !request
    || state.conversationId !== request.conversationId
    || state.revision !== request.baseRevision
    || state.contextEpoch !== request.contextEpoch
    || request.clientAuthEpoch !== ownerFence.clientAuthEpoch
    || !ownerMatchesState(state, ownerFence)) return null;
  return {
    conversationId: request.conversationId,
    turnId: request.turnId,
    attemptId: request.attemptId,
    userMessageId: request.userMessage.messageId,
    requestBaseRevision: request.baseRevision,
    acceptedRevision: null,
    contextEpoch: request.contextEpoch,
    contextRevision: state.contextRevision,
    ownerFence,
    clientAuthEpoch: request.clientAuthEpoch,
    expectedAssistantSequence: state.nextSequence + 1,
    nextEventSequence: 0,
    status: 'waiting',
    partialText: '',
    completedMessage: null,
    errorCode: null,
    lastEvent: null,
  };
}

export type GuideStreamApplyResult =
  | { outcome: 'applied' | 'duplicate'; state: GuideStreamAccumulatorDraftV1 }
  | {
    outcome:
      | 'invalid_event'
      | 'identity_mismatch'
      | 'event_gap'
      | 'stale_event'
      | 'conflicting_duplicate'
      | 'invalid_transition'
      | 'owner_fence_changed'
      | 'context_changed'
      | 'terminal';
    state: GuideStreamAccumulatorDraftV1;
  };

function sameEvent(left: GuideStreamEventDraftV1 | null, right: GuideStreamEventDraftV1): boolean {
  return left !== null && JSON.stringify(left) === JSON.stringify(right);
}

function scrubFencedStream(state: GuideStreamAccumulatorDraftV1): GuideStreamAccumulatorDraftV1 {
  return {
    ...state,
    status: 'cancelled',
    partialText: '',
    completedMessage: null,
    errorCode: null,
    lastEvent: null,
  };
}

export function applyGuideStreamEvent(
  state: GuideStreamAccumulatorDraftV1,
  candidateEvent: GuideStreamEventDraftV1,
  liveAuthority: GuideStreamLiveAuthorityDraftV1,
): GuideStreamApplyResult {
  if (liveAuthority.contextEpoch !== state.contextEpoch) {
    return { outcome: 'context_changed', state: scrubFencedStream(state) };
  }
  if (canonicalJson(liveAuthority.owner) !== canonicalJson(state.ownerFence)) {
    return { outcome: 'owner_fence_changed', state: scrubFencedStream(state) };
  }
  const event = parseGuideStreamEventDraftV1(candidateEvent);
  if (!event) return { outcome: 'invalid_event', state };
  if (event.conversationId !== state.conversationId
    || event.turnId !== state.turnId
    || event.attemptId !== state.attemptId
    || event.clientAuthEpoch !== state.clientAuthEpoch) return { outcome: 'identity_mismatch', state };
  if (event.eventSequence < state.nextEventSequence) {
    if (event.eventSequence === state.nextEventSequence - 1) {
      return sameEvent(state.lastEvent, event)
        ? { outcome: 'duplicate', state }
        : { outcome: 'conflicting_duplicate', state };
    }
    return { outcome: 'stale_event', state };
  }
  if (event.eventSequence > state.nextEventSequence) return { outcome: 'event_gap', state };
  if (state.status === 'completed' || state.status === 'cancelled' || state.status === 'failed') {
    return { outcome: 'terminal', state };
  }

  const nextBase = {
    ...state,
    nextEventSequence: state.nextEventSequence + 1,
    lastEvent: event,
  };
  if (event.type === 'accepted') {
    return state.status === 'waiting'
      && event.eventSequence === 0
      && event.conversationRevision === state.requestBaseRevision + 1
      ? {
        outcome: 'applied',
        state: {
          ...nextBase,
          status: 'streaming',
          acceptedRevision: event.conversationRevision,
        },
      }
      : { outcome: 'invalid_transition', state };
  }
  if (event.type === 'delta') {
    if (state.status !== 'streaming') return { outcome: 'invalid_transition', state };
    const partialText = `${state.partialText}${event.delta}`;
    if (guideUtf8Bytes(partialText) > GUIDE_LIMITS.messageBytes
      || [...partialText].length > GUIDE_LIMITS.messageCodePoints) {
      return { outcome: 'invalid_event', state };
    }
    return { outcome: 'applied', state: { ...nextBase, partialText } };
  }
  if (event.type === 'completed') {
    if (state.status !== 'streaming'
      || state.acceptedRevision === null
      || event.conversationRevision !== state.acceptedRevision + 1
      || event.message.sequence !== state.expectedAssistantSequence
      || event.message.contextRevision !== state.contextRevision
      || event.message.messageId === state.userMessageId
      || (state.partialText && !event.message.content.startsWith(state.partialText))) {
      return { outcome: 'invalid_transition', state };
    }
    return {
      outcome: 'applied',
      state: {
        ...nextBase,
        status: 'completed',
        partialText: '',
        completedMessage: event.message,
      },
    };
  }
  if (event.type === 'cancelled') {
    if (state.status !== 'streaming') return { outcome: 'invalid_transition', state };
    return {
      outcome: 'applied',
      state: { ...nextBase, status: 'cancelled', partialText: '' },
    };
  }
  if (state.status !== 'streaming') return { outcome: 'invalid_transition', state };
  return {
    outcome: 'applied',
    state: { ...nextBase, status: 'failed', errorCode: event.code },
  };
}

export interface LegacyAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Lossy compatibility adapter for the current `/api/assistant` shape. It
 * rejects instead of inheriting that endpoint's silent UTF-16 truncation and
 * never attaches chart/source context.
 */
export function guideHistoryToLegacyAssistant(
  conversation: GuideConversationDraftV1,
): LegacyAssistantMessage[] | null {
  const history = guideModelHistory(conversation);
  if (history.some(({ content }) => content.length > LEGACY_ASSISTANT_MESSAGE_CODE_UNITS)) return null;
  return history.slice(-GUIDE_LIMITS.modelWindowMessages).map(({ author, content }) => ({
    role: author === 'guide' ? 'assistant' : 'user',
    content,
  }));
}

/** Provider settings remain server-owned; clients cannot supply this object. */
export const GUIDE_PROVIDER_PRIVACY_POLICY = Object.freeze({
  retentionArrangement: 'standard_30_day' as const,
  route: '/v1/guide/turn' as const,
  productName: 'Guide' as const,
  currentModelIdentity: 'claude-sonnet-5-5' as const,
  contextHandling: 'untrusted_data_only' as const,
  protocolSchema: GUIDE_SCHEMAS.accountTurn,
});
