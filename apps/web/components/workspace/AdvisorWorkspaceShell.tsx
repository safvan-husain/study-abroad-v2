'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HOME_UI_TARGET, uiTargetsMatch } from '@study-abroad/contracts';
import { useAdvisorWorkspace, type AdvisorUiAction } from '../../hooks/useAdvisorWorkspace';
import { useWorkspaceNavigation } from '../../hooks/useWorkspaceNavigation';
import { createGuestSessionId, UI_CLIENT_STORAGE_KEY } from '../../lib/guest-session';
import { workspaceTargetIsAvailable } from '../../lib/ui-targets';
import { AdvisorRail } from './AdvisorRail';
import { WorkspaceView } from './WorkspaceView';

const PRESENCE_INTERVAL_MS = 10_000;

function ensureClientInstanceId() {
  const stored = window.sessionStorage.getItem(UI_CLIENT_STORAGE_KEY);
  const id = stored || createGuestSessionId();
  if (!stored) window.sessionStorage.setItem(UI_CLIENT_STORAGE_KEY, id);
  return id;
}

export function AdvisorWorkspaceShell() {
  const workspace = useAdvisorWorkspace();
  const navigation = useWorkspaceNavigation();
  const [clientInstanceId, setClientInstanceId] = useState<string>();
  const [resolvingActionId, setResolvingActionId] = useState<string>();
  const appliedActions = useRef(new Set<string>());

  useEffect(() => {
    setClientInstanceId(ensureClientInstanceId());
  }, []);

  const resetGuest = useCallback(() => {
    workspace.resetGuestJourney();
    const id = createGuestSessionId();
    window.sessionStorage.setItem(UI_CLIENT_STORAGE_KEY, id);
    setClientInstanceId(id);
    navigation.replaceTarget(HOME_UI_TARGET);
  }, [navigation.replaceTarget, workspace]);

  useEffect(() => {
    if (!clientInstanceId || workspace.connectionState !== 'ready') return;
    if (!workspaceTargetIsAvailable(navigation.target, workspace.workSets.map((workSet) => workSet.workSetId))) {
      navigation.replaceTarget(HOME_UI_TARGET);
      return;
    }
    void workspace.publishUiState(clientInstanceId, navigation.target, document.visibilityState === 'visible');
  }, [clientInstanceId, navigation.navigationRevision, navigation.replaceTarget, navigation.target,
    workspace.connectionState, workspace.publishUiState, workspace.workSets]);

  useEffect(() => {
    if (!clientInstanceId || workspace.connectionState !== 'ready'
      || !workspace.userUiStates.some((state) => state.clientInstanceId === clientInstanceId)) return;
    const publish = () => void workspace.publishUiPresence(clientInstanceId, document.visibilityState === 'visible');
    const timer = window.setInterval(publish, PRESENCE_INTERVAL_MS);
    document.addEventListener('visibilitychange', publish);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', publish); };
  }, [clientInstanceId, workspace.connectionState, workspace.publishUiPresence, workspace.userUiStates]);

  useEffect(() => {
    if (!clientInstanceId || resolvingActionId) return;
    const action = workspace.uiActions.find((candidate) =>
      candidate.clientInstanceId === clientInstanceId && candidate.status === 'auto_pending');
    if (!action) return;
    setResolvingActionId(action.actionId);
    void (async () => {
      // Flush the latest local target first; this makes Back and rapid navigation
      // visible before SpacetimeDB performs the authoritative revision check.
      await workspace.publishUiState(clientInstanceId, navigation.target, document.visibilityState === 'visible');
      await workspace.resolveAutoUiAction(action.actionId);
    })().finally(() => setResolvingActionId(undefined));
  }, [clientInstanceId, navigation.target, resolvingActionId, workspace.publishUiState, workspace.resolveAutoUiAction, workspace.uiActions]);

  useEffect(() => {
    if (!clientInstanceId) return;
    for (const action of workspace.uiActions) {
      if (action.clientInstanceId !== clientInstanceId || action.status !== 'applied' || appliedActions.current.has(action.actionId)) continue;
      appliedActions.current.add(action.actionId);
      if (!uiTargetsMatch(navigation.target, action.target)) navigation.openTarget(action.target);
    }
  }, [clientInstanceId, navigation, workspace.uiActions]);

  const openAction = useCallback(async (action: AdvisorUiAction) => {
    if (!clientInstanceId) return;
    await workspace.openUiAction(action.actionId, clientInstanceId);
    navigation.openTarget(action.target);
    if (action.sourceKind === 'work_item') requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById(`workspace-item-${action.sourceId}`)?.scrollIntoView({ block: 'center' });
    }));
  }, [clientInstanceId, navigation.replaceTarget, navigation.target, workspace.publishUiState, workspace.send, workspace.workSets]);

  const send = useCallback(async (content: string) => {
    if (!clientInstanceId) throw new Error('Browser tab is not ready');
    const target = workspaceTargetIsAvailable(navigation.target, workspace.workSets.map((workSet) => workSet.workSetId))
      ? navigation.target
      : HOME_UI_TARGET;
    if (target === HOME_UI_TARGET && navigation.target !== HOME_UI_TARGET) navigation.replaceTarget(HOME_UI_TARGET);
    await workspace.publishUiState(clientInstanceId, target, document.visibilityState === 'visible');
    await workspace.send(content, clientInstanceId);
  }, [clientInstanceId, navigation, workspace]);

  return (
    <div className="advisor-shell">
      <WorkspaceView
        directive={workspace.directive} workSets={workspace.workSets} workItems={workspace.workItems}
        workResults={workspace.workResults} profile={workspace.profile} target={navigation.target}
        catalogCourses={workspace.catalogCourses} catalogFamilies={workspace.catalogFamilies} selection={workspace.selection}
        documentRequirements={workspace.documentRequirements} documentSubmissions={workspace.documentSubmissions}
        setScrollElement={navigation.setScrollElement} onScroll={navigation.rememberScroll}
        onSelectOffering={(offeringId) => void workspace.selectOffering(offeringId)}
        onSelectFamily={(familyId) => void workspace.selectFamily(familyId)}
        onUploadDocument={workspace.uploadDocument}
      />
      <AdvisorRail
        connectionState={workspace.connectionState} error={workspace.error}
        agentThreadId={workspace.conversationId} messages={workspace.messages}
        turns={workspace.turns} turnUpdates={workspace.turnUpdates} uiActions={workspace.uiActions}
        directive={workspace.directive} profile={workspace.profile} onSend={send}
        selection={workspace.selection} selectionRevisions={workspace.selectionRevisions}
        catalogCourses={workspace.catalogCourses} catalogFamilies={workspace.catalogFamilies}
        onUpdateProfile={workspace.updateProfile} onOpenAction={openAction}
        onRemoveOffering={workspace.removeProvisionalOffering}
        onRemoveSelectedFamily={workspace.removeSelectedFamily}
        onRestoreRevision={workspace.restoreSelectionRevision}
        onConfirmSelection={workspace.confirmSelection} onEditConfirmedSelection={workspace.editConfirmedSelection}
        onResetGuest={resetGuest}
      />
    </div>
  );
}
