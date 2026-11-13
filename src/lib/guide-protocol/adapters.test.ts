import { describe, expect, it } from 'vitest';
import {
  GUIDE_PROVIDER_PRIVACY_POLICY,
  applyGuideStreamEvent,
  createGuideAnonymousImportSnapshotDigestDraftV1,
  createGuideAccountContextMutationSemanticDigestDraftV1,
  createGuideContextScopeDigestDraftV1,
  createGuideDraftHandoff,
  createGuideEphemeralContextScopeDigestDraftV1,
  createGuideLocalMutationVerifier,
  createGuideLocalSourceContentDigestDraftV1,
  createGuideStreamAccumulator,
  createGuideTurnSemanticDigestDraftV1,
  guideAccountSyncUiEligible,
  guideGenerationAllowed,
  guideHistoryToLegacyAssistant,
  guidePrivacyControlAllowed,
  guideTrustedSourceMaySyncToAccount,
  guideTurnAdmissionDecision,
  guideTurnIdempotencyDecision,
  guideTurnStartDecision,
  hydrateGuideAccountContextMutation,
  retryGuideTurnRequest,
  reviewExplicitAnonymousImport,
} from './adapters';
import { GUIDE_SCHEMAS, type GuideAuthorizationStateDraftV1 } from './types';
import {
  GUIDE_TEST_IDS,
  accountTurn,
  attachmentSource,
  draftHandoff,
  ephemeralTurn,
  guideConversation,
  guideMessage,
  rootChartSource,
  skySource,
} from './test-fixtures';

const GRANTED: GuideAuthorizationStateDraftV1 = {
  cloudProcessingConsent: 'granted',
  conversationSyncConsent: 'granted',
  generationEntitlement: 'allowed',
};

function eventBase(eventSequence: number) {
  return {
    schema: GUIDE_SCHEMAS.streamEvent,
    conversationId: GUIDE_TEST_IDS.conversation,
    turnId: GUIDE_TEST_IDS.turnThree,
    attemptId: GUIDE_TEST_IDS.attempt,
    eventSequence,
    clientAuthEpoch: 1,
  } as const;
}

const ACCOUNT_OWNER = {
  kind: 'account' as const,
  accountId: GUIDE_TEST_IDS.account,
  sessionId: GUIDE_TEST_IDS.authSession,
  clientAuthEpoch: 1,
};

const LIVE = { owner: ACCOUNT_OWNER, contextEpoch: 0 } as const;

const AUTHORITY = {
  owner: ACCOUNT_OWNER,
  processingPolicyVersion: 'guide-cloud-processing.draft.v1',
  processingConsentRevision: 1,
  processingDisclosureId: GUIDE_TEST_IDS.disclosure,
  processingContextEpoch: 0,
  processingContextScopeDigest: 'd'.repeat(64),
  currentContextEpoch: 0,
  currentContextScopeDigest: 'd'.repeat(64),
  currentModelInputBytes: 4_096,
};

