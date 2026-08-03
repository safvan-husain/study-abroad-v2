import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { DbConnection } from '@study-abroad/spacetimedb-bindings';

dotenv.config({ path: resolve(import.meta.dirname, '../.env') });

if (!Promise.withResolvers) {
  Promise.withResolvers = function withResolvers<T>() {
    let resolvePromise!: (value: T | PromiseLike<T>) => void;
    let rejectPromise!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromiseInner, rejectPromiseInner) => {
      resolvePromise = resolvePromiseInner; rejectPromise = rejectPromiseInner;
    });
    return { promise, resolve: resolvePromise, reject: rejectPromise };
  };
}

const server = process.env.SPACETIME_URL;
const database = process.env.SPACETIME_DATABASE;
if (!server) { console.log('Coordinator smoke skipped: set SPACETIME_URL.'); process.exit(0); }
if (!database) throw new Error('Set SPACETIME_DATABASE.');
const uri = server.replace(/^http/, 'ws');
const agentUsername = process.env.AGENT_USERNAME ?? 'study_abroad_agent';
const agentPassword = process.env.AGENT_PASSWORD ?? 'study-agent-dev';
const conversationId = randomUUID();
const turnId = `turn-${randomUUID()}`;
const clientInstanceId = `tab-${randomUUID()}`;

