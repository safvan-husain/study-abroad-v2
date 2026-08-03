'use client';

import { useCallback, useEffect, useRef } from 'react';
import { HOME_UI_TARGET } from '@study-abroad/contracts';
import { useAdvisorWorkspace } from '../../hooks/useAdvisorWorkspace';
import type { AdvisorUiActivity } from '../../hooks/useAdvisorWorkspace';
import { useWorkspaceNavigation } from '../../hooks/useWorkspaceNavigation';
import { createGuestSessionId } from '../../lib/guest-session';
import { workspaceContainsTarget } from '../../lib/ui-targets';
import { AdvisorRail } from './AdvisorRail';
import { WorkspaceView } from './WorkspaceView';

const UI_CLIENT_KEY = 'study-abroad-ui-client-id';

export function AdvisorWorkspaceShell() {
  const workspace = useAdvisorWorkspace();
  const navigation = useWorkspaceNavigation();
  const pendingAcknowledgements = useRef(new Set<string>());
  const clientInstanceId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(UI_CLIENT_KEY);
    clientInstanceId.current = stored || createGuestSessionId();
    if (!stored) window.sessionStorage.setItem(UI_CLIENT_KEY, clientInstanceId.current);
  }, []);

  useEffect(() => {
    const publish = () => {
      if (!clientInstanceId.current) return;
      void workspace.publishUiContext(
        clientInstanceId.current,
        navigation.target,
        navigation.navigationRevision,
        document.visibilityState === 'visible',
      );
    };
    publish();
    document.addEventListener('visibilitychange', publish);
    return () => document.removeEventListener('visibilitychange', publish);
  }, [navigation.navigationRevision, navigation.target, workspace.publishUiContext]);

  useEffect(() => {
    const receiptIds = new Set(workspace.uiActivityReceipts.map((receipt) => receipt.activityId));
    for (const activityId of receiptIds) pendingAcknowledgements.current.delete(activityId);
    for (const activity of workspace.uiActivities) {
      if (receiptIds.has(activity.activityId)
        || pendingAcknowledgements.current.has(activity.activityId)
        || !workspaceContainsTarget(navigation.target, activity.target)) continue;
      pendingAcknowledgements.current.add(activity.activityId);
      void workspace.acknowledgeUiActivity(activity.activityId, 'observed_in_place')
        .finally(() => pendingAcknowledgements.current.delete(activity.activityId));
    }
  }, [navigation.target, workspace.acknowledgeUiActivity, workspace.uiActivities, workspace.uiActivityReceipts]);

  const openActivity = useCallback((activity: AdvisorUiActivity) => {
    pendingAcknowledgements.current.add(activity.activityId);
    void workspace.acknowledgeUiActivity(activity.activityId, 'opened');
    navigation.openTarget(activity.target);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById(`workspace-item-${activity.workItemId}`)?.scrollIntoView({ block: 'center' });
    }));
  }, [navigation, workspace]);

  return (
    <div className="advisor-shell">
      <WorkspaceView
        directive={workspace.directive}
        workSets={workspace.workSets}
        workItems={workspace.workItems}
        workResults={workspace.workResults}
        profile={workspace.profile}
        target={navigation.target}
        setScrollElement={navigation.setScrollElement}
        onScroll={navigation.rememberScroll}
        onHome={() => navigation.openTarget(HOME_UI_TARGET)}
      />
      <AdvisorRail
        connectionState={workspace.connectionState}
        error={workspace.error}
        messages={workspace.messages}
        turns={workspace.turns}
        turnUpdates={workspace.turnUpdates}
        uiActivities={workspace.uiActivities}
        uiActivityReceipts={workspace.uiActivityReceipts}
        currentTarget={navigation.target}
        directive={workspace.directive}
        profile={workspace.profile}
        onSend={workspace.send}
        onUpdateProfile={workspace.updateProfile}
        onOpenActivity={openActivity}
      />
    </div>
  );
}
