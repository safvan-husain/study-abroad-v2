import { describe, expect, it } from 'vitest';
import { toChatMessage } from '../src/coordinator/spacetime-coordinator.js';

describe('Spacetime coordinator history', () => {
  it('maps persisted assistant messages to the browser contract', () => {
    expect(toChatMessage({
      messageId: 'turn-1-assistant',
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      sequence: 1n,
      role: 'assistant',
      content: 'Here is how to prepare.',
      createdAtMicros: 1_700_000_000_123_000n,
    })).toEqual({
      messageId: 'turn-1-assistant',
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      role: 'assistant',
      content: 'Here is how to prepare.',
      createdAt: '2023-11-14T22:13:20.123Z',
    });
  });
});