const sleep = (milliseconds: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
async function waitFor<T>(read: () => T | undefined, description: string): Promise<T> {
  for (let attempt = 0; attempt < 60; attempt += 1) { const value = read(); if (value !== undefined) return value; await sleep(250); }
  throw new Error(`Timed out waiting for ${description}`);
}

async function connect(queries: string[], worker = false) {
  return new Promise<InstanceType<typeof DbConnection>>((resolveConnection, reject) => {
    let settled = false;
    DbConnection.builder().withUri(uri).withDatabaseName(database)
      .onConnect((connection) => {
        const subscribe = () => connection.subscriptionBuilder().onApplied(() => {
          if (!settled) { settled = true; resolveConnection(connection); }
        }).subscribe(queries);
        if (!worker) return subscribe();
        void connection.reducers.login({ username: agentUsername, password: agentPassword })
          .then(() => connection.reducers.registerWorker({ workerLabel: 'spacetime-smoke' }))
          .then(subscribe).catch(reject);
      })
      .onConnectError((_context, error) => { if (!settled) reject(error); })
      .build();
  });
}

const studentQueries = [
  'SELECT * FROM my_conversations', 'SELECT * FROM my_messages', 'SELECT * FROM my_turns',
  'SELECT * FROM my_active_directives', 'SELECT * FROM my_workspace_work_sets',
  'SELECT * FROM my_workspace_work_items', 'SELECT * FROM my_workspace_work_controls',
  'SELECT * FROM my_workspace_results', 'SELECT * FROM my_ui_actions',
  'SELECT * FROM my_user_ui_states', 'SELECT * FROM catalog_course',
];
const workerQueries = ['SELECT * FROM worker_pending_turns', 'SELECT * FROM worker_pending_work_items', 'SELECT * FROM catalog_course'];
const studentOne = await connect(studentQueries);
const studentTwo = await connect(studentQueries);
const worker = await connect(workerQueries, true);

try {
  const first = studentOne.db as any;
  const second = studentTwo.db as any;
  const workerDb = worker.db as any;
  await studentOne.reducers.ensureGuestJourney({ conversationId });
  await waitFor(() => [...first.my_conversations.iter()].find((row: any) => row.conversationId === conversationId), 'conversation');
  await studentOne.reducers.publishUiState({ conversationId, clientInstanceId, targetJson: '{"schemaVersion":1,"viewType":"home"}', visible: true });

  let unauthorized = false;
  try {
    await studentTwo.reducers.sendMessage({ conversationId, clientCommandId: `blocked-${randomUUID()}`, clientInstanceId, content: 'Denied' });
  } catch { unauthorized = true; }
  if (!unauthorized) throw new Error('A non-member sent a turn');

  await studentOne.reducers.sendMessage({ conversationId, clientCommandId: turnId, clientInstanceId, content: 'Compare computing courses.' });
  await studentOne.reducers.sendMessage({ conversationId, clientCommandId: turnId, clientInstanceId, content: 'Compare computing courses.' });
  const pending = await waitFor(() => [...workerDb.worker_pending_turns.iter()].find((row: any) => row.turnId === turnId), 'origin-pinned turn');
  if (pending.uiClientInstanceId !== clientInstanceId || pending.uiNavigationRevision !== 0n) throw new Error('Turn did not retain its browser origin');
  if ([...first.my_messages.iter()].filter((row: any) => row.messageId === turnId).length !== 1) throw new Error('Duplicate command was not idempotent');

  const courses = [...workerDb.catalog_course.iter()].filter((row: any) => row.active).slice(0, 2);
  if (courses.length !== 2) throw new Error('Expected a reseeded catalogue with at least two courses');
  const profile = { background: '', courseInterests: 'computing', ambitions: '', primaryArea: 'computing', candidateAreas: ['computing'], studentPhrase: 'computing', constraintsText: '' };
  await worker.reducers.upsertConversationProfile({
    conversationId, background: profile.background, courseInterests: profile.courseInterests, ambitions: profile.ambitions,
    primaryArea: profile.primaryArea, candidateAreasJson: JSON.stringify(profile.candidateAreas), studentPhrase: profile.studentPhrase,
    constraintsText: profile.constraintsText,
  });
  const workSetId = `${turnId}-work`;
  const workItems = courses.map((course: any, orderIndex: number) => ({
    entityType: 'course', entityId: course.courseId, kind: 'course_fit_summary', displayTitle: `Comparing ${course.name}`,
    orderIndex, targetJson: JSON.stringify({ schemaVersion: 1, viewType: 'course_summary', workSetId, entityType: 'course', entityId: course.courseId, slot: 'summary' }),
    dependencyJson: JSON.stringify({ profile, course: {
      courseId: course.courseId, institutionId: course.institutionId, institutionName: course.institutionName,
      country: course.country, city: course.city, name: course.name, area: course.area, level: course.level,
      tuitionBand: course.tuitionBand, englishBar: course.englishBar,
    } }),
    inputJson: JSON.stringify({ courseId: course.courseId, name: course.name, institutionName: course.institutionName, country: course.country, area: course.area, studentPhrase: 'computing', profile }),
  }));
  await worker.reducers.claim({ turnId, expectedAttempt: 0, leaseSeconds: 30n });
  await worker.reducers.completeTurn({
    turnId, attempt: 1, assistantContent: 'I found two computing courses.', runId: `run-${turnId}`, agentThreadId: conversationId,
    directiveSchemaVersion: 1, directiveUiRevision: 1n, directiveType: 'catalog', directiveAwareness: 'Showing computing courses.',
    workKind: 'course_fit_summaries', workItems,
  });

  const catalogAction = await waitFor(() => [...first.my_ui_actions.iter()].find((row: any) => row.sourceId === turnId), 'catalog action');
  if (catalogAction.status !== 'auto_pending') throw new Error(`Expected auto-pending catalogue action, got ${catalogAction.status}`);
  await studentOne.reducers.resolveAutoUiAction({ conversationId, actionId: catalogAction.actionId });
  const appliedCatalog = await waitFor(() => [...first.my_ui_actions.iter()].find((row: any) => row.actionId === catalogAction.actionId && row.status === 'applied'), 'automatic navigation');
  const catalogState = [...first.my_user_ui_states.iter()].find((row: any) => row.clientInstanceId === clientInstanceId);
  if (!appliedCatalog || catalogState?.navigationRevision !== 1n || !catalogState.targetJson.includes('catalog')) throw new Error('Automatic navigation did not atomically advance state');

  const pendingItems = await waitFor(() => {
    const rows = [...workerDb.worker_pending_work_items.iter()].filter((row: any) => row.workSetId === workSetId);
    return rows.length === 2 ? rows : undefined;
  }, 'independent course work items');
  for (const item of [...pendingItems].reverse()) {
    await worker.reducers.claimWorkItem({ workItemId: item.workItemId, expectedAttempt: 0, leaseSeconds: 30n });
    await worker.reducers.completeWorkItem({ workItemId: item.workItemId, attempt: 1, resultJson: JSON.stringify({ entityType: 'course', entityId: item.entityId, title: item.displayTitle.replace('Comparing ', ''), detail: 'Indicative fit.' }), runId: undefined });
  }
  const summaryActions = await waitFor(() => {
    const rows = [...first.my_ui_actions.iter()].filter((row: any) => row.sourceKind === 'work_item');
    return rows.length === 2 ? rows : undefined;
  }, 'per-course permanent actions');
  if (summaryActions.some((action: any) => action.status !== 'offered')) throw new Error('Later summaries stole focus after the first accepted navigation');
  const chosen = summaryActions[0];
  await studentOne.reducers.openUiAction({ conversationId, actionId: chosen.actionId, clientInstanceId });
  await waitFor(() => [...first.my_ui_actions.iter()].find((row: any) => row.actionId === chosen.actionId && row.status === 'opened'), 'Open again action state');
  await studentOne.reducers.publishUiState({ conversationId, clientInstanceId, targetJson: '{"schemaVersion":1,"viewType":"home"}', visible: true });
  if ([...first.my_ui_actions.iter()].filter((row: any) => row.conversationId === conversationId).length !== 3) throw new Error('Navigation removed chronological action cards');

  const otherTab = `tab-${randomUUID()}`;
  await studentOne.reducers.publishUiState({ conversationId, clientInstanceId: otherTab, targetJson: '{"schemaVersion":1,"viewType":"home"}', visible: true });
  const otherState = [...first.my_user_ui_states.iter()].find((row: any) => row.clientInstanceId === otherTab);
  if (otherState?.navigationRevision !== 0n || otherState.targetJson !== '{"schemaVersion":1,"viewType":"home"}') throw new Error('Originating action affected another tab');

  let malformedRejected = false;
  try { await studentOne.reducers.publishUiState({ conversationId, clientInstanceId, targetJson: '{"schemaVersion":1,"viewType":"unknown"}', visible: true }); } catch { malformedRejected = true; }
  if (!malformedRejected) throw new Error('Malformed target was accepted');
  let duplicateRejected = false;
  try { await worker.reducers.completeWorkItem({ workItemId: pendingItems[0].workItemId, attempt: 1, resultJson: '{}', runId: undefined }); } catch { duplicateRejected = true; }
  if (!duplicateRejected) throw new Error('Duplicate completion was accepted');
  if ([...second.my_ui_actions.iter()].some((row: any) => row.conversationId === conversationId)) throw new Error('Another user observed UI actions');

  console.log(`Coordinator UI-state smoke passed: ${conversationId}/${turnId}`);
} finally {
  studentOne.disconnect(); studentTwo.disconnect(); worker.disconnect();
}
