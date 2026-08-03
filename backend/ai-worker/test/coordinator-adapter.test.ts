import { describe, expect, it, vi } from 'vitest';
import { SpacetimeCoordinatorAdapter } from '../src/services/coordinator-adapter.js';
import { uiContextForGraph } from '../src/services/agent-server-client.js';

describe('SpacetimeCoordinatorAdapter', () => {
  it('serializes bigint UI revisions at the Agent Server boundary', () => {
    const wire = uiContextForGraph({ clientInstanceId: 'tab-1', target: { schemaVersion: 1, viewType: 'home' }, navigationRevision: 7n, visible: true, lastSeenAtMicros: 99n });
    expect(JSON.stringify(wire)).toContain('"navigationRevision":"7"');
    expect(JSON.stringify(wire)).toContain('"lastSeenAtMicros":"99"');
  });
  it('serializes lease fences and u64 durations for generated reducers', async () => {
    const claim = vi.fn().mockResolvedValue(undefined);
    const jobs = { subscribe: () => () => undefined, poll: async () => [] };
    const adapter = new SpacetimeCoordinatorAdapter({ reducers: { claim }, db: {} }, jobs, undefined, 60);

    const attempt = await adapter.claim({
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      correlationId: 'turn-1',
      agentThreadId: 'conversation-1',
      userMessageId: 'turn-1',
      userContent: 'Hello',
      attempt: 2,
      baseUiRevision: 4n,
      uiContext: { clientInstanceId: 'tab-1', target: { schemaVersion: 1, viewType: 'home' }, navigationRevision: 0n, visible: true, lastSeenAtMicros: 1n },
    });

    expect(attempt).toBe(3);
    expect(claim).toHaveBeenCalledWith({ turnId: 'turn-1', expectedAttempt: 2, leaseSeconds: 60n });
  });

  it('submits the assistant, directive, and terminal turn state through one reducer', async () => {
    const completeTurn = vi.fn().mockResolvedValue(undefined);
    const jobs = { subscribe: () => () => undefined, poll: async () => [] };
    const adapter = new SpacetimeCoordinatorAdapter({ reducers: { completeTurn }, db: {} }, jobs);

    await adapter.complete('turn-1', 3, {
      assistantContent: 'Here is a starting point.',
      runId: 'run-1',
      agentThreadId: 'conversation-1',
      directiveSchemaVersion: 1,
      directiveUiRevision: 5n,
      directiveType: 'discovery',
      directiveAwareness: 'I am ready to learn about your goals.',
      workKind: 'discovery_guidance',
      workItems: [{ entityType: 'discovery_topic', entityId: 'goals', kind: 'advisor_prompt', displayTitle: 'Preparing goals', orderIndex: 0, targetJson: '{"schemaVersion":1,"viewType":"catalog"}', dependencyJson: '{}', inputJson: '{}' }],
    });

    expect(completeTurn).toHaveBeenCalledWith({
      turnId: 'turn-1',
      attempt: 3,
      assistantContent: 'Here is a starting point.',
      runId: 'run-1',
      agentThreadId: 'conversation-1',
      directiveSchemaVersion: 1,
      directiveUiRevision: 5n,
      directiveType: 'discovery',
      directiveAwareness: 'I am ready to learn about your goals.',
      workKind: 'discovery_guidance',
      workItems: [{ entityType: 'discovery_topic', entityId: 'goals', kind: 'advisor_prompt', displayTitle: 'Preparing goals', orderIndex: 0, targetJson: '{"schemaVersion":1,"viewType":"catalog"}', dependencyJson: '{}', inputJson: '{}' }],
    });
  });

  it('serializes independently fenced child completion reducers', async () => {
    const claimWorkItem = vi.fn().mockResolvedValue(undefined);
    const completeWorkItem = vi.fn().mockResolvedValue(undefined);
    const jobs = { subscribe: () => () => undefined, poll: async () => [] };
    const adapter = new SpacetimeCoordinatorAdapter({ reducers: { claimWorkItem, completeWorkItem }, db: {} }, jobs);
    const item = { workItemId: 'work-1', workSetId: 'set-1', conversationId: 'c1', entityType: 'topic', entityId: 'goals', kind: 'prompt', displayTitle: 'Preparing goals', orderIndex: 0, targetJson: '{"schemaVersion":1,"viewType":"catalog"}', dependencyJson: '{}', inputJson: '{}', attempt: 2, expectedContextRevision: 0n, expectedUiRevision: 1n, uiContext: { clientInstanceId: 'tab-1', target: { schemaVersion: 1 as const, viewType: 'home' as const }, navigationRevision: 0n, visible: true, lastSeenAtMicros: 1n } };

    expect(await adapter.claimWorkItem(item)).toBe(3);
    await adapter.completeWorkItem('work-1', 3, '{"ready":true}');

    expect(claimWorkItem).toHaveBeenCalledWith({ workItemId: 'work-1', expectedAttempt: 2, leaseSeconds: 60n });
    expect(completeWorkItem).toHaveBeenCalledWith({ workItemId: 'work-1', attempt: 3, resultJson: '{"ready":true}', runId: undefined });
  });
});
