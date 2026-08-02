import { DbConnection } from '@study-abroad/spacetimedb-bindings';
import type { ChatTurn } from './services/process-chat-turn.js';
import { loadConfig } from './config.js';
import { createWorker } from './index.js';
import { SpacetimeCoordinatorAdapter, type PendingJobSource } from './services/coordinator-adapter.js';
import type { PendingWorkItemSource } from './services/coordinator-adapter.js';
import type { WorkspaceWorkItem } from './services/process-work-item.js';

type WorkerPendingTurnRow = {
  conversationId: string;
  turnId: string;
  agentThreadId: string;
  correlationId: string;
  userMessageId: string;
  userContent: string;
  status: string;
  leaseUntilMicros: bigint | null;
  attempt: number;
  baseUiRevision: bigint;
};

type WorkerPendingWorkItemRow = {
  workItemId: string;
  workSetId: string;
  conversationId: string;
  entityType: string;
  entityId: string;
  kind: string;
  inputJson: string;
  status: string;
  leaseUntilMicros: bigint | null;
  attempt: number;
  expectedContextRevision: bigint;
  expectedUiRevision: bigint;
};

function rowToTurn(row: WorkerPendingTurnRow): ChatTurn | undefined {
  const claimedLeaseExpired = row.status === 'claimed'
    && row.leaseUntilMicros !== null
    && row.leaseUntilMicros <= BigInt(Date.now()) * 1_000n;
  if (row.status !== 'pending' && row.status !== 'retrying' && !claimedLeaseExpired) return undefined;
  return {
    conversationId: row.conversationId,
    turnId: row.turnId,
    correlationId: row.correlationId,
    agentThreadId: row.agentThreadId,
    userMessageId: row.userMessageId,
    userContent: row.userContent,
    attempt: row.attempt,
    baseUiRevision: row.baseUiRevision,
  };
}

async function connect(config: ReturnType<typeof loadConfig>): Promise<DbConnection> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const builder = DbConnection.builder()
      .withUri(config.SPACETIME_URL.replace(/^http/, 'ws'))
      .withDatabaseName(config.SPACETIME_DATABASE)
      .onConnect((connection) => {
        void connection.reducers.login({ username: config.AGENT_USERNAME, password: config.AGENT_PASSWORD })
          .then(() => connection.reducers.registerWorker({ workerLabel: config.WORKER_ID }))
          .then(() => {
            connection.subscriptionBuilder().onApplied(() => {
              if (!settled) {
                settled = true;
                resolve(connection);
              }
            }).subscribe(['SELECT * FROM worker_pending_turns', 'SELECT * FROM worker_pending_work_items']);
          })
          .catch((error: unknown) => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          });
      })
      .onConnectError((_context, error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
    builder.build();
  });
}

function rowToWorkItem(row: WorkerPendingWorkItemRow): WorkspaceWorkItem | undefined {
  const claimedLeaseExpired = row.status === 'claimed'
    && row.leaseUntilMicros !== null
    && row.leaseUntilMicros <= BigInt(Date.now()) * 1_000n;
  if (row.status !== 'pending' && row.status !== 'retrying' && !claimedLeaseExpired) return undefined;
  return {
    workItemId: row.workItemId,
    workSetId: row.workSetId,
    conversationId: row.conversationId,
    entityType: row.entityType,
    entityId: row.entityId,
    kind: row.kind,
    inputJson: row.inputJson,
    attempt: row.attempt,
    expectedContextRevision: row.expectedContextRevision,
    expectedUiRevision: row.expectedUiRevision,
  };
}

function createPendingWorkItemSource(connection: DbConnection): PendingWorkItemSource {
  const table = connection.db.worker_pending_work_items as any;
  let listener: ((item: WorkspaceWorkItem) => void) | undefined;
  const publish = (row: WorkerPendingWorkItemRow) => {
    const item = rowToWorkItem(row);
    if (item) listener?.(item);
  };
  return {
    subscribe(callback) {
      listener = callback;
      const onInsert = (_context: unknown, row: WorkerPendingWorkItemRow) => publish(row);
      table.onInsert(onInsert);
      return () => {
        table.removeOnInsert(onInsert);
        listener = undefined;
      };
    },
    async poll() {
      return [...table.iter()]
        .map((row: WorkerPendingWorkItemRow) => rowToWorkItem(row))
        .filter((item: WorkspaceWorkItem | undefined): item is WorkspaceWorkItem => Boolean(item));
    },
  };
}

function createPendingJobSource(connection: DbConnection): PendingJobSource {
  const table = connection.db.worker_pending_turns as any;
  let listener: ((turn: ChatTurn) => void) | undefined;

  const publish = (row: WorkerPendingTurnRow) => {
    const turn = rowToTurn(row);
    if (turn) listener?.(turn);
  };

  return {
    subscribe(callback) {
      listener = callback;
      const onInsert = (_context: unknown, row: WorkerPendingTurnRow) => publish(row);
      table.onInsert(onInsert);
      return () => {
        table.removeOnInsert(onInsert);
        listener = undefined;
      };
    },
    async poll() {
      return [...table.iter()]
        .map((row: WorkerPendingTurnRow) => rowToTurn(row))
        .filter((turn: ChatTurn | undefined): turn is ChatTurn => Boolean(turn));
    },
  };
}

const config = loadConfig();
const connection = await connect(config);
const jobs = createPendingJobSource(connection);
const workItems = createPendingWorkItemSource(connection);
const coordinator = new SpacetimeCoordinatorAdapter(connection as any, jobs, workItems, config.WORKER_LEASE_SECONDS);
const worker = createWorker({ coordinator, jobs, workItems }, config);

worker.start();
console.log(`AI worker started: ${config.WORKER_ID}`);

const shutdown = async () => {
  await worker.stop();
  connection.disconnect();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
