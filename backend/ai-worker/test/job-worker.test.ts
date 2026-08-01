import { describe, expect, it, vi } from 'vitest';
import { InMemoryMongoMessageStore } from '../src/services/mongo-message-store.js';
import { processChatTurn } from '../src/services/process-chat-turn.js';
import { JobWorker } from '../src/services/job-worker.js';

describe('AI worker chat turn', () => {
  it('writes MongoDB before completing the coordinator turn and deduplicates claims', async () => {
    const store = new InMemoryMongoMessageStore();
    await store.append({ messageId: 'm1', conversationId: 'c1', turnId: 't1', role: 'user', content: 'Hello', idempotencyKey: 'm1' });
    const coordinator = { claim: vi.fn().mockResolvedValue(true), complete: vi.fn(), retry: vi.fn() };
    const agent = { run: vi.fn().mockResolvedValue({ threadId: 'c1', runId: 'r1', content: 'Hi there', metadata: {} }) };
    await processChatTurn({ conversationId: 'c1', turnId: 't1', correlationId: 'corr1', workerId: 'w1' }, store, agent, coordinator);
    expect((await store.list('c1')).map(message => message.role)).toEqual(['user', 'assistant']);
    expect(coordinator.complete).toHaveBeenCalledWith('t1', expect.objectContaining({ messageId: 't1-assistant', runId: 'r1', correlationId: 'corr1' }));
    expect(coordinator.complete.mock.invocationCallOrder[0]).toBeGreaterThan(agent.run.mock.invocationCallOrder[0]);
  });

  it('subscribes, deduplicates delivery, renews leases, and stops cleanly', async () => {
    let deliver: ((turn: any) => void) | undefined;
    const coordinator = { claim: vi.fn().mockResolvedValue(true), renew: vi.fn().mockResolvedValue(true), complete: vi.fn(), retry: vi.fn() };
    const store = new InMemoryMongoMessageStore();
    await store.append({ messageId: 'm2', conversationId: 'c2', turnId: 't2', role: 'user', content: 'Hi', idempotencyKey: 'm2' });
    const agent = { run: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ threadId: 'c2', runId: 'r2', content: 'Hello', metadata: {} }), 30))) };
    const worker = new JobWorker({ store, agent, coordinator, leaseSeconds: 1, subscribe: callback => { deliver = callback; return () => { deliver = undefined; }; } });
    worker.start();
    const turn = { conversationId: 'c2', turnId: 't2', correlationId: 'x', workerId: 'w' };
    deliver!(turn); deliver!(turn);
    await worker.stop();
    expect(agent.run).toHaveBeenCalledTimes(1);
    expect(coordinator.complete).toHaveBeenCalledTimes(1);
  });

  it('waits for an in-flight turn before resolving stop', async () => {
    const store = new InMemoryMongoMessageStore();
    await store.append({ messageId: 'm3', conversationId: 'c3', turnId: 't3', role: 'user', content: 'Hi', idempotencyKey: 'm3' });
    let finish!: () => void;
    const coordinator = { claim: vi.fn().mockResolvedValue(true), complete: vi.fn(), retry: vi.fn() };
    const agent = { run: vi.fn().mockImplementation(() => new Promise(resolve => { finish = () => resolve({ threadId: 'c3', runId: 'r3', content: 'Done', metadata: {} }); })) };
    const worker = new JobWorker({ store, agent, coordinator });
    worker.start();
    const turn = { conversationId: 'c3', turnId: 't3', correlationId: 'x', workerId: 'w' };
    const running = worker.handle(turn);
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
    const store = new InMemoryMongoMessageStore();
    await store.append({ messageId: 'm4', conversationId: 'c4', turnId: 't4', role: 'user', content: 'Hi', idempotencyKey: 'm4' });
    const coordinator = { claim: vi.fn().mockResolvedValue(true), renew: vi.fn().mockRejectedValue(new Error('offline')), complete: vi.fn(), retry: vi.fn() };
    let finish!: () => void;
    const agent = { run: vi.fn().mockImplementation(() => new Promise(resolve => { finish = () => resolve({ threadId: 'c4', runId: 'r4', content: 'Done', metadata: {} }); })) };
    const worker = new JobWorker({ store, agent, coordinator, leaseSeconds: 1 });
    worker.start();
    const task = worker.handle({ conversationId: 'c4', turnId: 't4', correlationId: 'x', workerId: 'w' });
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
    const store = new InMemoryMongoMessageStore();

    await expect(processChatTurn({ conversationId: 'c5', turnId: 't5', correlationId: 'x', workerId: 'w' }, store, agent, coordinator)).resolves.toBeUndefined();
    expect(agent.run).not.toHaveBeenCalled();
    expect(coordinator.retry).not.toHaveBeenCalled();
  });

  it('fails permanent transcript errors instead of retrying forever', async () => {
    const store = new InMemoryMongoMessageStore();
    const coordinator = { claim: vi.fn().mockResolvedValue(true), complete: vi.fn(), retry: vi.fn(), fail: vi.fn() };
    const agent = { run: vi.fn() };

    await processChatTurn({ conversationId: 'c6', turnId: 't6', correlationId: 'x', workerId: 'w' }, store, agent, coordinator);

    expect(coordinator.fail).toHaveBeenCalledWith('t6', 'Error');
    expect(coordinator.retry).not.toHaveBeenCalled();
  });
});
