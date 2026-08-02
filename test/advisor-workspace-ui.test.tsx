import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdvisorConversation } from '../apps/web/components/workspace/AdvisorConversation';
import { WorkspaceView } from '../apps/web/components/workspace/WorkspaceView';

describe('advisor workspace UI', () => {
  it('keeps acknowledgement transcript content separate from child results', () => {
    const transcript = renderToStaticMarkup(<AdvisorConversation messages={[{ messageId: 'a1', role: 'assistant', content: 'I am opening your planning space.', sequence: 2n }]} turns={[{ turnId: 't1', status: 'completed', errorCode: null }]} />);
    const workspace = renderToStaticMarkup(<WorkspaceView
      directive={{ viewType: 'discovery', awareness: 'Learning about your goals.', uiRevision: 1n, workSetId: 'set-1' }}
      workSets={[{ workSetId: 'set-1', status: 'partial' }]}
      workItems={[
        { workItemId: 'i1', workSetId: 'set-1', entityId: 'background', status: 'completed', errorCode: null },
        { workItemId: 'i2', workSetId: 'set-1', entityId: 'ambition', status: 'pending', errorCode: null },
      ]}
      workResults={[{ workItemId: 'i1', resultJson: '{"title":"Academic background","detail":"Ready independently."}' }]}
    />);

    expect(transcript).toContain('I am opening your planning space.');
    expect(transcript).not.toContain('Ready independently.');
    expect(workspace).toContain('Ready independently.');
    expect(workspace).toContain('Preparing this step');
    expect(workspace).toContain('aria-busy="true"');
  });

  it('renders failed and obsolete child slots without hiding siblings', () => {
    const markup = renderToStaticMarkup(<WorkspaceView
      workSets={[{ workSetId: 'set-1', status: 'completed_with_errors' }]}
      workItems={[
        { workItemId: 'i1', workSetId: 'set-1', entityId: 'one', status: 'completed', errorCode: null },
        { workItemId: 'i2', workSetId: 'set-1', entityId: 'two', status: 'failed', errorCode: 'worker_error' },
        { workItemId: 'i3', workSetId: 'set-1', entityId: 'three', status: 'obsolete', errorCode: 'stale_context' },
      ]}
      workResults={[{ workItemId: 'i1', resultJson: '{"title":"Completed sibling","detail":"Still visible."}' }]}
    />);
    expect(markup).toContain('Completed sibling');
    expect(markup).toContain('Needs another try');
    expect(markup).toContain('no longer matches');
  });
});
