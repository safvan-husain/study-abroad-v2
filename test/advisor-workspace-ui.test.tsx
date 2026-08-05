import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdvisorConversation } from '../apps/web/components/workspace/AdvisorConversation';
import { AdvisorRail } from '../apps/web/components/workspace/AdvisorRail';
import { AdvisorActionCard } from '../apps/web/components/workspace/AdvisorActivities';
import {
  AdvisorWorkspaceFrame,
  advisorShellClassName,
  workspaceOverlayClassName,
} from '../apps/web/components/workspace/AdvisorWorkspaceFrame';
import { WorkspaceLiveReplyBar } from '../apps/web/components/workspace/WorkspaceLiveReplyBar';
import { WorkspaceView } from '../apps/web/components/workspace/WorkspaceView';
import { hasNewAssistantReply, latestAssistantMessageId } from '../apps/web/lib/live-reply';

const summaryTarget = (entityId: string) => ({ schemaVersion: 1 as const, viewType: 'course_summary' as const, workSetId: 'set-1', entityType: 'course', entityId, slot: 'summary' });

describe('advisor workspace UI', () => {
  it('opens with Explore-first progress and no Discovery step', () => {
    const markup = renderToStaticMarkup(<WorkspaceView
      workSets={[]}
      workItems={[]}
      workResults={[]}
      target={{ schemaVersion: 1, viewType: 'home' }}
    />);
    expect(markup).toContain('Explore courses that fit your story.');
    expect(markup).toContain('Ready to explore');
    expect(markup).toContain('<b>Explore</b>');
    expect(markup).toContain('<b>Shortlist</b>');
    expect(markup).toContain('<b>Documents</b>');
    expect(markup).not.toContain('Discovery');
    expect(markup).toContain('YOUR JOURNEY <b>/</b> EXPLORE');
  });

  it('opens with a hard-coded background and interests ask instead of starter chips', () => {
    const welcome = renderToStaticMarkup(<AdvisorConversation messages={[]} turns={[]} />);
    const rail = renderToStaticMarkup(<AdvisorRail
      connectionState="ready"
      agentThreadId="550e8400-e29b-41d4-a716-446655440000"
      messages={[]}
      turns={[]}
      turnUpdates={[]}
      onSend={async () => undefined}
      onUpdateProfile={async () => undefined}
    />);
    expect(welcome).toContain('Tell me about your background and interests.');
    expect(rail).not.toContain('TRY ASKING');
    expect(rail).not.toContain('I am unsure what to study');
    expect(rail).toContain('550e8400-e29b-41d4-a716-446655440000');
    expect(rail).toContain('Copy thread ID');
    expect(rail).toContain('Reset guest journey');
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

  it('renders course area cards for program_area_overview work items', () => {
    const markup = renderToStaticMarkup(<WorkspaceView
      directive={{ viewType: 'catalog', awareness: 'Showing the main course areas.', uiRevision: 1n, workSetId: 'set-1' }}
      workSets={[{ workSetId: 'set-1', status: 'partial', kind: 'areas_overview' }]}
      target={{ schemaVersion: 1, viewType: 'catalog', workSetId: 'set-1' }}
      workItems={[
        {
          workItemId: 'a1', workSetId: 'set-1', entityId: 'computing-technology', kind: 'program_area_overview',
          displayTitle: 'Computing and Technology', orderIndex: 0,
          target: { schemaVersion: 1, viewType: 'area', workSetId: 'set-1', entityType: 'area', entityId: 'computing-technology' },
          status: 'completed', errorCode: null,
        },
        {
          workItemId: 'a2', workSetId: 'set-1', entityId: 'health-medicine', kind: 'program_area_overview',
          displayTitle: 'Health and Medicine', orderIndex: 1,
          target: { schemaVersion: 1, viewType: 'area', workSetId: 'set-1', entityType: 'area', entityId: 'health-medicine' },
          status: 'completed', errorCode: null,
        },
      ]}
      workResults={[
        {
          workItemId: 'a1',
          resultJson: '{"title":"Computing and Technology","detail":"Includes course types such as Computer Science.","familyCount":5,"sampleFamilyNames":["Computer Science","Data Science"]}',
          target: { schemaVersion: 1, viewType: 'area', workSetId: 'set-1', entityType: 'area', entityId: 'computing-technology' },
        },
        {
          workItemId: 'a2',
          resultJson: '{"title":"Health and Medicine","detail":"Includes course types such as Nursing.","familyCount":1,"sampleFamilyNames":["Nursing"]}',
          target: { schemaVersion: 1, viewType: 'area', workSetId: 'set-1', entityType: 'area', entityId: 'health-medicine' },
        },
      ]}
    />);
    expect(markup).toContain('Course areas');
    expect(markup).toContain('Computing and Technology');
    expect(markup).toContain('Health and Medicine');
    expect(markup).toContain('5 course types');
    expect(markup).toContain('Computer Science');
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

  it('shows the parent catalogue area as a badge under the composer when families are presented', () => {
    const rail = renderToStaticMarkup(<AdvisorRail
      connectionState="ready"
      messages={[]}
      turns={[]}
      turnUpdates={[]}
      selection={{
        revision: 1n,
        presentedFamilyIds: ['computer-science', 'mathematical-and-computing-sciences-for-artificial-intelligence'],
        selectedFamilyIds: [],
        presentedOfferingIds: [],
        provisionalOfferingIds: [],
        suppressedOfferingIds: [],
        confirmedOfferingIds: [],
        confirmedSnapshotId: null,
        comparisonCriterion: '',
      }}
      catalogFamilies={[
        {
          familyId: 'computer-science', areaId: 'computing-technology', name: 'Computer Science',
          aliasesJson: '[]', description: '', typicalSubjectsJson: '[]', careerDirectionsJson: '[]', relatedFamilyIdsJson: '[]',
        },
        {
          familyId: 'mathematical-and-computing-sciences-for-artificial-intelligence',
          areaId: 'computing-technology',
          name: 'Mathematical and Computing Sciences for Artificial Intelligence',
          aliasesJson: '[]', description: '', typicalSubjectsJson: '[]', careerDirectionsJson: '[]', relatedFamilyIdsJson: '[]',
        },
      ]}
      onSend={async () => undefined}
      onUpdateProfile={async () => undefined}
    />);
    expect(rail).toContain('Computer Science');
    expect(rail).toContain('Mathematical and Computing Sciences for Artificial Intelligence');
    expect(rail).toContain('composer-area-badge');
    expect(rail).toContain('Computing and Technology');
    expect(rail.match(/Computing and Technology/g)?.length).toBe(1);
  });

  it('shows selected course types under the composer separately from presented context chips', () => {
    const rail = renderToStaticMarkup(<AdvisorRail
      connectionState="ready"
      messages={[]}
      turns={[]}
      turnUpdates={[]}
      selection={{
        revision: 2n,
        presentedFamilyIds: ['computer-science', 'data-science'],
        selectedFamilyIds: ['computer-science', 'data-science'],
        presentedOfferingIds: [],
        provisionalOfferingIds: [],
        suppressedOfferingIds: [],
        confirmedOfferingIds: [],
        confirmedSnapshotId: null,
        comparisonCriterion: '',
      }}
      catalogFamilies={[
        {
          familyId: 'computer-science', areaId: 'computing-technology', name: 'Computer Science',
          aliasesJson: '[]', description: '', typicalSubjectsJson: '[]', careerDirectionsJson: '[]', relatedFamilyIdsJson: '[]',
        },
        {
          familyId: 'data-science', areaId: 'computing-technology', name: 'Data Science',
          aliasesJson: '[]', description: '', typicalSubjectsJson: '[]', careerDirectionsJson: '[]', relatedFamilyIdsJson: '[]',
        },
      ]}
      onSend={async () => undefined}
      onUpdateProfile={async () => undefined}
    />);
    expect(rail).toContain('Selected course types');
    expect(rail).toContain('aria-label="Selected course types"');
    expect(rail).toContain('2/4');
    expect(rail).toContain('Remove Computer Science');
    expect(rail).toContain('Remove Data Science');
  });

  it('lets students choose course types from family overview cards', () => {
    const familyTarget = {
      schemaVersion: 1 as const, viewType: 'family' as const, workSetId: 'set-family', entityType: 'family', entityId: 'computer-science',
    };
    const markup = renderToStaticMarkup(<WorkspaceView
      workSets={[{ workSetId: 'set-family', status: 'completed', kind: 'area_overview' }]}
      target={{ schemaVersion: 1, viewType: 'catalog', workSetId: 'set-family' }}
      workItems={[{
        workItemId: 'f1', workSetId: 'set-family', entityId: 'computer-science', kind: 'program_family_overview',
        displayTitle: 'Computer Science', orderIndex: 0, target: familyTarget, status: 'completed', errorCode: null,
      }]}
      workResults={[{
        workItemId: 'f1',
        resultJson: JSON.stringify({
          title: 'Computer Science', detail: 'Focuses on algorithms and software.', offeringCount: 2,
          typicalSubjects: ['Algorithms'], careerDirections: ['Software engineering'],
        }),
        target: familyTarget,
      }]}
      selection={{
        revision: 1n, presentedFamilyIds: ['computer-science'], selectedFamilyIds: [],
        presentedOfferingIds: [], provisionalOfferingIds: [], suppressedOfferingIds: [],
        confirmedOfferingIds: [], confirmedSnapshotId: null, comparisonCriterion: '',
      }}
    />);
    expect(markup).toContain('Course types in this area');
    expect(markup).toContain('Choose course type');
    expect(markup).toContain('Focuses on algorithms and software.');
  });

  it('shows a dismiss control on the workspace when the compact overlay can close', () => {
    const markup = renderToStaticMarkup(<WorkspaceView
      workSets={[]}
      workItems={[]}
      workResults={[]}
      target={{ schemaVersion: 1, viewType: 'home' }}
      onDismiss={() => undefined}
    />);
    expect(markup).toContain('Back to chat');
    expect(markup).toContain('workspace-dismiss');
  });

  it('renders compact chat-primary chrome with a closed or open workspace overlay', () => {
    const closed = renderToStaticMarkup(<AdvisorWorkspaceFrame
      compact
      overlayOpen={false}
      showLiveReply={false}
      onReturnToChat={() => undefined}
      workspace={<div>Workspace pane</div>}
      rail={<div>Chat rail</div>}
    />);
    expect(closed).toContain('advisor-shell is-compact');
    expect(closed).not.toContain('workspace-overlay-open');
    expect(closed).toContain('workspace-overlay');
    expect(closed).not.toContain('is-open');
    expect(closed).toContain('aria-hidden="true"');
    expect(closed).toContain('Chat rail');
    expect(closed).toContain('Workspace pane');
    expect(closed).not.toContain('Advisor replied');

    const open = renderToStaticMarkup(<AdvisorWorkspaceFrame
      compact
      overlayOpen
      showLiveReply
      onReturnToChat={() => undefined}
      workspace={<div>Workspace pane</div>}
      rail={<div>Chat rail</div>}
    />);
    expect(open).toContain('advisor-shell is-compact workspace-overlay-open');
    expect(open).toContain('workspace-overlay is-open');
    expect(open).toContain('aria-hidden="false"');
    expect(open).toContain('Advisor replied — back to chat');
    expect(open).toContain('A new message is waiting in the conversation.');
  });

  it('keeps desktop side-by-side order without an overlay', () => {
    const markup = renderToStaticMarkup(<AdvisorWorkspaceFrame
      compact={false}
      overlayOpen={false}
      showLiveReply={false}
      onReturnToChat={() => undefined}
      workspace={<div id="ws">Workspace pane</div>}
      rail={<div id="chat">Chat rail</div>}
    />);
    expect(markup).toContain('advisor-shell');
    expect(markup).not.toContain('is-compact');
    expect(markup).not.toContain('workspace-overlay');
    expect(markup.indexOf('Workspace pane')).toBeLessThan(markup.indexOf('Chat rail'));
  });

  it('builds shell and overlay class names for compact auto-show states', () => {
    expect(advisorShellClassName(false, true)).toBe('advisor-shell');
    expect(advisorShellClassName(true, false)).toBe('advisor-shell is-compact');
    expect(advisorShellClassName(true, true)).toBe('advisor-shell is-compact workspace-overlay-open');
    expect(workspaceOverlayClassName(false)).toBe('workspace-overlay');
    expect(workspaceOverlayClassName(true)).toBe('workspace-overlay is-open');
  });

  it('detects a newer assistant reply for the live overlay cue', () => {
    expect(latestAssistantMessageId([])).toBeNull();
    expect(latestAssistantMessageId([
      { messageId: 'u1', role: 'user' },
      { messageId: 'a1', role: 'assistant' },
      { messageId: 'u2', role: 'user' },
    ])).toBe('a1');
    expect(hasNewAssistantReply(null, null)).toBe(false);
    expect(hasNewAssistantReply('a1', 'a1')).toBe(false);
    expect(hasNewAssistantReply('a2', 'a1')).toBe(true);
    expect(hasNewAssistantReply('a1', null)).toBe(true);
  });

  it('renders the live reply bar copy as an inline return control', () => {
    const markup = renderToStaticMarkup(<WorkspaceLiveReplyBar onReturn={() => undefined} />);
    expect(markup).toContain('workspace-live-reply');
    expect(markup).toContain('Advisor replied — back to chat');
    expect(markup).toContain('Open');
  });
});