describe('Guide authorization and account boundaries', () => {
  it('keeps processing consent, sync consent, and entitlement independent', () => {
    expect(guideGenerationAllowed(GRANTED)).toBe(true);
    expect(guideGenerationAllowed({ ...GRANTED, cloudProcessingConsent: 'withdrawn' })).toBe(false);
    expect(guideGenerationAllowed({ ...GRANTED, generationEntitlement: 'denied' })).toBe(false);

    expect(guideAccountSyncUiEligible(GRANTED, true)).toBe(true);
    expect(guideAccountSyncUiEligible(GRANTED, false)).toBe(false);
    expect(guideAccountSyncUiEligible({ ...GRANTED, conversationSyncConsent: 'pending' }, true)).toBe(false);
    expect(guideAccountSyncUiEligible({ ...GRANTED, generationEntitlement: 'denied' }, true)).toBe(true);
  });

  it('keeps privacy controls independent from generation entitlement and feature state', () => {
    expect(guidePrivacyControlAllowed(GUIDE_TEST_IDS.account, GUIDE_TEST_IDS.account)).toBe(true);
    expect(guidePrivacyControlAllowed(GUIDE_TEST_IDS.localOwner, GUIDE_TEST_IDS.account)).toBe(false);
    expect(guidePrivacyControlAllowed(null, GUIDE_TEST_IDS.account)).toBe(false);
  });

  it('rechecks revision, context epoch, consent policy, entitlement, and owner before a turn', () => {
    const state = guideConversation();
    const request = accountTurn();
    expect(guideTurnStartDecision(state, request, GRANTED, AUTHORITY)).toBe('allowed');
    expect(guideTurnStartDecision(state, { ...request, baseRevision: 1 }, GRANTED, AUTHORITY))
      .toBe('revision_conflict');
    expect(guideTurnStartDecision(state, { ...request, baseRevision: 1 }, GRANTED, {
      ...AUTHORITY,
      owner: { ...ACCOUNT_OWNER, accountId: GUIDE_TEST_IDS.localOwner },
    })).toBe('account_boundary_conflict');
    expect(guideTurnStartDecision(state, { ...request, baseRevision: 1 }, GRANTED, {
      ...AUTHORITY,
      owner: { ...ACCOUNT_OWNER, accountId: GUIDE_TEST_IDS.localOwner },
    })).toBe('account_boundary_conflict');
    expect(guideTurnStartDecision(state, {
      ...request,
      contextEpoch: 1,
      consent: { ...request.consent, disclosedContextEpoch: 1 },
    }, GRANTED, AUTHORITY)).toBe('context_changed');
    expect(guideTurnStartDecision(state, request, {
      ...GRANTED, generationEntitlement: 'denied',
    }, AUTHORITY)).toBe('entitlement_required');
    expect(guideTurnStartDecision(state, request, GRANTED, {
      ...AUTHORITY,
      owner: { ...ACCOUNT_OWNER, accountId: GUIDE_TEST_IDS.localOwner },
    })).toBe('account_boundary_conflict');
    expect(guideTurnStartDecision(state, request, GRANTED, {
      ...AUTHORITY, processingPolicyVersion: 'guide-cloud-processing.draft.v2',
    })).toBe('consent_policy_mismatch');
    expect(guideTurnStartDecision(state, request, GRANTED, {
      ...AUTHORITY, processingContextScopeDigest: 'e'.repeat(64),
    })).toBe('consent_scope_mismatch');
    expect(guideTurnStartDecision(state, request, GRANTED, {
      ...AUTHORITY, currentContextScopeDigest: 'e'.repeat(64),
    })).toBe('consent_scope_mismatch');
    expect(guideTurnStartDecision(state, request, GRANTED, {
      ...AUTHORITY, currentModelInputBytes: 49_153,
    })).toBe('request_too_large');

    const ephemeral = ephemeralTurn();
    expect(guideTurnStartDecision(
      guideConversation({
        ownerBoundary: { kind: 'anonymous', localOwnerId: GUIDE_TEST_IDS.localOwner },
        persistence: 'memory_only',
        baseContext: ephemeral.ephemeralContext.baseContext,
      }),
      ephemeral,
      GRANTED,
      {
        ...AUTHORITY,
        owner: {
          kind: 'anonymous', localOwnerId: GUIDE_TEST_IDS.localOwner, clientAuthEpoch: 1,
        },
      },
    )).toBe('allowed');
  });

  it('permits only explicitly self-owned chart references in initial account sync', async () => {
    expect(guideTrustedSourceMaySyncToAccount({
      authority: 'account_v2_self_chart', source: rootChartSource(),
    })).toBe(true);
    expect(guideTrustedSourceMaySyncToAccount({
      authority: 'public_source_catalog', source: rootChartSource(),
    })).toBe(false);
    expect(guideTrustedSourceMaySyncToAccount({
      authority: 'public_source_catalog', source: attachmentSource(),
    })).toBe(true);
    expect(guideTrustedSourceMaySyncToAccount({
      authority: 'public_source_catalog',
      source: attachmentSource({
        kind: 'site_page',
        sourceId: 'page:birth-chart',
        title: 'Birth chart',
        subject: {
          boundary: 'public_reference',
          subjectId: 'page:birth-chart',
          subjectName: null,
          subjectIsUser: false,
        },
      }),
    })).toBe(true);
    expect(guideTrustedSourceMaySyncToAccount({
      authority: 'account_v2_self_chart', source: attachmentSource({
      kind: 'saved_person',
      sourceId: GUIDE_TEST_IDS.person,
      subject: {
        boundary: 'saved_person',
        subjectId: GUIDE_TEST_IDS.person,
        subjectName: 'Alex',
        subjectIsUser: false,
      },
      containsThirdPartyData: true,
      persistence: 'local_only',
      facts: 'Alex has a Taurus Sun.',
    }),
    })).toBe(false);

    const accountMutation = {
      schema: GUIDE_SCHEMAS.accountContextMutation,
      conversationId: GUIDE_TEST_IDS.conversation,
      operationId: GUIDE_TEST_IDS.operation,
      baseRevision: 2,
      clientAuthEpoch: 1,
      operation: 'attach',
      sourceRef: {
        kind: 'learn_term',
        sourceId: 'learn:retrograde',
        sourceRevision: 1,
      },
    } as const;
    const hydrated = hydrateGuideAccountContextMutation(accountMutation, {
      authority: 'public_source_catalog', source: attachmentSource(),
    }, ACCOUNT_OWNER);
    expect(hydrated?.operation).toBe('attach');
    expect(hydrated && 'source' in hydrated ? hydrated.source?.facts : 'missing').toBeNull();
    expect(hydrateGuideAccountContextMutation(accountMutation, {
      authority: 'account_v2_self_chart', source: attachmentSource(),
    }, ACCOUNT_OWNER)).toBeNull();
    expect(hydrateGuideAccountContextMutation(accountMutation, {
      authority: 'public_source_catalog', source: attachmentSource(),
    }, { ...ACCOUNT_OWNER, clientAuthEpoch: 2 })).toBeNull();
    const verifierInput = await createGuideAccountContextMutationSemanticDigestDraftV1(
      accountMutation,
      GUIDE_TEST_IDS.account,
      GUIDE_TEST_IDS.authSession,
      attachmentSource().contentDigest,
    );
    expect(verifierInput).toMatch(/^[a-f0-9]{64}$/);
    expect(await createGuideAccountContextMutationSemanticDigestDraftV1(
      { ...accountMutation, clientAuthEpoch: 2 },
      GUIDE_TEST_IDS.account,
      GUIDE_TEST_IDS.authSession,
      attachmentSource().contentDigest,
    )).not.toBe(verifierInput);
  });

  it('allows anonymous adoption only after explicit review and never offers A data to B', async () => {
    const ephemeral = ephemeralTurn();
    const conversation = guideConversation({
      ownerBoundary: { kind: 'anonymous', localOwnerId: GUIDE_TEST_IDS.localOwner },
      persistence: 'memory_only',
      baseContext: ephemeral.ephemeralContext.baseContext,
    });
    const request = {
      schema: GUIDE_SCHEMAS.anonymousImport,
      operationId: GUIDE_TEST_IDS.operation,
      previewId: GUIDE_TEST_IDS.preview,
      conversationId: GUIDE_TEST_IDS.conversation,
      localOwnerId: GUIDE_TEST_IDS.localOwner,
      lineageId: GUIDE_TEST_IDS.lineage,
      previewRevision: 2,
      previewContextEpoch: 0,
      snapshotDigest: 'e'.repeat(64),
      clientAuthEpoch: 1,
      confirmation: 'IMPORT',
    } as const;
    const preview = {
      authenticatedAccountId: GUIDE_TEST_IDS.account,
      clientAuthEpoch: 1,
      provenance: 'anonymous_never_bound' as const,
      provenanceSource: 'account_v2_boundary' as const,
      lineageId: GUIDE_TEST_IDS.lineage,
      lineageState: 'unclaimed' as const,
      lineageVerifier: `1:${'b'.repeat(64)}`,
      previewId: GUIDE_TEST_IDS.preview,
      conversationId: GUIDE_TEST_IDS.conversation,
      localOwnerId: GUIDE_TEST_IDS.localOwner,
      previewRevision: 2,
      previewContextEpoch: 0,
      snapshotDigest: 'e'.repeat(64),
      semanticVerifier: `1:${'a'.repeat(64)}`,
    };
    const snapshotDigest = await createGuideAnonymousImportSnapshotDigestDraftV1(conversation);
    expect(snapshotDigest).toMatch(/^[a-f0-9]{64}$/);
    const boundRequest = { ...request, snapshotDigest: snapshotDigest! };
    const boundPreview = { ...preview, snapshotDigest: snapshotDigest! };
    expect(await reviewExplicitAnonymousImport(
      boundRequest, conversation, boundPreview, ACCOUNT_OWNER,
    )).toBe('allowed');
    expect(await reviewExplicitAnonymousImport(
      { ...boundRequest, snapshotDigest: 'f'.repeat(64) }, conversation, boundPreview, ACCOUNT_OWNER,
    )).toBe('preview_changed');
    expect(await reviewExplicitAnonymousImport(
      boundRequest, guideConversation(), boundPreview, ACCOUNT_OWNER,
    )).toBe('account_boundary_conflict');
    expect(await reviewExplicitAnonymousImport(
      boundRequest,
      conversation,
      boundPreview,
      { ...ACCOUNT_OWNER, accountId: GUIDE_TEST_IDS.localOwner },
    )).toBe('account_boundary_conflict');
    expect(await reviewExplicitAnonymousImport(
      boundRequest,
      conversation,
      { ...boundPreview, lineageState: 'claimed' as any },
      ACCOUNT_OWNER,
    )).toBe('invalid');
    expect(await reviewExplicitAnonymousImport(
      boundRequest,
      conversation,
      { ...boundPreview, lineageState: 'claimed' as any },
      ACCOUNT_OWNER,
    )).toBe('invalid');
    const changedSnapshotDigest = await createGuideAnonymousImportSnapshotDigestDraftV1({
      ...conversation,
      messages: conversation.messages.map((message, index) => index === 0
        ? { ...message, content: `${message.content}!` }
        : message),
    });
    expect(changedSnapshotDigest).not.toBe(snapshotDigest);
    expect(await reviewExplicitAnonymousImport(
      boundRequest, {
        ...conversation,
        messages: conversation.messages.map((message, index) => index === 0
          ? { ...message, content: `${message.content}!` }
          : message),
      }, boundPreview, ACCOUNT_OWNER,
    )).toBe('preview_changed');
  });
});

