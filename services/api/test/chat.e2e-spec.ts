import { InMemoryMongoMessageStore } from '../src/mongo/message-store.js';
import { describe, expect, it } from 'vitest';

describe('chat API contracts', () => {
  it('appends user messages idempotently and preserves the transcript', async () => {
    const store = new InMemoryMongoMessageStore();
    const input = { messageId: 'm1', conversationId: 'c1', turnId: 't1', role: 'user' as const, content: 'hello', idempotencyKey: 'k1' };
    const first = await store.append(input);
    expect(await store.append(input)).toEqual(first);
    expect(await store.list('c1')).toHaveLength(1);
  });
});
