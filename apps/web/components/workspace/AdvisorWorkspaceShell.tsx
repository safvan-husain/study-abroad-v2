'use client';

import { useAdvisorWorkspace } from '../../hooks/useAdvisorWorkspace';
import { AdvisorRail } from './AdvisorRail';
import { WorkspaceView } from './WorkspaceView';

export function AdvisorWorkspaceShell() {
  const workspace = useAdvisorWorkspace();
  return (
    <div className="advisor-shell">
      <WorkspaceView
        directive={workspace.directive}
        workSets={workspace.workSets}
        workItems={workspace.workItems}
        workResults={workspace.workResults}
        profile={workspace.profile}
      />
      <AdvisorRail
        connectionState={workspace.connectionState}
        error={workspace.error}
        messages={workspace.messages}
        turns={workspace.turns}
        turnUpdates={workspace.turnUpdates}
        directive={workspace.directive}
        profile={workspace.profile}
        onSend={workspace.send}
        onUpdateProfile={workspace.updateProfile}
      />
    </div>
  );
}