describe('Guide draft handoff and legacy compatibility', () => {
  it('creates only a reviewable draft and never introduces an automatic-send field', () => {
    const handoff = createGuideDraftHandoff(draftHandoff(), guideConversation());
    expect(handoff).toEqual(draftHandoff());
    expect(handoff?.delivery).toBe('requires_user_action');
    expect(handoff).not.toHaveProperty('send');
    expect(createGuideDraftHandoff(draftHandoff({
      sourceRefs: [{ sourceId: 'sky:2026-08-12', sourceRevision: 2 }],
    }), guideConversation())).toBeNull();
  });

  it('canonicalizes an in-memory mutation verifier without granting server authority', async () => {
    const mutation = {
      schema: GUIDE_SCHEMAS.contextMutation,
      conversationId: GUIDE_TEST_IDS.conversation,
      operationId: GUIDE_TEST_IDS.operation,
      baseRevision: 2,
      operation: 'attach',
      source: attachmentSource(),
    } as const;
    const reordered = {
      source: mutation.source,
      operation: mutation.operation,
      baseRevision: mutation.baseRevision,
      operationId: mutation.operationId,
      conversationId: mutation.conversationId,
      schema: mutation.schema,
    } as const;
    const first = await createGuideLocalMutationVerifier(mutation);
    expect(first).toMatch(/^local:[a-f0-9]{64}$/);
    expect(await createGuideLocalMutationVerifier(reordered)).toBe(first);
    expect(await createGuideLocalMutationVerifier({
      ...mutation,
      source: attachmentSource({ sourceRevision: 2 }),
    })).not.toBe(first);
  });

  it('maps post-cutoff history to the legacy website role names without chart context', () => {
    const legacy = guideHistoryToLegacyAssistant(guideConversation({
      modelHistoryStartSequence: 3,
    }));
    expect(legacy).toEqual([
      { role: 'user', content: 'How can I make that concrete?' },
      { role: 'assistant', content: 'Pick one small task and give it your full attention.' },
    ]);
    expect(JSON.stringify(legacy)).not.toContain('owner_chart');
  });

  it('rejects rather than inheriting the legacy endpoint silent truncation', () => {
    const conversation = guideConversation();
    conversation.messages[0] = guideMessage({
      messageId: GUIDE_TEST_IDS.messageOne,
      sequence: 1,
      author: 'user',
      generation: null,
      content: 'a'.repeat(1_201),
    });
    expect(guideHistoryToLegacyAssistant(conversation)).toBeNull();
  });
});

