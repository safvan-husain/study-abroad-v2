import { describe, expect, it, vi } from 'vitest';
import { AgentServerClient, courseFitThreadId } from '../src/services/agent-server-client.js';

describe('AgentServerClient', () => {
  it('reuses the graph assistant and sends only the new native human message', async () => {
    const wait = vi.fn().mockImplementation(async (_thread: string, _assistant: string, options: any) => {
      options.onRunCreated({ run_id: 'run-1' });
      return { messages: [{ type: 'ai', content: 'answer' }] };
    });
    const client: any = { assistants: { create: vi.fn().mockResolvedValue({ assistant_id: 'assistant-1' }) }, threads: { create: vi.fn().mockResolvedValue({}) }, runs: { wait } };
    const config: any = {
      AGENT_SERVER_URL: 'http://agent',
      LANGGRAPH_API_URL: 'https://agent.example.test',
      AGENT_GRAPH_ID: 'chat',
    };
    const subject = new AgentServerClient(config, client);
    const ids = { conversationId: 'conversation-1', turnId: 'turn-1', correlationId: 'corr-1' };
    await subject.run([{ messageId: 'old', conversationId: 'conversation-1', turnId: 'old', role: 'assistant', content: 'old', createdAt: '' }, { messageId: 'new', conversationId: 'conversation-1', turnId: 'turn-1', role: 'user', content: 'new', createdAt: '' }], ids);
    await subject.run([{ messageId: 'newer', conversationId: 'conversation-1', turnId: 'turn-2', role: 'user', content: 'newer', createdAt: '' }], { ...ids, turnId: 'turn-2' });
    expect(client.assistants.create).toHaveBeenCalledTimes(1);
    expect(wait.mock.calls[0][2].input.messages).toEqual([{ role: 'human', content: 'new' }]);
    expect(wait.mock.calls[0][2].input.catalog_courses).toEqual([]);
    expect(wait.mock.calls[0][2].input.catalog_families).toEqual([]);
    expect(client.threads.create.mock.calls[0][0].metadata).toEqual({ conversation_id: 'conversation-1' });
    expect(wait.mock.calls[0][2].metadata).toMatchObject({
      conversation_id: 'conversation-1',
      correlation_id: 'corr-1',
      LANGGRAPH_API_URL: 'https://agent.example.test',
    });
    expect(wait.mock.calls[0][2].metadata).not.toHaveProperty('thread_id');
  });

  it('uses a stable UUID thread for each course fit', async () => {
    const wait = vi.fn().mockImplementation(async (_thread: string, _assistant: string, options: any) => {
      options.onRunCreated({ run_id: 'run-fit' });
      return { course_fit_result: {
        entityType: 'course', entityId: 'course-1', title: 'Computer Science', detail: 'A fit.',
        institutionName: 'University', area: 'computing', country: 'Latvia', studentPhrase: 'programming',
      } };
    });
    const client: any = { assistants: { create: vi.fn().mockResolvedValue({ assistant_id: 'assistant-1' }) }, threads: { create: vi.fn().mockResolvedValue({}) }, runs: { wait } };
    const subject = new AgentServerClient({ AGENT_SERVER_URL: 'http://agent', AGENT_GRAPH_ID: 'chat' } as any, client);
    const input: any = {
      conversationId: 'conversation-1', correlationId: 'work-1',
      course: { courseId: 'course-1', name: 'Computer Science', institutionName: 'University', area: 'computing', country: 'Latvia' },
      profile: { studentPhrase: 'programming' },
      uiContext: { clientInstanceId: 'tab-1', target: { schemaVersion: 1, viewType: 'home' }, navigationRevision: 0n, visible: true, lastSeenAtMicros: 1n },
    };
    await subject.runCourseFit(input);
    const expected = courseFitThreadId('conversation-1', 'course-1');
    expect(expected).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(client.threads.create).toHaveBeenCalledWith(expect.objectContaining({ threadId: expected }));
    expect(wait).toHaveBeenCalledWith(expected, 'assistant-1', expect.any(Object));
  });
});
