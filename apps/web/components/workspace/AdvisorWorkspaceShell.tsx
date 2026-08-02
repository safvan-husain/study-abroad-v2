'use client';

import { useAdvisorWorkspace } from '../../hooks/useAdvisorWorkspace';
import { AdvisorRail } from './AdvisorRail';
import { WorkspaceView } from './WorkspaceView';

export function AdvisorWorkspaceShell() {
  const workspace = useAdvisorWorkspace();
  return (
    <div className="advisor-shell">
      <WorkspaceView directive={workspace.directive} workSets={workspace.workSets} workItems={workspace.workItems} workResults={workspace.workResults} />
      <AdvisorRail connectionState={workspace.connectionState} error={workspace.error} messages={workspace.messages} turns={workspace.turns} directive={workspace.directive} onSend={workspace.send} />
    </div>
  );
}
