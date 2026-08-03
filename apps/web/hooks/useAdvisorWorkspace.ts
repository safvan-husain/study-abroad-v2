'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DbConnection } from '@study-abroad/spacetimedb-bindings';
import type { DiscoveryProfilePatch, TurnUpdatePayload, UiActivityReceiptState, UiTargetRef } from '@study-abroad/contracts';
import { turnUpdatePayload, uiTargetRef } from '@study-abroad/contracts';
import { getOrCreateGuestSessionId } from '../lib/guest-session';

const TOKEN_KEY = 'study-abroad-spacetimedb-token';

export type AdvisorMessage = { messageId: string; role: string; content: string; sequence: bigint };
export type AdvisorTurn = { turnId: string; status: string; errorCode: string | null; attempt: number };
export type AdvisorDirective = { viewType: string; awareness: string; uiRevision: bigint; workSetId: string | null };
export type AdvisorWorkSet = { workSetId: string; status: string };
export type AdvisorWorkItem = { workItemId: string; workSetId: string; entityId: string; kind: string; displayTitle: string; orderIndex: number; target: UiTargetRef; status: string; errorCode: string | null };
export type AdvisorWorkResult = { workItemId: string; resultJson: string; target: UiTargetRef };
export type AdvisorUiActivity = { activityId: string; workItemId: string; kind: string; label: string; target: UiTargetRef; createdAtMicros: bigint };
export type AdvisorUiActivityReceipt = { activityId: string; state: UiActivityReceiptState };
export type AdvisorTurnUpdate = { updateId: bigint; turnId: string; attempt: number; sequence: number; kind: string; payload: TurnUpdatePayload };
export type AdvisorProfile = DiscoveryProfilePatch;
export type AdvisorCatalogCourse = {
  courseId: string;
  institutionName: string;
  country: string;
  city: string;
  name: string;
  area: string;
};

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
  try {
    candidateAreas = JSON.parse(String(row.candidateAreasJson ?? '[]')) as string[];
  } catch {
    candidateAreas = [];
  }
  return {
    background: String(row.background ?? ''),
    courseInterests: String(row.courseInterests ?? ''),
    ambitions: String(row.ambitions ?? ''),
    primaryArea: String(row.primaryArea ?? ''),
    candidateAreas,
    studentPhrase: String(row.studentPhrase ?? ''),
    constraintsText: String(row.constraintsText ?? ''),
  };
}