describe('Guide retries and app-owned stream state', () => {
  it('binds cloud consent to an exact ordered context disclosure', async () => {
    const ephemeral = ephemeralTurn();
    const localOwner = ephemeral.ephemeralContext.baseContext.ownerChart.source!;
    const localSky = ephemeral.ephemeralContext.baseContext.todaySky.source!;
    const ownerDigest = await createGuideLocalSourceContentDigestDraftV1(localOwner);
    const skyDigest = await createGuideLocalSourceContentDigestDraftV1(localSky);
    expect(ownerDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(skyDigest).toMatch(/^[a-f0-9]{64}$/);
    const conversation = guideConversation({
      baseContext: {
        ownerChart: {
          ...guideConversation().baseContext.ownerChart,
          source: rootChartSource({ contentDigest: ownerDigest! }),
        },
        todaySky: {
          ...guideConversation().baseContext.todaySky,
          source: skySource({ contentDigest: skyDigest! }),
        },
      },
    });
    const accountDigest = await createGuideContextScopeDigestDraftV1(conversation);
    expect(accountDigest).toMatch(/^[a-f0-9]{64}$/);

    const sameVisibleScope = ephemeralTurn({
      ephemeralContext: { ...ephemeral.ephemeralContext, history: conversation.messages },
    });
    expect(await createGuideEphemeralContextScopeDigestDraftV1(sameVisibleScope)).toBe(accountDigest);
    const changedLocalFacts = ephemeralTurn({
      ephemeralContext: {
        ...sameVisibleScope.ephemeralContext,
        baseContext: {
          ...sameVisibleScope.ephemeralContext.baseContext,
          ownerChart: {
            ...sameVisibleScope.ephemeralContext.baseContext.ownerChart,
            source: { ...localOwner, facts: `${localOwner.facts} Changed.` },
          },
        },
      },
    });
    expect(await createGuideEphemeralContextScopeDigestDraftV1(changedLocalFacts))
      .not.toBe(accountDigest);
    expect(await createGuideContextScopeDigestDraftV1(guideConversation({
      baseContext: {
        ...conversation.baseContext,
        todaySky: {
          ...conversation.baseContext.todaySky,
          source: {
            ...conversation.baseContext.todaySky.source!,
            sourceRevision: 2,
            contentDigest: 'f'.repeat(64),
          },
        },
      },
    }))).not.toBe(accountDigest);
  });

  it('retries with a new transport attempt but the same logical turn and operation', () => {
    const prior = accountTurn();
    const retry = retryGuideTurnRequest(prior, GUIDE_TEST_IDS.attemptTwo);
    expect(retry).toMatchObject({
      turnId: prior.turnId,
      operationId: prior.operationId,
      userMessage: prior.userMessage,
      attemptId: GUIDE_TEST_IDS.attemptTwo,
      retryOfAttemptId: GUIDE_TEST_IDS.attempt,
    });
    expect(retryGuideTurnRequest(prior, prior.attemptId)).toBeNull();
  });

  it('resolves logical idempotency before revision preflight and never duplicates a model call', async () => {
    const request = accountTurn();
    const verifier = `1:${'a'.repeat(64)}`;
    const receipt = {
      schema: GUIDE_SCHEMAS.turnReceipt,
      conversationId: request.conversationId,
      operationId: request.operationId,
      turnId: request.turnId,
      userMessageId: request.userMessage.messageId,
      semanticVerifier: verifier,
      status: 'reserved' as const,
      activeAttemptId: request.attemptId,
      resultRevision: null,
      responseMessageId: null,
    };
    expect(guideTurnIdempotencyDecision(null, request, verifier)).toBe('new_reservation');
    expect(guideTurnIdempotencyDecision(receipt, request, verifier)).toBe('replay_in_progress');
    expect(guideTurnAdmissionDecision(
      guideConversation({ revision: 3 }),
      request,
      GRANTED,
      AUTHORITY,
      receipt,
      verifier,
    )).toBe('replay_in_progress');
    expect(guideTurnAdmissionDecision(
      guideConversation({ revision: 3 }),
      request,
      GRANTED,
      { ...AUTHORITY, owner: { ...ACCOUNT_OWNER, accountId: GUIDE_TEST_IDS.localOwner } },
      receipt,
      verifier,
    )).toBe('account_boundary_conflict');
    expect(guideTurnAdmissionDecision(
      guideConversation({ conversationId: GUIDE_TEST_IDS.localOwner, revision: 3 }),
      request,
      GRANTED,
      AUTHORITY,
      receipt,
      verifier,
    )).toBe('conversation_mismatch');
    expect(guideTurnIdempotencyDecision(receipt, request, `1:${'b'.repeat(64)}`))
      .toBe('mutation_conflict');
    expect(guideTurnIdempotencyDecision({
      ...receipt,
      status: 'completed',
      resultRevision: 4,
      responseMessageId: GUIDE_TEST_IDS.messageSix,
    }, request, verifier)).toBe('replay_completed');
    const failedBeforeProvider = { ...receipt, status: 'failed_before_provider' as const };
    expect(guideTurnIdempotencyDecision(failedBeforeProvider, request, verifier))
      .toBe('mutation_conflict');
    const retry = retryGuideTurnRequest(request, GUIDE_TEST_IDS.attemptTwo)!;
    expect(guideTurnIdempotencyDecision(failedBeforeProvider, retry, verifier))
      .toBe('retry_before_provider');

    expect(await createGuideTurnSemanticDigestDraftV1(retry, GUIDE_TEST_IDS.account))
      .toBe(await createGuideTurnSemanticDigestDraftV1(request, GUIDE_TEST_IDS.account));
    expect(await createGuideTurnSemanticDigestDraftV1({
      ...request,
      userMessage: { ...request.userMessage, content: `${request.userMessage.content}!` },
    }, GUIDE_TEST_IDS.account)).not.toBe(
      await createGuideTurnSemanticDigestDraftV1(request, GUIDE_TEST_IDS.account),
    );
    expect(await createGuideTurnSemanticDigestDraftV1(request, GUIDE_TEST_IDS.localOwner))
      .not.toBe(await createGuideTurnSemanticDigestDraftV1(request, GUIDE_TEST_IDS.account));
  });

  it('orders deltas, ignores identical replay, and completes exactly once', () => {
    let state = createGuideStreamAccumulator(guideConversation(), accountTurn(), ACCOUNT_OWNER);
    expect(state).not.toBeNull();
    if (!state) return;

    const accepted = { ...eventBase(0), type: 'accepted', conversationRevision: 3 } as const;
    let result = applyGuideStreamEvent(state, accepted, LIVE);
    expect(result.outcome).toBe('applied');
    state = result.state;

    const delta = { ...eventBase(1), type: 'delta', delta: 'Pick one' } as const;
    result = applyGuideStreamEvent(state, delta, LIVE);
    expect(result.outcome).toBe('applied');
    state = result.state;
    expect(state.partialText).toBe('Pick one');

    expect(applyGuideStreamEvent(state, delta, LIVE).outcome).toBe('duplicate');
    expect(applyGuideStreamEvent(state, { ...delta, delta: 'Different' }, LIVE).outcome)
      .toBe('conflicting_duplicate');
    expect(applyGuideStreamEvent(
      state, { ...eventBase(3), type: 'delta', delta: 'gap' }, LIVE,
    ).outcome)
      .toBe('event_gap');

    const completed = {
      ...eventBase(2),
      type: 'completed',
      conversationRevision: 4,
      message: guideMessage({
        turnId: GUIDE_TEST_IDS.turnThree,
        messageId: GUIDE_TEST_IDS.messageSix,
        sequence: 6,
        content: 'Pick one small task and give it your full attention.',
      }),
    } as const;
    result = applyGuideStreamEvent(state, completed, LIVE);
    expect(result.outcome).toBe('applied');
    expect(result.state.status).toBe('completed');
    expect(result.state.partialText).toBe('');
    expect(result.state.completedMessage?.content).toContain('Pick one small task');
    expect(applyGuideStreamEvent(
      result.state, { ...eventBase(3), type: 'delta', delta: 'late' }, LIVE,
    ).outcome)
      .toBe('terminal');
  });

  it('cancellation discards partial text while ordinary failure keeps it memory-only', () => {
    const start = createGuideStreamAccumulator(guideConversation(), accountTurn(), ACCOUNT_OWNER)!;
    expect(applyGuideStreamEvent(start, {
      ...eventBase(0), type: 'cancelled', reason: 'client_cancelled',
    }, LIVE).outcome).toBe('invalid_transition');
    expect(applyGuideStreamEvent(start, {
      ...eventBase(0), type: 'error', code: 'temporarily_unavailable', retryable: false,
    }, LIVE).outcome).toBe('invalid_transition');
    const accepted = applyGuideStreamEvent(start, {
      ...eventBase(0), type: 'accepted', conversationRevision: 3,
    }, LIVE).state;
    const streaming = applyGuideStreamEvent(accepted, {
      ...eventBase(1), type: 'delta', delta: 'Private partial',
    }, LIVE).state;

    const cancelled = applyGuideStreamEvent(streaming, {
      ...eventBase(2), type: 'cancelled', reason: 'context_invalidated',
    }, LIVE);
    expect(cancelled.state.status).toBe('cancelled');
    expect(cancelled.state.partialText).toBe('');
    expect(cancelled.state.completedMessage).toBeNull();

    const failed = applyGuideStreamEvent(streaming, {
      ...eventBase(2),
      type: 'error',
      code: 'temporarily_unavailable',
      retryable: false,
    }, LIVE);
    expect(failed.state.status).toBe('failed');
    expect(failed.state.partialText).toBe('Private partial');
    expect(failed.state.completedMessage).toBeNull();
  });

  it('scrubs late stream output after an owner or context fence changes', () => {
    const start = createGuideStreamAccumulator(guideConversation(), accountTurn(), ACCOUNT_OWNER)!;
    const accepted = applyGuideStreamEvent(start, {
      ...eventBase(0), type: 'accepted', conversationRevision: 3,
    }, LIVE).state;
    const streaming = applyGuideStreamEvent(accepted, {
      ...eventBase(1), type: 'delta', delta: 'Private A text',
    }, LIVE).state;

    const switched = applyGuideStreamEvent(streaming, {
      ...eventBase(2), type: 'delta', delta: ' must not paint',
    }, {
      contextEpoch: 0,
      owner: { ...ACCOUNT_OWNER, accountId: GUIDE_TEST_IDS.localOwner },
    });
    expect(switched.outcome).toBe('owner_fence_changed');
    expect(switched.state.partialText).toBe('');
    expect(switched.state.completedMessage).toBeNull();
    expect(switched.state.lastEvent).toBeNull();

    const revoked = applyGuideStreamEvent(streaming, {
      ...eventBase(2), type: 'delta', delta: ' must not paint',
    }, { ...LIVE, contextEpoch: 1 });
    expect(revoked.outcome).toBe('context_changed');
    expect(revoked.state.partialText).toBe('');

    expect(applyGuideStreamEvent(streaming, {
      ...eventBase(2), clientAuthEpoch: 2, type: 'delta', delta: 'wrong epoch',
    }, LIVE).outcome).toBe('identity_mismatch');
  });

  it('caps cumulative stream text by code points as well as UTF-8 bytes', () => {
    const start = createGuideStreamAccumulator(guideConversation(), accountTurn(), ACCOUNT_OWNER)!;
    const accepted = applyGuideStreamEvent(start, {
      ...eventBase(0), type: 'accepted', conversationRevision: 3,
    }, LIVE).state;
    const first = applyGuideStreamEvent(accepted, {
      ...eventBase(1), type: 'delta', delta: 'a'.repeat(2_400),
    }, LIVE).state;
    expect(applyGuideStreamEvent(first, {
      ...eventBase(2), type: 'delta', delta: 'b',
    }, LIVE).outcome).toBe('invalid_event');
  });

  it('pins provider privacy without exposing a key or prompt', () => {
    expect(GUIDE_PROVIDER_PRIVACY_POLICY).toMatchObject({
      retentionArrangement: 'standard_30_day',
      productName: 'Guide',
      currentModelIdentity: 'claude-sonnet-5-5',
      route: '/v1/guide/turn',
      contextHandling: 'untrusted_data_only',
    });
    expect(GUIDE_PROVIDER_PRIVACY_POLICY).not.toHaveProperty('apiKey');
    expect(GUIDE_PROVIDER_PRIVACY_POLICY).not.toHaveProperty('prompt');
  });
});
