'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DbConnection } from '@study-abroad/spacetimedb-bindings';
import type { DiscoveryProfilePatch, TurnUpdatePayload, UiActionActivation, UiActionStatus, UiTargetRef } from '@study-abroad/contracts';
import { turnUpdatePayload, uiTargetRef } from '@study-abroad/contracts';
import { getOrCreateGuestSessionId } from '../lib/guest-session';

const TOKEN_KEY = 'study-abroad-spacetimedb-token';

export type AdvisorMessage = { messageId: string; turnId: string; role: string; content: string; sequence: bigint; createdAtMicros: bigint };
export type AdvisorTurn = { turnId: string; status: string; errorCode: string | null; attempt: number };
export type AdvisorDirective = { viewType: string; awareness: string; uiRevision: bigint; workSetId: string | null };
export type AdvisorWorkSet = { workSetId: string; status: string; kind?: string };
export type AdvisorWorkItem = { workItemId: string; workSetId: string; entityId: string; kind: string; displayTitle: string; orderIndex: number; target: UiTargetRef; status: string; errorCode: string | null };
export type AdvisorWorkResult = { workItemId: string; resultJson: string; target: UiTargetRef };
export type AdvisorUiAction = { actionId: string; clientInstanceId: string; sourceKind: string; sourceId: string; kind: string; label: string; buttonLabel: string; target: UiTargetRef; baseTarget: UiTargetRef; baseNavigationRevision: bigint; activation: UiActionActivation; status: UiActionStatus; createdAtMicros: bigint; updatedAtMicros: bigint };
export type AdvisorUserUiState = { clientInstanceId: string; target: UiTargetRef; navigationRevision: bigint; visible: boolean; lastSeenAtMicros: bigint };
export type AdvisorTurnUpdate = { updateId: bigint; turnId: string; attempt: number; sequence: number; kind: string; payload: TurnUpdatePayload };
export type AdvisorProfile = DiscoveryProfilePatch;
export type AdvisorCatalogCourse = {
  courseId: string; institutionId: string; institutionName: string; country: string; city: string;
  name: string; area: string; level: string; familyId: string; qualification: string; officialUrl: string;
  ownership: string; englishBar: string; requirementsJson: string; rankingsJson: string; sourcesJson: string;
};
export type AdvisorCatalogFamily = {
  familyId: string; areaId: string; name: string; aliasesJson: string; description: string;
  typicalSubjectsJson: string; careerDirectionsJson: string; relatedFamilyIdsJson: string;
};
export type AdvisorSelection = {
  revision: bigint; presentedFamilyIds: string[]; selectedFamilyIds: string[]; presentedOfferingIds: string[]; provisionalOfferingIds: string[];
  suppressedOfferingIds: string[]; confirmedOfferingIds: string[]; confirmedSnapshotId: string | null; comparisonCriterion: string;
};
export type AdvisorSelectionRevision = { revision: bigint; source: string; rationale: string; provisionalOfferingIds: string[]; createdAtMicros: bigint };
export type AdvisorDocumentRequirement = { requirementKey: string; snapshotId: string; documentType: string; label: string; reason: string; status: string };
export type AdvisorDocumentSubmission = { submissionId: string; snapshotId: string; documentType: string; originalName: string; mimeType: string; byteSize: bigint; uploadedAtMicros: bigint; expiresAtMicros: bigint };