function parseTarget(value: unknown): UiTargetRef | undefined {
  try {
    const parsed = uiTargetRef.safeParse(JSON.parse(String(value ?? '{}')));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function useAdvisorWorkspace() {
  const connectionRef = useRef<DbConnection | null>(null);
  const [reconnect, setReconnect] = useState(0);
  const [connectionState, setConnectionState] = useState<'connecting' | 'hydrating' | 'ready' | 'disconnected' | 'error'>('connecting');
  const [error, setError] = useState<string>();
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [turns, setTurns] = useState<AdvisorTurn[]>([]);
  const [directive, setDirective] = useState<AdvisorDirective>();
  const [workSets, setWorkSets] = useState<AdvisorWorkSet[]>([]);
  const [workItems, setWorkItems] = useState<AdvisorWorkItem[]>([]);
  const [workResults, setWorkResults] = useState<AdvisorWorkResult[]>([]);
  const [uiActivities, setUiActivities] = useState<AdvisorUiActivity[]>([]);
  const [uiActivityReceipts, setUiActivityReceipts] = useState<AdvisorUiActivityReceipt[]>([]);
  const [turnUpdates, setTurnUpdates] = useState<AdvisorTurnUpdate[]>([]);
  const [profile, setProfile] = useState<AdvisorProfile>();
  const [catalogCourses, setCatalogCourses] = useState<AdvisorCatalogCourse[]>([]);
  const [conversationId, setConversationId] = useState<string>();

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const id = getOrCreateGuestSessionId(window.localStorage);
    setConversationId(id);
    setConnectionState('connecting');
    setError(undefined);

    const refresh = (connection: DbConnection) => {
      const db = connection.db as any;
      setMessages([...db.my_messages.iter()].sort((a, b) => Number(a.sequence - b.sequence)));
      setTurns([...db.my_turns.iter()].map((turn: any) => ({
        turnId: turn.turnId,
        status: turn.status,
        errorCode: turn.errorCode ?? null,
        attempt: turn.attempt,
      })));
      setDirective([...db.my_active_directives.iter()].map((row: any) => ({
        viewType: row.viewType,
        awareness: row.awareness,
        uiRevision: row.uiRevision,
        workSetId: row.workSetId ?? null,
      }))[0]);
      setWorkSets([...db.my_workspace_work_sets.iter()]);
      const workControls = [...db.my_workspace_work_controls.iter()];
      const controlByItem = new Map(workControls.map((control: any) => [control.workItemId, control]));
      setWorkItems([...db.my_workspace_work_items.iter()].flatMap((item: any): AdvisorWorkItem[] => {
        const control = controlByItem.get(item.workItemId) as any;
        const target = parseTarget(control?.targetJson);
        return target ? [{
          workItemId: item.workItemId,
          workSetId: item.workSetId,
          entityId: item.entityId,
          kind: item.kind,
          displayTitle: control.displayTitle,
          orderIndex: control.orderIndex,
          target,
          status: item.status,
          errorCode: item.errorCode ?? null,
        }] : [];
      }).sort((a: AdvisorWorkItem, b: AdvisorWorkItem) => a.orderIndex - b.orderIndex));
      setWorkResults([...db.my_workspace_results.iter()].flatMap((result: any): AdvisorWorkResult[] => {
        const control = controlByItem.get(result.workItemId) as any;
        const target = parseTarget(control?.targetJson);
        return target ? [{ workItemId: result.workItemId, resultJson: result.resultJson, target }] : [];
      }));
      setUiActivities([...db.my_ui_activities.iter()].flatMap((activity: any): AdvisorUiActivity[] => {
        const target = parseTarget(activity.targetJson);
        return target ? [{
          activityId: activity.activityId,
          workItemId: activity.workItemId,
          kind: activity.kind,
          label: activity.label,
          target,
          createdAtMicros: activity.createdAtMicros,
        }] : [];
      }).sort((a: AdvisorUiActivity, b: AdvisorUiActivity) => Number(a.createdAtMicros - b.createdAtMicros)));
      setUiActivityReceipts([...db.my_ui_activity_receipts.iter()].map((receipt: any) => ({
        activityId: receipt.activityId,
        state: receipt.state,
      })));
      setTurnUpdates([...db.my_turn_updates.iter()].map((row: any) => {
        let payload: TurnUpdatePayload = { kind: 'turn_started' };
        try {
          const parsed = turnUpdatePayload.safeParse(JSON.parse(String(row.payloadJson ?? '{}')));
          if (parsed.success) payload = parsed.data;
        } catch {
          // Malformed payloadJson falls back to turn_started.
        }
        return {
          updateId: row.updateId,
          turnId: row.turnId,
          attempt: row.attempt,
          sequence: row.sequence,
          kind: row.kind,
          payload,
        };
      }));
      setProfile(parseProfile([...db.my_conversation_profiles.iter()][0]));
      setCatalogCourses([...db.catalog_course.iter()].filter((row: any) => row.active !== false).map((row: any) => ({
        courseId: row.courseId,
        institutionName: row.institutionName,
        country: row.country,
        city: row.city,
        name: row.name,
        area: row.area,
      })));
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
            'my_messages', 'my_turns', 'my_active_directives', 'my_workspace_work_sets',
            'my_workspace_work_items', 'my_workspace_work_controls', 'my_workspace_results', 'my_user_actions', 'my_conversations',
            'my_turn_updates', 'my_conversation_profiles', 'my_ui_activities',
            'my_ui_activity_receipts', 'my_ui_client_contexts', 'catalog_course',
          ];
          const db = connection.db as any;
          for (const tableName of tables) {
            const table = db[tableName];
            const onChange = () => refresh(connection);
            table.onInsert(onChange);
            table.onUpdate?.(onChange);
            table.onDelete(onChange);
          }
          connection.subscriptionBuilder()
            .onApplied(() => {
              refresh(connection);
              setConnectionState('ready');
            })
            .onError((context) => {
              setError(`Subscription failed: ${String(context.event)}`);
              setConnectionState('error');
            })
            .subscribe(tables.map((table) => `SELECT * FROM ${table}`));
        }).catch((journeyError: unknown) => {
          setError(journeyError instanceof Error ? journeyError.message : String(journeyError));
          setConnectionState('error');
        });
      })
      .onConnectError((_context, connectError) => {
        if (disposed) return;
        setError(String(connectError));
        setConnectionState('error');
        reconnectTimer = setTimeout(() => setReconnect((value) => value + 1), 1500);
      })
      .onDisconnect(() => {
        if (disposed) return;
        connectionRef.current = null;
        setConnectionState('disconnected');
        reconnectTimer = setTimeout(() => setReconnect((value) => value + 1), 1500);
      });
    builder.build();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      connectionRef.current?.disconnect();
      connectionRef.current = null;
    };
  }, [reconnect]);

  const send = useCallback(async (content: string) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    await connection.reducers.sendMessage({ conversationId, clientCommandId: commandId(), content: content.trim() });
  }, [connectionState, conversationId]);

  const updateProfile = useCallback(async (next: AdvisorProfile) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) throw new Error('Advisor is not connected');
    await connection.reducers.updateDiscoveryProfile({
      conversationId,
      clientCommandId: commandId(),
      background: next.background,
      courseInterests: next.courseInterests,
      ambitions: next.ambitions,
      primaryArea: next.primaryArea,
      candidateAreasJson: JSON.stringify(next.candidateAreas),
      studentPhrase: next.studentPhrase,
      constraintsText: next.constraintsText,
    });
  }, [connectionState, conversationId]);

  const publishUiContext = useCallback(async (clientInstanceId: string, target: UiTargetRef, navigationRevision: number, visible: boolean) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) return;
    await connection.reducers.publishUiContext({
      conversationId,
      clientInstanceId,
      targetJson: JSON.stringify(target),
      navigationRevision: BigInt(navigationRevision),
      visible,
    });
  }, [connectionState, conversationId]);

  const acknowledgeUiActivity = useCallback(async (activityId: string, state: UiActivityReceiptState) => {
    const connection = connectionRef.current;
    if (!connection || connectionState !== 'ready' || !conversationId) return;
    await connection.reducers.acknowledgeUiActivity({ conversationId, activityId, state });
  }, [connectionState, conversationId]);

  return {
    connectionState,
    error,
    conversationId,
    messages,
    turns,
    directive,
    workSets,
    workItems,
    workResults,
    uiActivities,
    uiActivityReceipts,
    turnUpdates,
    profile,
    catalogCourses,
    send,
    updateProfile,
    publishUiContext,
    acknowledgeUiActivity,
  };
}
