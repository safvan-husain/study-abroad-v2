import { describe, expect, it } from 'vitest';
import { chatMessage, compactResult, coordinatorJob, messageWrite } from '../src/index.js';
const base = { conversationId:'c1', turnId:'t1', kind:'chat_turn' as const, status:'pending' as const, idempotencyKey:'k1', agentThreadId:'c1', attempt:0 };
describe('bounded contracts', () => {
  it('accepts compact coordinator records', () => expect(coordinatorJob.parse(base).status).toBe('pending'));
  it('rejects transcript-sized results', () => expect(() => compactResult.parse({dataClass:'compact_result',status:'completed',summary:'x'.repeat(513)})).toThrow());
  it('rejects unbounded messages', () => expect(() => messageWrite.parse({...base,messageId:'m1',role:'user',content:'x'.repeat(16001)})).toThrow());
  it('requires ISO timestamps for reads', () => expect(() => chatMessage.parse({...base,messageId:'m1',role:'user',content:'hi',createdAt:'nope'})).toThrow());
});
