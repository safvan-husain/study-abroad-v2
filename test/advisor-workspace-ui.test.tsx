import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdvisorConversation } from '../apps/web/components/workspace/AdvisorConversation';
import { AdvisorRail } from '../apps/web/components/workspace/AdvisorRail';
import { AdvisorActionCard } from '../apps/web/components/workspace/AdvisorActivities';
import { WorkspaceView } from '../apps/web/components/workspace/WorkspaceView';

const summaryTarget = (entityId: string) => ({ schemaVersion: 1 as const, viewType: 'course_summary' as const, workSetId: 'set-1', entityType: 'course', entityId, slot: 'summary' });

describe('advisor workspace UI', () => {
  it('opens with a hard-coded background and interests ask instead of starter chips', () => {
    const welcome = renderToStaticMarkup(<AdvisorConversation messages={[]} turns={[]} />);
    const rail = renderToStaticMarkup(<AdvisorRail
      connectionState="ready"
      messages={[]}
      turns={[]}
      turnUpdates={[]}
      onSend={async () => undefined}
      onUpdateProfile={async () => undefined}
    />);
    expect(welcome).toContain('Tell me about your background and interests.');
    expect(rail).not.toContain('TRY ASKING');
    expect(rail).not.toContain('I am unsure what to study');
  });

  it('renders progressive activity labels from typed turn updates', () => {
    const transcript = renderToStaticMarkup(<AdvisorConversation
      messages={[{ messageId: 'u1', turnId: 't1', role: 'user', content: 'I like programming', sequence: 1n, createdAtMicros: 1n }]}
      turns={[{ turnId: 't1', status: 'claimed', errorCode: null, attempt: 1 }]}
      turnUpdates={[{
        updateId: 1n,
        turnId: 't1',
        attempt: 1,
        sequence: 2,
        kind: 'course_search_results_ready',
        payload: { kind: 'course_search_results_ready', studentPhrase: 'programming', matchCount: 5, courseIds: ['a'] },
      }]}
    />);
    expect(transcript).toContain('Found 5 study-abroad courses related to programming.');
    expect(transcript).not.toContain('Computer Science at University of Latvia');
  });

  it('keeps acknowledgement transcript content separate from child course results', () => {
    const transcript = renderToStaticMarkup(<AdvisorConversation messages={[{ messageId: 'a1', turnId: 't1', role: 'assistant', content: 'I am opening your planning space.', sequence: 2n, createdAtMicros: 2n }]} turns={[{ turnId: 't1', status: 'completed', errorCode: null, attempt: 1 }]} />);
    const workspace = renderToStaticMarkup(<WorkspaceView
      directive={{ viewType: 'catalog', awareness: 'Showing courses related to programming.', uiRevision: 1n, workSetId: 'set-1' }}
      workSets={[{ workSetId: 'set-1', status: 'partial' }]}
      target={summaryTarget('lu-computer-science-bsc')}
      workItems={[
        { workItemId: 'i1', workSetId: 'set-1', entityId: 'lu-computer-science-bsc', kind: 'course_fit_summary', displayTitle: 'Comparing Computer Science', orderIndex: 0, target: summaryTarget('lu-computer-science-bsc'), status: 'completed', errorCode: null },
        { workItemId: 'i2', workSetId: 'set-1', entityId: 'rtu-computer-systems-bsc', kind: 'course_fit_summary', displayTitle: 'Comparing Computer Systems', orderIndex: 1, target: summaryTarget('rtu-computer-systems-bsc'), status: 'pending', errorCode: null },
      ]}
      workResults={[{ workItemId: 'i1', resultJson: '{"title":"Computer Science","detail":"Indicative fit for programming.","institutionName":"University of Latvia","area":"computing"}', target: summaryTarget('lu-computer-science-bsc') }]}
      profile={{ background: '', courseInterests: 'programming', ambitions: '', primaryArea: 'computing', candidateAreas: ['computing'], studentPhrase: 'programming', constraintsText: '' }}
    />);

    expect(transcript).toContain('I am opening your planning space.');
    expect(transcript).not.toContain('Indicative fit for programming.');
    expect(workspace).toContain('Indicative fit for programming.');
    expect(workspace).toContain('Comparing Computer Systems');
    expect(workspace).toContain('aria-busy="true"');
    expect(workspace).toContain('programming');
  });

  it('renders failed and obsolete child slots without hiding siblings', () => {
    const markup = renderToStaticMarkup(<WorkspaceView
      workSets={[{ workSetId: 'set-1', status: 'completed_with_errors' }]}
      target={{ schemaVersion: 1, viewType: 'catalog', workSetId: 'set-1' }}
      workItems={[
        { workItemId: 'i1', workSetId: 'set-1', entityId: 'one', kind: 'advisor_prompt', displayTitle: 'Preparing one', orderIndex: 0, target: { schemaVersion: 1, viewType: 'catalog', workSetId: 'set-1' }, status: 'completed', errorCode: null },
        { workItemId: 'i2', workSetId: 'set-1', entityId: 'two', kind: 'advisor_prompt', displayTitle: 'Preparing two', orderIndex: 1, target: { schemaVersion: 1, viewType: 'catalog', workSetId: 'set-1' }, status: 'failed', errorCode: 'worker_error' },
        { workItemId: 'i3', workSetId: 'set-1', entityId: 'three', kind: 'advisor_prompt', displayTitle: 'Preparing three', orderIndex: 2, target: { schemaVersion: 1, viewType: 'catalog', workSetId: 'set-1' }, status: 'obsolete', errorCode: 'stale_context' },
      ]}
      workResults={[{ workItemId: 'i1', resultJson: '{"title":"Completed sibling","detail":"Still visible."}', target: { schemaVersion: 1, viewType: 'catalog', workSetId: 'set-1' } }]}
    />);
    expect(markup).toContain('Completed sibling');
    expect(markup).toContain('Needs another try');
    expect(markup).toContain('no longer matches');
  });

  it('keeps a completed action card available regardless of the current workspace', () => {
    const action = {
      actionId: 'a1', clientInstanceId: 'tab-1', sourceKind: 'work_item', sourceId: 'i1', kind: 'open_course_summary',
      label: 'Computer Science summary added', buttonLabel: 'Open summary', target: summaryTarget('lu-computer-science-bsc'),
      baseTarget: { schemaVersion: 1 as const, viewType: 'home' as const }, baseNavigationRevision: 0n,
      activation: 'auto_if_origin_unchanged' as const, status: 'opened' as const, createdAtMicros: 1n, updatedAtMicros: 2n,
    };
    const card = renderToStaticMarkup(<AdvisorActionCard action={action} onOpen={() => undefined} />);
    const transcript = renderToStaticMarkup(<AdvisorConversation messages={[]} turns={[]} uiActions={[action]} />);
    expect(card).toContain('Computer Science summary added');
    expect(card).toContain('Open again');
    expect(transcript).toContain('Computer Science summary added');
  });
});
