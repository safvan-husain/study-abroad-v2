import { DbConnection } from '@study-abroad/spacetimedb-bindings';
import type { ChatTurn } from './services/process-chat-turn.js';
import { loadConfig } from './config.js';
import { createWorker } from './index.js';
import { SpacetimeCoordinatorAdapter, type PendingJobSource } from './services/coordinator-adapter.js';
import { MongoMessageStore } from './services/mongo-message-store.js';

type JobRow = {
  conversationId: string;
  turnId: string;
  status: string;
};

function rowToTurn(row: JobRow, workerId: string): ChatTurn | undefined {
  if (row.status !== 'pending' && row.status !== 'retrying') return undefined;
  return {
    conversationId: row.conversationId,
    turnId: row.turnId,
    correlationId: row.turnId,
    workerId,
  };
}

async function connect(config: ReturnType<typeof loadConfig>): Promise<DbConnection> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const builder = DbConnection.builder()
      .withUri(config.SPACETIME_URL.replace(/^http/, 'ws'))
      .withDatabaseName(config.SPACETIME_DATABASE)
      .onConnect((connection) => {
        connection.subscriptionBuilder().onApplied(() => {
          if (!settled) {
            settled = true;
            resolve(connection);
          }
        }).subscribe('SELECT * FROM job');
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

function createPendingJobSource(connection: DbConnection, workerId: string): PendingJobSource {
  const table = connection.db.job as any;
  let listener: ((turn: ChatTurn) => void) | undefined;

  const publish = (row: JobRow) => {
    const turn = rowToTurn(row, workerId);
    if (turn) listener?.(turn);
  };

  return {
    subscribe(callback) {
      listener = callback;
      const onInsert = (_context: unknown, row: JobRow) => publish(row);
      const onUpdate = (_context: unknown, _oldRow: JobRow, row: JobRow) => publish(row);
      table.onInsert(onInsert);
      table.onUpdate(onUpdate);
      return () => {
        table.removeOnInsert(onInsert);
        table.removeOnUpdate(onUpdate);
        listener = undefined;
      };
    },
    async poll() {
      return [...table.iter()]
        .map((row: JobRow) => rowToTurn(row, workerId))
        .filter((turn: ChatTurn | undefined): turn is ChatTurn => Boolean(turn));
    },
  };
}

const config = loadConfig();
const connection = await connect(config);
const jobs = createPendingJobSource(connection, config.WORKER_ID);
const coordinator = new SpacetimeCoordinatorAdapter(connection as any, jobs, config.WORKER_LEASE_SECONDS);
const worker = createWorker({ store: new MongoMessageStore(), coordinator, jobs }, config);

worker.start();
console.log(`AI worker started: ${config.WORKER_ID}`);

const shutdown = async () => {
  await worker.stop();
  connection.disconnect();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
