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

const computingCatalog = {
  listCourses: () => [{
    courseId: 'lu-computer-science-bsc',
    institutionId: 'university-of-latvia',
    institutionName: 'University of Latvia',
    country: 'Latvia',
    city: 'Riga',
    name: 'Computer Science',
    area: 'computing',
    level: 'undergraduate',
    tuitionBand: 'moderate',
    englishBar: 'IELTS 6.0',
  }],
  getProfile: () => undefined,
};

describe('AI worker chat turn', () => {
  it('publishes progressive search milestones and course-fit work items for mapped interests', async () => {
    const publishTurnUpdate = vi.fn();
    const upsertConversationProfile = vi.fn();
    const coordinator = {
      claim: vi.fn().mockResolvedValue(1),
      complete: vi.fn(),
      retry: vi.fn(),
      publishTurnUpdate,
      upsertConversationProfile,
    };
    const agent = {
      run: vi.fn().mockResolvedValue({
        threadId: 'c1',
        runId: 'r1',
        content: 'Looking at programming courses.',
        metadata: {},
        discovery: {
          assistantContent: 'Thanks — I am looking through partner courses related to programming and will organize matches in your workspace.',
          profilePatch: {
            background: '',
            courseInterests: 'programming',
            ambitions: '',
            primaryArea: 'computing',
            candidateAreas: ['computing'],
            studentPhrase: 'programming',
            constraintsText: '',
          },
          discoveryIntent: { studentPhrase: 'programming', catalogAreas: ['computing'], status: 'mapped' },
          directive: { type: 'catalog', awareness: 'Showing courses related to programming.' },
          workItems: [],
          workKind: '',
        },
      }),
    };
    await processChatTurn(turn({ userContent: 'I like programming' }), agent, coordinator, undefined, computingCatalog);
    expect(publishTurnUpdate.mock.calls.map((call) => call[3].kind)).toEqual([
      'turn_started',
      'course_search_started',
      'course_search_results_ready',
    ]);
    expect(coordinator.complete).toHaveBeenCalledWith('t1', 1, expect.objectContaining({
      directiveType: 'catalog',
      workKind: 'course_fit_summaries',
      workItems: [expect.objectContaining({ entityId: 'lu-computer-science-bsc', kind: 'course_fit_summary' })],
    }));
    expect(upsertConversationProfile).toHaveBeenCalled();
  });

  it('keeps discovery without invented courses for unmapped phrases', async () => {
    const coordinator = { claim: vi.fn().mockResolvedValue(1), complete: vi.fn(), retry: vi.fn(), publishTurnUpdate: vi.fn() };
    const agent = { run: vi.fn().mockResolvedValue({ threadId: 'c1', runId: 'r1', content: 'Need more detail', metadata: {} }) };
    await processChatTurn(turn({ userContent: 'underwater basket weaving' }), agent, coordinator, undefined, computingCatalog);
    expect(coordinator.complete).toHaveBeenCalledWith('t1', 1, expect.objectContaining({
      directiveType: 'discovery',
      workItems: [],
    }));
  });

  it('subscribes, deduplicates delivery, renews leases, and stops cleanly', async () => {
    let deliver: ((turn: any) => void) | undefined;
    const coordinator = { claim: vi.fn().mockResolvedValue(1), renew: vi.fn().mockResolvedValue(undefined), complete: vi.fn(), retry: vi.fn() };
    const agent = { run: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ threadId: 'c2', runId: 'r2', content: 'Hello', metadata: {} }), 30))) };
    const worker = new JobWorker({ agent, coordinator, leaseSeconds: 1, subscribe: callback => { deliver = callback; return () => { deliver = undefined; }; }, catalog: computingCatalog });
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
    const worker = new JobWorker({ agent, coordinator, catalog: computingCatalog });
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
});
