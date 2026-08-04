import { describe, expect, it, vi } from 'vitest';
import { MIN_CATALOG_COURSES, processChatTurn } from '../src/services/process-chat-turn.js';
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
  uiContext: { clientInstanceId: string; target: { schemaVersion: 1; viewType: 'home' }; navigationRevision: bigint; visible: boolean; lastSeenAtMicros: bigint };
}> = {}) => ({
  conversationId: 'c1',
  turnId: 't1',
  correlationId: 'corr1',
  agentThreadId: 'c1',
  userMessageId: 't1',
  userContent: 'Hello',
  attempt: 0,
  baseUiRevision: 0n,
  uiContext: { clientInstanceId: 'tab-1', target: { schemaVersion: 1, viewType: 'home' }, navigationRevision: 0n, visible: true, lastSeenAtMicros: 1n },
  ...overrides,
});

const baseCourse = {
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
};

const computingCatalog = {
  listCourses: () => Array.from({ length: MIN_CATALOG_COURSES }, (_, index) => ({
    ...baseCourse,
    courseId: index === 0 ? baseCourse.courseId : `course-${index}`,
    name: index === 0 ? baseCourse.name : `Course ${index}`,
  })),
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
      workItems: expect.arrayContaining([
        expect.objectContaining({ entityId: 'lu-computer-science-bsc', kind: 'course_fit_summary' }),
      ]),
    }));
    expect(upsertConversationProfile).toHaveBeenCalled();
  });

  it('builds program_area_overview work items for areas_overview without shortlisting', async () => {
    const coordinator = {
      claim: vi.fn().mockResolvedValue(1),
      complete: vi.fn(),
      retry: vi.fn(),
      publishTurnUpdate: vi.fn(),
      upsertConversationProfile: vi.fn(),
    };
    const families = [
      {
        familyId: 'computer-science', areaId: 'computing-technology', name: 'Computer Science',
        aliasesJson: '[]', description: 'Software and theory.', typicalSubjectsJson: '[]',
        careerDirectionsJson: '[]', relatedFamilyIdsJson: '[]', active: true,
      },
      {
        familyId: 'nursing', areaId: 'health-medicine', name: 'Nursing',
        aliasesJson: '[]', description: 'Clinical care.', typicalSubjectsJson: '[]',
        careerDirectionsJson: '[]', relatedFamilyIdsJson: '[]', active: true,
      },
    ];
    const catalog = {
      listCourses: () => Array.from({ length: MIN_CATALOG_COURSES }, (_, index) => ({
        ...baseCourse,
        courseId: index === 0 ? baseCourse.courseId : `course-${index}`,
        familyId: index === 0 ? 'computer-science' : 'nursing',
        name: index === 0 ? baseCourse.name : `Course ${index}`,
      })),
      listFamilies: () => families,
      getProfile: () => undefined,
    };
    const agent = {
      run: vi.fn().mockResolvedValue({
        threadId: 'c1',
        runId: 'r1',
        content: 'Here are the main course areas.',
        metadata: {},
        advisor: {
          assistantContent: 'I’ve opened the main course areas in your workspace.',
          route: { intent: 'discovery', reason: 'Cold-start browse', clarificationQuestion: '' },
          scope: {
            scope: 'areas_overview', areaId: '', familyIds: [], offeringIds: [],
            explanation: 'Catalog-wide browse', clarificationQuestion: '', comparisonCriterion: '',
          },
          proposal: { mode: 'none', offeringIds: [], rationale: '' },
          presentedFamilyIds: [],
          presentedOfferingIds: [],
          directive: { type: 'catalog', awareness: 'Showing the main course areas.' },
          workItems: [],
          workKind: 'areas_overview',
          profilePatch: {
            background: '', courseInterests: '', ambitions: '', primaryArea: '',
            candidateAreas: [], studentPhrase: "I'm confused", constraintsText: '',
          },
        },
      }),
    };
    await processChatTurn(turn({ userContent: "I'm confused and want to go abroad" }), agent, coordinator, undefined, catalog);
    expect(coordinator.complete).toHaveBeenCalledWith('t1', 1, expect.objectContaining({
      directiveType: 'catalog',
      workKind: 'areas_overview',
      presentedFamilyIds: [],
      presentedOfferingIds: [],
      workItems: expect.arrayContaining([
        expect.objectContaining({ entityType: 'area', entityId: 'computing-technology', kind: 'program_area_overview' }),
        expect.objectContaining({ entityType: 'area', entityId: 'health-medicine', kind: 'program_area_overview' }),
      ]),
    }));
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

  it('fails the turn without invoking the agent when the catalog is too small', async () => {
    const fail = vi.fn();
    const coordinator = { claim: vi.fn().mockResolvedValue(1), complete: vi.fn(), retry: vi.fn(), fail, publishTurnUpdate: vi.fn() };
    const agent = { run: vi.fn() };
    const thinCatalog = { listCourses: () => [baseCourse], getProfile: () => undefined };
    await processChatTurn(turn({ userContent: 'I like programming' }), agent, coordinator, undefined, thinCatalog);
    expect(agent.run).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith('t1', 1, 'catalog_unavailable');
    expect(coordinator.complete).not.toHaveBeenCalled();
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
