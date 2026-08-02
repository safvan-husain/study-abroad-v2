import { describe, expect, it, vi } from 'vitest';
import { processChatTurn } from '../src/services/process-chat-turn.js';
import { JobWorker } from '../src/services/job-worker.js';

const turn = (overrides: Partial<{
  conversationId: string;
  turnId: string;
  correlationId: string;
  agentThreadId: string;
  userMessageId: string;
  userContent: string;
  attempt: number;
  baseUiRevision: bigint;
}> = {}) => ({
  conversationId: 'c1',
  turnId: 't1',
  correlationId: 'corr1',
  agentThreadId: 'c1',
  userMessageId: 't1',
  userContent: 'Hello',
  attempt: 0,
  baseUiRevision: 0n,
  ...overrides,
});

describe('AI worker chat turn', () => {
  it('reads the subscribed user row and atomically completes the assistant turn', async () => {
    const coordinator = { claim: vi.fn().mockResolvedValue(1), complete: vi.fn(), retry: vi.fn() };
    const agent = { run: vi.fn().mockResolvedValue({ threadId: 'c1', runId: 'r1', content: 'Hi there', metadata: {} }) };
    await processChatTurn(turn(), agent, coordinator);
    expect(agent.run).toHaveBeenCalledWith([expect.objectContaining({ messageId: 't1', content: 'Hello', role: 'user' })], expect.objectContaining({ conversationId: 'c1', turnId: 't1' }));
    expect(coordinator.complete).toHaveBeenCalledWith('t1', 1, expect.objectContaining({
      assistantContent: expect.stringContaining('planning space'),
      runId: 'r1',
      agentThreadId: 'c1',
      directiveSchemaVersion: 1,
      directiveUiRevision: 1n,
      directiveType: 'discovery',
      workItems: expect.arrayContaining([expect.objectContaining({ entityId: 'academic-background' }), expect.objectContaining({ entityId: 'study-ambition' })]),
    }));
    expect(coordinator.complete.mock.invocationCallOrder[0]).toBeGreaterThan(agent.run.mock.invocationCallOrder[0]);
  });

  it('subscribes, deduplicates delivery, renews leases, and stops cleanly', async () => {
    let deliver: ((turn: any) => void) | undefined;
    const coordinator = { claim: vi.fn().mockResolvedValue(1), renew: vi.fn().mockResolvedValue(undefined), complete: vi.fn(), retry: vi.fn() };
    const agent = { run: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ threadId: 'c2', runId: 'r2', content: 'Hello', metadata: {} }), 30))) };
    const worker = new JobWorker({ agent, coordinator, leaseSeconds: 1, subscribe: callback => { deliver = callback; return () => { deliver = undefined; }; } });
    worker.start();
    const pending = turn({ conversationId: 'c2', turnId: 't2', correlationId: 'x', agentThreadId: 'c2', userMessageId: 't2', userContent: 'Hi' });
    deliver!(pending); deliver!(pending);
    await worker.stop();
    expect(agent.run).toHaveBeenCalledTimes(1);
    expect(coordinator.complete).toHaveBeenCalledTimes(1);
  });

  it('waits for an in-flight turn before resolving stop', async () => {
    let finish!: () => void;
    const coordinator = { claim: vi.fn().mockResolvedValue(1), complete: vi.fn(), retry: vi.fn() };
    const agent = { run: vi.fn().mockImplementation(() => new Promise(resolve => { finish = () => resolve({ threadId: 'c3', runId: 'r3', content: 'Done', metadata: {} }); })) };
    const worker = new JobWorker({ agent, coordinator });
    worker.start();
    const running = worker.handle(turn({ conversationId: 'c3', turnId: 't3', correlationId: 'x', agentThreadId: 'c3', userMessageId: 't3' }));
    let stopped = false;
    const stopping = worker.stop().then(() => { stopped = true; });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(stopped).toBe(false);
    finish();
    await Promise.all([running, stopping]);
    expect(stopped).toBe(true);
  });

  it('routes renewal failures to a swallowed background error', async () => {
    vi.useFakeTimers();
    const coordinator = { claim: vi.fn().mockResolvedValue(1), renew: vi.fn().mockRejectedValue(new Error('offline')), complete: vi.fn(), retry: vi.fn() };
    let finish!: () => void;
    const agent = { run: vi.fn().mockImplementation(() => new Promise(resolve => { finish = () => resolve({ threadId: 'c4', runId: 'r4', content: 'Done', metadata: {} }); })) };
    const worker = new JobWorker({ agent, coordinator, leaseSeconds: 1 });
    worker.start();
    const task = worker.handle(turn({ conversationId: 'c4', turnId: 't4', correlationId: 'x', agentThreadId: 'c4', userMessageId: 't4' }));
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);
    finish();
    await task;
    await worker.stop();
    expect(coordinator.renew).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('does not crash when a coordinator claim fails', async () => {
    const coordinator = { claim: vi.fn().mockRejectedValue(new Error('coordinator offline')), complete: vi.fn(), retry: vi.fn() };
    const agent = { run: vi.fn() };

    await expect(processChatTurn(turn({ conversationId: 'c5', turnId: 't5', correlationId: 'x', agentThreadId: 'c5', userMessageId: 't5' }), agent, coordinator)).resolves.toBeUndefined();
    expect(agent.run).not.toHaveBeenCalled();
    expect(coordinator.retry).not.toHaveBeenCalled();
  });

  it('retries an agent failure using the claimed lease fence', async () => {
    const coordinator = { claim: vi.fn().mockResolvedValue(4), complete: vi.fn(), retry: vi.fn() };
    const agent = { run: vi.fn().mockRejectedValue(new Error('Agent unavailable')) };

    await processChatTurn(turn({ conversationId: 'c6', turnId: 't6', correlationId: 'x', agentThreadId: 'c6', userMessageId: 't6', attempt: 3 }), agent, coordinator);

    expect(coordinator.retry).toHaveBeenCalledWith('t6', 4, 'Error');
  });

  it('processes child work independently without invoking the parent agent', async () => {
    let deliverWorkItem: ((item: any) => void) | undefined;
    const coordinator = {
      claim: vi.fn(), complete: vi.fn(), retry: vi.fn(),
      claimWorkItem: vi.fn().mockResolvedValue(1), completeWorkItem: vi.fn(), retryWorkItem: vi.fn(),
    };
    const agent = { run: vi.fn() };
    const worker = new JobWorker({ agent, coordinator, subscribeWorkItems: callback => { deliverWorkItem = callback; return () => { deliverWorkItem = undefined; }; } });
    worker.start();
    deliverWorkItem!({ workItemId: 'item-1', workSetId: 'set-1', conversationId: 'c1', entityType: 'topic', entityId: 'goals', kind: 'prompt', inputJson: '{"title":"Goals","detail":"Share them."}', attempt: 0, expectedContextRevision: 0n, expectedUiRevision: 1n });
    await worker.stop();

    expect(agent.run).not.toHaveBeenCalled();
    expect(coordinator.completeWorkItem).toHaveBeenCalledWith('item-1', 1, expect.stringContaining('Share them.'));
  });
});