function spacetimeUri() {
  if (process.env.NEXT_PUBLIC_SPACETIME_URL) return process.env.NEXT_PUBLIC_SPACETIME_URL.replace(/^http/, 'ws');
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:3002`;
}

function commandId() {
  return globalThis.crypto?.randomUUID?.() ?? `command-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function parseProfile(row: Record<string, unknown> | undefined): AdvisorProfile | undefined {
  if (!row) return undefined;
  let candidateAreas: string[] = [];
  try { candidateAreas = JSON.parse(String(row.candidateAreasJson ?? '[]')) as string[]; } catch { candidateAreas = []; }
  return {
    background: String(row.background ?? ''), courseInterests: String(row.courseInterests ?? ''),
    ambitions: String(row.ambitions ?? ''), primaryArea: String(row.primaryArea ?? ''), candidateAreas,
    studentPhrase: String(row.studentPhrase ?? ''), constraintsText: String(row.constraintsText ?? ''),
  };
}

function parseTarget(value: unknown): UiTargetRef | undefined {
  try {
    const parsed = uiTargetRef.safeParse(JSON.parse(String(value ?? '{}')));
    return parsed.success ? parsed.data : undefined;
  } catch { return undefined; }
}

export function useAdvisorWorkspace() {
  const connectionRef = useRef<DbConnection | null>(null);
  const catalogConnectionRef = useRef<DbConnection | null>(null);
  const [reconnect, setReconnect] = useState(0);
  const [connectionState, setConnectionState] = useState<'connecting' | 'hydrating' | 'ready' | 'disconnected' | 'error'>('connecting');
  const [error, setError] = useState<string>();
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [turns, setTurns] = useState<AdvisorTurn[]>([]);
  const [directive, setDirective] = useState<AdvisorDirective>();
  const [workSets, setWorkSets] = useState<AdvisorWorkSet[]>([]);
  const [workItems, setWorkItems] = useState<AdvisorWorkItem[]>([]);
  const [workResults, setWorkResults] = useState<AdvisorWorkResult[]>([]);
  const [uiActions, setUiActions] = useState<AdvisorUiAction[]>([]);
  const [userUiStates, setUserUiStates] = useState<AdvisorUserUiState[]>([]);
  const [turnUpdates, setTurnUpdates] = useState<AdvisorTurnUpdate[]>([]);
  const [profile, setProfile] = useState<AdvisorProfile>();
  const [catalogCourses, setCatalogCourses] = useState<AdvisorCatalogCourse[]>([]);
  const [catalogFamilies, setCatalogFamilies] = useState<AdvisorCatalogFamily[]>([]);
  const [selection, setSelection] = useState<AdvisorSelection>();
  const [selectionRevisions, setSelectionRevisions] = useState<AdvisorSelectionRevision[]>([]);
  const [documentRequirements, setDocumentRequirements] = useState<AdvisorDocumentRequirement[]>([]);
  const [documentSubmissions, setDocumentSubmissions] = useState<AdvisorDocumentSubmission[]>([]);
  const [conversationId, setConversationId] = useState<string>();

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let cacheRefreshTimer: ReturnType<typeof setInterval> | undefined;
    const id = getOrCreateGuestSessionId(window.localStorage);
    setConversationId(id);
    setConnectionState('connecting');
    setError(undefined);

    const refresh = (connection: DbConnection) => {
      const db = connection.db as any;
      setMessages([...db.my_messages.iter()].sort((a: any, b: any) => Number(a.sequence - b.sequence)));
      setTurns([...db.my_turns.iter()].map((turn: any) => ({ turnId: turn.turnId, status: turn.status, errorCode: turn.errorCode ?? null, attempt: turn.attempt })));
      setDirective([...db.my_active_directives.iter()].map((row: any) => ({ viewType: row.viewType, awareness: row.awareness, uiRevision: row.uiRevision, workSetId: row.workSetId ?? null }))[0]);
      setWorkSets([...db.my_workspace_work_sets.iter()]);
      const workControls = [...db.my_workspace_work_controls.iter()];
      const controlByItem = new Map(workControls.map((control: any) => [control.workItemId, control]));
      setWorkItems([...db.my_workspace_work_items.iter()].flatMap((item: any): AdvisorWorkItem[] => {
        const control = controlByItem.get(item.workItemId) as any;
        const target = parseTarget(control?.targetJson);
        return target ? [{ workItemId: item.workItemId, workSetId: item.workSetId, entityId: item.entityId, kind: item.kind, displayTitle: control.displayTitle, orderIndex: control.orderIndex, target, status: item.status, errorCode: item.errorCode ?? null }] : [];
      }).sort((a: AdvisorWorkItem, b: AdvisorWorkItem) => a.orderIndex - b.orderIndex));
      setWorkResults([...db.my_workspace_results.iter()].flatMap((result: any): AdvisorWorkResult[] => {
        const target = parseTarget((controlByItem.get(result.workItemId) as any)?.targetJson);
        return target ? [{ workItemId: result.workItemId, resultJson: result.resultJson, target }] : [];
      }));
      setUiActions([...db.my_ui_actions.iter()].flatMap((row: any): AdvisorUiAction[] => {
        const target = parseTarget(row.targetJson);
        const baseTarget = parseTarget(row.baseTargetJson);
        return target && baseTarget ? [{
          actionId: row.actionId, clientInstanceId: row.clientInstanceId, sourceKind: row.sourceKind, sourceId: row.sourceId,
          kind: row.kind, label: row.label, buttonLabel: row.buttonLabel, target, baseTarget,
          baseNavigationRevision: row.baseNavigationRevision, activation: row.activation, status: row.status,
          createdAtMicros: row.createdAtMicros, updatedAtMicros: row.updatedAtMicros,
        }] : [];
      }).sort((a: AdvisorUiAction, b: AdvisorUiAction) => Number(a.createdAtMicros - b.createdAtMicros)));
      setUserUiStates([...db.my_user_ui_states.iter()].flatMap((row: any): AdvisorUserUiState[] => {
        const target = parseTarget(row.targetJson);
        return target ? [{ clientInstanceId: row.clientInstanceId, target, navigationRevision: row.navigationRevision, visible: row.visible, lastSeenAtMicros: row.lastSeenAtMicros }] : [];
      }));
      setTurnUpdates([...db.my_turn_updates.iter()].map((row: any) => {
        let payload: TurnUpdatePayload = { kind: 'turn_started' };
        try { const parsed = turnUpdatePayload.safeParse(JSON.parse(String(row.payloadJson ?? '{}'))); if (parsed.success) payload = parsed.data; } catch { /* diagnostic row is retained but hidden */ }
        return { updateId: row.updateId, turnId: row.turnId, attempt: row.attempt, sequence: row.sequence, kind: row.kind, payload };
      }));
      setProfile(parseProfile([...db.my_conversation_profiles.iter()][0]));
      const catalogDb = catalogConnectionRef.current?.db as any;
      if (catalogDb) {
        setCatalogCourses([...catalogDb.catalog_course.iter()].filter((row: any) => row.active !== false).map((row: any) => ({
          courseId: row.courseId, institutionId: row.institutionId, institutionName: row.institutionName, country: row.country,
          city: row.city, name: row.name, area: row.area, level: row.level, familyId: row.familyId,
          qualification: row.qualification, officialUrl: row.officialUrl, ownership: row.ownership, englishBar: row.englishBar,
          requirementsJson: row.requirementsJson, rankingsJson: row.rankingsJson, sourcesJson: row.sourcesJson,
        })));
        setCatalogFamilies([...catalogDb.catalog_family.iter()].filter((row: any) => row.active !== false));
      }
      const selectionRow = [...db.my_conversation_selections.iter()][0];
      const parseIds = (value: unknown) => { try { return JSON.parse(String(value ?? '[]')) as string[]; } catch { return []; } };
      setSelection(selectionRow ? {
        revision: selectionRow.revision, presentedFamilyIds: parseIds(selectionRow.presentedFamilyIdsJson),
        selectedFamilyIds: parseIds(selectionRow.selectedFamilyIdsJson),
        presentedOfferingIds: parseIds(selectionRow.presentedOfferingIdsJson), provisionalOfferingIds: parseIds(selectionRow.provisionalOfferingIdsJson),
        suppressedOfferingIds: parseIds(selectionRow.suppressedOfferingIdsJson), confirmedOfferingIds: parseIds(selectionRow.confirmedOfferingIdsJson),
        confirmedSnapshotId: selectionRow.confirmedSnapshotId ?? null, comparisonCriterion: selectionRow.comparisonCriterion ?? '',
      } : undefined);
      setSelectionRevisions([...db.my_selection_revisions.iter()].map((row: any) => ({
        revision: row.revision, source: row.source, rationale: row.rationale,
        provisionalOfferingIds: parseIds(row.provisionalOfferingIdsJson), createdAtMicros: row.createdAtMicros,
      })).sort((a: AdvisorSelectionRevision, b: AdvisorSelectionRevision) => Number(b.revision - a.revision)));
      setDocumentRequirements([...db.my_document_requirements.iter()]);
      setDocumentSubmissions([...db.my_document_submissions.iter()]);
    };

    const builder = DbConnection.builder()
      .withUri(spacetimeUri())
      .withDatabaseName(process.env.NEXT_PUBLIC_SPACETIME_DATABASE ?? 'study-abroad-coordinator')
      .withToken(window.localStorage.getItem(TOKEN_KEY) ?? undefined)
      .onConnect((connection, _identity, token) => {
        if (disposed) return connection.disconnect();
        connectionRef.current = connection;
        if (token) window.localStorage.setItem(TOKEN_KEY, token);
        setConnectionState('hydrating');
        void connection.reducers.ensureGuestJourney({ conversationId: id }).then(() => {
          const tables = [
            'my_messages', 'my_turns', 'my_active_directives', 'my_workspace_work_sets', 'my_workspace_work_items',
            'my_workspace_work_controls', 'my_workspace_results', 'my_user_actions', 'my_conversations', 'my_turn_updates',
            'my_conversation_profiles', 'my_conversation_selections', 'my_selection_revisions',
            'my_confirmed_selection_snapshots', 'my_document_requirements', 'my_document_submissions', 'my_upload_tickets',
            'my_ui_actions', 'my_user_ui_states',
          ];
          const db = connection.db as any;
          for (const tableName of tables) {
            const table = db[tableName];
            const onChange = () => refresh(connection);
            table.onInsert(onChange); table.onUpdate?.(onChange); table.onDelete(onChange);
          }
          connection.subscriptionBuilder()
            .onApplied(() => {
              const catalogTables = ['catalog_course', 'catalog_family', 'catalog_institution', 'catalog_policy'];
              DbConnection.builder()
                .withUri(spacetimeUri())
                .withDatabaseName(process.env.NEXT_PUBLIC_SPACETIME_DATABASE ?? 'study-abroad-coordinator')
                .withToken(token ?? undefined)
                .onConnect((catalogConnection) => {
                  if (disposed) return catalogConnection.disconnect();
                  catalogConnectionRef.current = catalogConnection;
                  const catalogDb = catalogConnection.db as any;
                  for (const tableName of catalogTables) {
                    const table = catalogDb[tableName];
                    const onChange = () => refresh(connection);
                    table.onInsert(onChange); table.onUpdate?.(onChange); table.onDelete(onChange);
                  }
                  catalogConnection.subscriptionBuilder()
                    .onApplied(() => {
                      refresh(connection);
                      // SpacetimeDB 2.0.3 can apply remote view rows to its cache without
                      // consistently firing the generated table callback. Reconcile the
                      // already-local cache as a fallback; no HTTP polling is involved.
                      cacheRefreshTimer ??= setInterval(() => refresh(connection), 500);
                      setConnectionState('ready');
                    })
                    .onError((context) => { setError(`Catalog subscription failed: ${String(context.event)}`); setConnectionState('error'); })
                    .subscribe(catalogTables.map((table) => `SELECT * FROM ${table}`));
                })
                .onConnectError((_context, catalogError) => { setError(String(catalogError)); setConnectionState('error'); })
                .build();
            })
            .onError((context) => { setError(`Subscription failed: ${String(context.event)}`); setConnectionState('error'); })
            .subscribe(tables.map((table) => `SELECT * FROM ${table}`));
        }).catch((journeyError: unknown) => { setError(journeyError instanceof Error ? journeyError.message : String(journeyError)); setConnectionState('error'); });
      })
      .onConnectError((_context, connectError) => {
        if (disposed) return;
        setError(String(connectError)); setConnectionState('error');
        reconnectTimer = setTimeout(() => setReconnect((value) => value + 1), 1500);
      })
      .onDisconnect(() => {
        if (disposed) return;
        connectionRef.current = null; setConnectionState('disconnected');
        reconnectTimer = setTimeout(() => setReconnect((value) => value + 1), 1500);
      });
    builder.build();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (cacheRefreshTimer) clearInterval(cacheRefreshTimer);
      catalogConnectionRef.current?.disconnect();
      catalogConnectionRef.current = null;
      connectionRef.current?.disconnect();
      connectionRef.current = null;
    };
  }, [reconnect]);

  const send = useCallback(async (content: string, clientInstanceId: string) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    await connection.reducers.sendMessage({ conversationId, clientCommandId: commandId(), clientInstanceId, content: content.trim() });
  }, [connectionState, conversationId]);

  const updateProfile = useCallback(async (next: AdvisorProfile) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    await connection.reducers.updateDiscoveryProfile({
      conversationId, clientCommandId: commandId(), background: next.background, courseInterests: next.courseInterests,
      ambitions: next.ambitions, primaryArea: next.primaryArea, candidateAreasJson: JSON.stringify(next.candidateAreas),
      studentPhrase: next.studentPhrase, constraintsText: next.constraintsText,
    });
  }, [connectionState, conversationId]);

  const publishUiState = useCallback(async (clientInstanceId: string, target: UiTargetRef, visible: boolean) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) return;
    await connection.reducers.publishUiState({ conversationId, clientInstanceId, targetJson: JSON.stringify(target), visible });
  }, [connectionState, conversationId]);

  const publishUiPresence = useCallback(async (clientInstanceId: string, visible: boolean) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) return;
    await connection.reducers.publishUiPresence({ conversationId, clientInstanceId, visible });
  }, [connectionState, conversationId]);

  const resolveAutoUiAction = useCallback(async (actionId: string) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) return;
    await connection.reducers.resolveAutoUiAction({ conversationId, actionId });
  }, [connectionState, conversationId]);

  const openUiAction = useCallback(async (actionId: string, clientInstanceId: string) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) return;
    await connection.reducers.openUiAction({ conversationId, actionId, clientInstanceId });
  }, [connectionState, conversationId]);

  const removeProvisionalOffering = useCallback(async (offeringId: string) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    await connection.reducers.removeProvisionalOffering({ conversationId, clientCommandId: commandId(), offeringId });
  }, [connectionState, conversationId]);

  const selectOffering = useCallback(async (offeringId: string) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    await connection.reducers.selectOffering({ conversationId, clientCommandId: commandId(), offeringId });
  }, [connectionState, conversationId]);

  const selectFamily = useCallback(async (familyId: string) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    await connection.reducers.selectFamily({ conversationId, clientCommandId: commandId(), familyId });
  }, [connectionState, conversationId]);

  const removeSelectedFamily = useCallback(async (familyId: string) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    await connection.reducers.removeSelectedFamily({ conversationId, clientCommandId: commandId(), familyId });
  }, [connectionState, conversationId]);

  const restoreSelectionRevision = useCallback(async (revision: bigint) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    await connection.reducers.restoreSelectionRevision({ conversationId, clientCommandId: commandId(), revision });
  }, [connectionState, conversationId]);

  const confirmSelection = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    await connection.reducers.confirmSelection({ conversationId, clientCommandId: commandId() });
  }, [connectionState, conversationId]);

  const editConfirmedSelection = useCallback(async () => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    await connection.reducers.editConfirmedSelection({ conversationId, clientCommandId: commandId() });
  }, [connectionState, conversationId]);

  const uploadDocument = useCallback(async (documentType: string, file: File) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    const ticketId = commandId();
    await connection.reducers.createUploadTicket({ conversationId, ticketId, documentType });
    const body = new FormData();
    body.set('ticketId', ticketId);
    body.set('file', file);
    const api = process.env.NEXT_PUBLIC_API_URL
      ?? `${window.location.protocol}//${window.location.hostname}:3001`;
    const response = await fetch(`${api}/documents/upload`, { method: 'POST', body });
    if (!response.ok) throw new Error((await response.text()) || 'Document upload failed');
  }, [connectionState, conversationId]);

  return {
    connectionState, error, conversationId, messages, turns, directive, workSets, workItems, workResults,
    uiActions, userUiStates, turnUpdates, profile, catalogCourses, catalogFamilies, selection, selectionRevisions,
    documentRequirements, documentSubmissions, send, updateProfile, publishUiState,
    publishUiPresence, resolveAutoUiAction, openUiAction, removeProvisionalOffering, selectOffering,
    selectFamily, removeSelectedFamily,
    restoreSelectionRevision, confirmSelection, editConfirmedSelection, uploadDocument,
  };
}
