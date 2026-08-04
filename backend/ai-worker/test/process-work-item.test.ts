import { describe, expect, it, vi } from 'vitest';
import { processWorkItem } from '../src/services/process-work-item.js';

const item = {
  workItemId: 'item-1',
  workSetId: 'set-1',
  conversationId: 'c1',
  entityType: 'topic',
  entityId: 'background',
  kind: 'prompt',
  displayTitle: 'Preparing background',
  orderIndex: 0,
  targetJson: '{"schemaVersion":1,"viewType":"catalog"}',
  dependencyJson: '{}',
  inputJson: '{"title":"Background","detail":"Share your grades."}',
  attempt: 0,
  expectedContextRevision: 0n,
  expectedUiRevision: 1n,
  uiContext: { clientInstanceId: 'tab-1', target: { schemaVersion: 1 as const, viewType: 'home' as const }, navigationRevision: 0n, visible: true, lastSeenAtMicros: 1n },
};

describe('processWorkItem', () => {
  it('claims and commits one bounded result without a transcript operation', async () => {
    const coordinator = { claimWorkItem: vi.fn().mockResolvedValue(1), completeWorkItem: vi.fn(), retryWorkItem: vi.fn() };
    await processWorkItem(item, coordinator);
    expect(coordinator.completeWorkItem).toHaveBeenCalledWith('item-1', 1, expect.stringContaining('Share your grades.'));
  });

  it('writes a deterministic area overview for program_area_overview items', async () => {
    const coordinator = { claimWorkItem: vi.fn().mockResolvedValue(1), completeWorkItem: vi.fn(), retryWorkItem: vi.fn() };
    await processWorkItem({
      ...item,
      entityType: 'area',
      entityId: 'computing-technology',
      kind: 'program_area_overview',
      displayTitle: 'Computing and Technology',
      inputJson: JSON.stringify({
        areaId: 'computing-technology',
        name: 'Computing and Technology',
        description: 'Includes course types such as Computer Science.',
        familyCount: 5,
        sampleFamilyNames: ['Computer Science', 'Data Science'],
        offeringCount: 12,
      }),
    }, coordinator);
    expect(coordinator.completeWorkItem).toHaveBeenCalledWith(
      'item-1',
      1,
      expect.stringContaining('Computing and Technology'),
    );
    const payload = JSON.parse(coordinator.completeWorkItem.mock.calls[0][2] as string);
    expect(payload).toMatchObject({
      entityType: 'area',
      entityId: 'computing-technology',
      familyCount: 5,
      offeringCount: 12,
    });
  });

  it('writes an indicative course fit summary for course_fit_summary items', async () => {
    const coordinator = { claimWorkItem: vi.fn().mockResolvedValue(1), completeWorkItem: vi.fn(), retryWorkItem: vi.fn() };
    await processWorkItem({
      ...item,
      entityType: 'course',
      entityId: 'lu-computer-science-bsc',
      kind: 'course_fit_summary',
      inputJson: JSON.stringify({
        courseId: 'lu-computer-science-bsc',
        name: 'Computer Science',
        institutionName: 'University of Latvia',
        country: 'Latvia',
        area: 'computing',
        studentPhrase: 'programming',
      }),
    }, coordinator);
    expect(coordinator.completeWorkItem).toHaveBeenCalledWith(
      'item-1',
      1,
      expect.stringContaining('programming'),
    );
  });

  it('keeps the local course-fit fallback when remote output is malformed', async () => {
    const coordinator = { claimWorkItem: vi.fn().mockResolvedValue(1), completeWorkItem: vi.fn(), retryWorkItem: vi.fn() };
    const agent = {
      runCourseFit: vi.fn().mockResolvedValue({
        runId: 'run-bad',
        result: { entityType: 'course', entityId: '', title: '', detail: '' },
      }),
    };
    await processWorkItem({
      ...item,
      entityType: 'course',
      entityId: 'lu-computer-science-bsc',
      kind: 'course_fit_summary',
      inputJson: JSON.stringify({
        courseId: 'lu-computer-science-bsc',
        name: 'Computer Science',
        institutionName: 'University of Latvia',
        country: 'Latvia',
        area: 'computing',
        studentPhrase: 'programming',
      }),
    }, coordinator, undefined, agent as any);
    expect(coordinator.completeWorkItem).toHaveBeenCalledWith(
      'item-1',
      1,
      expect.stringContaining('indicative fit'),
    );
    expect(coordinator.completeWorkItem.mock.calls[0][3]).toBeUndefined();
  });

  it('retries malformed child input with the active fence', async () => {
    const coordinator = { claimWorkItem: vi.fn().mockResolvedValue(2), completeWorkItem: vi.fn(), retryWorkItem: vi.fn() };
    await processWorkItem({ ...item, inputJson: '{' }, coordinator);
    expect(coordinator.retryWorkItem).toHaveBeenCalledWith('item-1', 2, 'SyntaxError');
  });
});
