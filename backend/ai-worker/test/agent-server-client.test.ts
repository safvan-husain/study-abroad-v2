import { describe, expect, it, vi } from 'vitest';
import { AgentServerClient } from '../src/services/agent-server-client.js';

describe('AgentServerClient', () => {
  it('reuses the graph assistant and sends only the new native human message', async () => {
    const wait = vi.fn().mockImplementation(async (_thread: string, _assistant: string, options: any) => {
      options.onRunCreated({ run_id: 'run-1' });
      return { messages: [{ type: 'ai', content: 'answer' }] };
    });
    const client: any = { assistants: { create: vi.fn().mockResolvedValue({ assistant_id: 'assistant-1' }) }, threads: { create: vi.fn().mockResolvedValue({}) }, runs: { wait } };
    const config: any = { AGENT_SERVER_URL: 'http://agent', AGENT_GRAPH_ID: 'chat' };
    const subject = new AgentServerClient(config, client);
    const ids = { conversationId: 'conversation-1', turnId: 'turn-1', correlationId: 'corr-1' };
    await subject.run([{ messageId: 'old', conversationId: 'conversation-1', turnId: 'old', role: 'assistant', content: 'old', createdAt: '' }, { messageId: 'new', conversationId: 'conversation-1', turnId: 'turn-1', role: 'user', content: 'new', createdAt: '' }], ids);
    await subject.run([{ messageId: 'newer', conversationId: 'conversation-1', turnId: 'turn-2', role: 'user', content: 'newer', createdAt: '' }], { ...ids, turnId: 'turn-2' });
    expect(client.assistants.create).toHaveBeenCalledTimes(1);
    expect(wait.mock.calls[0][2].input.messages).toEqual([{ role: 'human', content: 'new' }]);
    expect(wait.mock.calls[0][2].metadata).toMatchObject({ thread_id: 'conversation-1', correlation_id: 'corr-1' });
  });
});
