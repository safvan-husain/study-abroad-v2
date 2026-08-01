import { describe, expect, it } from 'vitest';
import { InMemoryMongoMessageStore } from '../src/mongo/message-store.js';

describe('Mongo message adapter contract', () => {
  it('is idempotent and keeps transcripts isolated', async () => {
    const store = new InMemoryMongoMessageStore();
    const input = { messageId: 'm1', conversationId: 'c1', turnId: 't1', idempotencyKey: 'k1', role: 'user' as const, content: 'hello' };
    const first = await store.append(input);
    const second = await store.append(input);
    expect(second).toEqual(first);
    expect(await store.list('c2')).toEqual([]);
    expect(await store.list('c1')).toHaveLength(1);
  });

  it('rejects reuse of an idempotency key for different content', async () => {
    const store = new InMemoryMongoMessageStore();
    const input = { messageId: 'm1', conversationId: 'c1', turnId: 't1', idempotencyKey: 'k1', role: 'user' as const, content: 'hello' };

    await store.append(input);

    await expect(store.append({ ...input, messageId: 'm2', content: 'changed' })).rejects.toThrow('idempotency conflict');
  });
});
