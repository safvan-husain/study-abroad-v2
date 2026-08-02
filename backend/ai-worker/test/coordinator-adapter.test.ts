import { describe, expect, it, vi } from 'vitest';
import { SpacetimeCoordinatorAdapter } from '../src/services/coordinator-adapter.js';

describe('SpacetimeCoordinatorAdapter', () => {
  it('serializes lease fences and u64 durations for generated reducers', async () => {
    const claim = vi.fn().mockResolvedValue(undefined);
    const jobs = { subscribe: () => () => undefined, poll: async () => [] };
    const adapter = new SpacetimeCoordinatorAdapter({ reducers: { claim }, db: {} }, jobs, 60);

    const attempt = await adapter.claim({
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      correlationId: 'turn-1',
      agentThreadId: 'conversation-1',
      userMessageId: 'turn-1',
      userContent: 'Hello',
      attempt: 2,
      baseUiRevision: 4n,
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
    });
  });
});
